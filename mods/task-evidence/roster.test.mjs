import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateRunShape, parseRunShape, readRoster, readMember, rosterFacts, factKey, recordPath, runPath } from "./roster.js";

const fixture = async name => readFile(new URL(`../../records/fixtures/${name}.json`, import.meta.url), "utf8");
const run = JSON.parse(await fixture("run"));
const active = JSON.parse(await fixture("active"));
const accepted = JSON.parse(await fixture("accepted"));
const memberRecord = (taskId, extra = {}) => ({ ...active, taskId, owner: `worker-${taskId}`, checkout: run.checkout, coordinator: run.coordinator, machine: run.machine, ...extra });
const files = entries => async (path, options) => {
  files.calls.push([path, options]);
  const value = entries[path];
  if (value instanceof Error) throw value;
  return value === undefined ? null : typeof value === "string" ? value : JSON.stringify(value);
};
files.calls = [];

test("run index paths and structure match the coordinator-side index", () => {
  assert.deepEqual(validateRunShape(run), []);
  assert.equal(runPath(run), "/work/pilot/.herdr-tasks/roster-pilot/run.json");
  assert.equal(recordPath(run.members[1]), "/work/pilot/.herdr-tasks/pilot-b/task.json");
  assert.match(validateRunShape({ ...run, members: [] }).join(), /1-3/);
  assert.match(validateRunShape({ ...run, members: [...run.members, ...run.members] }).join(), /1-3/);
  assert.match(validateRunShape({ ...run, schemaVersion: 2 }).join(), /schemaVersion/);
  assert.match(validateRunShape({ ...run, members: [{ ...run.members[0], taskId: "roster-pilot" }] }).join(), /duplicate/);
  assert.match(validateRunShape({ ...run, members: [{ ...run.members[0], writes: ["../escape"] }] }).join(), /checkout-relative/);
  assert.equal(parseRunShape("{").run, null);
  assert.deepEqual(parseRunShape("[]").errors, ["run must be an object"]);
});

test("normalized absolute checkouts agree with POSIX path.resolve", () => {
  for (const checkout of ["/", "/work", "/work/pilot", "/work/", "/work//pilot", "/work/./pilot", "/work/../pilot", "work", "/work/pilot/.."]) {
    const shape = validateRunShape({ ...run, checkout, members: [{ ...run.members[0], checkout: "/work/pilot" }] });
    assert.equal(!shape.some(error => error.startsWith("checkout")), resolve(checkout) === checkout, checkout);
  }
});

test("roster reads the index, then every member record on the configured machine", async () => {
  files.calls = [];
  const read = files({
    "/idx/run.json": run,
    [recordPath(run.members[0])]: memberRecord("pilot-a"),
    [recordPath(run.members[1])]: memberRecord("pilot-b", { receipt: { ...accepted.receipt, coordinator: run.coordinator } }),
  });
  const roster = await readRoster(read, "/idx/run.json", "server");
  assert.equal(roster.run.runId, "roster-pilot");
  assert.match(roster.state, /2 members.*no aggregate acceptance/);
  assert.deepEqual(roster.members.map(m => [m.taskId, m.record?.owner]), [["pilot-a", "worker-pilot-a"], ["pilot-b", "worker-pilot-b"]]);
  assert.match(roster.members[0].state, /Acceptance: unverified/);
  // A saved accepted receipt is a snapshot: without current observation it stays unverified.
  assert.match(roster.members[1].state, /Acceptance: unverified/);
  assert.ok(files.calls.every(([, options]) => options.on === "server"));
});

test("each member fails visibly and independently", async () => {
  const [a, b] = run.members;
  const third = { taskId: "pilot-c", checkout: run.checkout, writes: ["src/c.js"] };
  const cases = {
    missing: [undefined, /Task record missing/],
    malformed: ["{", /Malformed task record: invalid JSON/],
    unavailable: [new Error("offline"), /unavailable: Error: offline/],
    renamed: [memberRecord("other"), /does not match the run index: taskId/],
    foreign: [memberRecord("pilot-b", { coordinator: "coordinator-2", receipt: null }), /does not match the run index: coordinator/],
    stale: [{ ...JSON.parse(await fixture("stale-revision")), taskId: "pilot-b", checkout: run.checkout }, /Acceptance: stale/],
  };
  for (const [name, [value, expected]] of Object.entries(cases)) {
    const index = { ...run, members: [a, b, third] };
    const roster = await readRoster(files({ "/run.json": index, [recordPath(a)]: memberRecord("pilot-a"), [recordPath(b)]: value, [recordPath(third)]: memberRecord("pilot-c") }), "/run.json", null);
    assert.match(roster.members[1].state, expected, name);
    if (name !== "stale") assert.equal(roster.members[1].record, null, name);
    assert.ok(roster.members[0].record && roster.members[2].record, `${name}: siblings stay readable`);
  }
});

test("index failures show no members", async () => {
  for (const [value, expected] of [[undefined, /Run index missing/], ["{}", /Malformed run index/], [new Error("down"), /Run index unavailable/], [JSON.stringify(active), /Malformed run index/]]) {
    const roster = await readRoster(files({ "/run.json": value }), "/run.json", null);
    assert.match(roster.state, expected);
    assert.equal(roster.run, null);
    assert.deepEqual(roster.members, []);
  }
  assert.match((await readMember(files({}), "/task.json", null)).state, /missing/);
});

const terminal = (address, labels, state = "live", status = null) => ({ address, labels, state, status });

test("live facts group run-labelled terminals by member and keep processes out of acceptance", () => {
  const members = [{ taskId: "pilot-a", record: memberRecord("pilot-a", { worker: { core: "c", terminal: "t5", occupant: "o" } }) },
    { taskId: "pilot-b", record: memberRecord("pilot-b", { worker: null }) }, { taskId: "pilot-c", record: null }];
  const facts = rosterFacts({ runId: "roster-pilot", members }, [
    terminal("t5", { run: "roster-pilot", task: "pilot-a", role: "worker" }, "live", { state: "working" }),
    terminal("t6", { run: "roster-pilot", task: "pilot-a", role: "process" }),
    terminal("t7", { run: "roster-pilot", task: "pilot-b", role: "seat" }, "finished", "done"),
    terminal("t8", { run: "roster-pilot", task: "stray", role: "watcher" }),
    terminal("t9", { run: "other-run", task: "pilot-a", role: "worker" }),
    terminal("server/t5", { run: "roster-pilot", task: "pilot-a", role: "worker" }),
    terminal("t10", { "herdr.space": "s" }),
  ]);
  assert.deepEqual(facts.members.map(m => m.terminals.map(t => `${t.address}:${t.role}:${t.state}:${t.status}`)),
    [["t5:worker:live:working", "t6:process:live:null"], ["t7:seat:finished:done"], []]);
  assert.match(facts.members[0].binding, /Saved binding t5 \(unconfirmed\): address is live; core and occupant identity are not observable/);
  assert.equal(facts.members[1].binding, "No worker binding recorded.");
  assert.equal(facts.members[2].binding, "No readable record.");
  assert.deepEqual(facts.unlisted.map(t => [t.address, t.task, t.role]), [["t8", "stray", "watcher"]]);
});

test("bindings resolve on the record's machine and report a vanished address", () => {
  const members = [{ taskId: "pilot-a", record: memberRecord("pilot-a", { worker: { core: "c", terminal: "t5", occupant: "o" } }) }];
  const remote = rosterFacts({ runId: "roster-pilot", members }, [terminal("t5", {}), terminal("server/t5", {}, "finished")], "server");
  assert.match(remote.members[0].binding, /address is finished/);
  assert.deepEqual(remote.members[0].terminals.map(t => t.address), ["server/t5"]);
  assert.match(rosterFacts({ runId: "roster-pilot", members }, [], null).members[0].binding, /not in the app.s live listing/);
  // A single task record has no run label; its task label and bound address still locate terminals.
  const single = rosterFacts({ members }, [terminal("t5", {}), terminal("t6", { task: "pilot-a", role: "process" })]);
  assert.deepEqual(single.members[0].terminals.map(t => t.address), ["t6", "t5"]);
});

test("fact key changes only for facts about the shown roster", () => {
  const members = [{ taskId: "pilot-a", record: memberRecord("pilot-a", { worker: { core: "c", terminal: "t5", occupant: "o" } }) }];
  const key = list => factKey(rosterFacts({ runId: "roster-pilot", members }, list));
  const base = [terminal("t5", { run: "roster-pilot", task: "pilot-a", role: "worker" }, "live", "working"), terminal("t20", {})];
  assert.equal(key(base), key([...base, terminal("t21", { run: "other" })]));
  assert.equal(key(base), key([base[0], terminal("t20", {}, "finished")]));
  assert.notEqual(key(base), key([{ ...base[0], status: "idle" }, base[1]]));
  assert.notEqual(key(base), key([{ ...base[0], state: "finished" }, base[1]]));
  assert.notEqual(key(base), key([...base, terminal("t22", { run: "roster-pilot", task: "pilot-a", role: "process" })]));
  assert.notEqual(key(base), key([...base, terminal("t23", { run: "roster-pilot", task: "new", role: "worker" })]));
  assert.notEqual(key(base), key([base[1]]));
});
