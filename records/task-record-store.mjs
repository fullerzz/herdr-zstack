import { open, readFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { validateRecord } from '../mods/task-evidence/task-record.js';

// One coordinator owns each file. The lock rejects concurrent writers; sequence rejects stale updates.
async function writeLocked(path, value, { writer, expectedSequence, validate, identity }) {
  const errors = validate(value);
  if (errors.length) throw new Error(errors.join('; '));
  if (writer !== value.coordinator) throw new Error('only the coordinator may write');
  const lockPath = `${path}.lock`;
  const lock = await open(lockPath, 'wx', 0o600);
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    let previous;
    try { previous = JSON.parse(await readFile(path, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (previous !== undefined && validate(previous).length) throw new Error('existing record is malformed');
    if ((previous?.sequence ?? 0) !== expectedSequence || value.sequence !== expectedSequence + 1) throw new Error('stale sequence');
    if (previous && identity.some(key => previous[key] !== value[key])) throw new Error('record identity cannot change');
    const file = await open(temporary, 'wx', 0o600);
    try { await file.writeFile(`${JSON.stringify(value, null, 2)}\n`); await file.sync(); }
    finally { await file.close(); }
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
    await lock.close();
    await unlink(lockPath);
  }
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

// Freeze task writers before observing; git does not provide an atomic worktree snapshot.
export async function observeRevision(checkout) {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const { createHash } = await import('node:crypto');
  const { lstat, readlink, realpath } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const run = promisify(execFile);
  const git = async args => (await run('git', ['-C', checkout, ...args], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 })).stdout;
  const root = (await git(['rev-parse', '--show-toplevel'])).toString().trim();
  if (await realpath(checkout) !== await realpath(root)) throw new Error('checkout must be the repository root');
  const paths = ['--', '.', ':(exclude).herdr-tasks'];
  const commit = (await git(['rev-parse', 'HEAD'])).toString().trim();
  const staged = await git(['ls-files', '--stage', '-z', ...paths]);
  const tree = await git(['ls-tree', '-rz', 'HEAD']);
  const names = new Set((await git(['ls-files', '--others', '--exclude-standard', '-z', ...paths])).toString().split('\0').filter(Boolean));
  const submodules = new Set();
  for (const entry of `${tree}\0${staged}`.split('\0').filter(Boolean)) {
    const name = entry.slice(entry.indexOf('\t') + 1);
    if (name === '.herdr-tasks' || name.startsWith('.herdr-tasks/')) continue;
    names.add(name);
    if (entry.startsWith('160000 ')) submodules.add(name);
  }
  const hash = createHash('sha256');
  const part = value => { hash.update(String(value.length)); hash.update(':'); hash.update(value); };
  part(Buffer.from('raw-worktree-v1')); part(staged);
  for (const name of [...names].sort()) {
    const path = join(checkout, name);
    part(Buffer.from(name));
    let stat;
    try { stat = await lstat(path); }
    catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error;
      part(Buffer.from('missing')); continue;
    }
    if (stat.isDirectory() && submodules.has(name)) { part(Buffer.from('submodule')); continue; }
    if (!stat.isFile() && !stat.isSymbolicLink()) throw new Error(`Unsupported revision input: ${name}`);
    part(Buffer.from(String(stat.mode)));
    part(stat.isSymbolicLink() ? Buffer.from(await readlink(path)) : await readFile(path));
  }
  return { commit, worktreeDigest: `sha256:${hash.digest('hex')}` };
}
