# Task & Evidence

A read-only native GPUI panel with explicit task-record selection, brief/artifact/handoff navigation, and coordinator receipt snapshots. It never writes records, executes commands, sends agent messages, or infers acceptance from status or prose.

Follow [installation](../../docs/installation.md) to install the runtime as `zstack-task-evidence` and add it to a personal layout clone. The installer includes all sibling runtime `.js` modules; copying only the original three files is insufficient.

Use the [shared sidebar recipe](../../examples/layout-recipe.md) for a top-row
Task & Evidence button beside Files and Changes. Clicking the active button
collapses the sidebar; switching buttons replaces its contents. Selection and
closed state are remembered per space.

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

`tasks` is an explicit list, never directory discovery. Each entry names exactly one absolute `record` or one absolute `run` index; an entry with both, or with neither, is ignored. `record: "/absolute/path/task.json"` at the top level is shorthand for one task, with top-level `machine`. A task entry's `machine` routes reads; null or omitted means this computer. Record contents describe their owning machine; they never select a read destination. Use the remote machine's paths and explicit routing for remote records. See the [schema](../../docs/task-record.md).

Select a task to read its record and brief. Select a file for its contents. Refresh clears the shown evidence, then rereads the selected task record or run index and its records, then the first file; manual mode rereads the selected file. Task and file reads are generation guarded, so late reads cannot replace a newer selection or refresh. Missing, malformed and unavailable records stay visible and clear earlier evidence. Missing/unreadable artifacts remain distinct from empty files. Host reads are limited to 1 MiB; successful reads show timestamps, not claims of current freshness.

The receipt decision and revision are labeled **RECEIPT SNAPSHOT**. A record/receipt revision mismatch is stale. Otherwise acceptance remains unverified because the panel cannot independently observe current Git state. A recorded `accepted` decision never becomes a current acceptance claim.

Live activity is shown only for the explicit `space`, or one unique space matching the explicit `folder` and `machine`. The installed AgentInfo API exposes neither core identity nor stable occupant identity. Consequently all listed activity is **ownership unverified**, even when an address matches a worker binding; no agent is promoted to task-owned activity. Native Codex children without Herdr terminals do not appear. Activity and durable task state remain separate.

Manual mode remains available without `tasks`/`record`: configure `folder`, `notes`, optional `acceptance`, `handoff`, `decisions`, and `artifacts: [{label, path}]`. Paths are absolute or relative to an absolute folder. An unresolved explicit space without an explicit machine refuses manual reads. Markdown is displayed using the native read-only TextView.

Run `node --test mods/task-evidence/*.test.mjs`, `herdr-app check mods/task-evidence`, and `just check`. The type check reads the JSDoc types for records, rosters, boards, and panel props. The checker covers initial rendering only; live async navigation and refresh still need inspection. `place: none` avoids automatically changing a layout on installation.

## Rosters

A `run` entry, or top-level `run` shorthand, points at a coordinator's [run index](../../docs/task-record.md#run-index-for-a-roster). The panel reads the index, then each member's record on the same machine. Each member row shows the task ID, owner, reported activity, record state, binding status and receipt snapshot. It also lists the live terminals labelled with `run=<run-id>` and that member's `task=<task-id>`, with their `role`, state and status. Supporting processes appear there by role, and they never stand in for a member. Run-labelled terminals whose task is not in the index are listed separately. Select a member to browse its brief, artifacts, receipt evidence and handoff.

Each member's record is checked against its index entry: task ID, checkout, coordinator and machine must match. A missing, malformed, unavailable or mismatched record stays listed with its reason, and its evidence is cleared. Its siblings remain readable. The panel checks the index's structure with `validateRunShape`. It cannot check write-scope exclusivity, which needs the owning filesystem; the coordinator's `validateRun` does that before launch. The index grants no aggregate acceptance, and each receipt is a snapshot.

Binding status names the saved terminal address and whether the app lists it. The app's live listing omits finished terminals that `hc ls --all` still shows. Core and occupant identity are not observable here, so a binding is always unconfirmed.

The panel rereads when the core facts it shows change: a roster terminal starts, finishes, changes status or labels, or a bound address appears or vanishes. herdr-app keeps `terminals()` live from herdr-core and reruns the mod's render on each change. Those are the facts `hc events` streams, so the panel never runs `hc events` or any other command. A fact-driven reread keeps the shown evidence until new reads finish. It also keeps the selected member and file when they still exist. A change during a reread triggers another. For layout `tasks`, file edits alone trigger nothing; use Refresh. Board tasks also reread on file changes, as described under [tracked tasks](#tracked-tasks). Status reports activity only, so a reread never infers acceptance. Single `record` entries get the same reread for terminals labelled with their task ID or at their bound address.

Use the [roster layout recipe](../../examples/roster-layout.md) to show a roster panel beside the coordinator.

## Tracked tasks

Set `board` to an absolute board file to list the tasks that z-mode coordinators track with `scripts/task.mjs`. Without `board`, the panel reads no board. The CLI writes `~/.local/state/herdr-zstack/board.json` by default, or `$XDG_STATE_HOME/herdr-zstack/board.json` when that is set, unless `--board` or `HERDR_ZSTACK_BOARD` names another file:

```json
{ "title": "Task & Evidence", "board": "/Users/me/.local/state/herdr-zstack/board.json" }
```

The board is still an explicit list: coordinators add entries to it, and the panel never scans directories for them. The [schema](../../docs/task-record.md#task-board) describes its format. Board entries follow any `tasks` from the layout, newest first. The panel reads the board on this computer, and each entry's `machine` routes its own reads. A selection stays while its entry remains, including when a layout entry points to the same record as a board entry. When the entry disappears, the panel selects the first task, or returns to manual mode when the list is empty.

The panel watches the board's folder, and the `<checkout>/.herdr-tasks` folder of a selected board task on this computer, with `watchFolder`. A local board roster also watches each member checkout’s evidence folder, deduplicating shared folders and updating subscriptions when membership changes. A change rereads the record and the selected file, and the shown evidence stays visible until the new reads finish. Remote board tasks and layout `tasks` still reread only on core-fact changes and Refresh. Before the first task creates the board folder, the panel watches that folder's parent instead. When neither can be watched, the panel says so, and Refresh retries. A board task opens on its status file, which holds the coordinator's latest status line and a newest-first log. A single task also lists the live terminals labelled with its `task`, such as the coordinator's own. Labels locate terminals; they never prove ownership. Activity is reported, never acceptance.

## Decisions

A record's optional `decisions` path, or the manual `decisions` prop, adds a **Decisions** file. Coordinators write it with `task.mjs decide`; the [schema](../../docs/task-record.md) describes the format. When that file starts with the exact header, the panel shows one card per row: time and phase, the decision, why, evidence, and the result labelled as reported. A `start` row shows as a divider between runs. An evidence pointer links only when it exactly matches the label or path of a file the panel already lists, so a click selects that file. The panel reads nothing else, and commits or PR numbers stay plain text. A file without the header shows as raw text, and a row with the wrong cell count stays visible as malformed. Decision rows are the coordinator's reasoning, never acceptance.

Decision cells preserve ordinary spaces, including repeated filename spaces; tabs, CR and newlines become spaces. Spreadsheet formula guards also cover leading whitespace and are hidden when displaying the cell. New CLI rows double a literal leading apostrophe; decoding removes that added apostrophe, preserving the original text and evidence filename. Older logs (including `log.sh` output) do not distinguish literal leading apostrophes from guards; they retain legacy guard decoding, so ambiguous historical values cannot be recovered automatically.

A `start` row keeps its divider heading and shows its why, evidence links and reported result below it. Automatic refresh preserves the selected file's path and label, so listing the decision log as an artifact does not switch the **Decisions** view to raw text.

Separate evidence pointers with a comma followed by optional whitespace. At each pointer, the longest exact listed label or path ending at a comma or the end of the cell wins, including any commas inside that name. Otherwise text splits at the next comma and stays unlinked. Duplicate pointers remain visible. This syntax has no quoting or escaping: if `a`, `b`, and `a,b` are all listed, `a,b` selects the single longest name. Use distinct comma-free labels to express separate pointers in ambiguous cases. Whitespace after a separator belongs to the separator; use an alternate label for a filename that starts with whitespace in a multi-pointer cell.
