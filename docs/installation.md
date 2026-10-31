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

Direct runtime `.js` files and `mod.json` from `mods/task-evidence` and
`mods/task-evidence-tabs` are copied into `mods/zstack-task-evidence` and
`mods/zstack-task-evidence-tabs`, respectively. Tests, generated typings and editor
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

## hc companion skills

The repository root is also a `herdr-zstack` plugin. Its manifests are
`.claude-plugin/plugin.json` and `.codex-plugin/plugin.json`. It ships
`herdr-zstack:hc-workflow` and `herdr-zstack:single-worker`. Both are
explicit-only, and neither installs a hook or activates a mode. zstack's session
hook resolves the companion only after the user selects Herdr. A missing or
ambiguous install is a capability gap.

With [just](https://just.systems/) installed, run these from this checkout:

```sh
just install-codex
just update-codex
just install-claude-code
just update-claude-code
```

Run the install recipe once for each host, then its update recipe after changing
or pulling this checkout. These recipes use the local checkout; they do not pull
Git changes. Plain `just` lists the recipes. Restart the host session after an
install or update; Claude Code also supports `/reload-plugins`.

The equivalent manual installation commands follow.

For Claude Code, add this checkout as a directory marketplace, then install the
plugin:

```sh
claude plugin marketplace add /absolute/path/to/herdr-zstack
claude plugin install herdr-zstack@herdr-zstack-local
```

`claude plugin validate .` checks the manifests.

For Codex CLI, register this checkout as a local marketplace, then install the
plugin. These commands use the syntax checked with Codex CLI 0.166.0:

```sh
codex plugin marketplace add /absolute/path/to/herdr-zstack
codex plugin add herdr-zstack@herdr-zstack-local
codex plugin list --marketplace herdr-zstack-local
```

Codex reuses this checkout's `.claude-plugin/marketplace.json` catalog and loads
the plugin's `.codex-plugin/plugin.json` manifest. See OpenAI's
[local marketplace documentation](https://developers.openai.com/plugins/build/plugins#how-local-marketplaces-work).
Start a new Codex session after installation and confirm both companion skills
are available. Installation does not select Herdr execution or authorize workers.

Local installation was checked with isolated Codex and Claude Code configuration
directories; Codex reinstallation also refreshed changed files at the same plugin
version. Live skill discovery has not been exercised. Do not copy the skills into
personal configuration to work around a discovery failure.

### Install from GitHub

For a fresh installation without a local checkout, register the public repository
URL. Both sources use the marketplace name `herdr-zstack-local`; the `just`
recipes above use the local checkout. These commands do not migrate an existing
local registration.

For Codex:

```sh
codex plugin marketplace add https://github.com/fullerzz/herdr-zstack.git
codex plugin add herdr-zstack@herdr-zstack-local
```

To update the GitHub installation, fetch the marketplace before reinstalling:

```sh
codex plugin marketplace upgrade herdr-zstack-local
codex plugin add herdr-zstack@herdr-zstack-local
```

For Claude Code:

```sh
claude plugin marketplace add https://github.com/fullerzz/herdr-zstack.git
claude plugin install herdr-zstack@herdr-zstack-local
```

To update:

```sh
claude plugin marketplace update herdr-zstack-local
claude plugin update herdr-zstack@herdr-zstack-local
```

Restart the host session after installation or updating. Claude Code also supports
`/reload-plugins`. These commands were checked with isolated configuration
directories against public repository revision `ebec254`; live skill discovery
remains unverified.

### Presentation and verification

For presentation, follow [the portable recipe](../examples/layout-recipe.md).
The mod's `place: none` does not activate a layout.

`node --test` runs dependency-free tests, including disposable app-home installs.
GitHub Actions runs those tests, whitespace checks and generated-file tracking
checks from a clean checkout. It does not install hc, herdr-app, or activate a
personal configuration. Run `herdr-app check mods/task-evidence` separately with
the installed host, then inspect the live UI after async reads, artifact selection
and refresh. Neither CI nor the native initial-render checker proves live UI behavior.
