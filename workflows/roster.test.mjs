import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateRun, parseRun, recordMemberAcceptance, recordPath, runPath, MAX_ROSTER } from './roster.mjs';
import { writeRun } from '../records/task-record-store.mjs';
import { validateRecord } from '../mods/task-evidence/task-record.js';

const fixture = async name => JSON.parse(await readFile(new URL(`../records/fixtures/${name}.json`, import.meta.url), 'utf8'));
const revision = { commit: 'a'.repeat(40), worktreeDigest: `sha256:${'c'.repeat(64)}` };
const member = (taskId, writes, checkout = '/work/pilot') => ({ taskId, checkout, writes });

test('run fixture is a valid index and not a task record', async () => {
  const run = await fixture('run');
  assert.deepEqual(validateRun(run), []);
  assert.notDeepEqual(validateRecord(run), []);
  assert.equal(recordPath(run.members[0]), '/work/pilot/.herdr-tasks/pilot-a/task.json');
  assert.equal(runPath(run), '/work/pilot/.herdr-tasks/roster-pilot/run.json');
  for (const name of ['accepted', 'active', 'completed-unverified', 'missing-worker', 'stale-revision'])
    assert.deepEqual(validateRecord(await fixture(name)), [], name);
});

test('roster is bounded, uniquely named and never reuses the run ID', async () => {
  const run = await fixture('run');
  assert.match(validateRun({ ...run, members: [] }).join(), /1-3/);
  const many = Array.from({ length: MAX_ROSTER + 1 }, (_, i) => member(`w${i}`, [`f${i}`]));
  assert.match(validateRun({ ...run, members: many }).join(), /1-3/);
  assert.match(validateRun({ ...run, members: [member('a', ['x']), member('a', ['y'])] }).join(), /duplicate/);
  assert.match(validateRun({ ...run, members: [member('roster-pilot', ['x'])] }).join(), /duplicate/);
  assert.match(validateRun({ ...run, members: [member('../a', ['x'])] }).join(), /segment/);
  assert.deepEqual(validateRun({ ...run, members: [member('solo', ['x'])] }), [], 'N=1 is the single-worker case');
});

test('writers in one checkout need disjoint files and cannot touch coordinator files', async () => {
  const run = await fixture('run');
  const conflict = members => validateRun({ ...run, members }).join();
  assert.match(conflict([member('a', ['src']), member('b', ['src/b.js'])]), /overlaps/);
  assert.match(conflict([member('a', ['src/a.js']), member('b', ['src/a.js/'])]), /overlaps/);
  assert.match(conflict([member('a', ['.herdr-tasks/b/task.json']), member('b', ['src/b.js'])]), /coordinator file/);
  assert.match(conflict([member('a', ['.herdr-tasks/a']), member('b', ['src/b.js'])]), /coordinator file/);
  assert.match(conflict([member('a', ['.herdr-tasks/roster-pilot/run.json'])]), /coordinator file/);
  for (const write of ['/etc/passwd', '../x', 'a/./b', '']) assert.match(conflict([member('a', [write])]), /relative/);
});

test('separate worktrees may share relative paths but not nest', async () => {
  const run = await fixture('run');
  assert.deepEqual(validateRun({ ...run, members: [member('a', ['src/x.js'], '/work/wt-a'), member('b', ['src/x.js'], '/work/wt-b')] }), []);
  assert.match(validateRun({ ...run, members: [member('a', ['x'], '/work/wt'), member('b', ['y'], '/work/wt/inner')] }).join(), /nested/);
});

test('malformed run JSON fails visibly', () => {
  assert.deepEqual(parseRun('{').errors, ['invalid JSON']);
  assert.equal(parseRun('{"schemaVersion":2}').run, null);
});

async function scratchRun() {
  const checkout = await mkdtemp(join(tmpdir(), 'hc-roster-'));
  const run = { schemaVersion: 1, sequence: 1, runId: 'run-1', coordinator: 'parent', machine: 'local', checkout,
    members: [member('a', ['a.txt'], checkout), member('b', ['b.txt'], checkout)] };
  const records = {};
  const observedByTask = {};
  for (const [i, { taskId }] of run.members.entries()) {
    const worker = { core: 'core-1', terminal: `t${i + 1}`, occupant: `pid-${i + 1}` };
    records[taskId] = { schemaVersion: 1, sequence: 1, taskId, coordinator: 'parent', machine: 'local', checkout,
      owner: `worker-${taskId}`, scope: `${taskId}.txt`, activity: 'active', worker, revision, brief: 'brief.md',
      handoff: 'handoff.md', artifacts: [], receipt: null };
    observedByTask[taskId] = { machine: 'local', checkout, worker, reachable: true, state: 'finished', ...revision };
    await mkdir(join(checkout, '.herdr-tasks', taskId), { recursive: true });
    await writeFile(recordPath(run.members[i]), JSON.stringify(records[taskId]));
  }
  await mkdir(join(checkout, '.herdr-tasks', 'run-1'), { recursive: true });
  return { checkout, run, records, observedByTask };
}

const inputs = observedByTask => ({ writer: 'parent', observedByTask, before: revision, after: revision,
  checks: [{ command: 'node check.mjs', exitCode: 0, evidence: 'check.log' }] });

test('member acceptance waits until every writer in the checkout is finished', async () => {
  const { checkout, run, observedByTask } = await scratchRun();
  try {
    const live = { ...observedByTask, b: { ...observedByTask.b, state: 'live' } };
    await assert.rejects(recordMemberAcceptance(run, 'a', inputs(live)), /b: writer is not confirmed finished/);
    const missing = { a: observedByTask.a };
    await assert.rejects(recordMemberAcceptance(run, 'a', inputs(missing)), /b: writer is not confirmed finished/);
    assert.equal(JSON.parse(await readFile(recordPath(run.members[0]))).sequence, 1);
    const a = await recordMemberAcceptance(run, 'a', inputs(observedByTask));
    const b = await recordMemberAcceptance(run, 'b', inputs(observedByTask));
    assert.deepEqual(a.receipt.revision, b.receipt.revision, 'both receipts bind one snapshot');
    assert.equal(a.worker.terminal, 't1');
    assert.equal(b.worker.terminal, 't2');
  } finally { await rm(checkout, { recursive: true, force: true }); }
});

test('no worker or non-coordinator can accept, and mismatched records are refused', async () => {
  const { checkout, run, records, observedByTask } = await scratchRun();
  try {
    await assert.rejects(recordMemberAcceptance(run, 'a', { ...inputs(observedByTask), writer: 'worker-a' }), /run coordinator/);
    await assert.rejects(recordMemberAcceptance({ ...run, coordinator: 'worker-b' }, 'a', { ...inputs(observedByTask), writer: 'worker-b' }), /does not match/);
    await writeFile(recordPath(run.members[0]), JSON.stringify({ ...records.a, owner: 'parent' }));
    await assert.rejects(recordMemberAcceptance(run, 'a', inputs(observedByTask)), /own work/);
    await writeFile(recordPath(run.members[0]), JSON.stringify(records.a));
    await assert.rejects(recordMemberAcceptance(run, 'c', inputs(observedByTask)), /not a run member/);
    await writeFile(recordPath(run.members[1]), JSON.stringify({ ...records.b, taskId: 'other' }));
    await assert.rejects(recordMemberAcceptance(run, 'a', inputs(observedByTask)), /does not match/);
  } finally { await rm(checkout, { recursive: true, force: true }); }
});

test('run index writes are coordinator-only and sequence checked', async () => {
  const { checkout, run } = await scratchRun();
  try {
    const path = runPath(run);
    await assert.rejects(writeRun(path, run, { writer: 'worker-a' }), /coordinator/);
    await writeRun(path, run, { writer: 'parent' });
    await assert.rejects(writeRun(path, { ...run, sequence: 2 }, { writer: 'parent', expectedSequence: 0 }), /stale/);
    await assert.rejects(writeRun(path, { ...run, sequence: 2, runId: 'run-2' }, { writer: 'parent', expectedSequence: 1 }), /identity/);
    await assert.rejects(writeRun(path, { ...run, sequence: 2, members: [member('a', ['x'], checkout), member('b', ['x'], checkout)] }, { writer: 'parent', expectedSequence: 1 }), /overlaps/);
    assert.equal(JSON.parse(await readFile(path)).sequence, 1);
  } finally { await rm(checkout, { recursive: true, force: true }); }
});
