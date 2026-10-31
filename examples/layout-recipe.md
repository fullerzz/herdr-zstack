# Put Task & Evidence beside Files and Changes

1. Install both mods using [the explicit installer](../docs/installation.md).
2. Clone your chosen layout under a personal name using the installed
   `herdr-app` manual. Do not edit shipped layouts. Keep the original for rollback.
3. In the clone, change the `tabs` block's `content.mod` to
   `zstack-task-evidence-tabs`. This is a copy of Herdr app 0.1.10's tab bar;
   it retains its tabs, Files/Changes controls, and per-space panel memory.
4. Move the existing Task & Evidence block into the `panel-body` stack's
   `children`, beside `files` and `changes`. Its ID must be `task-evidence`.
   Remove its old standalone placement and fixed size/min/max so it fills the
   shared sidebar. Preserve its configured props. For a new panel, use:

```json
{
  "type": "block",
  "id": "task-evidence",
  "content": {
    "mod": "zstack-task-evidence",
    "props": {
      "title": "Task & Evidence",
      "folder": "/absolute/path/to/project",
      "space": "<verified-space-id>",
      "notes": "docs/task.md",
      "artifacts": [{ "label": "Verification", "path": "docs/validation.md" }]
    }
  }
}
```

The layout must retain the standard `panel` container and `panel-body` stack
IDs. The shared sidebar's width and resizing bounds now apply to all three panels.
The Task & Evidence button appears only when that stack contains its block.
Files and Changes still respect the existing `workspace.panels` preferences.

5. Select the clone and click Task & Evidence in the top row. Click again to
   collapse it; click Files or Changes to replace it in the same sidebar.
   Verify file selection and Refresh after async reads. Switching spaces remembers
   each space's panel selection or closed state.

Switch back to the original layout to roll back presentation. Before removing
mods, switch back or remove their references from the clone yourself; the installer
never rewrites layouts or keybindings. Personal tab-bar copies do not automatically
receive future Herdr tab-bar changes; compare against the installed mod when upgrading.

For durable task records, use the task-record props documented by the mod.
Paths are explicit examples, not task inference; verify space IDs with `herdr-app ls`.
