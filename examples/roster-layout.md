# Put a roster panel beside the coordinator

This layout shows the coordinator's tab with a Task & Evidence panel for one
[run index](../docs/task-record.md#run-index-for-a-roster) beside it. Workers that
`hc run --bg` starts have no pane. Their labelled terminals, records and receipts
appear in the panel. The [shared sidebar recipe](layout-recipe.md) remains the
choice for one task record behind a toggle button. Both recipes can be used in
one layout.

1. Install the mods using [the explicit installer](../docs/installation.md).
2. Clone a layout under a personal name. Never edit a shipped layout. The
   clone becomes the shown layout; switch back to the original to roll back.

   ```sh
   herdr-app do layout.clone '{"name":"main","as":"my-roster"}'
   ```

3. In `layouts/my-roster.json`, append this block to the `work-body` row's
   `children`, after `panel`. Use the run index's absolute path on its owning
   machine. Set `machine` to that machine's name, or `null` for this computer.
   The coordinator writes the index; the panel only reads it.

```json
{
  "type": "block",
  "id": "roster-evidence",
  "size": { "px": 420 },
  "min": 320,
  "content": {
    "mod": "zstack-task-evidence",
    "props": {
      "title": "Roster",
      "tasks": [
        { "label": "<run-id>", "run": "/absolute/checkout/.herdr-tasks/<run-id>/run.json", "machine": null }
      ]
    }
  }
}
```

   Keep the ID distinct from `task-evidence`, which the shared sidebar's
   button looks for. A `tasks` list may mix `run` and `record` entries.
4. Check `herdr-app status` for layout errors. Select the coordinator's space
   and tab. The tab block shows the active tab. Do not choose a task by
   pointing a layout block at whichever terminal has focus.
5. Verify in the running app:
   - The async reads list each member, with its owner, reported activity,
     binding status and receipt snapshot.
   - The panel rereads when a run-labelled terminal starts, finishes, or changes
     status.
   - Refresh rereads on demand, for example after a record change with no
     terminal change.

The panel locates terminals by the `run=<run-id>` and `task=<task-id>` labels
that [operations](../skills/hc-workflow/references/operations.md) and
[supporting processes](../skills/hc-workflow/references/processes.md) assign.
Labels never prove ownership. A saved binding stays unconfirmed, and a receipt
stays a snapshot. The run index grants no aggregate acceptance.
