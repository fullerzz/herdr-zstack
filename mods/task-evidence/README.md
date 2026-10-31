# Task & Evidence

A read-only native GPUI panel with explicit task-record selection, brief/artifact/handoff navigation, and coordinator receipt snapshots. It never writes records, executes commands, sends agent messages, or infers acceptance from status or prose.

Follow [installation](../../docs/installation.md) to install the runtime as `zstack-task-evidence` and add it to a personal layout clone. The installer includes all sibling runtime `.js` modules; copying only the original three files is insufficient.

Configure its block props:

```json
{
  "title": "Project tasks",
  "space": "explicit-space-id",
  "tasks": [
    {"label": "Feature", "record": "/absolute/checkout/.herdr-tasks/feature/task.json", "machine": null},
    {"label": "Remote task", "record": "/remote/checkout/.herdr-tasks/fix/task.json", "machine": "server"}
  ]
}
```

`tasks` is an explicit list, never directory discovery. `record: "/absolute/path/task.json"` at the top level is shorthand for one task, with top-level `machine`. A task entry's `machine` routes reads; null or omitted means this computer. Record contents describe their owning machine; they never select a read destination. Use the remote machine's paths and explicit routing for remote records. See the [schema](../../docs/task-record.md).

Select a task to read its record and brief. Select a file for its contents. Refresh rereads the selected task record, then its brief; manual mode rereads the selected file. Task and file reads are generation guarded, so late reads cannot replace a newer selection or refresh. Missing, malformed and unavailable records stay visible and clear earlier evidence. Missing/unreadable artifacts remain distinct from empty files. Host reads are limited to 1 MiB; successful reads show timestamps, not claims of current freshness.

The receipt decision and revision are labeled **RECEIPT SNAPSHOT**. A record/receipt revision mismatch is stale. Otherwise acceptance remains unverified because the panel cannot independently observe current Git state. A recorded `accepted` decision never becomes a current acceptance claim.

Live activity is shown only for the explicit `space`, or one unique space matching the explicit `folder` and `machine`. The installed AgentInfo API exposes neither core identity nor stable occupant identity. Consequently all listed activity is **ownership unverified**, even when an address matches a worker binding; no agent is promoted to task-owned activity. Native Codex children without Herdr terminals do not appear. Activity and durable task state remain separate.

Manual mode remains available without `tasks`/`record`: configure `folder`, `notes`, optional `acceptance`, `handoff`, and `artifacts: [{label, path}]`. Paths are absolute or relative to an absolute folder. An unresolved explicit space without an explicit machine refuses manual reads. Markdown is displayed using the native read-only TextView.

Run `node --test mods/task-evidence/*.test.mjs` and `herdr-app check mods/task-evidence`. The checker covers initial rendering only; live async navigation and refresh still need inspection. `place: none` avoids automatically changing a layout on installation.
