import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { validateRecord } from '../mods/task-evidence/task-record.js';
import { validateBoard } from '../mods/task-evidence/board.js';

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

// Many coordinators share one board, so each update rereads it under the lock
// and applies `change(tasks)`. A busy lock is retried briefly, never stolen.
export async function updateBoard(path, change, { attempts = 40 } = {}) {
  await mkdir(dirname(path), { recursive: true });
  for (let attempt = 1; ; attempt++) {
    try {
      return await withFileLock(path, async () => {
        let previous;
        try { previous = JSON.parse(await readFile(path, 'utf8')); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        if (previous !== undefined && validateBoard(previous).length) throw new Error('existing board is malformed');
        const board = { schemaVersion: 1, sequence: (previous?.sequence ?? 0) + 1, tasks: change(previous?.tasks ?? []) };
        const errors = validateBoard(board);
        if (errors.length) throw new Error(errors.join('; '));
        await writeAtomic(path, `${JSON.stringify(board, null, 2)}\n`);
        return board;
      });
    } catch (error) {
      if (error.code !== 'EEXIST' || attempt >= attempts) throw error;
      await delay(25);
    }
  }
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
