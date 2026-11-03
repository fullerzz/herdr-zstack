import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateRunShape, recordPath, runPath } from "./roster.js";

const run = JSON.parse(await readFile(new URL("./fixtures/run.json", import.meta.url), "utf8"));

test("run index paths and structure match the coordinator-side index", () => {
  assert.deepEqual(validateRunShape(run), []);
  assert.equal(runPath(run), "/work/pilot/.herdr-tasks/roster-pilot/run.json");
  assert.equal(recordPath(run.members[1]), "/work/pilot/.herdr-tasks/pilot-b/task.json");
  assert.match(validateRunShape({ ...run, members: [] }).join(), /1-3/);
  assert.match(validateRunShape({ ...run, members: [...run.members, ...run.members] }).join(), /1-3/);
  assert.match(validateRunShape({ ...run, schemaVersion: 2 }).join(), /schemaVersion/);
  assert.match(validateRunShape({ ...run, members: [{ ...run.members[0], taskId: "roster-pilot" }] }).join(), /duplicate/);
  assert.match(validateRunShape({ ...run, members: [{ ...run.members[0], writes: ["../escape"] }] }).join(), /checkout-relative/);
  assert.deepEqual(validateRunShape([]), ["run must be an object"]);
});

test("normalized absolute checkouts agree with POSIX path.resolve", () => {
  for (const checkout of ["/", "/work", "/work/pilot", "/work/", "/work//pilot", "/work/./pilot", "/work/../pilot", "work", "/work/pilot/.."]) {
    const shape = validateRunShape({ ...run, checkout, members: [{ ...run.members[0], checkout: "/work/pilot" }] });
    assert.equal(!shape.some(error => error.startsWith("checkout")), resolve(checkout) === checkout, checkout);
  }
});
