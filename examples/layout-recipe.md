# Add the panel to a personal layout clone

1. Install using [the explicit installer](../docs/installation.md).
2. Use the installed herdr-app manual to clone your chosen layout under a new
   personal name. Do not edit shipped layouts. Keep the original for rollback.
3. Add this block to the clone, replacing the project path and space ID with
   values verified from `herdr-app ls`. Choose a unique block ID if necessary.

```json
{
  "type": "block",
  "id": "zstack-task-evidence",
  "size": { "px": 360 },
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

4. Select the clone explicitly and verify file reads and refresh in the live app.
   Switching back to the original layout rolls back presentation. Before removing
   the mod, switch back or remove this block from the clone yourself; the installer
   never rewrites layouts or keybindings.

For durable task records, use the task-record props documented by the mod instead
of inventing schema fields here. These paths are explicit examples, not task inference.
