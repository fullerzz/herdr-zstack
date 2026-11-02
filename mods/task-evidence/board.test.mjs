import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBoard, readBoard, validateBoard, evidenceFolder, completedTask, removeEntry, removedPath, MAX_BOARD } from './board.js';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { updateBoard } from '../../records/task-record-store.mjs';
import { addEntry } from '../../scripts/task.mjs';

const active = JSON.parse(await readFile(new URL('../../records/fixtures/active.json', import.meta.url), 'utf8'));
const run = JSON.parse(await readFile(new URL('../../records/fixtures/run.json', import.meta.url), 'utf8'));

test('clear requires completed durable activity, including every valid roster member', async () => {
  for (const value of [null, '{}', JSON.stringify(active), new Error('offline')]) {
    assert.equal(await completedTask(async () => { if (value instanceof Error) throw value; return value; }, {record: '/task.json'}), false);
  }
  let machine;
  assert.equal(await completedTask(async (_path, options) => { machine = options.on; return JSON.stringify({...active, activity: 'completed'}); }, {record: '/task.json', machine: 'server'}), true);
  assert.equal(machine, 'server');
  const records = Object.fromEntries(run.members.map(member => [`${member.checkout}/.herdr-tasks/${member.taskId}/task.json`, JSON.stringify({
    ...active, taskId: member.taskId, checkout: member.checkout, coordinator: run.coordinator, machine: run.machine, activity: 'completed',
  })]));
  const read = async path => path === '/run.json' ? JSON.stringify(run) : records[path] ?? null;
  assert.equal(await completedTask(read, {run: '/run.json'}), true);
  const first = Object.keys(records)[0];
  records[first] = JSON.stringify({...JSON.parse(records[first]), activity: 'active'});
  assert.equal(await completedTask(read, {run: '/run.json'}), false);
  delete records[first];
  assert.equal(await completedTask(read, {run: '/run.json'}), false);
  assert.equal(await completedTask(async () => '{}', {run: '/run.json'}), false);
});

const entry = (id, extra = {}) => ({ label: `Task ${id}`, record: `/repo/.herdr-tasks/${id}/task.json`, machine: null, ...extra });
const board = tasks => ({ schemaVersion: 1, sequence: 1, tasks });

test('a board names exactly one absolute record or run per entry', () => {
  assert.deepEqual(validateBoard(board([entry('a'), { label: 'Run', run: '/repo/.herdr-tasks/r/run.json' }])), []);
  for (const bad of [{ label: 'x' }, { label: 'x', record: 'relative/task.json' }, { label: 'x', record: '/a', run: '/b' },
    { record: '/a' }, { label: 'x', record: '/a', machine: '' }]) {
    assert.ok(validateBoard(board([bad])).length, JSON.stringify(bad));
  }
  assert.ok(validateBoard(board([entry('a'), entry('a')])).some(error => /duplicate/.test(error)));
  assert.ok(validateBoard(board([entry('a'), entry('a', { machine: 'server' })])).length === 0, 'machine distinguishes entries');
  assert.ok(validateBoard(board(Array.from({ length: MAX_BOARD + 1 }, (_, i) => entry(i)))).length);
  assert.ok(validateBoard({ ...board([]), schemaVersion: 2 }).length);
  assert.equal(parseBoard('{').board, null);
});

test('reading a board distinguishes missing, malformed and unavailable files', async () => {
  const missing = await readBoard(async () => null, '/b.json');
  assert.match(missing.state, /no tracked tasks yet/);
  assert.deepEqual(missing.tasks, [], 'a missing board lists no tasks');
  const malformed = await readBoard(async () => '{"schemaVersion":1}', '/b.json');
  assert.match(malformed.state, /Malformed board/);
  const unavailable = await readBoard(async () => { throw new Error('denied'); }, '/b.json');
  assert.match(unavailable.state, /unavailable: Error: denied/);
  assert.equal(malformed.tasks, null, 'unknown contents are not an empty board');
  assert.equal(unavailable.tasks, null);
  let on;
  const { tasks } = await readBoard(async (path, options) => { on = options.on; return path === '/b.json' ? JSON.stringify(board([entry('a', { machine: 'server' })])) : null; }, '/b.json');
  assert.equal(on, null, 'the board itself is always read on this computer');
  assert.deepEqual(tasks, [{ label: 'Task a', record: '/repo/.herdr-tasks/a/task.json', machine: 'server', added: null, board: true }]);
});

test('the watched evidence folder is the checkout task folder', () => {
  assert.equal(evidenceFolder({ record: '/repo/.herdr-tasks/a/task.json' }), '/repo/.herdr-tasks');
  assert.equal(evidenceFolder({ run: '/repo/.herdr-tasks/r/run.json' }), '/repo/.herdr-tasks');
  assert.equal(evidenceFolder({ record: '/task.json' }), null);
});


// A model of the host's writeTextFile: compare, then rename. `between` runs in that gap.
const hostWrite = (between = async () => {}) => async (path, text, expected) => {
  const current = await readFile(path, 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (current !== expected) throw new Error('The file changed outside Herdr.');
  await between();
  await writeFile(path, text);
};
const fsRead = path => readFile(path, 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error; });

test('a removal never writes the board, so a CLI commit during the host write survives', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'board-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'board.json');
  await updateBoard(path, addEntry(entry('a')));
  await updateBoard(path, addEntry(entry('b')));
  const { tasks } = await readBoard(fsRead, path);
  const a = tasks.find(task => task.label === 'Task a');
  const write = hostWrite(() => updateBoard(path, addEntry(entry('c'))));
  assert.equal(await removeEntry(fsRead, write, path, a), null);
  const onDisk = JSON.parse(await readFile(path, 'utf8'));
  assert.deepEqual(onDisk.tasks.map(task => task.label), ['Task c', 'Task b', 'Task a'], 'the CLI commit is kept; the board is untouched');
  assert.deepEqual((await readBoard(fsRead, path)).tasks.map(task => task.label), ['Task c', 'Task b']);
  assert.equal(removedPath(path), join(dir, 'board.removed.json'));
});

test('a removed entry shows again when re-added, and old removals are pruned', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'board-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'board.json');
  await updateBoard(path, addEntry(entry('a')));
  await updateBoard(path, addEntry(entry('b', { machine: 'server' })));
  await updateBoard(path, addEntry(entry('b')));
  const listed = async () => (await readBoard(fsRead, path)).tasks;
  const pick = async (label, machine = null) => (await listed()).find(task => task.label === label && task.machine === machine);
  assert.equal(await removeEntry(fsRead, hostWrite(), path, await pick('Task b')), null);
  assert.deepEqual((await listed()).map(task => [task.label, task.machine]), [['Task b', 'server'], ['Task a', null]], 'machine distinguishes entries');
  assert.equal(await removeEntry(fsRead, hostWrite(), path, await pick('Task a')), null);
  await updateBoard(path, addEntry(entry('a')));
  assert.deepEqual((await listed()).map(task => task.label), ['Task a', 'Task b'], 'a new addition is a new entry');
  await updateBoard(path, tasks => tasks.filter(task => task.machine === null));
  assert.equal(await removeEntry(fsRead, hostWrite(), path, await pick('Task a')), null);
  const list = JSON.parse(await readFile(removedPath(path), 'utf8'));
  assert.deepEqual(list.removed.map(r => r.record), [entry('b').record, entry('a').record], 'removals of entries gone from the board are dropped');
  assert.equal(list.removed.at(-1).added, 4);
  assert.deepEqual(await listed(), []);
});

test('removeEntry refuses unsafe lists and treats a missing entry as removed', async () => {
  const path = '/s/board.json';
  const source = JSON.stringify(board([entry('a')]));
  const target = { record: entry('a').record, machine: null, added: null };
  const store = files => {
    const writes = [];
    return { writes, read: async p => { if (files[p] instanceof Error) throw files[p]; return files[p] ?? null; },
      write: async (p, text, expected) => { writes.push(expected); if ((files[p] ?? null) !== expected) throw new Error('stale'); files[p] = text; } };
  };
  for (const [files, message] of [
    [{ [path]: '{' }, /Malformed board/],
    [{ [path]: source, [removedPath(path)]: '{"schemaVersion":1,"removed":[{}]}' }, /Malformed removed-task list/],
    [{ [path]: new Error('denied') }, /Board unavailable: Error: denied/],
  ]) {
    const s = store(files);
    assert.match(await removeEntry(s.read, s.write, path, target), message);
    assert.deepEqual(s.writes, []);
  }
  for (const files of [{}, { [path]: source }]) {
    const s = store(files);
    assert.equal(await removeEntry(s.read, s.write, path, { ...target, record: '/gone/task.json' }), null);
    assert.deepEqual(s.writes, []);
  }
  const created = store({ [path]: source });
  assert.equal(await removeEntry(created.read, created.write, path, target), null);
  assert.deepEqual(created.writes, [null], 'the first removal creates the list');
  const stale = store({ [path]: source });
  stale.write = async () => { throw new Error('stale snapshot'); };
  assert.match(await removeEntry(stale.read, stale.write, path, target), /Removed-task list changed; try again/);
  const unreadable = await readBoard(async p => p === path ? source : '{', path);
  assert.deepEqual(unreadable.tasks.map(task => task.label), ['Task a'], 'an unreadable list hides nothing');
  assert.match(unreadable.state, /Removed-task list unreadable/);
});

test('a board entry may record the sequence that added it', () => {
  assert.deepEqual(validateBoard(board([entry('a', { added: 3 })])), []);
  for (const added of [0, -1, 1.5, '3', null]) assert.ok(validateBoard(board([entry('a', { added })])).length, String(added));
});

test('a removal never prunes a newer removal against an older board read', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'board-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'board.json');
  await updateBoard(path, addEntry(entry('a')));
  const [a] = (await readBoard(fsRead, path)).tasks;
  let resume, paused;
  const reached = new Promise(resolve => { paused = resolve; });
  // Pause the first removal after its first read; then the CLI adds c and a second panel removes it.
  let reads = 0;
  const slowRead = async (p, options) => {
    const text = await fsRead(p, options);
    if (++reads === 1) { paused(); await new Promise(resolve => { resume = resolve; }); }
    return text;
  };
  const first = removeEntry(slowRead, hostWrite(), path, a);
  await reached;
  await updateBoard(path, addEntry(entry('c')));
  const c = (await readBoard(fsRead, path)).tasks.find(task => task.label === 'Task c');
  assert.equal(await removeEntry(fsRead, hostWrite(), path, c), null);
  resume();
  assert.match(await first, /Removed-task list changed; try again/, 'the older removal is refused, not pruned in');
  assert.deepEqual((await readBoard(fsRead, path)).tasks.map(task => task.label), ['Task a']);
  assert.equal(await removeEntry(fsRead, hostWrite(), path, a), null, 'a retry succeeds');
  assert.deepEqual((await readBoard(fsRead, path)).tasks, []);
});
