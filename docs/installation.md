# Explicit local installation

Requires Node 24 or newer; there are no npm dependencies. Compatibility follows
[the execution contract](execution-contract.md): inspected hc 0.1.15,
herdr-app 0.1.10, and zstack 0.22.0. Installation does not enable either mode,
dispatch workers, register skills, change layouts/keybindings, or update itself.

Use an explicit absolute **app configuration directory**, normally
`$HOME/.config/herdr-app`. Symlinked destinations or ancestors are refused; use
their canonical paths. Preview is the default. Review the printed writes/removals,
then repeat the command with `--apply`:

```sh
node scripts/install.mjs install --home "$HOME/.config/herdr-app"
node scripts/install.mjs install --home "$HOME/.config/herdr-app" --apply
node scripts/install.mjs update --home "$HOME/.config/herdr-app"
node scripts/install.mjs update --home "$HOME/.config/herdr-app" --apply
node scripts/install.mjs remove --home "$HOME/.config/herdr-app"
node scripts/install.mjs remove --home "$HOME/.config/herdr-app" --apply
node scripts/install.mjs rollback --home "$HOME/.config/herdr-app"
node scripts/install.mjs rollback --home "$HOME/.config/herdr-app" --apply
```

Only direct runtime `.js` files and `mod.json` from `mods/task-evidence` are
copied into `mods/zstack-task-evidence`. Tests, generated typings and editor
files are excluded. Runtime modules must remain direct siblings. Ownership
hashes and the previous transaction's contents live in
`.herdr-zstack-install.json` at the app home. Keep that file to retain removal
and rollback. Reinstall with identical contents does nothing and retains rollback.
Update also removes obsolete owned runtime files.

Any unowned name collision or edited owned file aborts the entire plan, including
removal and rollback, before writes. There is no force overwrite. Back up edits
outside the managed folder and restore the recorded original before retrying;
for a preexisting unowned collision, explicitly move it aside after reviewing it.
Unrelated files inside the mod directory remain untouched. Removal leaves empty
directories and ownership metadata so rollback can restore the last transaction.
Rollback is one transaction deep; its inverse becomes the next rollback. A later
successful change replaces that recovery snapshot.

The installer checks boundaries before writing and restores files on ordinary
write errors. Runtime writes, rollback and error recovery write a unique sibling
temporary file and rename it over the destination, preserving permission bits
without modifying any hardlinked backup inode. Apply holds an exclusive `.herdr-zstack-install.lock` before reading
ownership; a second installer refuses to run. Preview remains read-only. Avoid
concurrent edits by other tools; this is not a crash-safe package manager. After
a killed process, inspect ownership, files, the lock and any
`.herdr-zstack-install.json.tmp` before retrying. Failed state writes retain the
temporary file for recovery. Remove a stale lock only after confirming its process
has stopped; review any temporary state before moving it aside.

For presentation, follow [the portable recipe](../examples/layout-recipe.md).
The mod's `place: none` does not activate a layout.

`node --test` runs dependency-free tests, including disposable app-home installs.
GitHub Actions runs those tests, whitespace checks and generated-file tracking
checks from a clean checkout. It does not install hc, herdr-app, or activate a
personal configuration. Run `herdr-app check mods/task-evidence` separately with
the installed host, then inspect the live UI after async reads, artifact selection
and refresh. Neither CI nor the native initial-render checker proves live UI behavior.
