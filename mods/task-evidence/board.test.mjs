import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBoard, readBoard, validateBoard, evidenceFolder, MAX_BOARD } from './board.js';

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
  assert.match((await readBoard(async () => null, '/b.json')).state, /no tracked tasks yet/);
  assert.match((await readBoard(async () => '{"schemaVersion":1}', '/b.json')).state, /Malformed board/);
  assert.match((await readBoard(async () => { throw new Error('denied'); }, '/b.json')).state, /unavailable: Error: denied/);
  let on;
  const { tasks } = await readBoard(async (_path, options) => { on = options.on; return JSON.stringify(board([entry('a', { machine: 'server' })])); }, '/b.json');
  assert.equal(on, null, 'the board itself is always read on this computer');
  assert.deepEqual(tasks, [{ label: 'Task a', record: '/repo/.herdr-tasks/a/task.json', machine: 'server', board: true }]);
});

test('the watched evidence folder is the checkout task folder', () => {
  assert.equal(evidenceFolder({ record: '/repo/.herdr-tasks/a/task.json' }), '/repo/.herdr-tasks');
  assert.equal(evidenceFolder({ run: '/repo/.herdr-tasks/r/run.json' }), '/repo/.herdr-tasks');
  assert.equal(evidenceFolder({ record: '/task.json' }), null);
});
