import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./model.js", import.meta.url), "utf8");
const { filesFor, taskSpace } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("configured records preserve roles and resolve against explicit folder", () => {
  assert.deepEqual(filesFor({ folder: "/repo/", notes: "status.md", acceptance: "/evidence/accepted.md", artifacts: [{ label: "Checks", path: "checks.log" }], handoff: "handoff.md" }), [
    { label: "Task notes", path: "/repo/status.md" },
    { label: "Acceptance", path: "/evidence/accepted.md" },
    { label: "Checks", path: "/repo/checks.log" },
    { label: "Handoff", path: "/repo/handoff.md" },
  ]);
  assert.deepEqual(filesFor({ notes: "relative.md" }), []);
  assert.deepEqual(filesFor({}), []);
});

test("activity requires unique explicit space or folder and machine match", () => {
  const local = { id: "local", folder: "/repo", machine: null };
  const remote = { id: "remote/id", folder: "/repo", machine: "remote" };
  assert.equal(taskSpace({ folder: "/repo/" }, [local, remote]), local);
  assert.equal(taskSpace({ folder: "/repo", machine: "remote" }, [local, remote]), remote);
  assert.equal(taskSpace({ folder: "/repo" }, [local, { ...local, id: "other" }]), null);
  assert.equal(taskSpace({ space: "missing", folder: "/repo" }, [local]), null);
  assert.equal(taskSpace({ space: "remote/id" }, [local, remote]), remote);
  assert.equal(taskSpace({}, [local]), null);
});

test('record file roles and explicit choices preserve manual mode', async () => {
  const {taskChoices,recordFiles,taskActivity} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  assert.deepEqual(taskChoices({}),[]);
  assert.deepEqual(taskChoices({tasks:[null, 3, {record:'relative'}, {record:'/task.json'}]}),[{record:'/task.json'}]);
  assert.deepEqual(taskChoices({tasks:[{run:'/run.json'}, {run:'run.json'}, {record:'/t.json', run:'/r.json'}, {record:'/t.json', run:'r.json'}]}),[{run:'/run.json'}]);
  assert.deepEqual(taskChoices({run:'/run.json', machine:'server'}),[{label:'Roster', run:'/run.json', machine:'server'}]);
  assert.deepEqual(recordFiles({checkout:'/repo',brief:'brief.md',handoff:'handoff.md',artifacts:['check.log'],receipt:{evidence:['receipt.md']}}).map(f=>f.path),['/repo/brief.md','/repo/check.log','/repo/receipt.md','/repo/handoff.md']);
  const live=[{address:'t1',space:'s',status:'done'}];
  assert.deepEqual(taskActivity({worker:{core:'c',terminal:'t1',occupant:'session'}},live).owned,[]);
  assert.deepEqual(taskActivity(null,live).unverified,live);
});
