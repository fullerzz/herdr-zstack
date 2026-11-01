import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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
    export const watchFolder = path => h.watch(path);
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
const byId = (node, id) => typeof node === 'string' ? null : node.styles.id?.[0] === id ? node : node.items.map(child => byId(child, id)).find(Boolean) ?? null;
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

test('panel host surface stays read-only', () => {
  const imported = [...main.matchAll(/^import \{([^}]*)\} from "herdr";$/gm)].flatMap(m => m[1].split(',').map(name => name.trim()));
  assert.deepEqual(imported.sort(), ['agents', 'props', 'readTextFile', 'run', 'spaces', 'terminals', 'theme', 'watchFolder']);
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
