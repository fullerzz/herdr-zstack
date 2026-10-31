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
