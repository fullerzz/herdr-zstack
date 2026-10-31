# Task & Evidence

A read-only native GPUI panel beside a Herdr workspace. Explicit file paths supply the task brief, acceptance record, verification artifacts, and handoff. Live Herdr agent reports appear separately and never become task acceptance. Native Codex children without Herdr terminals do not appear in that activity list.

Existing `.agent-work/*/status.md` files mix scope, acceptance, checks, decisions and handoff in prose. This panel shows their actual contents without parsing or inventing a status. Select a configured file to read it; Refresh rereads it. There is no automatic task inference, execution, editing, agent messaging, or directory crawling.

Copy only `main.js`, `model.js`, and `mod.json` from this directory to `~/.config/herdr-app/mods/task-evidence/`, then add a block to a **personal layout clone**:

```json
{
  "type": "block",
  "id": "task-evidence",
  "size": { "px": 360 },
  "content": {
    "mod": "task-evidence",
    "props": {
      "title": "Task & Evidence implementation",
      "folder": "/absolute/path/to/your/project",
      "notes": "docs/task.md",
      "space": "<space-id-from-herdr-app-ls>",
      "artifacts": [
        { "label": "Verification", "path": "docs/validation.md" }
      ]
    }
  }
}
```

`notes`, optional `acceptance`, optional `handoff`, and every artifact `path` accept an absolute path or a path relative to an explicit absolute `folder`. `artifacts` is an array of `{label, path}`. Unresolvable paths are omitted; absent or unreadable files show an honest missing/error state. Files are read on selection and Refresh, up to the host's 1 MiB limit. There is no background polling or stale-file claim of live freshness; each successful read has a timestamp. Markdown is rendered read-only using the native TextView.

`space` is an explicit live space ID. Without it, activity links only when exactly one space has the same folder and `machine`. File reads use explicit `machine`, otherwise the linked space's machine, otherwise local (`null`). An unresolved explicit space without a `machine` refuses reads rather than falling back to local. Use the machine's paths and fully qualified live space ID for a remote task. Matching a workspace is not proof that every agent works on this task. File choice is manual; change the layout props to select a different task.

Run:

```sh
herdr-app check mods/task-evidence
node --test mods/task-evidence/*.test.mjs
```

The host checker covers the initial render only. Installation must also be checked in the live app after file reads and navigation. `mod.json` uses `place: none` to avoid automatically changing a layout merely by installing the folder.
