import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DECISION_HEADER, decisionCell } from "./decisions.js";

const main = await readFile(new URL("./main.js", import.meta.url), "utf8");
// Host modules become one stub; sibling modules load from disk, as the installer ships them.
const hostImport = /^import (.*) from "(gpui-kit|gpui-base|herdr)";$/gm;
const siblingImport = /from "\.\/([\w-]+\.js)";/g;
async function panel(read, props = {}) {
  const callbacks = [];
  const key = `taskEvidenceTest${Math.random()}`;
  globalThis[key] = { read, spaces: [], terminals: [], watch: () => new Promise(() => {}), props: { notes: "/notes.md", artifacts: [{ path: "/checks.log" }], ...props } };
  const host = `const h = globalThis[${JSON.stringify(key)}];
    export const View = class {}; export const readTextFile = (...args) => h.read(...args); export const spaces = () => h.spaces; export const props = () => h.props;
    export const theme = () => ({}); export const agents = () => []; export const terminals = () => h.terminals; export const run = () => null;
    export const watchFolder = path => h.watch(path); export const writeTextFile = (...args) => h.write(...args);
    export const div = () => { const node = {items: [], styles: {}}; let builder;
      builder = new Proxy(node, {get(target, name) {
        if (name in target) return target[name];
        return (...args) => {
          if (name === 'child') node.items.push(args[0]);
          else if (name === 'children') node.items.push(...args[0]);
          else if (name === 'when') { if (args[0]) args[1](builder); }
          else node.styles[name] = args;
          return builder;
        };
      }}); return builder;
    };
    export const v_flex = div, h_flex = div; export const TextView = {markdown: (id, text) => div().id(id).child(text)};\n`;
  const hostUrl = `data:text/javascript;base64,${Buffer.from(host).toString("base64")}`;
  const source = main.replace(hostImport, (_line, names) => `import ${names} from "${hostUrl}";`)
    .replace(siblingImport, (_match, file) => `from "${new URL(`./${file}`, import.meta.url)}";`);
  const { default: Panel } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  const instance = new Panel();
  const cx = { spawn: fn => callbacks.push(fn), notify() {} };
  instance.init(undefined, cx);
  return { instance, cx, callbacks, host: globalThis[key], cleanup: () => delete globalThis[key] };
}

test("root mod reads layout configuration from herdr.props", async () => {
  let path;
  const p = await panel(async value => { path = value; return "task notes"; }, { title: "Configured task", folder: "/task", notes: "notes.md" });
  assert.equal(p.instance.config.title, "Configured task");
  assert.equal(p.instance.files[0].path, "/task/notes.md");
  await p.callbacks.shift()(p.cx);
  assert.equal(path, "/task/notes.md");
  assert.equal(p.instance.snapshot.text, "task notes");
  p.cleanup();
});

test("slow previous selection never replaces newer record", async () => {
  let finish;
  const p = await panel(path => path === "/notes.md" ? new Promise(resolve => { finish = resolve; }) : Promise.resolve("checks"));
  const previous = p.callbacks.shift()(p.cx);
  p.instance.selected = 1;
  p.instance.load(p.cx);
  assert.equal(p.instance.snapshot, null);
  await p.callbacks.shift()(p.cx);
  finish("old notes");
  await previous;
  assert.equal(p.instance.snapshot.text, "checks");
  p.cleanup();
});

test("absent, empty and failed reads remain distinct", async () => {
  for (const value of [null, "", new Error("exceeds 1 MiB")]) {
    const p = await panel(async () => { if (value instanceof Error) throw value; return value; });
    assert.equal(p.instance.loading, true);
    await p.callbacks.shift()(p.cx);
    assert.equal(p.instance.loading, false);
    if (value instanceof Error) assert.match(p.instance.snapshot.error, /exceeds 1 MiB/);
    else assert.equal(p.instance.snapshot.text, value);
    p.cleanup();
  }
});

test("unresolved explicit remote space never reads local files", async () => {
  let reads = 0;
  const p = await panel(async () => { reads++; }, { space: "remote/unknown" });
  await p.callbacks.shift()(p.cx);
  assert.equal(reads, 0);
  assert.match(p.instance.snapshot.error, /Space unavailable/);
  p.cleanup();
});

test("explicit remote machine is passed to file reader", async () => {
  let options;
  const p = await panel(async (_path, opts) => { options = opts; return "remote notes"; }, { machine: "server", space: "server/task" });
  await p.callbacks.shift()(p.cx);
  assert.deepEqual(options, { on: "server" });
  p.cleanup();
});

const active = JSON.parse(await readFile(new URL('../../records/fixtures/active.json', import.meta.url), 'utf8'));
test('Clear dismisses completed board tasks, preserves other entries and ignores stale reads', async () => {
  const p = await panel(async path => path === '/done.json' ? JSON.stringify({...active, activity: 'completed'}) : path === '/active.json' ? JSON.stringify(active) : null,
    {tasks: [{record: '/configured.json'}]});
  const boardTasks = [{record: '/done.json', board: true}, {record: '/active.json', board: true}, {record: '/missing.json', board: true}];
  p.instance.applyBoard(p.cx, boardTasks);
  p.instance.taskIndex = 1;
  p.instance.loadTask(p.cx);
  const stale = p.callbacks.pop();
  p.callbacks.length = 0;
  const tree = p.instance.render(p.cx);
  byId(tree, 'clear').styles.on_click[0](undefined, p.cx);
  byId(tree, 'clear').styles.on_click[0](undefined, p.cx);
  assert.equal(p.callbacks.length, 1, 'duplicate clicks start only one clear');
  await p.callbacks.shift()(p.cx);
  assert.deepEqual(p.instance.tasks.map(task => task.record), ['/configured.json', '/active.json', '/missing.json']);
  assert.equal(p.instance.taskIndex, 0);
  await stale(p.cx);
  assert.equal(p.instance.record, null, 'dismissed task read cannot replace the new selection');
  p.instance.applyBoard(p.cx, boardTasks);
  byId(p.instance.render(p.cx), 'refresh').styles.on_click[0](undefined, p.cx);
  assert.equal(p.instance.tasks.some(task => task.record === '/done.json'), false, 'board notifications and Refresh keep it dismissed');
  p.cleanup();
});

test('clearing the last board task returns to manual evidence', async () => {
  const p = await panel(async () => JSON.stringify({...active, activity: 'completed'}));
  p.instance.applyBoard(p.cx, [{record: '/done.json', board: true}]);
  p.callbacks.length = 0;
  p.instance.clearCompleted(p.cx);
  await p.callbacks.shift()(p.cx);
  assert.deepEqual(p.instance.tasks, []);
  assert.equal(p.instance.record, null);
  assert.equal(p.instance.files[0].path, '/notes.md');
  p.cleanup();
});
test('long metadata and artifact selectors stay in a separate bounded scroll region', async () => {
  const p = await panel(async () => 'document', {artifacts: Array.from({length: 20}, (_, i) => ({path: `/long/worker/evidence/${i}.md`}))});
  p.instance.record = {...active, worker: {core: 'long-core/'.repeat(40), terminal: 't1', occupant: 'long-occupant/'.repeat(40)}};
  const tree = p.instance.render(p.cx);
  const [header, metadata, document] = tree.items;
  assert.equal(tree.items.length, 3);
  assert.deepEqual(header.styles.flex_shrink_0, []);
  for (const region of [metadata, document]) {
    assert.deepEqual(region.styles.flex_1, []);
    assert.deepEqual(region.styles.min_h, [0]);
    assert.deepEqual(region.styles.overflow_y_scrollbar, []);
  }
  assert.deepEqual(metadata.items[0].styles.flex_shrink_0, []);
  const descendants = node => typeof node === 'string' ? [node] : [node, ...node.items.flatMap(descendants)];
  const metadataNodes = descendants(metadata);
  assert.ok(metadataNodes.some(node => typeof node !== 'string' && node.styles.id?.[0] === 'file-20'));
  assert.ok(metadataNodes.some(node => typeof node === 'string' && node.includes(p.instance.record.worker.core)));
  assert.ok(descendants(header).some(node => typeof node !== 'string' && node.styles.id?.[0] === 'refresh'));
  p.cleanup();
});

test('record selection and refresh discard older task reads', async () => {
  let finish;
  const p = await panel(path => path === '/old.json' ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(path === '/new.json' ? JSON.stringify({...active, taskId:'new'}) : 'brief'), { tasks:[{record:'/old.json'}, {record:'/new.json'}] });
  const old = p.callbacks.shift()(p.cx);
  p.instance.taskIndex = 1;
  p.instance.loadTask(p.cx);
  await p.callbacks.shift()(p.cx);
  finish(JSON.stringify(active)); await old;
  assert.equal(p.instance.record.taskId,'new');
  assert.equal(p.instance.files[0].path, `${active.checkout}/${active.brief}`);
  const brief = p.callbacks.shift();
  p.instance.loadTask(p.cx);
  assert.equal(p.instance.record,null);
  await brief(p.cx);
  await p.callbacks.shift()(p.cx);
  assert.equal(p.instance.record.taskId,'new');
  p.cleanup();
});

test('task reads distinguish missing, malformed, unavailable and stale receipt', async () => {
  const stale = await readFile(new URL('../../records/fixtures/stale-revision.json', import.meta.url),'utf8');
  for (const [value, expected] of [[null,/missing/],['{}',/Malformed/],[new Error('offline'),/unavailable/],[stale,/stale/]]) {
    const p = await panel(async () => {if(value instanceof Error) throw value; return value;}, {record:'/task.json'});
    await p.callbacks.shift()(p.cx);
    assert.match(p.instance.recordState,expected);
    if(value !== stale) assert.deepEqual(p.instance.files,[]);
    p.cleanup();
  }
});

const run = JSON.parse(await readFile(new URL('../../records/fixtures/run.json', import.meta.url), 'utf8'));
const accepted = JSON.parse(await readFile(new URL('../../records/fixtures/accepted.json', import.meta.url), 'utf8'));
const memberPath = id => `${run.checkout}/.herdr-tasks/${id}/task.json`;
const rosterFiles = (overrides = {}) => ({
  '/idx/run.json': JSON.stringify(run),
  [memberPath('pilot-a')]: JSON.stringify({...active, taskId: 'pilot-a', owner: 'worker-a', worker: {core: 'c', terminal: 't5', occupant: 'o'}}),
  [memberPath('pilot-b')]: JSON.stringify({...accepted, taskId: 'pilot-b', owner: 'worker-b', worker: null}),
  ...overrides,
});
const texts = node => typeof node === 'string' ? [node] : node.items.flatMap(texts);
function byId(node, id) { return typeof node === 'string' ? null : node.styles.id?.[0] === id ? node : node.items.map(child => byId(child, id)).find(Boolean) ?? null; }
async function rosterPanel(entries) {
  const reads = [];
  const p = await panel(async path => { reads.push(path); return entries[path] ?? null; }, {tasks: [{label: 'Roster', run: '/idx/run.json'}]});
  await p.callbacks.shift()(p.cx);
  await p.callbacks.shift()(p.cx);
  return {...p, reads, entries};
}

test('roster view shows per-member labels, binding status and receipt snapshots without aggregate acceptance', async () => {
  const p = await rosterPanel(rosterFiles());
  p.host.terminals = [{address: 't5', labels: {run: 'roster-pilot', task: 'pilot-a', role: 'worker'}, state: 'live', status: 'working'},
    {address: 't6', labels: {run: 'roster-pilot', task: 'pilot-a', role: 'process'}, state: 'live'}];
  const lines = texts(p.instance.render(p.cx));
  assert.ok(lines.includes('pilot-a · worker-a · active (reported)'));
  assert.ok(lines.includes('pilot-b · worker-b · completed (reported)'));
  assert.ok(lines.some(line => /Saved binding t5 \(unconfirmed\): address is live/.test(line)));
  assert.ok(lines.includes('No worker binding recorded.'));
  assert.ok(lines.includes(`RECEIPT SNAPSHOT: accepted · ${accepted.receipt.revision.commit.slice(0, 12)}`));
  assert.ok(lines.includes('t6 · role=process · live'));
  assert.ok(lines.some(line => /no aggregate acceptance/.test(line)));
  assert.ok(!lines.some(line => /^Acceptance: accepted/.test(line)), 'a saved receipt is never current acceptance');
  assert.deepEqual(p.reads, ['/idx/run.json', memberPath('pilot-a'), memberPath('pilot-b'), `${run.checkout}/${active.brief}`]);
  p.cleanup();
});

test('selecting a member shows its own evidence files', async () => {
  const p = await rosterPanel(rosterFiles());
  byId(p.instance.render(p.cx), 'member-1').styles.on_click[0](undefined, p.cx);
  assert.equal(p.instance.record.taskId, 'pilot-b');
  const paths = [accepted.brief, ...accepted.artifacts, ...accepted.receipt.evidence, accepted.handoff].map(path => path.startsWith('/') ? path : `${run.checkout}/${path}`);
  assert.deepEqual(p.instance.files.map(f => f.path), paths);
  assert.equal(p.callbacks.length, 1, 'only the selected file is read');
  p.cleanup();
});

test('unreadable members stay listed and clear their evidence', async () => {
  const p = await rosterPanel(rosterFiles({[memberPath('pilot-b')]: '{'}));
  byId(p.instance.render(p.cx), 'member-1').styles.on_click[0](undefined, p.cx);
  assert.equal(p.instance.record, null);
  assert.deepEqual(p.instance.files, []);
  const lines = texts(p.instance.render(p.cx));
  assert.ok(lines.includes('Malformed task record: invalid JSON'));
  assert.ok(lines.includes('The selected member has no readable record, so it has no evidence files.'));
  p.cleanup();
});

test('core fact changes reread records once, keeping selection and evidence visible', async () => {
  const p = await rosterPanel(rosterFiles());
  const worker = {address: 't5', labels: {run: 'roster-pilot', task: 'pilot-a', role: 'worker'}, state: 'live', status: 'working'};
  p.host.terminals = [worker];
  p.instance.render(p.cx);
  assert.equal(p.callbacks.length, 1, 'first observation after a read is a fact change');
  await p.callbacks.shift()(p.cx);
  await p.callbacks.shift()(p.cx);
  p.instance.render(p.cx);
  assert.equal(p.callbacks.length, 0, 'unchanged facts do not reread');
  p.host.terminals = [worker, {address: 't30', labels: {run: 'other'}, state: 'live'}];
  p.instance.render(p.cx);
  assert.equal(p.callbacks.length, 0, 'unrelated terminals do not reread');

  byId(p.instance.render(p.cx), 'member-1').styles.on_click[0](undefined, p.cx);
  await p.callbacks.shift()(p.cx);
  p.instance.selected = 1; p.instance.load(p.cx); await p.callbacks.shift()(p.cx);
  const shown = p.instance.snapshot;
  p.entries[memberPath('pilot-b')] = JSON.stringify({...accepted, taskId: 'pilot-b', owner: 'worker-b', worker: null, activity: 'active'});
  p.host.terminals = [{...worker, status: 'idle'}];
  p.instance.render(p.cx);
  p.instance.render(p.cx);
  assert.equal(p.callbacks.length, 1, 'one reread while a read is pending');
  assert.equal(p.instance.snapshot, shown, 'evidence stays visible during the reread');
  await p.callbacks.shift()(p.cx);
  assert.equal(p.instance.record.activity, 'active');
  assert.equal(p.instance.memberIndex, 1);
  assert.equal(p.instance.selected, 1);
  assert.equal(p.instance.snapshot, shown);
  await p.callbacks.shift()(p.cx);
  assert.equal(p.instance.files[1].path, p.reads.at(-1));
  p.cleanup();
});

test('facts changing during a reread trigger another; manual refresh clears first', async () => {
  let finish;
  const entries = rosterFiles();
  const reads = [];
  const p = await panel(path => { reads.push(path); return path === '/idx/run.json' && finish === null ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(entries[path] ?? null); },
    {tasks: [{label: 'Roster', run: '/idx/run.json'}]});
  p.host.terminals = [];
  finish = undefined;
  await p.callbacks.shift()(p.cx);
  await p.callbacks.shift()(p.cx);
  finish = null;
  p.host.terminals = [{address: 't5', labels: {}, state: 'live'}];
  p.instance.render(p.cx);
  const pending = p.callbacks.shift()(p.cx);
  p.host.terminals = [{address: 't5', labels: {}, state: 'finished'}];
  finish(entries['/idx/run.json']); await pending;
  p.instance.render(p.cx);
  assert.equal(p.callbacks.length, 2, 'selected file reread plus a second record reread');

  byId(p.instance.render(p.cx), 'refresh').styles.on_click[0](undefined, p.cx);
  assert.equal(p.instance.roster, null);
  assert.deepEqual(p.instance.members, []);
  assert.equal(p.instance.recordState, 'Reading run index…');
  p.cleanup();
});

test('panel host surface reads, navigates and writes only the configured board', () => {
  const imported = [...main.matchAll(/^import \{([^}]*)\} from "herdr";$/gm)].flatMap(m => m[1].split(',').map(name => name.trim()));
  assert.deepEqual(imported.sort(), ['agents', 'props', 'readTextFile', 'run', 'spaces', 'terminals', 'theme', 'watchFolder', 'writeTextFile']);
  assert.deepEqual([...main.matchAll(/writeTextFile[^\n]*/g)].map(m => m[0]).slice(1),
    ['writeTextFile, this.config.board, boardKey(task));'], 'the write goes only through removeEntry on the board');
  assert.deepEqual([...main.matchAll(/run\("([^"]+)"/g)].map(m => m[1]), ['agent.focus'], 'navigation is the only command');
});

const boardPath = '/state/herdr-zstack/board.json';
const boardRecord = id => `/repo/.herdr-tasks/${id}/task.json`;
const boardFile = ids => JSON.stringify({schemaVersion: 1, sequence: ids.length + 1, tasks: ids.map(id => ({label: `Task ${id}`, record: boardRecord(id), machine: null}))});
const boardTask = id => JSON.stringify({...active, taskId: id, checkout: '/repo', brief: `.herdr-tasks/${id}/brief.md`, handoff: `.herdr-tasks/${id}/status.md`, artifacts: []});
const flush = () => new Promise(resolve => setImmediate(resolve));
// Watch loops run until closed, so tests start them and flush instead of awaiting them.
async function boardPanel(entries, props = {}) {
  const reads = [], watches = [];
  const p = await panel(async path => { reads.push(path); return entries[path] ?? null; }, {board: boardPath, ...props});
  p.host.watch = path => new Promise(resolve => watches.push({path, resolve}));
  p.callbacks.shift()(p.cx);  // board loop
  p.callbacks.shift();        // initial manual-mode read, superseded once the board lists tasks
  await flush();
  return {...p, reads, watches, entries, close: async () => { p.instance.close(); watches.forEach(w => w.resolve([])); await flush(); p.cleanup(); }};
}

test('board tasks appear after the board is read and select the newest entry', async () => {
  const p = await boardPanel({[boardPath]: boardFile(['b', 'a']), [boardRecord('b')]: boardTask('b')});
  assert.deepEqual(p.instance.tasks.map(t => t.label), ['Task b', 'Task a']);
  assert.ok(texts(p.instance.render(p.cx)).some(line => /Board: 2 tracked tasks/.test(line)));
  p.callbacks.shift()(p.cx);  // evidence-folder watch loop
  await p.callbacks.shift()(p.cx);
  assert.equal(p.instance.record.taskId, 'b');
  assert.equal(p.instance.files[p.instance.selected].label, 'Handoff', 'a board task opens on its status');
  p.host.terminals = [{address: 't16', labels: {task: 'b'}, state: 'live', status: 'working'}];
  const lines = texts(p.instance.render(p.cx));
  assert.ok(lines.includes('TERMINALS LABELLED FOR THIS TASK — OWNERSHIP UNVERIFIED'));
  assert.ok(lines.includes('t16 · live · working'));
  await flush();
  assert.deepEqual(p.watches.map(w => w.path), ['/state/herdr-zstack', '/repo/.herdr-tasks']);
  await p.close();
});

test('board notifications and Refresh restore a cleared roster with new active work', async () => {
  for (const refresh of [false, true]) {
    const entries = rosterFiles(Object.fromEntries(run.members.map(member => [memberPath(member.taskId),
      JSON.stringify({...active, taskId: member.taskId, checkout: member.checkout, activity: 'completed'})])));
    entries[boardPath] = JSON.stringify({schemaVersion: 1, sequence: 1, tasks: [{label: 'Roster', run: '/idx/run.json'}]});
    const p = await boardPanel(entries);
    try {
      p.callbacks.length = 0;
      byId(p.instance.render(p.cx), 'clear').styles.on_click[0](undefined, p.cx);
      await p.callbacks.shift()(p.cx);
      assert.deepEqual(p.instance.tasks, []);
      p.callbacks.length = 0;
      p.entries['/idx/run.json'] = JSON.stringify({...run, sequence: run.sequence + 1, members: [run.members[0]]});
      p.entries[memberPath(run.members[0].taskId)] = JSON.stringify({...active, taskId: run.members[0].taskId, activity: 'active'});
      if (refresh) {
        byId(p.instance.render(p.cx), 'refresh').styles.on_click[0](undefined, p.cx);
        await p.callbacks.shift()(p.cx);
      } else {
        p.watches.findLast(w => w.path === '/state/herdr-zstack').resolve([boardPath]);
        await flush();
      }
      assert.equal(p.instance.tasks[0]?.label, 'Roster', refresh ? 'Refresh restores active work' : 'board reread restores active work');
      assert.equal(p.instance.cleared.size, 0);
    } finally { await p.close(); }
  }
});

test('board removals prune the hidden count and allow readded entries to appear', async () => {
  const p = await boardPanel({[boardPath]: boardFile(['a']), [boardRecord('a')]: JSON.stringify({...JSON.parse(boardTask('a')), activity: 'completed'})});
  try {
    p.callbacks.length = 0;
    p.instance.clearCompleted(p.cx);
    await p.callbacks.shift()(p.cx);
    assert.equal(p.instance.cleared.size, 1);
    p.callbacks.length = 0;
    p.entries[boardPath] = boardFile([]);
    p.watches.findLast(w => w.path === '/state/herdr-zstack').resolve([boardPath]);
    await flush();
    assert.equal(p.instance.cleared.size, 0);
    assert.equal(texts(p.instance.render(p.cx)).some(line => /hidden until panel reload/.test(line)), false);
    p.entries[boardPath] = boardFile(['a']);
    p.watches.findLast(w => w.path === '/state/herdr-zstack').resolve([boardPath]);
    await flush();
    assert.equal(p.instance.tasks[0]?.label, 'Task a');
  } finally { await p.close(); }
});

test('a slow dismissal recheck cannot restore an entry removed by a newer board read', async () => {
  let finish;
  const p = await panel(async () => JSON.stringify({...active, activity: 'completed'}));
  try {
    const tasks = [{record: '/done.json', board: true}];
    await p.instance.applyBoard(p.cx, tasks);
    p.callbacks.length = 0;
    p.instance.clearCompleted(p.cx);
    await p.callbacks.shift()(p.cx);
    assert.equal(p.instance.cleared.size, 1);
    p.host.read = () => new Promise(resolve => { finish = resolve; });
    const previous = p.instance.applyBoard(p.cx, tasks);
    await p.instance.applyBoard(p.cx, []);
    finish(JSON.stringify(active));
    await previous;
    assert.deepEqual(p.instance.tasks, []);
    assert.deepEqual(p.instance.boardTasks, []);
    assert.equal(p.instance.cleared.size, 0);
  } finally { p.cleanup(); }
});

test('a board write during a dismissal recheck starts another board read', async () => {
  const done = JSON.stringify({...JSON.parse(boardTask('a')), activity: 'completed'});
  const p = await boardPanel({[boardPath]: boardFile(['a']), [boardRecord('a')]: done});
  try {
    p.callbacks.length = 0;
    p.instance.clearCompleted(p.cx);
    await p.callbacks.shift()(p.cx);
    assert.deepEqual(p.instance.tasks, []);
    const read = p.host.read;
    let finish;
    p.host.read = (path, options) => path === boardRecord('a') && !finish ? new Promise(resolve => { finish = resolve; }) : read(path, options);
    const boardWatch = () => p.watches.findLast(w => w.path === '/state/herdr-zstack');
    boardWatch().resolve([boardPath]);
    await flush();
    assert.ok(finish, 'the board read is rechecking the dismissed entry');
    p.entries[boardPath] = boardFile(['b', 'a']);
    p.entries[boardRecord('b')] = boardTask('b');
    boardWatch().resolve([boardPath]);
    finish(done);
    await flush();
    assert.deepEqual(p.instance.tasks.map(t => t.label), ['Task b'], 'the write during the recheck is not missed');
    assert.equal(p.instance.cleared.size, 1);
  } finally { await p.close(); }
});

test('an unreadable board keeps dismissals for when it reads again', async () => {
  const p = await boardPanel({[boardPath]: boardFile(['a']), [boardRecord('a')]: JSON.stringify({...JSON.parse(boardTask('a')), activity: 'completed'})});
  try {
    p.callbacks.length = 0;
    p.instance.clearCompleted(p.cx);
    await p.callbacks.shift()(p.cx);
    const boardWatch = () => p.watches.findLast(w => w.path === '/state/herdr-zstack');
    p.entries[boardPath] = '{';
    boardWatch().resolve([boardPath]);
    await flush();
    assert.match(p.instance.boardState, /Malformed board/);
    assert.equal(p.instance.cleared.size, 1, 'unknown board contents remove no dismissal');
    p.callbacks.length = 0;
    byId(p.instance.render(p.cx), 'refresh').styles.on_click[0](undefined, p.cx);
    await p.callbacks.shift()(p.cx);
    assert.equal(p.instance.cleared.size, 1, 'Refresh keeps it too');
    p.entries[boardPath] = boardFile(['a']);
    boardWatch().resolve([boardPath]);
    await flush();
    assert.deepEqual(p.instance.tasks, [], 'the completed entry stays hidden');
  } finally { await p.close(); }
});

test('a change in the task evidence folder rereads the record and status, keeping them visible', async () => {
  const p = await boardPanel({[boardPath]: boardFile(['b']), [boardRecord('b')]: boardTask('b'), '/repo/.herdr-tasks/b/brief.md': 'goal'});
  p.callbacks.shift()(p.cx);                 // evidence-folder watch loop
  await p.callbacks.shift()(p.cx);           // record
  p.entries['/repo/.herdr-tasks/b/status.md'] = '**Now:** testing';
  await p.callbacks.shift()(p.cx);           // status
  assert.equal(p.watches.at(-1).path, '/repo/.herdr-tasks');
  assert.equal(p.instance.snapshot.text, '**Now:** testing');
  p.entries['/repo/.herdr-tasks/b/status.md'] = '**Now:** verified';
  p.entries[boardRecord('b')] = JSON.stringify({...JSON.parse(boardTask('b')), sequence: 2, activity: 'completed'});
  const shown = p.instance.snapshot;
  p.watches.at(-1).resolve(['/repo/.herdr-tasks/b/status.md']);
  await flush();
  assert.equal(p.callbacks.length, 1, 'one record reread per change');
  assert.equal(p.instance.snapshot, shown, 'evidence stays visible during the reread');
  await p.callbacks.shift()(p.cx);
  assert.equal(p.instance.record.activity, 'completed');
  assert.equal(p.instance.selected, 1);
  await p.callbacks.shift()(p.cx);
  assert.equal(p.instance.snapshot.text, '**Now:** verified');
  assert.equal(p.watches.length, 3, 'the loop waits again');
  await p.close();
});

// A host write that refuses a stale snapshot, as writeTextFile does.
function boardWrites(p) {
  const writes = [];
  p.host.write = async (path, text, expected) => {
    writes.push(path);
    if ((p.entries[path] ?? null) !== expected) throw new Error('stale snapshot');
    p.entries[path] = text;
    return null;
  };
  return writes;
}
const click = (p, id) => byId(p.instance.render(p.cx), id).styles.on_click[0](undefined, p.cx);

test('the X beside a board task asks first, then removes only that board entry', async () => {
  const p = await boardPanel({[boardPath]: boardFile(['b', 'a']), [boardRecord('b')]: boardTask('b')},
    {tasks: [{label: 'Pinned', record: '/pinned/.herdr-tasks/p/task.json'}]});
  const writes = boardWrites(p);
  try {
    assert.deepEqual(p.instance.tasks.map(t => t.label), ['Pinned', 'Task b', 'Task a']);
    assert.equal(byId(p.instance.render(p.cx), 'remove-0'), null, 'layout tasks are not on the board');
    click(p, 'remove-2');
    assert.ok(texts(p.instance.render(p.cx)).includes('Remove “Task a” from the board? Its record and evidence files stay.'));
    assert.equal(byId(p.instance.render(p.cx), 'task-2'), null, 'the confirmation replaces the row');
    click(p, 'remove-cancel-2');
    assert.ok(byId(p.instance.render(p.cx), 'remove-2'));
    assert.deepEqual(writes, [], 'nothing is written before confirmation');
    click(p, 'remove-2');
    p.callbacks.length = 0;
    click(p, 'remove-confirm-2');
    assert.ok(texts(p.instance.render(p.cx)).includes('Removing…'));
    await p.callbacks.shift()(p.cx);
    assert.deepEqual(writes, [boardPath]);
    const written = JSON.parse(p.entries[boardPath]);
    assert.equal(written.sequence, 4);
    assert.deepEqual(written.tasks.map(t => t.label), ['Task b']);
    assert.deepEqual(p.instance.tasks.map(t => t.label), ['Pinned', 'Task b']);
    assert.equal(p.instance.taskIndex, 0, 'the selection stays on its task');
    assert.equal(p.instance.confirmRemove, null);
    assert.equal(p.instance.removeState, null);
  } finally { await p.close(); }
});

test('a held board lock refuses removal and keeps the entry listed', async () => {
  const p = await boardPanel({[boardPath]: boardFile(['a']), [`${boardPath}.lock`]: '', [boardRecord('a')]: boardTask('a')});
  const writes = boardWrites(p);
  try {
    click(p, 'remove-0');
    p.callbacks.length = 0;
    click(p, 'remove-confirm-0');
    await p.callbacks.shift()(p.cx);
    assert.deepEqual(writes, []);
    assert.deepEqual(p.instance.tasks.map(t => t.label), ['Task a']);
    assert.ok(texts(p.instance.render(p.cx)).includes('Board is busy; try again.'));
    assert.ok(byId(p.instance.render(p.cx), 'remove-0'), 'the confirmation closes');
  } finally { await p.close(); }
});

test('board updates keep the selected task and fall back when it is removed', async () => {
  const p = await boardPanel({[boardPath]: boardFile(['b', 'a']), [boardRecord('a')]: boardTask('a'), [boardRecord('b')]: boardTask('b')},
    {tasks: [{label: 'Pinned', record: '/pinned/.herdr-tasks/p/task.json'}]});
  assert.deepEqual(p.instance.tasks.map(t => t.label), ['Pinned', 'Task b', 'Task a'], 'layout tasks stay first');
  p.instance.taskIndex = 2;
  p.callbacks.length = 0;
  const boardWatch = () => p.watches.findLast(w => w.path === '/state/herdr-zstack');
  p.entries[boardPath] = boardFile(['c', 'b', 'a']);
  boardWatch().resolve([boardPath]);
  await flush();
  assert.equal(p.instance.tasks[p.instance.taskIndex].label, 'Task a', 'selection follows its entry');
  assert.equal(p.callbacks.length, 0, 'a kept selection is not reread');
  p.entries[boardPath] = boardFile(['c']);
  boardWatch().resolve([boardPath]);
  await flush();
  assert.equal(p.instance.taskIndex, 0);
  assert.equal(p.instance.recordState, 'Reading task record…');
  await p.close();
});

test('a selected board duplicate keeps its identity and continues refreshing status after board updates', async () => {
  const status = '/repo/.herdr-tasks/a/status.md';
  const p = await boardPanel({[boardPath]: boardFile(['a']), [boardRecord('a')]: boardTask('a'), [status]: 'Initial status'},
    {tasks: [{label: 'Pinned a', record: boardRecord('a')}]});
  try {
    assert.deepEqual(p.instance.tasks.map(t => t.label), ['Pinned a', 'Task a']);
    assert.equal(p.instance.taskIndex, 0, 'layout entry keeps initial precedence');
    byId(p.instance.render(p.cx), 'task-1').styles.on_click[0](undefined, p.cx);
    p.callbacks.shift()(p.cx);               // evidence-folder watch loop
    await p.callbacks.shift()(p.cx);         // record
    await p.callbacks.shift()(p.cx);         // status
    assert.equal(p.instance.snapshot.text, 'Initial status');
    const watch = path => p.watches.findLast(w => w.path === path);

    for (const [ids, text] of [[['c', 'a'], 'Testing'], [['a', 'c'], 'Verified']]) {
      p.entries[boardPath] = boardFile(ids);
      watch('/state/herdr-zstack').resolve([boardPath]);
      await flush();
      assert.equal(p.instance.tasks[p.instance.taskIndex].label, 'Task a', 'selection follows the chosen board entry');
      assert.equal(p.instance.files[p.instance.selected].path, status);
      const shown = p.instance.snapshot;
      p.entries[status] = text;
      watch('/repo/.herdr-tasks').resolve([status]);
      await flush();
      assert.equal(p.instance.snapshot, shown, 'current evidence stays visible until reread');
      await p.callbacks.shift()(p.cx);       // record
      await p.callbacks.shift()(p.cx);       // status
      assert.equal(p.instance.snapshot.text, text);
      assert.notEqual(p.instance.taskWatch, null);
    }
    assert.equal(p.watches.filter(w => w.path === '/repo/.herdr-tasks').length, 3, 'watch re-arms after both changes');
  } finally { await p.close(); }
});

test('a selected layout duplicate retains precedence through board reorder and removal', async () => {
  const p = await boardPanel({[boardPath]: boardFile(['a'])}, {tasks: [{label: 'Pinned a', record: boardRecord('a')}]});
  try {
    for (const ids of [['c', 'a'], ['c']]) {
      p.entries[boardPath] = boardFile(ids);
      p.watches.findLast(w => w.path === '/state/herdr-zstack').resolve([boardPath]);
      await flush();
      assert.equal(p.instance.taskIndex, 0);
      assert.equal(p.instance.tasks[0].label, 'Pinned a');
      assert.equal(p.callbacks.length, 0, 'retaining a layout selection does not reload it');
    }
  } finally { await p.close(); }
});

test('an unwatchable board says so, and Refresh retries it', async () => {
  const p = await panel(async () => null, {board: boardPath});
  p.host.watch = async () => { throw new Error('no such folder'); };
  await p.callbacks.shift()(p.cx);
  assert.match(p.instance.boardState, /no tracked tasks yet.*Not watching the board.*no such folder/);
  p.callbacks.length = 0;
  byId(p.instance.render(p.cx), 'refresh').styles.on_click[0](undefined, p.cx);
  assert.equal(p.callbacks.length, 2, 'board read plus manual file read');
  p.cleanup();
});

test('a missing board folder is awaited from its parent, so the first task appears without Refresh', async () => {
  const entries = {}, watches = [];
  const p = await panel(async path => entries[path] ?? null, {board: boardPath});
  p.host.watch = path => path === '/state/herdr-zstack' ? Promise.reject(new Error('no such folder')) : new Promise(resolve => watches.push({path, resolve}));
  p.callbacks.shift()(p.cx); p.callbacks.shift(); await flush();
  assert.deepEqual(watches.map(w => w.path), ['/state']);
  entries[boardPath] = boardFile(['a']);
  watches[0].resolve(['/state/herdr-zstack/board.json']);
  await flush();
  assert.deepEqual(p.instance.tasks.map(t => t.label), ['Task a']);
  p.instance.close(); watches.forEach(w => w.resolve([])); await flush(); p.cleanup();
});

test('an emptied board returns to manual mode and discards task reads still in flight', async () => {
  const p = await boardPanel({[boardPath]: boardFile(['a']), [boardRecord('a')]: boardTask('a')});
  p.callbacks.shift()(p.cx);                 // evidence-folder watch loop
  await p.callbacks.shift()(p.cx);           // record
  await p.callbacks.shift()(p.cx);           // status
  p.instance.loadTask(p.cx, {keep: true});
  const late = p.callbacks.shift();          // a reread still in flight
  delete p.entries[boardRecord('a')];
  p.entries[boardPath] = boardFile([]);
  p.watches.find(w => w.path === '/state/herdr-zstack').resolve([boardPath]);
  await flush();
  await late(p.cx);
  assert.deepEqual(p.instance.tasks, []);
  assert.equal(p.instance.recordState, null);
  assert.equal(p.instance.files[0].path, '/notes.md', 'manual files return');
  await p.close();
});

// Exercise host-style one-shot folder notifications without changing terminal facts.
async function watchedRoster(machine = null) {
  const indexPath = '/coordinator/.herdr-tasks/run/run.json';
  const roster = {...run, members: run.members.map((m, i) => ({...m, checkout: `/checkout-${i}`}))};
  const paths = roster.members.map(m => `${m.checkout}/.herdr-tasks/${m.taskId}/task.json`);
  const entries = {[indexPath]: JSON.stringify(roster)};
  paths.forEach((path, i) => { entries[path] = JSON.stringify({...active, taskId: roster.members[i].taskId,
    checkout: roster.members[i].checkout, brief: `.herdr-tasks/${roster.members[i].taskId}/brief.md`,
    handoff: `.herdr-tasks/${roster.members[i].taskId}/status.md`}); });
  const p = await panel(async path => entries[path] ?? null, {tasks: [{run: indexPath, board: true, machine}]});
  const watches = [];
  p.host.watch = path => new Promise(resolve => watches.push({path, resolve}));
  // Start spawned loops and reads; loops suspend on the controlled watches.
  const drain = async () => {
    while (p.callbacks.length) { p.callbacks.shift()(p.cx); await flush(); }
  };
  await drain();
  return {...p, entries, roster, paths, indexPath, watches, drain,
    close: async () => { p.instance.close(); watches.forEach(w => w.resolve([])); await flush(); p.cleanup(); }};
}

test('split-checkout roster watches refresh member records and status with unchanged terminal facts', async () => {
  const p = await watchedRoster();
  try {
    assert.deepEqual(p.watches.map(w => w.path).sort(), ['/checkout-0/.herdr-tasks', '/checkout-1/.herdr-tasks', '/coordinator/.herdr-tasks']);
    p.instance.selectMember(p.cx, 1); await p.drain();
    const file = p.instance.files[p.instance.selected].path;
    p.entries[file] = 'verified status';
    p.entries[p.paths[1]] = JSON.stringify({...JSON.parse(p.entries[p.paths[1]]), activity: 'completed', sequence: 2});
    p.watches.find(w => w.path === '/checkout-1/.herdr-tasks').resolve([file, p.paths[1]]);
    await flush(); await p.drain();
    assert.equal(p.instance.record.activity, 'completed');
    assert.equal(p.instance.memberIndex, 1);
    assert.equal(p.instance.files[p.instance.selected].path, file);
    assert.equal(p.instance.snapshot.text, 'verified status');
    assert.deepEqual(p.host.terminals, []);
    assert.equal(p.watches.filter(w => w.path === '/checkout-0/.herdr-tasks').length, 1, 'unchanged subscription stays pending');
    assert.equal(p.watches.filter(w => w.path === '/coordinator/.herdr-tasks').length, 1);
  } finally { await p.close(); }
});

test('roster membership reconciles watches, deduplicates folders and ignores removed or deselected events', async () => {
  const p = await watchedRoster();
  try {
    const removed = p.watches.find(w => w.path === '/checkout-1/.herdr-tasks');
    p.roster.members[1].checkout = '/checkout-0';
    p.entries[p.indexPath] = JSON.stringify(p.roster);
    p.watches.find(w => w.path === '/coordinator/.herdr-tasks').resolve([p.indexPath]);
    await flush(); await p.drain();
    assert.equal(p.watches.filter(w => w.path === '/checkout-0/.herdr-tasks').length, 1, 'members sharing a folder share the watch');
    removed.resolve([]); await flush();
    assert.equal(p.callbacks.length, 0, 'removed folder event is stale');
    assert.equal(p.watches.filter(w => w.path === removed.path).length, 1, 'removed loop does not rearm');
    p.roster.members[1].checkout = '/checkout-new';
    p.entries[p.indexPath] = JSON.stringify(p.roster);
    p.watches.findLast(w => w.path === '/coordinator/.herdr-tasks').resolve([p.indexPath]);
    await flush(); await p.drain();
    assert.equal(p.watches.filter(w => w.path === '/checkout-new/.herdr-tasks').length, 1, 'missing member record still gets a watch');
    p.instance.tasks.push({record: '/other/task.json'});
    p.instance.taskIndex = 1; p.instance.loadTask(p.cx); await p.drain();
    p.watches.find(w => w.path === '/checkout-new/.herdr-tasks').resolve([]); await flush();
    assert.equal(p.callbacks.length, 0, 'previous selection cannot refresh the new selection');
  } finally { await p.close(); }
});

test('remote board rosters never watch local index or member folders', async () => {
  const p = await watchedRoster('server');
  try { assert.deepEqual(p.watches, []); }
  finally { await p.close(); }
});

test('a decision log renders reported rows whose listed evidence opens that file', async () => {
  const log = ['ts\tphase\tdecision\twhy\tevidence\tresult',
    '2026-11-01T00:00:00Z\tstart\trun t16\tnew session\tsession 6a3a\topen',
    '2026-11-01T00:00:01Z\tlayout\tDropped props\tstale fallback\t/checks.log, commit 3a9f1c2\tgreen', 'bad row', ''].join('\n');
  const p = await panel(async path => path === '/decisions.tsv' ? log : 'checks', { decisions: '/decisions.tsv' });
  await p.callbacks.shift()(p.cx);
  assert.deepEqual(p.instance.files.map(f => f.label), ['Task notes', 'Artifact', 'Decisions']);
  byId(p.instance.render(p.cx), 'file-2').styles.on_click[0](undefined, p.cx);
  await p.callbacks.shift()(p.cx);
  const tree = p.instance.render(p.cx);
  const lines = texts(byId(tree, 'record'));
  assert.ok(lines.includes('DECISIONS — REPORTED BY THE COORDINATOR, NOT VERIFIED'));
  assert.ok(lines.includes('── start · run t16 · 2026-11-01T00:00:00Z'));
  assert.ok(lines.includes('Why: new session'));
  assert.ok(lines.includes('Result (reported): open'));
  assert.ok(lines.includes('session 6a3a'));
  assert.ok(lines.includes('Result (reported): green'));
  assert.ok(lines.includes('commit 3a9f1c2'));
  assert.ok(lines.includes('Malformed row: bad row'));
  byId(tree, 'decision-1-evidence-0').styles.on_click[0](undefined, p.cx);
  assert.equal(p.instance.selected, 1);
  await p.callbacks.shift()(p.cx);
  assert.equal(p.instance.snapshot.text, 'checks');
  assert.ok(texts(byId(p.instance.render(p.cx), 'record')).includes('checks'));
  p.cleanup();
});

test('a Decisions file without the log header stays raw text', async () => {
  const p = await panel(async path => path === '/decisions.tsv' ? '# notes' : 'n', { decisions: '/decisions.tsv' });
  await p.callbacks.shift()(p.cx);
  p.instance.selected = 2; p.instance.load(p.cx);
  await p.callbacks.shift()(p.cx);
  assert.ok(texts(byId(p.instance.render(p.cx), 'record')).includes('# notes'));
  p.cleanup();
});

test('watch refresh preserves the selected view when Decisions is also an artifact', async () => {
  const path = '.herdr-tasks/b/decisions.tsv';
  const log = decision => `${DECISION_HEADER}\ntime\tfix\t${decision}\twhy\te\tresult\n`;
  const record = { ...JSON.parse(boardTask('b')), artifacts: [path], decisions: path };
  const p = await boardPanel({ [boardPath]: boardFile(['b']), [boardRecord('b')]: JSON.stringify(record), [`/repo/${path}`]: log('First') });
  try {
    p.callbacks.shift()(p.cx);
    await p.callbacks.shift()(p.cx);
    await p.callbacks.shift()(p.cx);
    for (const label of ['Decisions', path]) {
      const index = p.instance.files.findIndex(file => file.label === label);
      byId(p.instance.render(p.cx), `file-${index}`).styles.on_click[0](undefined, p.cx);
      await p.callbacks.shift()(p.cx);
      p.entries[`/repo/${path}`] = log('Second');
      p.watches.findLast(w => w.path === '/repo/.herdr-tasks').resolve([`/repo/${path}`]);
      await flush();
      await p.callbacks.shift()(p.cx);
      await p.callbacks.shift()(p.cx);
      assert.equal(p.instance.files[p.instance.selected].label, label);
      const lines = texts(byId(p.instance.render(p.cx), 'record'));
      assert.ok(lines.includes(label === 'Decisions' ? 'Second' : log('Second')));
    }
  } finally { await p.close(); }
});

test('decision evidence keeps spaced and comma filenames and clicks only exact listed targets', async () => {
  const reads = [];
  const evidence = '/a  b.txt, /a,b.txt, comma,label, /a,b.txt, /abc, /a  b.txt.bak, /unlisted';
  const log = `${DECISION_HEADER}\n${['time', 'fix', '  =reported', 'why', evidence, 'ok'].map(decisionCell).join('\t')}\n`;
  const p = await panel(async path => { reads.push(path); return path === '/decisions.tsv' ? log : path; }, {
    decisions: '/decisions.tsv', artifacts: [
      { label: 'prefix', path: '/a' },
      { label: 'one space', path: '/a b.txt' },
      { label: 'two spaces', path: '/a  b.txt' },
      { label: 'comma,label', path: '/a,b.txt' },
    ],
  });
  try {
    await p.callbacks.shift()(p.cx);
    p.instance.selected = p.instance.files.findIndex(file => file.label === 'Decisions');
    p.instance.load(p.cx); await p.callbacks.shift()(p.cx);
    const tree = p.instance.render(p.cx);
    const lines = texts(byId(tree, 'record'));
    for (const text of ['  =reported', '/a  b.txt ↗', '/a,b.txt ↗', 'comma,label ↗', '/abc', '/a  b.txt.bak', '/unlisted']) {
      assert.ok(lines.includes(text), text);
    }
    assert.equal(lines.filter(text => text === '/a,b.txt ↗').length, 2, 'duplicates stay visible');
    for (const index of [4, 5, 6]) assert.equal(byId(tree, `decision-0-evidence-${index}`), null, 'unlisted lookalikes have no click target');
    const targets = ['/a  b.txt', '/a,b.txt', '/a,b.txt', '/a,b.txt'];
    for (const [index, target] of targets.entries()) {
      byId(tree, `decision-0-evidence-${index}`).styles.on_click[0](undefined, p.cx);
      assert.equal(p.instance.files[p.instance.selected].path, target);
      await p.callbacks.shift()(p.cx);
      assert.equal(p.instance.snapshot.text, target);
    }
    assert.deepEqual(reads, ['/notes.md', '/decisions.tsv', ...targets], 'no prefix, collapsed-space or unlisted path is read');
  } finally { p.cleanup(); }
});
