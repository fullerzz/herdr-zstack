import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const recordModel = await readFile(new URL("./task-record.js", import.meta.url), "utf8");
const model = await readFile(new URL("./model.js", import.meta.url), "utf8");
const main = await readFile(new URL("./main.js", import.meta.url), "utf8");
async function panel(read, props = {}) {
  const callbacks = [];
  const key = `taskEvidenceTest${Math.random()}`;
  globalThis[key] = { read, spaces: [], props: { notes: "/notes.md", artifacts: [{ path: "/checks.log" }], ...props } };
  const source = main.replace(/^import .*;\n/gm, "")
    .replace("export default class", "class") + `\nexport default TaskEvidence;`;
  const prelude = `const View = class {}; const readTextFile = globalThis[${JSON.stringify(key)}].read; const spaces = () => globalThis[${JSON.stringify(key)}].spaces; const props = () => globalThis[${JSON.stringify(key)}].props;
    const theme = () => ({}); const agents = () => [];
    const div = () => { const node = {items: [], styles: {}}; let builder;
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
    const v_flex = div, h_flex = div; const TextView = {markdown: (id, text) => div().id(id).child(text)};\n`;
  const { default: Panel } = await import(`data:text/javascript;base64,${Buffer.from(prelude + recordModel + model + source).toString("base64")}`);
  const instance = new Panel();
  const cx = { spawn: fn => callbacks.push(fn), notify() {} };
  instance.init(undefined, cx);
  return { instance, cx, callbacks, cleanup: () => delete globalThis[key] };
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
