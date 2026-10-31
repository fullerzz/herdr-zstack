import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const model = await readFile(new URL("./model.js", import.meta.url), "utf8");
const main = await readFile(new URL("./main.js", import.meta.url), "utf8");
async function panel(read, props = {}) {
  const callbacks = [];
  const key = `taskEvidenceTest${Math.random()}`;
  globalThis[key] = { read, spaces: [], props: { notes: "/notes.md", artifacts: [{ path: "/checks.log" }], ...props } };
  const source = main.replace(/^import .*;\n/gm, "")
    .replace("export default class", "class") + `\nexport default TaskEvidence;`;
  const prelude = `const View = class {}; const readTextFile = globalThis[${JSON.stringify(key)}].read; const spaces = () => globalThis[${JSON.stringify(key)}].spaces; const props = () => globalThis[${JSON.stringify(key)}].props;\n`;
  const { default: Panel } = await import(`data:text/javascript;base64,${Buffer.from(prelude + model + source).toString("base64")}`);
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
