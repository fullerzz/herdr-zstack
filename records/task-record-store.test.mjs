import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withFileLock } from './task-record-store.mjs';

test('locks fail fast by default but opt-in waiters run after the owner releases', async t => {
  const root = await mkdtemp(join(tmpdir(), 'task-lock-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'record');
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  let entered;
  const acquired = new Promise(resolve => { entered = resolve; });
  const owner = withFileLock(path, async () => { entered(); await blocked; });
  await acquired;
  await assert.rejects(withFileLock(path, () => assert.fail('busy action ran')), { code: 'EEXIST' });
  const waiter = withFileLock(path, () => 'ran', { waitMs: 1000 });
  release();
  await owner;
  assert.equal(await waiter, 'ran');
  await assert.rejects(readFile(`${path}.lock`), { code: 'ENOENT' });
});

test('waiting timeout preserves the lock and does not run the action', async t => {
  const root = await mkdtemp(join(tmpdir(), 'task-lock-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'record');
  await writeFile(`${path}.lock`, 'owner');
  await assert.rejects(withFileLock(path, () => assert.fail('timed-out action ran'), { waitMs: 40 }), /timed out waiting/);
  assert.equal(await readFile(`${path}.lock`, 'utf8'), 'owner');
});

test('waiting never retries a failed action and releases its lock', async t => {
  const root = await mkdtemp(join(tmpdir(), 'task-lock-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'record');
  let calls = 0;
  await assert.rejects(withFileLock(path, () => {
    calls++;
    throw Object.assign(new Error('action failure'), { code: 'EEXIST' });
  }, { waitMs: 1000 }), /action failure/);
  assert.equal(calls, 1);
  await assert.rejects(readFile(`${path}.lock`), { code: 'ENOENT' });
});
