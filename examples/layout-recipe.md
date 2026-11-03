# Add sidebar integrations beside Files and Changes

1. Install the tab bar using [the explicit installer](../docs/installation.md).
2. Clone your chosen layout under a personal name using the installed
   `herdr-app` manual. Do not edit shipped layouts. Keep the original for rollback.
3. In the clone, change the `tabs` block's `content.mod` to
   `zstack-task-evidence-tabs`. This is a copy of Herdr app 0.1.10's tab bar;
   it retains its tabs, Files/Changes controls, and per-space panel memory.
4. Configure extra buttons as described below.

The layout must retain the standard `panel` container and `panel-body` stack
IDs. Files and Changes still respect the existing `workspace.panels` preferences.
Switching spaces remembers each space's panel selection or closed state.

Switch back to the original layout to roll back presentation. Before removing
mods, switch back or remove their references from the clone yourself; the installer
never rewrites layouts or keybindings. Personal tab-bar copies do not automatically
receive future Herdr tab-bar changes; compare against the installed mod when upgrading.

The Task & Evidence panel has been removed. If a clone still has a
`task-evidence` block, or any block whose `content.mod` is
`zstack-task-evidence`, remove it; the tab bar no longer shows its button.

## Additional sidebar integrations

Configure extra buttons in the **tabs block's** `content.props.extraPanels`.
Each entry names an existing direct child of the `panel-body` stack. The tab
bar only selects that child; it does not install or configure its mod.
For example, with an Atuin Threads mod already installed:

```json
{
  "id": "tabs",
  "type": "block",
  "content": {
    "mod": "zstack-task-evidence-tabs",
    "props": {
      "extraPanels": [
        {
          "id": "atuin-threads",
          "label": "Threads",
          "icon": "art/atuin-turtle.svg",
          "iconType": "image"
        }
      ]
    }
  }
}
```

Keep the tabs block's existing size and other properties. Add or retain this
block beside `files` and `changes` in `panel-body.children`:

```json
{
  "id": "atuin-threads",
  "type": "block",
  "content": { "mod": "atuin-threads" }
}
```

`id` and `label` must be non-empty strings. `icon` is optional and defaults to
the Files icon; paths resolve from the Herdr app configuration directory.
`iconType` defaults to `svg` (theme-tinted); `image` preserves the asset's colors,
including full-color SVGs. The asset must already exist.

Extra buttons appear after Changes, in configuration order.
They share the sidebar's collapse, switching, and per-space selection memory.
Invalid entries, missing child IDs, and repeated IDs are ignored (the first
valid entry wins). The IDs `files` and `changes` are reserved;
extras cannot override their buttons or Files/Changes preferences.

Keep integration configuration in your personal layout and integration code/assets
in their own mod. Updates can then replace the project's tab bar without losing
your buttons. The installer still refuses modified runtime copies. For an existing
hardcoded button, back up the modified tab bar and layout, move its configuration
into `extraPanels`, and restore the original installer-owned tab bar before
running `just update-sidebar`. Do not discard unrelated custom code: it must be
preserved or migrated separately. The installer never changes personal layouts.
