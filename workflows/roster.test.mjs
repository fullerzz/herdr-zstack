import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile, symlink, open } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateRun, parseRun, recordMemberAcceptance, observeMember, recordPath, runPath, MAX_ROSTER } from './roster.mjs';
import { writeRun, writeRecord } from '../records/task-record-store.mjs';
import { validateRecord } from '../records/task-record.js';

const fixture = async name => JSON.parse(await readFile(new URL(`../records/fixtures/${name}.json`, import.meta.url), 'utf8'));
const revision = { commit: 'a'.repeat(40), worktreeDigest: `sha256:${'c'.repeat(64)}` };
const member = (taskId, writes, checkout = '/work/pilot') => ({ taskId, checkout, writes });

test('run fixture is a valid index and not a task record', async () => {
  const run = await fixture('run');
  assert.deepEqual(validateRun(run), []);
  assert.notDeepEqual(validateRecord(run), []);
  assert.equal(recordPath(run.members[0], run), '/work/pilot/.herdr-tasks/pilot-a/task.json');
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

async function scratchRun({ persist = true } = {}) {
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
    await writeFile(recordPath(run.members[i], run), JSON.stringify(records[taskId]));
  }
  await mkdir(join(checkout, '.herdr-tasks', 'run-1'), { recursive: true });
  if (persist) await writeRun(runPath(run), run, { writer: 'parent' });
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
    assert.equal(JSON.parse(await readFile(recordPath(run.members[0], run))).sequence, 1);
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
    await writeFile(recordPath(run.members[0], run), JSON.stringify({ ...records.a, owner: 'parent' }));
    await assert.rejects(recordMemberAcceptance(run, 'a', inputs(observedByTask)), /own work/);
    await writeFile(recordPath(run.members[0], run), JSON.stringify(records.a));
    await assert.rejects(recordMemberAcceptance(run, 'c', inputs(observedByTask)), /not a run member/);
    await writeFile(recordPath(run.members[1], run), JSON.stringify({ ...records.b, taskId: 'other' }));
    await assert.rejects(recordMemberAcceptance(run, 'a', inputs(observedByTask)), /does not match/);
  } finally { await rm(checkout, { recursive: true, force: true }); }
});

test('run index writes are coordinator-only and sequence checked', async () => {
  const { checkout, run } = await scratchRun({ persist: false });
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

test('filesystem aliases cannot grant overlapping or protected writes', async () => {
  const { checkout, run } = await scratchRun();
  try {
    await mkdir(join(checkout, 'src'));
    await symlink('src', join(checkout, 'editable'));
    await symlink('.herdr-tasks', join(checkout, 'evidence'));
    await symlink('.', join(checkout, 'checkout-alias'));
    await symlink('missing', join(checkout, 'dangling'));
    const cases = [
      [member('a', ['shared.txt'], checkout), member('b', ['shared.txt'], `${checkout}/../${checkout.split('/').at(-1)}`)],
      [member('a', ['shared.txt'], checkout), member('b', ['shared.txt'], join(checkout, 'checkout-alias'))],
      [member('a', ['src/shared.txt'], checkout), member('b', ['editable/shared.txt'], checkout)],
      [member('a', ['src/Shared.txt'], checkout), member('b', ['src/shared.txt'], checkout)],
      [member('a', ['evidence/run-1/run.json'], checkout)],
      [member('a', ['.HERDR-TASKS/RUN-1/RUN.JSON'], checkout)],
      [member('a', ['dangling/file.txt'], checkout)],
    ];
    for (const members of cases) {
      const unsafe = { ...run, sequence: 2, members };
      assert.notDeepEqual(validateRun(unsafe), [], JSON.stringify(members));
      await assert.rejects(writeRun(runPath(run), unsafe, { writer: 'parent', expectedSequence: 1 }));
    }
    assert.equal(JSON.parse(await readFile(runPath(run))).sequence, 1);
    assert.deepEqual(validateRun({ ...run, members: [member('a', ['src/a.txt'], checkout),
      member('b', ['editable/b.txt'], checkout)] }), [], 'disjoint symlink targets stay usable');
  } finally { await rm(checkout, { recursive: true, force: true }); }
});

test('a containing member checkout cannot grant access to the coordinator index', async () => {
  const { checkout, run } = await scratchRun();
  try {
    const nested = { ...run, checkout: join(checkout, 'coordinator'),
      members: [member('a', ['coordinator/.herdr-tasks/run-1/run.json'], checkout)] };
    assert.notDeepEqual(validateRun(nested), []);
    await mkdir(join(nested.checkout, '.herdr-tasks', 'run-1'), { recursive: true });
    await assert.rejects(writeRun(runPath(nested), nested, { writer: 'parent' }));
  } finally { await rm(checkout, { recursive: true, force: true }); }
});

test('acceptance rejects stale and truncated run indexes while a sibling is live', async () => {
  const { checkout, run, observedByTask } = await scratchRun({ persist: false });
  try {
    const stale = { ...run, members: [run.members[0]] };
    await writeRun(runPath(run), stale, { writer: 'parent' });
    const current = { ...run, sequence: 2 };
    await writeRun(runPath(run), current, { writer: 'parent', expectedSequence: 1 });
    const live = { ...observedByTask, b: { ...observedByTask.b, state: 'live' } };
    await assert.rejects(recordMemberAcceptance(stale, 'a', inputs(live)), /stale run/);
    await assert.rejects(recordMemberAcceptance({ ...stale, sequence: 2 }, 'a', inputs(live)), /stale run/);
    await assert.rejects(recordMemberAcceptance(current, 'a', inputs(live)), /not confirmed finished/);
    const saved = JSON.parse(await readFile(recordPath(run.members[0], run)));
    assert.equal(saved.receipt, null);
    assert.equal(saved.sequence, 1);
  } finally { await rm(checkout, { recursive: true, force: true }); }
});

test('a foreign-machine member cannot satisfy the freeze guard', async () => {
  const { checkout, run, records, observedByTask } = await scratchRun();
  try {
    await writeFile(recordPath(run.members[1], run), JSON.stringify({ ...records.b, machine: 'remote' }));
    const foreign = { ...observedByTask, b: { ...observedByTask.b, machine: 'remote' } };
    await assert.rejects(recordMemberAcceptance(run, 'a', inputs(foreign)), /does not match/);
    assert.equal(JSON.parse(await readFile(recordPath(run.members[0], run))).receipt, null);
  } finally { await rm(checkout, { recursive: true, force: true }); }
});

test('ownership changed during acceptance cannot approve itself', { timeout: 5000 }, async () => {
  const { checkout, run, records, observedByTask } = await scratchRun();
  let gate;
  try {
    const aPath = recordPath(run.members[0], run);
    const bPath = recordPath(run.members[1], run);
    await rm(bPath);
    execFileSync('/usr/bin/mkfifo', [bPath]);
    const pending = recordMemberAcceptance(run, 'a', inputs(observedByTask));
    const rejected = assert.rejects(pending, /own work|stale sequence/);
    // Opening the writer waits until acceptance has read a and is reading b.
    gate = await open(bPath, 'w');
    await assert.rejects(writeRun(runPath(run), { ...run, sequence: 2 },
      { writer: 'parent', expectedSequence: 1 }), { code: 'EEXIST' });
    await writeRecord(aPath, { ...records.a, sequence: 2, owner: 'parent' }, { writer: 'parent', expectedSequence: 1 });
    await gate.writeFile(JSON.stringify(records.b));
    await gate.close(); gate = undefined;
    await rejected;
    const saved = JSON.parse(await readFile(aPath));
    assert.equal(saved.sequence, 2);
    assert.equal(saved.receipt, null);
    await writeRun(runPath(run), { ...run, sequence: 2 }, { writer: 'parent', expectedSequence: 1 });
  } finally {
    if (gate) await gate.close();
    await rm(checkout, { recursive: true, force: true });
  }
});

test('members must have distinct resolved task-record paths', async () => {
  const { checkout, run } = await scratchRun();
  try {
    await symlink('a', join(checkout, '.herdr-tasks', 'alias'));
    const collisions = [
      [member('WorkerA', ['a.txt'], checkout), member('workera', ['b.txt'], checkout)],
      [member('a', ['a.txt'], checkout), member('alias', ['b.txt'], checkout)],
    ];
    for (const members of collisions) {
      const unsafe = { ...run, sequence: 2, members };
      assert.match(validateRun(unsafe).join(), /duplicate member record/);
      await assert.rejects(writeRun(runPath(run), unsafe,
        { writer: 'parent', expectedSequence: 1 }), /duplicate member record/);
    }
    assert.equal(JSON.parse(await readFile(runPath(run))).sequence, 1);
  } finally { await rm(checkout, { recursive: true, force: true }); }
});

test('a Successor replaces a finished owner and is accepted at the restacked head', async () => {
  const { observeRevision } = await import('../records/task-record-store.mjs');
  const { acceptanceStatus } = await import('../records/task-record.js');
  const base = await mkdtemp(join(tmpdir(), 'hc-successor-'));
  const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
  try {
    const origin = join(base, 'origin');
    await mkdir(origin);
    git(origin, 'init', '-q', '-b', 'main');
    git(origin, 'config', 'user.email', 'test@example.invalid');
    git(origin, 'config', 'user.name', 'test');
    await writeFile(join(origin, 'a.txt'), '1\n');
    git(origin, 'add', '.');
    git(origin, 'commit', '-qm', 'base');
    const checkout = join(base, 'owner');
    git(origin, 'worktree', 'add', '-q', '-b', 'unit', checkout);
    await writeFile(join(checkout, 'a.txt'), '2\n');
    git(checkout, 'commit', '-qam', 'unit');
    const prHead = git(checkout, 'rev-parse', 'HEAD');

    const coordinator = join(base, 'coordinator');
    await mkdir(join(coordinator, '.herdr-tasks', 'run-1'), { recursive: true });
    const owner = taskId => member(taskId, ['a.txt'], checkout);
    const worker = n => ({ core: 'core-1', terminal: `t${n}`, occupant: `pid-${n}` });
    for (const [n, taskId] of [[1, 'own-1'], [2, 'own-2']]) {
      await mkdir(join(checkout, '.herdr-tasks', taskId), { recursive: true });
      await writeRecord(recordPath(owner(taskId), { checkout: coordinator, machine: 'local' }), { schemaVersion: 1, sequence: 1, taskId, coordinator: 'parent',
        machine: 'local', checkout, owner: `worker-${taskId}`, scope: 'a.txt', activity: 'active', worker: worker(n),
        revision: null, brief: 'brief.md', handoff: 'handoff.md', artifacts: [], receipt: null }, { writer: 'parent' });
    }
    const finished = (taskId, n, snapshot) => ({ [taskId]: { machine: 'local', checkout, worker: worker(n),
      reachable: true, state: 'finished', ...snapshot } });
    const accept = (run, taskId, n, snapshot) => recordMemberAcceptance(run, taskId, { writer: 'parent',
      observedByTask: finished(taskId, n, snapshot), before: snapshot, after: snapshot,
      checks: [{ command: 'node check.mjs', exitCode: 0, evidence: 'check.log' }] });
    const status = (record, snapshot) => acceptanceStatus(record, { machine: 'local', checkout, ...snapshot });

    // Head check: a clean owner worktree at the PR head yields the PR head's own snapshot.
    let run = { schemaVersion: 1, sequence: 1, runId: 'run-1', coordinator: 'parent', machine: 'local',
      checkout: coordinator, members: [owner('own-1')] };
    await writeRun(runPath(run), run, { writer: 'parent' });
    assert.equal(git(checkout, 'status', '--porcelain', '--untracked-files=all', '--', '.', ':(exclude).herdr-tasks'), '');
    const accepted = await accept(run, 'own-1', 1, await observeRevision(checkout));
    const fresh = join(base, 'fresh');
    git(origin, 'worktree', 'add', '-q', '--detach', fresh, prHead);
    assert.equal(accepted.receipt.revision.commit, prHead);
    assert.equal(accepted.receipt.revision.worktreeDigest, (await observeRevision(fresh)).worktreeDigest);

    // The Successor cannot share the index with its predecessor, so it replaces that entry.
    assert.match(validateRun({ ...run, sequence: 2, members: [owner('own-1'), owner('own-2')] }).join(), /overlaps/);
    const next = { ...run, sequence: 2, members: [owner('own-2')] };
    await writeRun(runPath(next), next, { writer: 'parent', expectedSequence: 1 });
    run = next;
    assert.equal(status(accepted, await observeRevision(checkout)), 'accepted');

    // A restack keeps the patch-id but moves the head: the old receipt goes stale, the Successor is accepted.
    const patchId = () => execFileSync('git', ['patch-id', '--stable'],
      { input: git(checkout, 'show', 'HEAD'), encoding: 'utf8' }).split(' ')[0];
    const before = patchId();
    await writeFile(join(origin, 'b.txt'), 'b\n');
    git(origin, 'add', 'b.txt');
    git(origin, 'commit', '-qm', 'parent moved');
    git(checkout, 'rebase', '-q', 'main');
    assert.equal(patchId(), before);
    const restacked = await observeRevision(checkout);
    assert.equal(status(accepted, restacked), 'stale');
    assert.equal(status(await accept(run, 'own-2', 2, restacked), restacked), 'accepted');
  } finally { await rm(base, { recursive: true, force: true }); }
});

test('the Head check compares digests because index flags hide edits from git status', async () => {
  const { observeRevision } = await import('../records/task-record-store.mjs');
  const base = await mkdtemp(join(tmpdir(), 'hc-head-check-'));
  const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
  try {
    const owner = join(base, 'owner');
    await mkdir(owner);
    git(owner, 'init', '-q');
    git(owner, 'config', 'user.email', 'test@example.invalid');
    git(owner, 'config', 'user.name', 'test');
    await writeFile(join(owner, 'a.txt'), '1\n');
    await writeFile(join(owner, 'b.txt'), '1\n');
    git(owner, 'add', '.');
    git(owner, 'commit', '-qm', 'head');
    const head = git(owner, 'rev-parse', 'HEAD');
    const fresh = join(base, 'fresh');
    git(owner, 'worktree', 'add', '-q', '--detach', fresh, head);
    assert.equal((await observeRevision(owner)).worktreeDigest, (await observeRevision(fresh)).worktreeDigest);
    git(owner, 'update-index', '--assume-unchanged', 'a.txt');
    git(owner, 'update-index', '--skip-worktree', 'b.txt');
    await writeFile(join(owner, 'a.txt'), '2\n');
    await writeFile(join(owner, 'b.txt'), '2\n');
    assert.equal(git(owner, 'status', '--porcelain', '--untracked-files=all'), '', 'status hides both edits');
    assert.equal(git(owner, 'rev-parse', 'HEAD'), head);
    assert.notEqual((await observeRevision(owner)).worktreeDigest, (await observeRevision(fresh)).worktreeDigest);
  } finally { await rm(base, { recursive: true, force: true }); }
});

test('a remote member keeps its record with the coordinator and its checkout is compared by text', async () => {
  const run = await fixture('run');
  const remote = (taskId, checkout, machine = 'remote-1') => ({ ...member(taskId, ['src/x.js'], checkout), machine });
  const one = { ...run, members: [run.members[0], remote('far', '/home/u/wt')] };
  assert.deepEqual(validateRun(one), []);
  assert.equal(recordPath(one.members[1], one), '/work/pilot/.herdr-tasks/far/task.json');
  assert.equal(recordPath({ ...one.members[1], machine: 'local' }, one), '/home/u/wt/.herdr-tasks/far/task.json', 'the index machine is local');
  assert.deepEqual(validateRun({ ...run, members: [remote('far', '/work/pilot')] }), [], 'a remote path may equal a local one');
  assert.deepEqual(validateRun({ ...run, members: [remote('a', '/wt'), remote('b', '/wt', 'remote-2')] }), [], 'machines differ');
  for (const [a, b] of [['/wt', '/wt'], ['/wt', '/wt/inner'], ['/WT', '/wt']])
    assert.match(validateRun({ ...run, members: [remote('a', a), remote('b', b)] }).join(), /distinct, non-nested/);
  assert.match(validateRun({ ...run, members: [remote('a', '/wt', 'x/y')] }).join(), /machine name/);
  assert.match(validateRun({ ...run, members: [member('a', ['.herdr-tasks/far/task.json']), remote('far', '/wt')] }).join(), /coordinator file/);
});

// Stands in for `hc exec --on <machine>`: runs the observer argv on this host.
const fixtureExec = async ({ argv }) => execFileSync(argv[0], argv.slice(1), { maxBuffer: 64 * 1024 * 1024 });

async function remoteRun({ terminal = 'remote-1/t3' } = {}) {
  const base = await mkdtemp(join(tmpdir(), 'hc-remote-run-'));
  const git = (...args) => execFileSync('git', ['-C', join(base, 'far'), ...args], { encoding: 'utf8' }).trim();
  const coordinator = join(base, 'coordinator');
  await mkdir(join(base, 'far'));
  git('init', '-q');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'test');
  await writeFile(join(base, 'far', 'x.txt'), '1\n');
  git('add', '.');
  git('commit', '-qm', 'base');
  await writeFile(join(base, 'far', 'x.txt'), 'dirty\n');
  const run = { schemaVersion: 1, sequence: 1, runId: 'run-1', coordinator: 'parent', machine: 'local', checkout: coordinator,
    members: [{ taskId: 'far', checkout: join(base, 'far'), writes: ['x.txt'], machine: 'remote-1' }] };
  const worker = { core: 'core-r', terminal, occupant: 'pid-9' };
  const record = { schemaVersion: 1, sequence: 1, taskId: 'far', coordinator: 'parent', machine: 'remote-1',
    checkout: run.members[0].checkout, owner: 'worker-far', scope: 'x.txt', activity: 'active', worker, revision: null,
    brief: join(coordinator, '.herdr-tasks/far/brief.md'), handoff: join(coordinator, '.herdr-tasks/far/handoff.md'), artifacts: [], receipt: null };
  for (const dir of ['far', 'run-1']) await mkdir(join(coordinator, '.herdr-tasks', dir), { recursive: true });
  await writeRecord(recordPath(run.members[0], run), record, { writer: 'parent' });
  await writeRun(runPath(run), run, { writer: 'parent' });
  return { base, run, record, worker };
}

const remoteInputs = (observed, snapshot = observed) => ({ writer: 'parent', observedByTask: { far: observed }, before: snapshot, after: snapshot,
  checks: [{ command: 'hc exec --on remote-1 -- sh check.sh', exitCode: 0, evidence: 'check.log' }] });

test('a remote member is accepted only from a revision observed on its own machine', async () => {
  const { observeRevision } = await import('../records/task-record-store.mjs');
  const { acceptanceStatus } = await import('../records/task-record.js');
  const { base, run, worker } = await remoteRun();
  try {
    const observed = await observeMember(run, 'far', { worker, state: 'finished' }, { exec: fixtureExec });
    assert.equal(observed.reachable, true);
    assert.equal(observed.machine, 'remote-1');
    const local = await observeRevision(run.members[0].checkout);
    assert.equal(observed.worktreeDigest, local.worktreeDigest, 'the fixture tree is the same one');
    // The same path observed locally, unlabelled or labelled with the coordinator's machine, never substitutes.
    const labelled = { ...local, machine: 'local', checkout: run.members[0].checkout };
    for (const substitute of [local, labelled])
      await assert.rejects(recordMemberAcceptance(run, 'far', remoteInputs(observed, substitute)), /before revision was not observed on remote-1/);
    await assert.rejects(recordMemberAcceptance(run, 'far', remoteInputs({ ...observed, ...labelled }, observed)), /observed revision was not observed on remote-1/);
    assert.equal(JSON.parse(await readFile(recordPath(run.members[0], run))).sequence, 1);
    const accepted = await recordMemberAcceptance(run, 'far', remoteInputs(observed));
    assert.equal(accepted.receipt.decision, 'accepted');
    assert.equal(accepted.worker.terminal, 'remote-1/t3');
    const revision = { commit: observed.commit, worktreeDigest: observed.worktreeDigest };
    assert.deepEqual(accepted.revision, revision, 'observation fields are not persisted');
    assert.deepEqual(accepted.receipt.revision, revision);
    assert.equal(acceptanceStatus(accepted, observed), 'accepted');
    assert.equal(acceptanceStatus(accepted, { ...local, machine: 'local', checkout: run.members[0].checkout }), 'unverified');
  } finally { await rm(base, { recursive: true, force: true }); }
});

test('an unreachable or failing remote machine stays fail-closed', async () => {
  const { reconcile } = await import('./worker-lifecycle.mjs');
  const { base, run, worker } = await remoteRun();
  try {
    const good = await observeMember(run, 'far', { worker, state: 'finished' }, { exec: fixtureExec });
    const failures = [
      await observeMember(run, 'far', { worker, state: 'finished', reachable: true, ...good }, { exec: async () => { throw new Error('machine_unreachable'); } }),
      await observeMember(run, 'far', { worker, state: 'finished' }, { exec: async () => Buffer.from('C deadbeef\n') }),
      await observeMember(run, 'far', null, { exec: fixtureExec }),
    ];
    for (const observed of failures) {
      assert.equal(observed.reachable, false);
      assert.equal(observed.commit, undefined, 'no revision from a failed observation');
      assert.equal(reconcile({ ...JSON.parse(await readFile(recordPath(run.members[0], run))), revision: good }, observed).state, 'unavailable');
      await assert.rejects(recordMemberAcceptance(run, 'far', remoteInputs(observed, good)), /not confirmed finished|not observed/);
    }
    const saved = JSON.parse(await readFile(recordPath(run.members[0], run)));
    assert.equal(saved.sequence, 1);
    assert.equal(saved.receipt, null);
  } finally { await rm(base, { recursive: true, force: true }); }
});

test('a remote worker address must be qualified with its machine', async () => {
  for (const terminal of ['t3', 'other/t3', 'remote-1/t3/x']) {
    const { base, run, worker } = await remoteRun({ terminal });
    try {
      const observed = await observeMember(run, 'far', { worker, state: 'finished' }, { exec: fixtureExec });
      await assert.rejects(recordMemberAcceptance(run, 'far', remoteInputs(observed)), /qualified as remote-1\/tN/);
    } finally { await rm(base, { recursive: true, force: true }); }
  }
});

test('a base-36 remote terminal ID counts as qualified', async () => {
  const { base, run, worker } = await remoteRun({ terminal: 'remote-1/t1h' });
  try {
    const observed = await observeMember(run, 'far', { worker, state: 'finished' }, { exec: fixtureExec });
    const updated = await recordMemberAcceptance(run, 'far', remoteInputs(observed));
    assert.equal(updated.receipt.decision, 'accepted');
  } finally { await rm(base, { recursive: true, force: true }); }
});
