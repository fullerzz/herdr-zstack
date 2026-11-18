import { open, readFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { validateRecord } from './task-record.js';

export async function withFileLock(path, action, { waitMs = 0 } = {}) {
  const lockPath = `${path}.lock`;
  const deadline = performance.now() + waitMs;
  let lock;
  for (;;) {
    try { lock = await open(lockPath, 'wx', 0o600); break; }
    catch (error) {
      if (error.code !== 'EEXIST' || waitMs === 0) throw error;
      const remaining = deadline - performance.now();
      if (remaining <= 0) throw new Error(`timed out waiting for ${lockPath}; inspect its owner before retrying`);
      await delay(Math.min(25, remaining));
    }
  }
  try { return await action(); }
  finally {
    await lock.close();
    await unlink(lockPath);
  }
}

// Readers see the old or the new complete file, never a partial write.
export async function writeAtomic(path, contents) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    const file = await open(temporary, 'wx', 0o600);
    try { await file.writeFile(contents); await file.sync(); }
    finally { await file.close(); }
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}

// One coordinator owns each file. The lock rejects concurrent writers; sequence rejects stale updates.
async function writeLocked(path, value, { writer, expectedSequence, validate, identity }) {
  const errors = validate(value);
  if (errors.length) throw new Error(errors.join('; '));
  if (writer !== value.coordinator) throw new Error('only the coordinator may write');
  return withFileLock(path, async () => {
    let previous;
    try { previous = JSON.parse(await readFile(path, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (previous !== undefined && validate(previous).length) throw new Error('existing record is malformed');
    if ((previous?.sequence ?? 0) !== expectedSequence || value.sequence !== expectedSequence + 1) throw new Error('stale sequence');
    if (previous && identity.some(key => previous[key] !== value[key])) throw new Error('record identity cannot change');
    await writeAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
  });
}

export async function writeRecord(path, record, { writer, expectedSequence = 0 }) {
  await writeLocked(path, record, { writer, expectedSequence, validate: validateRecord,
    identity: ['taskId', 'coordinator', 'machine', 'checkout'] });
}

// A run index groups member task records; it never holds worker bindings or receipts.
export async function writeRun(path, run, { writer, expectedSequence = 0 }) {
  const { validateRun } = await import('../workflows/roster.mjs');
  await writeLocked(path, run, { writer, expectedSequence, validate: validateRun,
    identity: ['runId', 'coordinator', 'machine', 'checkout'] });
}

// Git's revision-input commands, run in the checkout. A remote observer runs the same ones.
export const REVISION_PATHS = ['--', '.', ':(exclude).herdr-tasks'];
const S_IFMT = 0o170000, S_IFDIR = 0o040000, S_IFREG = 0o100000, S_IFLNK = 0o120000;

/**
 * The `raw-worktree-v1` digest over git's raw outputs and each path's lstat
 * mode and bytes. Local and remote observers share it, so equal inputs give
 * equal digests.
 * @param {{ commit: string, staged: Buffer, tree: Buffer, others: Buffer,
 *   entry: (name: string) => Promise<null | { mode: number, bytes: () => Promise<Buffer> }> }} inputs
 *   `entry` returns null for a missing path; `bytes` gives file content or the symlink target.
 */
export async function digestRevision({ commit, staged, tree, others, entry }) {
  const { createHash } = await import('node:crypto');
  const names = new Set(others.toString().split('\0').filter(Boolean));
  const submodules = new Set();
  for (const line of `${tree}\0${staged}`.split('\0').filter(Boolean)) {
    const name = line.slice(line.indexOf('\t') + 1);
    if (name === '.herdr-tasks' || name.startsWith('.herdr-tasks/')) continue;
    names.add(name);
    if (line.startsWith('160000 ')) submodules.add(name);
  }
  const hash = createHash('sha256');
  const part = value => { hash.update(String(value.length)); hash.update(':'); hash.update(value); };
  part(Buffer.from('raw-worktree-v1')); part(staged);
  for (const name of [...names].sort()) {
    part(Buffer.from(name));
    const found = await entry(name);
    if (!found) { part(Buffer.from('missing')); continue; }
    const type = found.mode & S_IFMT;
    if (type === S_IFDIR && submodules.has(name)) { part(Buffer.from('submodule')); continue; }
    if (type !== S_IFREG && type !== S_IFLNK) throw new Error(`Unsupported revision input: ${name}`);
    part(Buffer.from(String(found.mode)));
    part(await found.bytes());
  }
  return { commit, worktreeDigest: `sha256:${hash.digest('hex')}` };
}

// Freeze task writers before observing; git does not provide an atomic worktree snapshot.
export async function observeRevision(checkout) {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const { lstat, readlink, realpath } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const run = promisify(execFile);
  const git = async args => (await run('git', ['-C', checkout, ...args], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 })).stdout;
  const root = (await git(['rev-parse', '--show-toplevel'])).toString().trim();
  if (await realpath(checkout) !== await realpath(root)) throw new Error('checkout must be the repository root');
  const commit = (await git(['rev-parse', 'HEAD'])).toString().trim();
  const staged = await git(['ls-files', '--stage', '-z', ...REVISION_PATHS]);
  const tree = await git(['ls-tree', '-rz', 'HEAD']);
  const others = await git(['ls-files', '--others', '--exclude-standard', '-z', ...REVISION_PATHS]);
  return digestRevision({ commit, staged, tree, others, entry: async name => {
    const path = join(checkout, name);
    let stat;
    try { stat = await lstat(path); }
    catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error;
      return null;
    }
    return { mode: stat.mode, bytes: () => stat.isSymbolicLink() ? readlink(path, { encoding: 'buffer' }) : readFile(path) };
  } });
}
