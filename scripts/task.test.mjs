import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main, defaultBoard } from './task.mjs';
import { updateBoard } from '../records/task-record-store.mjs';
import { parseRecord, acceptanceStatus } from '../mods/task-evidence/task-record.js';
import { DECISION_HEADER, parseDecisions } from '../mods/task-evidence/decisions.js';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'task-cli-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const checkout = join(root, 'repo');
  execFileSync('git', ['init', '-q', checkout]);
  const board = join(root, 'state', 'board.json');
  const output = [];
  let clock = 0;
  const cli = (args, env = { HC_TERMINAL_ID: 't16' }) => main([...args, '--checkout', checkout, '--board', board],
    { env, cwd: root, now: () => `2026-11-01T00:00:0${clock++}Z`, out: line => output.push(line) });
  return { root, checkout, board, cli, output, json: async path => JSON.parse(await readFile(path, 'utf8')) };
}

test('start writes the coordinator record, brief, status and board entry', async t => {
  const f = await fixture(t);
  await f.cli(['start', '--task', 'fix-1', '--scope', 'mods/task-evidence', '--goal', 'Show agent status.']);
  const recordPath = join(f.checkout, '.herdr-tasks/fix-1/task.json');
  const { record, errors } = parseRecord(await readFile(recordPath, 'utf8'));
  assert.deepEqual(errors, []);
  assert.equal(record.coordinator, 't16');
  assert.equal(record.owner, 't16');
  assert.equal(record.activity, 'active');
  assert.equal(record.worker, null);
  assert.equal(record.receipt, null);
  assert.equal(record.handoff, '.herdr-tasks/fix-1/status.md');
  assert.match(await readFile(join(f.checkout, record.brief), 'utf8'), /## Goal\n\nShow agent status\./);
  assert.match(await readFile(join(f.checkout, record.handoff), 'utf8'), /\*\*Now:\*\* Started\./);
  const board = await f.json(f.board);
  assert.deepEqual(board.tasks, [{ label: 'fix-1 · repo', record: recordPath, machine: null }]);
  assert.match(f.output.at(-1), /hc label t16 task=fix-1/);
  await assert.rejects(f.cli(['start', '--task', 'fix-1', '--scope', 's', '--goal', 'g']), /already exists/);
});

for (const option of ['label', 'coordinator']) {
  test(`start rejects a blank --${option} without claiming the task, allowing a corrected retry`, async t => {
    const f = await fixture(t);
    const args = ['start', '--task', 'fix-1', '--scope', 's', '--goal', 'g'];
    await assert.rejects(f.cli([...args, `--${option}`, ' \t\n ']), new RegExp(option));
    await assert.rejects(readdir(join(f.checkout, '.herdr-tasks/fix-1')), { code: 'ENOENT' });
    await assert.rejects(readFile(f.board), { code: 'ENOENT' });

    await f.cli([...args, `--${option}`, option === 'label' ? 'Fixed label' : 't16']);
    const recordPath = join(f.checkout, '.herdr-tasks/fix-1/task.json');
    assert.equal((await f.json(recordPath)).coordinator, 't16');
    assert.deepEqual((await f.json(f.board)).tasks, [{
      label: option === 'label' ? 'Fixed label' : 'fix-1 · repo', record: recordPath, machine: null,
    }]);
  });
}

test('concurrent starts keep all task evidence owned by the successful coordinator', async t => {
  const f = await fixture(t);
  const owners = ['t1', 't2', 't3', 't4'];
  const results = await Promise.allSettled(owners.map(owner => f.cli(
    ['start', '--task', 'race', '--scope', owner, '--goal', `Goal ${owner}`, '--label', owner],
    { HC_TERMINAL_ID: owner })));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const winner = owners[results.findIndex(result => result.status === 'fulfilled')];
  const folder = join(f.checkout, '.herdr-tasks/race');
  const record = await f.json(join(folder, 'task.json'));
  assert.equal(record.coordinator, winner);
  assert.equal(record.scope, winner);
  assert.equal(await readFile(join(folder, 'brief.md'), 'utf8'),
    `# ${winner}\n\n## Goal\n\nGoal ${winner}\n\n## Scope\n\n${winner}\n\nOwner and coordinator: ${winner}\n`);
  const status = await readFile(join(folder, 'status.md'), 'utf8');
  assert.equal(status.split('\n').filter(line => line.startsWith('- ')).length, 1);
  const board = await f.json(f.board);
  assert.equal(board.sequence, 1);
  assert.deepEqual(board.tasks, [{ label: winner, record: join(folder, 'task.json'), machine: null }]);
});

test('start preserves evidence in an existing task folder without a record', async t => {
  const f = await fixture(t);
  const folder = join(f.checkout, '.herdr-tasks/partial');
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, 'brief.md'), 'Original brief');
  await assert.rejects(f.cli(['start', '--task', 'partial', '--scope', 's', '--goal', 'g']), /already exists/);
  assert.equal(await readFile(join(folder, 'brief.md'), 'utf8'), 'Original brief');
  await assert.rejects(readFile(join(folder, 'task.json')), { code: 'ENOENT' });
});

test('note, artifact and finish update status and reported activity, never acceptance', async t => {
  const f = await fixture(t);
  await f.cli(['start', '--task', 'fix-1', '--scope', 's', '--goal', 'g']);
  await f.cli(['note', '--task', 'fix-1', 'Running', 'checks\nnow']);
  await f.cli(['artifact', '--task', 'fix-1', 'docs/validation.md']);
  await f.cli(['artifact', '--task', 'fix-1', 'docs/validation.md']);
  await f.cli(['finish', '--task', 'fix-1', 'tests pass']);
  const status = await readFile(join(f.checkout, '.herdr-tasks/fix-1/status.md'), 'utf8');
  assert.match(status, /\*\*Now:\*\* Finished: tests pass/);
  assert.deepEqual(status.split('\n').filter(line => line.startsWith('- ')), [
    '- 2026-11-01T00:00:02Z — Finished: tests pass',
    '- 2026-11-01T00:00:01Z — Running checks now',
    '- 2026-11-01T00:00:00Z — Started.',
  ]);
  const record = await f.json(join(f.checkout, '.herdr-tasks/fix-1/task.json'));
  assert.deepEqual(record.artifacts, ['docs/validation.md']);
  assert.equal(record.activity, 'completed');
  assert.equal(record.sequence, 3);
  assert.equal(acceptanceStatus(record), 'unverified');
});

test('decide appends sanitized rows to the task decision log and names it once', async t => {
  const f = await fixture(t);
  await f.cli(['start', '--task', 'fix-1', '--scope', 's', '--goal', 'g']);
  const decide = (decision, extra = {}) => f.cli(['decide', '--task', 'fix-1', ...Object.entries({
    phase: 'layout', why: 'stale\tfallback', evidence: 'panel.png', result: 'errors: []', ...extra }).map(([k, v]) => `--${k}=${v}`), ...decision]);
  await decide(['Dropped', 'migration\nprops']);
  await decide(['Kept board'], { evidence: '=HYPERLINK("x")', result: '-1 entries' });
  const path = join(f.checkout, '.herdr-tasks/fix-1/decisions.tsv');
  assert.equal(await readFile(path, 'utf8'), [
    'ts\tphase\tdecision\twhy\tevidence\tresult',
    '2026-11-01T00:00:01Z\tlayout\tDropped migration props\tstale fallback\tpanel.png\terrors: []',
    `2026-11-01T00:00:02Z\tlayout\tKept board\tstale fallback\t'=HYPERLINK("x")\t'-1 entries`, ''].join('\n'));
  const record = await f.json(join(f.checkout, '.herdr-tasks/fix-1/task.json'));
  assert.equal(record.decisions, '.herdr-tasks/fix-1/decisions.tsv');
  assert.equal(record.sequence, 2);
  assert.deepEqual(parseRecord(JSON.stringify(record)).errors, []);

  await assert.rejects(decide(['x'], { why: ' ' }), /decide needs --why/);
  await assert.rejects(decide([]), /decide needs a decision/);
  await assert.rejects(f.cli(['decide', '--task', 'fix-1', '--phase', 'p', '--why', 'w', '--evidence', 'e', '--result', 'r', 'x'],
    { HC_TERMINAL_ID: 't20' }), /only the coordinator t16/);
  await writeFile(path, '# not a log\n');
  await assert.rejects(decide(['x']), /not a decision log/);
  assert.equal(await readFile(path, 'utf8'), '# not a log\n');
});

test('only the recorded coordinator may update a task', async t => {
  const f = await fixture(t);
  await f.cli(['start', '--task', 'fix-1', '--scope', 's', '--goal', 'g']);
  await assert.rejects(f.cli(['note', '--task', 'fix-1', 'hi'], { HC_TERMINAL_ID: 't20' }), /only the coordinator t16/);
  await assert.rejects(f.cli(['start', '--task', 'fix-2', '--scope', 's', '--goal', 'g'], {}), /--coordinator is required/);
  await assert.rejects(f.cli(['start', '--task', '../x', '--scope', 's', '--goal', 'g']), /one path segment/);
});

test('the checkout must be a repository root', async t => {
  const f = await fixture(t);
  execFileSync('mkdir', [join(f.checkout, 'sub')]);
  await assert.rejects(main(['start', '--task', 'x', '--scope', 's', '--goal', 'g', '--checkout', join(f.checkout, 'sub'), '--board', f.board],
    { env: { HC_TERMINAL_ID: 't16' }, out: () => {} }), /repository root/);
});

test('board add and remove keep newest first and refuse malformed boards', async t => {
  const f = await fixture(t);
  await f.cli(['board', 'add', '--run', '/r/.herdr-tasks/run/run.json', '--label', 'Roster']);
  await f.cli(['board', 'add', '--record', '/r/.herdr-tasks/a/task.json', '--label', 'A', '--machine', 'server']);
  await f.cli(['board', 'add', '--run', '/r/.herdr-tasks/run/run.json', '--label', 'Roster again']);
  assert.deepEqual((await f.json(f.board)).tasks.map(task => task.label), ['Roster again', 'A']);
  await f.cli(['board', 'remove', '--record', '/r/.herdr-tasks/a/task.json']);
  assert.equal((await f.json(f.board)).tasks.length, 2, 'machine is part of an entry identity');
  await f.cli(['board', 'remove', '--record', '/r/.herdr-tasks/a/task.json', '--machine', 'server']);
  assert.deepEqual((await f.json(f.board)).tasks.map(task => task.label), ['Roster again']);
  await assert.rejects(f.cli(['board', 'add', '--record', 'relative.json', '--label', 'x']), /absolute/);
  await writeFile(f.board, '{"schemaVersion":1,"sequence":1,"tasks":[{}]}');
  await assert.rejects(f.cli(['board', 'add', '--record', '/x/task.json', '--label', 'x']), /malformed/);
});

test('concurrent board updates all land, in sequence', async t => {
  const f = await fixture(t);
  await Promise.all(Array.from({ length: 8 }, (_, i) =>
    updateBoard(f.board, tasks => [{ label: `T${i}`, record: `/r/.herdr-tasks/t${i}/task.json`, machine: null }, ...tasks])));
  const board = await f.json(f.board);
  assert.equal(board.sequence, 8);
  assert.equal(board.tasks.length, 8);
});

test('the default board follows HERDR_ZSTACK_BOARD, then XDG_STATE_HOME', () => {
  assert.equal(defaultBoard({ HERDR_ZSTACK_BOARD: '/b.json', HOME: '/h' }), '/b.json');
  assert.equal(defaultBoard({ XDG_STATE_HOME: '/s', HOME: '/h' }), '/s/herdr-zstack/board.json');
  assert.equal(defaultBoard({ HOME: '/h' }), '/h/.local/state/herdr-zstack/board.json');
});

const decisionArgs = text => ['decide', '--task', 'race', '--phase=p', '--why=w', '--evidence=e', '--result=r', text];
const taskCLI = new URL('./task.mjs', import.meta.url).pathname;
const exec = promisify(execFile);
const childCLI = (f, args) => exec(process.execPath, [taskCLI, ...args, '--checkout', f.checkout,
  '--board', f.board, '--coordinator', 't16']);

for (const initialized of [false, true]) {
  test(`20 concurrent child decisions commit once each (${initialized ? 'existing' : 'fresh'} log)`, async t => {
    const f = await fixture(t);
    await f.cli(['start', '--task', 'race', '--scope', 's', '--goal', 'g']);
    if (initialized) await childCLI(f, decisionArgs('seed'));
    await Promise.all(Array.from({ length: 20 }, (_, i) => childCLI(f, decisionArgs(`row-${i}`))));
    const folder = join(f.checkout, '.herdr-tasks/race');
    const rows = parseDecisions(await readFile(join(folder, 'decisions.tsv'), 'utf8'));
    assert.equal(rows.length, initialized ? 21 : 20);
    assert.equal(new Set(rows.map(row => row.decision)).size, rows.length);
    assert.ok(rows.every(row => !row.malformed));
    const record = await f.json(join(folder, 'task.json'));
    assert.equal(record.sequence, 2);
    assert.equal(record.decisions, '.herdr-tasks/race/decisions.tsv');
  });
}

test('mixed child artifact, decide and finish commands preserve every record update', async t => {
  const f = await fixture(t);
  await f.cli(['start', '--task', 'race', '--scope', 's', '--goal', 'g']);
  await Promise.all([
    ...Array.from({ length: 20 }, (_, i) => childCLI(f, decisionArgs(`row-${i}`))),
    ...Array.from({ length: 20 }, (_, i) => childCLI(f, ['artifact', '--task', 'race', `file-${i}`])),
    childCLI(f, ['finish', '--task', 'race', 'done']),
  ]);
  const folder = join(f.checkout, '.herdr-tasks/race');
  const record = await f.json(join(folder, 'task.json'));
  assert.equal(record.artifacts.length, 20);
  assert.equal(new Set(record.artifacts).size, 20);
  assert.equal(record.activity, 'completed');
  assert.equal(record.sequence, 23);
  const rows = parseDecisions(await readFile(join(folder, 'decisions.tsv'), 'utf8'));
  assert.equal(rows.length, 20);
  assert.equal(new Set(rows.map(row => row.decision)).size, 20);
  assert.ok(rows.every(row => !row.malformed));
});

for (const previous of [DECISION_HEADER, `${DECISION_HEADER}\r\n`, `${DECISION_HEADER}\r\nt\tp\told\tw\te\tr`, `${DECISION_HEADER}\nt\tp\told\tw\te\tr`]) {
  test(`decide preserves imported log bytes and separates rows: ${JSON.stringify(previous)}`, async t => {
    const f = await fixture(t);
    await f.cli(['start', '--task', 'race', '--scope', 's', '--goal', 'g']);
    const path = join(f.checkout, '.herdr-tasks/race/decisions.tsv');
    await writeFile(path, previous);
    await childCLI(f, decisionArgs('new'));
    const text = await readFile(path, 'utf8');
    assert.ok(text.startsWith(previous + (previous.endsWith('\n') ? '' : '\n')));
    const rows = parseDecisions(text);
    assert.deepEqual(rows.map(row => row.decision), previous.includes('old') ? ['old', 'new'] : ['new']);
    assert.ok(rows.every(row => !row.malformed));
  });
}

test('invalid first decisions leave the record and log unchanged', async t => {
  const f = await fixture(t);
  await f.cli(['start', '--task', 'race', '--scope', 's', '--goal', 'g']);
  const folder = join(f.checkout, '.herdr-tasks/race');
  const record = await readFile(join(folder, 'task.json'), 'utf8');
  for (const key of ['phase', 'why', 'evidence', 'result']) {
    await assert.rejects(childCLI(f, decisionArgs('new').filter(arg => !arg.startsWith(`--${key}=`))));
  }
  await assert.rejects(childCLI(f, decisionArgs('')));
  await assert.rejects(readFile(join(folder, 'decisions.tsv')), { code: 'ENOENT' });
  await writeFile(join(folder, 'decisions.tsv'), 'wrong header\n');
  await assert.rejects(childCLI(f, decisionArgs('new')), /not a decision log/);
  assert.equal(await readFile(join(folder, 'task.json'), 'utf8'), record);
  assert.equal(await readFile(join(folder, 'decisions.tsv'), 'utf8'), 'wrong header\n');
});

test('task lock timeout leaves the record, status and log unchanged and never steals the lock', async t => {
  const f = await fixture(t);
  await f.cli(['start', '--task', 'race', '--scope', 's', '--goal', 'g']);
  const folder = join(f.checkout, '.herdr-tasks/race');
  const record = await readFile(join(folder, 'task.json'), 'utf8');
  const status = await readFile(join(folder, 'status.md'), 'utf8');
  await writeFile(join(folder, 'cli.lock'), 'owner');
  await assert.rejects(childCLI(f, decisionArgs('new')), /timed out waiting/);
  assert.equal(await readFile(join(folder, 'task.json'), 'utf8'), record);
  assert.equal(await readFile(join(folder, 'status.md'), 'utf8'), status);
  assert.equal(await readFile(join(folder, 'cli.lock'), 'utf8'), 'owner');
  await assert.rejects(readFile(join(folder, 'decisions.tsv')), { code: 'ENOENT' });
});

test('first-use registration failure cannot append a decision', async t => {
  const f = await fixture(t);
  await f.cli(['start', '--task', 'race', '--scope', 's', '--goal', 'g']);
  const folder = join(f.checkout, '.herdr-tasks/race');
  const record = await readFile(join(folder, 'task.json'), 'utf8');
  await writeFile(join(folder, 'task.json.lock'), 'acceptance owner');
  await assert.rejects(childCLI(f, decisionArgs('new')), /EEXIST/);
  assert.equal(await readFile(join(folder, 'task.json'), 'utf8'), record);
  assert.equal(await readFile(join(folder, 'task.json.lock'), 'utf8'), 'acceptance owner');
  await assert.rejects(readFile(join(folder, 'decisions.tsv')), { code: 'ENOENT' });
});
