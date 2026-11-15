# Explicit local installation

Run `just install` to install or update this checkout's tab-bar mod, hc role
templates, and Codex and Claude Code plugins. It requires `node`, `codex`, and
`claude` on PATH and stops if any step fails. Completed steps remain installed;
rerun after resolving the failure. Restart host sessions to load updated plugins.

Mods use `HERDR_APP_HOME` or `~/.config/herdr-app`; templates use
`${XDG_CONFIG_HOME:-$HOME/.config}/herdr-core`. Templates use the CLI default
models and effort, replacing previous installer-supplied overrides. Personal
layouts, keybindings, and core settings remain untouched; use the layout recipes
below to opt into presentation changes. This command does not pull Git changes.

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

Direct runtime `.js` files and `mod.json` from `mods/task-evidence-tabs` are
copied into `mods/zstack-task-evidence-tabs`. Tests, generated typings and editor
files are excluded. Runtime modules must remain direct siblings. Ownership
hashes and the previous transaction's contents live in
`.herdr-zstack-install.json` at the app home. Keep that file to retain removal
and rollback. Reinstall with identical contents does nothing and retains rollback.
Update also removes obsolete owned runtime files, including an unmodified earlier
install of the removed Task & Evidence panel in `mods/zstack-task-evidence`.
Remove any layout block that still names `zstack-task-evidence` yourself; the
installer never edits layouts.

To update the tab bar from this checkout, run
`just update-sidebar`. It applies the update to `HERDR_APP_HOME` when set, or
`~/.config/herdr-app` otherwise. Run it again after changing or pulling this
checkout; it does not fetch Git changes or change your layout configuration.

For other sidebar integrations, configure the tab bar's
[`extraPanels` layout prop](../examples/layout-recipe.md#additional-sidebar-integrations)
instead of editing its installed JavaScript. Button configuration then survives
sidebar updates; integration mods and assets remain separately managed.

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

## hc role templates

`templates/` ships zstack's two roles as hc templates, one per CLI:

| Template | Command |
|---|---|
| `z-agent-claude` | `claude --permission-mode auto --disallowedTools 'Bash(hc send *--force*)' --allowedTools 'Bash(hc send -- *)'` |
| `z-agent-codex` | `codex --no-daemon --approve-for-me` |
| `comment-sicko-claude` | `claude --permission-mode auto --disallowedTools Write,Edit,NotebookEdit 'Bash(hc send *--force*)' --allowedTools 'Bash(hc send -- *)'` |
| `comment-sicko-codex` | `codex --no-daemon --approve-for-me` |

The Claude allow rule covers only `hc send -- …`. After `--`, hc parses every
argument as text, so no quoting of `--force` can turn it into a flag. Any other
`hc send` form goes through the normal permission flow. The deny rule refuses
the literal `--force` spelling even when the user's permission mode would allow it.

Both Claude templates start in auto mode, so a worker does not stop at each
shell command or at a read outside its checkout. Claude Code's classifier
reviews those actions instead, and deny rules still apply. One prompt remains:
until you have answered it once on a host, Claude Code asks before the first
read outside the working directories, and both templates read z-mode's
`SKILL.md` first. Answer it yourself in the worker's terminal. Auto mode is not a
sandbox and does not enforce the brief's write scope. If auto mode is unavailable
to the session, Claude Code starts in Manual and the worker prompts again.

Each body carries the role, the instruction to read z-mode's `SKILL.md` first,
the no-delegation rule and the report route. The task given to `hc run` must supply
the absolute z-mode path, the coordinator's literal address, the task ID and, for
`z-agent`, the report path. `comment-sicko` writes no file: it leaves its report on
screen for `hc read` and sends one status line.

Both Codex templates start with `--approve-for-me`, Codex's automatic review
mode. It keeps the workspace-write sandbox and sends each approval request to
Codex's reviewer instead of asking, so a worker does not stop at a prompt. The
flag cannot be combined with `--sandbox` or `--ask-for-approval`. Codex
0.166.0's `read-only` sandbox blocks `hc send`
(`cannot start core: Operation not permitted`), so no template uses it. Neither
`comment-sicko` variant enforces read-only behavior with a sandbox; the role
forbids writes and the coordinator checks the checkout afterwards.

Install them into the herdr-core configuration directory, normally
`$HOME/.config/herdr-core`, with `--target templates`. The same preview, apply,
ownership, collision-refusal and rollback rules apply as for mods:

```sh
node scripts/install.mjs install --target templates --home "$HOME/.config/herdr-core"
node scripts/install.mjs install --target templates --home "$HOME/.config/herdr-core" --apply
hc templates
node scripts/install.mjs remove --target templates --home "$HOME/.config/herdr-core" --apply
```

Templates keep each CLI's default model and effort (roadmap D5). To override one,
pass it explicitly at install or update time:
`--claude-model`, `--claude-effort` (`low`, `medium`, `high`, `xhigh`, `max`),
`--codex-model` and `--codex-effort`. They render as `--model`/`--effort` for
Claude and `-m`/`-c model_reasoning_effort=` for Codex. Codex effort values are
checked only for shape. Pass the same overrides again on every update; an update
without them restores the defaults.

Ownership lives in `.herdr-zstack-templates.json` beside `templates/`, separate
from the mod state, so rolling back one target never reverts the other. Only
`templates/<name>.md` files this installer wrote are owned. Personal templates and
`config.toml` are never touched, and a personal template with a shipped name aborts
the install.

## hc companion skills

The repository root is also a `herdr-zstack` plugin. Its manifests are
`.claude-plugin/plugin.json` and `.codex-plugin/plugin.json`. It ships
`herdr-zstack:hc-workflow`, `herdr-zstack:single-worker`, and
`herdr-zstack:swarm`, which are explicit-only, and `herdr-zstack:hc-first`,
which agents may load on their own. `hc-first` applies only inside a live hc
terminal that passes the read-only preflight. It routes slow commands, CI
watches and servers through hc and grants no delegation authority. None of
the four installs a hook or activates a mode. zstack resolves the companion when z-mode is activated or restored for automatic
preflight and native-session detection, or when the user explicitly selects Herdr.
A verified live hc terminal qualifies for automatic selection even without the app. A missing or ambiguous install is a capability gap.

When zstack's swarm is the selected workflow, the hc companion loads this
plugin's [swarm addendum](../skills/swarm/SKILL.md) alongside the shared skill.
It adds execution mechanics without copying or replacing zstack's workflow.

When a selected workflow needs a seat from another model family, such as
arena's judge or interrogate's other-provider adversary, the hc companion
applies [seats](../skills/hc-workflow/references/seats.md). That reference
replaces only zstack's one-shot seat launch with an interactive hc terminal.

With [just](https://just.systems/) installed, run these from this checkout:

```sh
just install-codex
just update-codex
just install-claude-code
just update-claude-code
```

The install recipes support both first installation and repeat updates; the
update recipes are shortcuts for already registered hosts. Fresh and repeated
`just install` runs passed in isolated Codex and Claude Code configurations,
including existing marketplace registrations. These recipes use the local checkout; they do not pull
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

### Preflight bootstrap and installation selection

Resolve the loaded `hc-workflow` or `hc-first` skill through the executing host's
catalog or trusted hook, following symlinks to its real absolute path. Its root
holds `skills/` and `scripts/`. Shared initial discovery remains owned by zstack;
the companion validates host selection before importing the selected probe.
Never select the newest-looking cache directory or search other checkouts.

Use an approved absolute Node executable, obtained from the installed runtime's
metadata or the host's tool inventory. A shell alias is not an executable. If a
version-manager shim fails, report a **bootstrap failure**. An already installed
executable may be used under the same sandbox when allowed; do not change
permissions, install a runtime, or move the probe to hc to evade a denial.
The launcher verifies Node by asking for `process.execPath`, then invokes that
executable without a shell command string. It never automatically tries another
runtime after a refusal.

Both hosts need fresh host metadata. From the executing checkout, capture the
installed host CLI's plugin listing, then pass its absolute filename (the
launcher itself only reads it). For Claude Code:

```sh
claude plugin list --json > /absolute/task/installed-plugins.json
/bin/sh "/absolute/companion/scripts/preflight.sh" "/approved/bin/node" --host claude --metadata /absolute/task/installed-plugins.json
```

For Codex:

```sh
codex plugin list --json > /absolute/task/installed-plugins.json
/bin/sh "/absolute/companion/scripts/preflight.sh" "/approved/bin/node" --host codex --metadata /absolute/task/installed-plugins.json
```

Do not reuse a listing after installing, updating, enabling or disabling a
plugin. Capture it in the executing host's configuration and checkout so host
settings apply, and run the launcher from that same working directory. Keep
listings and probe output local; they contain personal paths. The Node and
launcher paths may contain spaces.

Selection contract:

- Claude consumes the `herdr-zstack` entries in `claude plugin list --json`
  whose `enabled` is true. The host CLI computes that flag from its own
  settings for the capture directory, so a plugin disabled in user, project
  (`.claude/settings.json`) or local (`.claude/settings.local.json`) settings
  is not selected. This helper reads no settings file and never enables a
  plugin. An entry with `readFromFolder` (a directory marketplace) selects that
  folder, which the host reports and loads; otherwise the absolute
  `installPath` is selected and its `version` must match the manifest.
  `folderVersion`, when present, must also match.
- Claude reports `enabled` per plugin id, so another project's `project` or
  `local` entry appears enabled wherever the id is enabled. Those entries
  apply only when `projectPath` is the launcher's working directory. Claude
  Code 2.1.325 matched project settings to the exact directory, not an
  enclosing Git root. A user and a project installation with different roots
  in the same directory are ambiguous: no observed host precedence decides
  between them, so resolve them in the host. Any other scope, such as
  `managed`, fails as unsupported. A separately run listing cannot see
  per-session overrides such as `--plugin-dir` or `--settings`; they are
  unsupported. Managed policy settings were not exercised.
- A directory marketplace loads its source folder without a refresh; the
  registered cache record can lag behind it. Such a record is reported as
  informational `companion.staleRegistrations`; it does not reject the folder.
- Codex consumes the enabled, installed `herdr-zstack` entries in
  `codex plugin list --json`. Each entry's marketplace and version select exactly
  `CODEX_HOME/plugins/cache/<marketplace>/herdr-zstack/<version>` (default
  `~/.codex`). Other cached versions are ignored. Missing, conflicting or
  unsupported metadata fails explicitly. A local source's payload must match
  the selected cache, even when the version labels agree.
- The result reports canonical path, manifest version, selection provenance and
  a SHA-256 over both manifests, `skills/`, `scripts/` and `docs/`. This fingerprint
  detects payload drift; it is not a signature or proof of authenticity. No Git
  command, network request or core startup is needed. Only synthetic fixtures
  belong in published evidence.

Exit 2 indicates a bootstrap, installation or probe failure and leaves
`session.status` untested. `bootstrap.status: failed` means Node or the
companion module did not produce a valid report. `companion.status:
unavailable` means host selection failed. `probe.status: failed` means the
selected, verified probe threw; its companion provenance is kept, and
reinstalling the same payload will not fix it. Node itself exits 1 on any
uncaught load error, so the launcher accepts exit 0 or 1 only with a matching
JSON report and otherwise reports a bootstrap failure.
Exit 1 means the probe ran but native-session detection failed; its
reason distinguishes missing caller identity from an unreachable core. Exit 0
requires supported companion selection and a supported session. Direct
`preflight.mjs` remains a diagnostic interface: it reports the executing payload
as `companion.status: unverified`, and does not verify host selection. Upstream
zstack integrations should consume this launcher contract rather than interpret
a bare-Node launch failure as an absent caller.

### Release and refresh contract

Bump both `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` together
for every published companion change, including guidance. Version `0.1.1`
introduces the bootstrap contract. Do not republish changed contents under an
existing version. The regression suite checks manifest agreement and hashes
guidance as well as code; identical cache labels alone do not prove freshness.

For a local marketplace, update the checkout first, then use `just update-codex`
or `just update-claude-code`. For a GitHub-source Codex install, use
`just update-codex-git` (marketplace upgrade followed by plugin add); Claude uses
marketplace update followed by plugin update. These are host plugin operations,
not responsibilities of the mod/template installer. Restart the host session
(or `/reload-plugins` in Claude), capture fresh metadata, and rerun bootstrap.
An old session can retain old instructions even after files refresh. A content
or version mismatch is actionable: refresh the selected host installation and
restart; never repair it by copying arbitrary cache files or changing permissions.

### Presentation and verification

For presentation, follow [the portable recipe](../examples/layout-recipe.md).
The mod's `place: none` does not activate a layout.

`node --test` runs dependency-free tests, including disposable app-home installs.
GitHub Actions runs those tests, whitespace checks and generated-file tracking
checks from a clean checkout. It does not install hc, herdr-app, or activate a
personal configuration. Run `herdr-app check mods/task-evidence-tabs` separately with
the installed host, then inspect the live UI after panel switching and space
changes. Neither CI nor the native initial-render checker proves live UI behavior.
