# Validation

## Issue 1: execution contract — 2026-10-31

Documentation-only capability baseline; no worker was launched and no session controls were enabled.

- Installed `hc --version`: 0.1.15; `hc server status`: running core 0.1.15. Inspected `hc --skill`, top-level help, and `run`, `wait`, and `get` help.
- Installed `herdr-app --version`: 0.1.10. Inspected `--skill`, `--help`, generated app guide and relevant generated type headers. `herdr-app status` reported the existing `personal-task-evidence` layout with no errors; no presentation changes or screenshot inspection were performed.
- Read installed zstack 0.22.0 z-mode, native-host contract, and Herdr workflow/operations. Shared semantics remain authoritative; the execution contract explicitly bounds the legacy TUI command incompatibility.
- This worker had `HERDR_ENV=1` but no `HC_TERMINAL_ID`; parent-linked dispatch was not verified. The contract also permits an explicitly parentless standalone coordinator with recorded ownership and cleanup responsibilities. No focused terminal was adopted as a substitute.
- `git diff --check` passed for the documentation change. Links were checked against their target files. Mod tests and native rendering checks were not rerun because this slice changes no mod behavior.

Limits: templates, CLI model/effort settings, permission enforcement, first-message delivery, live worker completion, remote execution, pause/cleanup and restart recovery remain untested by this slice. Status discovery proves connectivity, not task acceptance. The later pilot must provide those relevant runtime checks before claiming a working worker flow.

## Initial migration — 2026-10-31

Migration accepted locally. Runtime files and tests were transferred byte-for-byte; no new execution behavior was introduced.

- New checkout: all 7 Node tests passed; `herdr-app check mods/task-evidence` passed.
- Original checkout after extraction: structural validation passed (57 skills, zero problems), Node suite passed (212 passed, 61 optional tests skipped), Python suite passed (143 tests).
- Both repositories passed `git diff --check` for tracked changes.
- Live app: migration notes rendered from this checkout; clicking Verification opened this checkout's `docs/validation.md`; app status reported no errors. The original personal layout and both tabs were preserved.
- Installed runtime copies match `mods/task-evidence/`. No commits or pushes were made.

Recovery copy of the original mod (including generated local files) and pre-migration layout: `/private/tmp/herdr-zstack-migration/backup`. This is a local temporary recovery artifact, not a portable dependency.

Historical evidence before migration: all seven focused tests and the native mod checker passed. Live task notes, scoped Codex activity, artifact navigation, and manual refresh were verified in the personal-task-evidence layout. A host initialization bug was fixed by reading herdr.props(), with a regression modeling undefined root init props.

Limits: remote reads have unit coverage only. Windows paths, theme switching, and restart recovery have not been tested live. Native children without core terminals are absent from the activity list. Activity covers a linked space, not proof of task ownership. The panel is explicitly configured and refreshed manually.

## Issue 2: task records and receipts — 2026-10-31

The pure shared schema, coordinator writer and local revision observer are implemented. Six schema/store tests passed, including atomic writes and stale-sequence refusal in a temporary directory, real scratch Git staged/unstaged/untracked revision changes, task-evidence exclusion, malformed field types, and acceptance requiring independent machine/checkout/revision agreement. Independent integration review also fixed preservation of existing malformed JSON primitives and rejected nested checkout observations that could miss dirty siblings. Fixtures cover active, completed-unverified, accepted, stale, missing-worker and malformed records. The UI imports only pure helpers, never the writer or Git observer.

Limits: the writer is local-filesystem coordination, not authenticated distributed ownership. Git observations require frozen writers and exclude ignored inputs/submodule interiors; see [task-record policy](task-record.md).

## Issue 3: single-worker hc pilot — 2026-10-31

The bounded local pilot completed through the [worker lifecycle](worker-lifecycle.md): one delivered assignment, collected report, independent coordinator verification, revision-bound acceptance and exact-owned-process cleanup. Installed versions were hc/core 0.1.15, herdr-app 0.1.10 and interactive Codex 0.166.0; the worker used `gpt-6.1-sol` with low effort.

- Isolated checkout: `/private/tmp/herdr-zstack-pilot-20261031`; task `hc-pilot-20261031`. Authorized writes were `pilot-result.txt` and `.herdr-tasks/pilot/report.md`. The collected screen shows the brief and exact-content assertion, and the report records exit code 0. The worker did not invoke hc itself; the coordinator owned launch, collection and cleanup.
- Terminal t18 stopped at the folder-trust dialog before task delivery and was killed and removed. After specific scratch-folder trust authorization, a fresh assignment reached t19 once; it completed and was killed and removed after collection. Before each kill, the coordinator rechecked the exact PID, process start time and executable. The saved core binding augments the permanent core ID with core process start identity; it does not claim an API-provided restart epoch.
- With the worker stopped, the coordinator checked write scope and asserted that `pilot-result.txt` was exactly `hc pilot verified` plus one newline. Before/after snapshots matched commit `c5f1a96508ad1e5eefb2062a5b7169c57549e6af` and digest `sha256:617d8e0f302163fafaa64d96cf6258a8242528403bea0583f20b130c5e7aa007`. Record sequence 5 retains the accepted receipt and completed activity and points to the final narrative `handoff.md`; this evidence-only update left the observed revision unchanged.
- Evidence inspected under `.herdr-tasks/pilot/`: `record.json`, `final-handoff.json`, `coordinator-check.json`, `collected-screen.txt`, `mcp-check.json`, `report.md`, `occupant.txt` and `core-process.txt`. These are local temporary evidence, not portable test dependencies; this section preserves their non-secret conclusions.

Limits: scratch-folder trust persists for that authorized directory. All discovered MCP servers were disabled. Explicit workspace-write/on-request launch settings used no bypass flags, but the managed UI displayed Custom permissions / Approve for me; this does not prove a separate manual-only approval policy or adversarial permission enforcement. Labels and status alone do not prove ownership. This pilot establishes the bounded local flow, not remote execution, portable session identity or all recovery acceptance.

## Issue 4: pause and pickup reconciliation — 2026-10-31

The explicit operator workflow and pure lifecycle helpers implement launch-once decisions, exact binding reconciliation, scoped pause proposals, fail-closed acceptance and sequence-checked coordinator receipt integration. Eight isolated fixture tests in `workflows/worker-lifecycle.test.mjs` passed. They cover surviving work after simulated app closure, lost core/worker identity, reused addresses/fresh shells, stale sessions, checkout or digest changes, unavailable machines, ambiguous delivery, unknown host state and changed verification snapshots. No fixture sends input or signals a process.

The live pilot supplies process accounting and a final handoff for both owned attempts: neither remains a writer, acceptance is bound to the tested dirty revision, and pickup explicitly requires fresh authority and process-start evidence with no replay. It does not supply a live interruption/resumption or restart test.

Limits: app closure, core restart and remote failure were simulated, not induced on the user's runtime. No live host-persistence claim is made. Issue 4's implementation and fixture coverage are complete. Issue 17 later supplied [live local restart evidence](#issue-17-supporting-processes-and-live-restart-recovery--2026-11-01) in an isolated session; remote recovery remains unverified. See [recovery checks and proof limits](worker-lifecycle.md#recovery-checks-and-proof-limits).

## Issue 5: task-connected panel — 2026-10-31

Explicit task choices now read schema records and expose brief, artifacts, receipt evidence and handoff. Receipt decisions are snapshots; absent independent current revision observation remains unverified, while record/receipt mismatch is stale. Saved worker core/terminal/occupant bindings are displayed. The installed AgentInfo lacks core and stable occupant identity, so all linked-space live activity remains ownership unverified. Address equality does not establish task ownership.

Panel tests cover explicit selection and refresh generation races, missing/malformed/unavailable records, stale receipts, file-role resolution, malformed task-choice config, manual file reads, remote routing guards and unavailable ownership identity. Final `node --test` passed all 30 integrated tests on Node 24.22.2, both in the working tree and a clean source export without generated host files. `herdr-app check mods/task-evidence` and `git diff --check` passed after the final sidebar fix. The checker proves initial rendering only.

Live QA rendered first in disposable app home `/private/tmp/herdr-zstack-panel-qa-20261031`. Because computer control attached to the existing app window, click tests used a uniquely named temporary mod/layout in that window; existing personal files were preserved. Verified ALPHA/BETA selection, the real pilot record with its actual receipt and coordinator evidence, long-artifact scrolling through paragraph 99, disk-update refresh, and layout switching. Only the task record path was configured for the pilot; its artifact paths came from the record.

The 360px sidebar test found that long worker bindings and artifact selectors pushed document content out of reach. The fix gives metadata/selectors and document content separate bounded scroll regions, with Refresh fixed above them. A render-tree regression and live scrolling confirmed all pilot artifact controls and the final Markdown handoff remain reachable. Screenshot: `/private/tmp/herdr-zstack-panel-qa-20261031/verified-sidebar.png` (temporary local evidence).

The disposable app was quit. Temporary personal QA files were archived under the disposable home, and the original `personal-task-evidence` layout, space, tab, focused pane and t16 selection were restored; app status reported no errors. No unrelated terminal was changed. Remote UI reads and restart recovery remain unit/simulation coverage only; the panel cannot establish live occupant identity or current Git acceptance from this host API.

## Issue 6: installation and CI — 2026-10-31

Five installer tests passed in disposable homes: preview/apply/idempotency/update/removal/rollback, unrelated-file preservation, ownership collisions, edited-file refusal, symlink boundaries, malformed manifests, obsolete-module cleanup, failed-state-write recovery and transaction-lock refusal. The namespaced install includes all sibling runtime JavaScript modules. Existing personal layouts and keybindings are never rewritten. The QA home was installed through the same explicit installer.

CI configuration is authored, not remotely executed. The Node 24 clean-source-export check passed all 30 tests, and no generated host files are tracked. Installer tests never targeted personal configuration; the separate temporary live-panel setup above was archived afterward. No publication or commit was performed. See [installation](installation.md) for the explicit local transaction and rollback contract.

## Review fixes — 2026-10-31

The revision observer and installer findings were reproduced with failing
regressions before implementation. With the fixes, Node 24.22.2 `node --test`
passes all 37 tests, including hidden tracked edits (`assume-unchanged` and
`skip-worktree`), executable changes with `core.filemode=false`, CRLF conversion
under `core.autocrlf` and `.gitattributes`, hardlinked backups during update and
rollback, and replacement during failed-transaction recovery. `git diff --check`
passes.

The original review repro scripts were rerun against the current helpers:
unchanged input remains accepted; hidden content, mode and line-ending changes
now produce stale acceptance. The installer update leaves the unrelated
hardlinked backup's original bytes intact.

The observer now always hashes raw inputs. Earlier pilot receipts are historical
and require new verification with this observer before current acceptance.
These fixes change coordinator/installer Node helpers, tests and documentation;
no mod runtime code changed in this follow-up. The native checker, live UI and
remote CI were not rerun for this follow-up. No personal app installation was
changed.

## Closeout pilot and acceptance map — 2026-10-31

A fresh, single `gpt-6.1-sol` low-effort worker ran through hc 0.1.15 with
Codex 0.166.0, `--no-daemon --sandbox workspace-write --ask-for-approval never`.
Plugins/apps and all discovered MCP servers were disabled for that invocation.
The effective terminal UI and worker policy both reported `never`; no personal
permission settings were changed. The earlier pilot's `on-request` flags alone
had not established this behavior under the managed automatic reviewer.

The worker ran a coordinator-owned assertion script in its default sandbox:

```json
{"allowedWrite":"passed","protectedWrite":"EPERM","pilotContent":"passed"}
```

The script wrote/read a scoped evidence file, attempted a harmless exclusive
create of `.git/herdr-closeout-probe`, required `EPERM` or `EACCES`, and checked
`pilot-result.txt` for the exact required bytes. It exited 0. No escalation or
outside-sandbox retry occurred. The launch prompt appeared once; no assignment
was resent. The coordinator collected the report/screen, rechecked the exact
worker PID/start time/executable and core identity, killed only t1c, confirmed
its finished state, and removed it.

With the writer stopped, the coordinator independently reran the probe using
`codex sandbox -P :workspace --include-managed-config`, retaining the inner
sandbox while executing outside the outer sandbox (which cannot initialize a
nested Seatbelt sandbox). The independent probe exited 0 with the same output.
Tracked diff and nonignored-untracked checks verified write scope; the protected
probe file was absent. Before/after `observeRevision` snapshots matched:

- Commit: `c5f1a96508ad1e5eefb2062a5b7169c57549e6af`.
- Raw-input digest: `sha256:a4e0cb361d05225b1e836dc334d3b14c87fae27ec14964bac17a589e5ec25efd`.
- New task: `hc-closeout-20261031`; sequence 2 accepted via `recordAcceptance`.

Local evidence lives in
`/private/tmp/herdr-zstack-pilot-20261031/.herdr-tasks/closeout/`:
`launch-attempt.json`, `mcp-check.json`, `report.md`, `collected-screen.txt`,
`prestop-get.json`, `finished-get.json`, `coordinator-check.json`, `record.json`
and `handoff.md`. These temporary artifacts are not portable dependencies;
the observed outcomes are recorded here. This is a bounded filesystem and
approval-policy proof, not exhaustive adversarial sandbox certification.

The native checker passed again. A fresh disposable app home, installed by the
repository installer, rendered the new record with its actual digest and
artifacts after the asynchronous read. The inspected screenshot showed
`RECEIPT SNAPSHOT: accepted` alongside current `Acceptance: unverified`, as
required without independent Git observation in the panel. The disposable app
exited normally and its terminal t1d was removed. The personal app remained on
`personal-task-evidence` with t16 selected and no errors. Earlier live selection,
refresh, scrolling and layout-switch checks remain the interaction evidence;
this pass verified the refreshed receipt rendering.

| Issue | Acceptance evidence and remaining publication gate |
|---|---|
| #1 | Operation matrix, capability preflight, explicit session/authority rules and installed-version baseline in the execution contract. |
| #2 | Schema fixtures, atomic store tests, revision/identity checks and five hidden-input regressions; refreshed raw-input receipt above. |
| #3 | Real single-worker completion and owned cleanup, fresh permission probe above, and no-duplicate-dispatch fixture coverage. |
| #4 | App closure with surviving binding, core/worker loss, stale/reused occupant, unavailable remote, stale revision and scoped pause are simulated in lifecycle tests. No host-restart claim; simulations are allowed by the issue. Real pilot supplies process accounting and final safe handoff. |
| #5 | Native checker, prior live selection/refresh/scroll/layout checks and refreshed real receipt rendering; the panel remains read-only and labels unavailable ownership evidence. |
| #6 | Disposable installer tests include update/rollback/recovery hardlink protection; all 37 Node tests pass locally. Remote clean-checkout CI must pass on the published PR before closeout. |

## Shared Task & Evidence sidebar — 2026-10-31

Added a personal Herdr 0.1.10 tab-bar copy with Task & Evidence beside Files and
Changes. The button uses the same `panel` / `panel-body` show, hide and selection
commands and remembers panel choice/closed state per space. It appears only when
that layout contains the task block. The installer owns both namespaced mods;
layout changes remain explicit.

- All 41 Node tests passed, including button toggling, switching, per-space restore,
  existing Files/Changes preferences, and two-mod install/remove/rollback.
- Native checks passed for `mods/task-evidence` and `mods/task-evidence-tabs`.
  The sandboxed checker could not access macOS services and was interrupted;
  the checks passed when rerun with native host access.
- Installed both namespaced mods, moved the existing configured block inside the
  personal layout's shared stack, and retained its task props. Shipped layouts,
  original `personal`, keybindings and terminal topology were preserved.
- Live clicks verified open, collapse, Files, Changes, return to Task & Evidence,
  async Markdown reads, Verification artifact selection and Refresh. App status
  reported no errors. Screenshots are temporary local evidence under
  `/private/tmp/herdr-task-panel-{closed,files,changes,artifact,refreshed}.png`.
- Pre-change personal layout: `/private/tmp/herdr-task-evidence-layout-before.json`.
  Switching to `personal` also restores the original presentation.

Limits: per-space restore has unit coverage; app restart, remote reads and Windows
window controls were not exercised live. The personal tab-bar copy is pinned to
Herdr 0.1.10 and needs comparison with shipped tabs after future host upgrades.

## Issue 9: native detection and preflight — 2026-10-31

Added `scripts/preflight.mjs`, a read-only JSON report of the execution
contract's supported / unavailable / untested matrix. Native detection requires
`HC_TERMINAL_ID`, an answering caller core and a live resolution of that
address. `HERDR_ENV` is diagnostic only.

### Host behavior

Observed on hc 0.1.15 / macOS, using scratch `HC_SESSION` and XDG directories
under `/tmp` (never the user's core):

- The hc CLI **starts a core on demand** for both `hc server status` and
  `hc get`. A fresh status answered with `uptime_ms: 10`. The manual says only
  Windows `server status` never starts one.
- The CLI ignores `HC_TERMINAL_SOCKET` and addresses `HC_SOCKET` when it is set.
  hc also exports `HC_SOCKET` into terminals of a core started with it.
  Otherwise the CLI derives the socket from `HC_SESSION` (default `default`):
  - `$XDG_RUNTIME_DIR/herdr-core/<session>.sock` when `XDG_RUNTIME_DIR` is set;
  - otherwise `${XDG_STATE_HOME:-~/.local/state}/herdr-core/<session>/<session>.sock`.
- It also accepts a quoted `"socket" =` key in `config.toml`.
- The core speaks JSON-RPC 2.0, one message per line, on its socket (`hc schema`,
  protocol generation 1). `hello`, `server.status`, `terminal.get`,
  `templates.list` and `machine.list` answered on the user's core with the same
  data as the CLI.
- Claude Code runs this directory-marketplace zstack plugin from its source
  checkout. The session hook's `${CLAUDE_PLUGIN_ROOT}` resolved to
  `/Users/zachfuller/Code/Misc/zachs-agent-skills`, whose manifest says 0.22.0.
  The plugin cache copy is a stale 0.1.0. Codex uses its own 0.22.0 cache copy.

Consequently, preflight never runs an hc core command. It sends those read-only
methods to `HC_TERMINAL_SOCKET` directly, so an absent or vanished core is a
failed connection, not a new core. `terminal.get` is sent without `caller`,
because that parameter marks child news as seen. Before dialing, preflight
requires that the hc CLI would address the same socket; otherwise dispatch could
reach another core. Each scratch core was stopped with its own session's
`hc server stop`, and the scratch directories were removed.

### Interrogation fixes

Three adversaries ran in isolated worktrees: two Claude Opus 5.5 native agents
and one Codex `gpt-6.1-sol` CLI seat. Seven verified findings were fixed, and
each original repro was rerun.

| Finding | Before | After |
|---|---|---|
| 1a. `HC_SOCKET` elsewhere and a different `XDG_STATE_HOME` | The gate passed. `hc server status` started core `ec01cba7…` at `z.sock`, and the report marked it `supported`. | Unavailable: "the hc CLI would address …/z.sock, not the caller core". No `z.sock` and no state files were created. |
| 1b. Inside a scratch terminal of a core started with `HC_SOCKET=y.sock` | Exit 1 with a false socket-mismatch reason. | Exit 0, supported: socket and CLI socket are both `y.sock`, caller `t1`. |
| 2. Quoted `"socket" =` key in the config | The guard was skipped, and a core started at the custom socket. | Unavailable: "sets a socket". `custom.sock` was not created. |
| 3. Core stopped after the readiness check | A replacement core started and was reported `supported`. | The stop was injected before the RPC: unavailable with `ENOENT`. No replacement and no `hc serve` remained. |
| 4. Claude copy broken while the Codex copy is complete (`CLAUDECODE=1`) | `supported`, using the Codex path. | `unavailable`, naming the Claude copy's path and its missing native-host contract. |
| 5. Installs found only through `CLAUDE_CONFIG_DIR` / `CODEX_HOME` | "no installed zstack found". | Both copies discovered. |
| 6. No host detected and differing copies | `supported` with `path: null`. | `untested`: "pass --host or --zstack". Run live with `env -u CLAUDECODE`. |
| 7. `--zstack` without a value | Exit 0, with automatic discovery. | Exit 2: "--zstack requires a value". |

### Live results

Results in this session's terminal (`HC_TERMINAL_ID=t16`, `HERDR_ENV` unset):

- **Inside hc:** exit 0, `session.status: supported`.
  - Core `d69141182c390e697d361b31591615ed` (`zachs-macbook-pro`). hc, core and herdr-app versions matched the baseline.
  - Caller `t16` was live with root topology (no parent).
  - Templates were unavailable (none installed). Machine `buntu26` was connected.
  - zstack 0.22.0 resolved at the source checkout above.
  - `commands` listed only `hc --version` and `herdr-app --version`. `requests` listed the five read-only methods.
- **Outside hc** (`HC_TERMINAL_ID`, `HC_TERMINAL_SOCKET` and `HC_SCOPE` unset): exit 1, because `HC_TERMINAL_ID` is not set. Nothing was dialed. `HERDR_ENV=1` without an ID reported a legacy-only environment.

### Fixture tests

The 19 tests in `scripts/preflight.test.mjs` cover:

- A supported session, with no terminal screen or status text in the report, and child topology.
- A missing ID, and a legacy-only environment.
- Unresolvable (`not_found`), finished and mismatched addresses.
- Unreachable and vanished cores, with only the version commands run.
- Protocol and core-identity mismatches.
- `HC_SOCKET` naming the caller's core or another core.
- Other CLI-socket mismatches and Windows.
- Bare, quoted, table and dotted `socket` keys, plus the comment case.
- Core failure, version drift, missing binaries and missing zstack.
- Host-scoped zstack selection, the undetected-host case and the config-directory overrides.
- The allowlist, socket placement, and `socketRpc` against a local line server (replies, early close, absent socket).
- CLI usage errors.

All 60 Node tests passed on Node 24.22.2. The 23 mod tests and
`herdr-app check mods/task-evidence` passed, and `git diff --check` passed. No
mod code changed.

### Limits

- A resolved address is not occupant identity.
- The CLI-socket rule mirrors hc 0.1.15 as observed on macOS, so re-check it after hc upgrades.
- Windows and any configured `socket` report unavailable instead of being checked.
- The core protocol is undocumented beyond `hc schema`; preflight requires generation 1.
- Template, machine and remote rows prove listing only.
- Hook routing to a herdr-zstack companion (rest of M1) needs the agent-skills
  change and is not part of this slice.

## Issue 11: hc-workflow companion and two-worker roster pilot — 2026-10-31

Added the [hc-workflow companion](../skills/hc-workflow/SKILL.md), its
[operations reference](../skills/hc-workflow/references/operations.md), the
run index (`workflows/roster.mjs`, `writeRun`), and `herdr-zstack` plugin
manifests. `claude plugin validate .` passed. The plugin was not installed into
any personal configuration.

### Live pilot

Coordinator: this Claude Code session in `t16`. Workers were authorized by the
user for this pilot. Versions matched the baseline: hc and core 0.1.15, Codex
0.166.0 at its default model (`gpt-6.1-sol`, high effort, per D5).

- **Run.** Scratch checkout `/private/tmp/herdr-zstack-roster-20261031` at base
  commit `1645b013a2315d567302b6f5f62b5cdb4ce94fdf`. Run index
  `.herdr-tasks/roster-pilot/run.json`. Members `roster-a` (writes `a.txt` and
  its report) and `roster-b` (writes `b.txt` and its report). `validateRun`
  accepted the disjoint scopes. The coordinator wrote both records and the index
  before launch.
- **Launch.** Each worker got one `hc run --bg --json` with run, task and role
  labels. The task was in the argv. Codex ran directly with `--no-daemon`,
  `--sandbox workspace-write --ask-for-approval never`, apps and plugins
  disabled, and all eleven configured MCP servers disabled. Each member's handoff
  recorded `launchAttempted` before its launch. hc returned `t1m` and `t1n`, both
  `agent: codex` and `parent: t16`.
- **Delivery.** The launch response had **no `first_message` field** for a
  direct argv task, so delivery was unknown until the screens were read. Both
  workers stopped at Codex's folder-trust dialog. The invocation-only
  `projects."<path>".trust_level` override did not suppress it. With the user's
  specific authorization, the coordinator chose "Trust and continue" in each
  terminal. That persisted a trust entry for this one scratch path in
  `~/.codex/config.toml`. A second dialog asked to trust 8 new hooks. The
  coordinator chose "Continue without trusting (hooks won't run)". Each screen
  then showed the launch prompt exactly once. No task was resent.
- **Reports.** Both reports arrived as hc notes:
  `<hc from="t1n roster-pilot-b">roster-b done: …</hc>`, then the same from
  `t1m roster-pilot-a`. Each `hc wait --children any` returned
  `reason: message` with the matching `from`. Then `--children all` returned
  both children `done`. **`hc send` worked from inside Codex's workspace-write
  sandbox** (the screens show exit 0). The coordinator read both report files
  and saved both screens. Each worker also read its Codex memory index before
  reading the brief. That read is outside the brief's intent but wrote nothing,
  and both reports disclosed it.
- **Binding and freeze.** Each record bound the core ID plus the core process
  start time, the terminal address, and the occupant PID with its start time and
  executable. Before each kill, the coordinator rechecked the PID start time and
  executable. After the kills, `hc get` showed both `finished`
  (`reason: killed`).
- **Acceptance.** `observeRevision` ran before and after the coordinator checks:
  exact content of both files, HEAD unchanged, and untracked files exactly
  `a.txt` and `b.txt`. Both snapshots matched digest
  `sha256:f480775aba2a0a466f7071fe90eed8ae5fcb1ffd0012034c288aff95491346de`.
  `recordMemberAcceptance` then wrote both receipts (sequence 3) against that one
  snapshot. The coordinator also checked that neither worker had changed its
  record or the index. Both records reached sequence 4, `completed`, and
  `acceptanceStatus` reports `accepted` against a fresh observation.
- **Cleanup.** `hc ls --all --label run=roster-pilot` listed only `t1m` and
  `t1n`. `hc rm` removed exactly those two. The following listing was empty. No
  other terminal was touched, and `herdr-app` was not used.

Evidence is under
`/private/tmp/herdr-zstack-roster-20261031/.herdr-tasks/`: `roster-pilot/`
holds `run.json`, `coordinator-check.json`, the core process and the cleanup
listings. Each member directory holds `task.json`, `brief.md`, `handoff.md`,
`launch-attempt.json`, `launch.json`, `report.md`, `collected-screen.txt`,
`occupant.txt`, and the running, pre-stop and finished `hc get` output. These
files are temporary local evidence, not portable dependencies.

### Fixture tests

`workflows/roster.test.mjs` adds 8 tests:

- The run fixture is a valid index, is not a task record, and leaves the schema 1
  fixtures valid.
- Rosters are limited to 1–3 members with unique IDs.
- Members in one checkout need disjoint writes.
- No member may write a coordinator file.
- Worktrees may not nest.
- Malformed input fails.
- Acceptance waits for every writer in the checkout to finish.
- No worker or non-coordinator can accept.
- Index writes are sequence-checked.

All 68 Node tests passed on Node 24.22.2, including the 23 mod tests.
`herdr-app check mods/task-evidence` and `git diff --check` passed. No mod code
changed.

### Limits

- The workers ran in one shared checkout. Separate worktrees have fixture
  coverage only.
- The roster had two members. Three members, remote members, pause and pickup
  have fixture coverage only.
- Codex's trust and hook dialogs need an operator decision for every new path.
  The invocation-only override did not avoid them.
- A sandbox does not stop a worker from writing its own record. The coordinator
  checked that afterward. Enforcement is still by brief and inspection.
- Without `first_message`, delivery is established by reading the screen, not by
  an API field.
- Claude Code installation of the companion was validated by manifest only.
  Codex installation was not exercised.

## PR 23: interrogation fixes — 2026-10-31

Fixed the five independently reproduced scope and acceptance defects:

- Scope checks now compare resolved absolute targets, including existing symlinks
  and ancestors of files not yet created. Non-normalized checkout paths fail.
  Case and Unicode-normalization variants conservatively conflict on every host.
  Workers cannot reach protected records through aliases or from a checkout
  containing the coordinator checkout. Dangling symlinks and writes outside the
  checkout fail validation; disjoint symlink targets remain usable.
- Acceptance takes the same run-index lock used by `writeRun` and holds it through
  receipt publication. The complete supplied index must match the persisted
  index, so neither an older sequence nor a truncated member list can omit a
  live writer. Concurrent index writes fail with an occupied lock.
- Reconciled member records must match the run's machine as well as its task,
  checkout and coordinator.
- The shared `acceptanceReceipt` checks owner/coordinator equality on the record
  actually being accepted. A coordinator ownership update between roster
  reconciliation and receipt creation can no longer bypass the self-acceptance
  guard. A later update is still rejected by the existing sequence check.

Added five regression tests in `workflows/roster.test.mjs`. All five failed
against the original code, then passed with the fixes. The concurrency test uses
an actual FIFO to pause a sibling read, updates the target's owner through
`writeRecord`, and verifies rejection without a receipt. It also verifies that
`writeRun` cannot update the locked index during acceptance and that the lock is
released after rejection. Existing acceptance fixtures now persist their run
index before use.

Validation on Node 24.22.2: all 73 tests passed, including the 23 Task & Evidence
tests and unchanged schema 1 fixtures. `git diff --check` passed.
`herdr-app check mods/task-evidence` passed outside the sandbox. Its initial
sandboxed attempt emitted macOS GUI-service connection errors and hung; it was
interrupted before the successful retry. No live UI or worker pilot was rerun,
no mod code changed, and no personal configuration was changed.

Limits: validation observes local filesystem state; it does not prevent a worker
from changing symlinks after validation. Revalidate immediately before launch,
keep targets stable while workers run, and inspect actual edits. Conservative
case folding also rejects case-only distinctions on case-sensitive filesystems.

### Review follow-up: unique member record targets

The current-head review found that distinct member IDs could resolve to the same
record through case differences or symlinked evidence directories. Scope
validation now rejects duplicate resolved member-record paths before a run can be
persisted. The regression covers both cases and verifies that a rejected update
leaves the existing index unchanged. It failed before the fix; all 74 Node tests
pass afterward on Node 24.22.2. `git diff --check` passed. No mod code changed and
no live worker pilot was rerun for this follow-up.

## Local plugin installation recipes — 2026-10-31

Checked CLI help with Codex 0.166.0 and Claude Code 2.1.316. Using copied plugin
sources and temporary `CODEX_HOME` / `CLAUDE_CONFIG_DIR` directories, both hosts
successfully registered the local marketplace and installed the plugin. Repeating
Codex's `plugin add` copied a changed file at the same plugin version. Claude's
marketplace and plugin update commands succeeded; its plugin update reported
that the local source folder is read at the next session start or
`/reload-plugins`, rather than refreshing the cached copy immediately.

No personal plugin configuration was changed. These CLI checks do not prove live
skill discovery or execution. The temporary sources and configuration directories
were removed afterward. With just 1.59.0, recipe listing, dry runs of all four
install/update recipes, and `just --fmt --check` passed. Plain `just` lists the
recipes. `git diff --check` passed.

## Public GitHub plugin installation — 2026-10-31

With Git credential helpers and interactive credential prompts disabled, both
Codex 0.166.0 and Claude Code 2.1.316 successfully registered
`https://github.com/fullerzz/herdr-zstack.git` and installed
`herdr-zstack@herdr-zstack-local` at version 0.1.0. Public HEAD was `ebec254`.
Both installed plugin directories contained `hc-workflow` and `single-worker`
skill files. Codex's named marketplace upgrade and subsequent plugin add passed;
Claude's named marketplace update and plugin update passed, reporting version
0.1.0 already current.

The checks used temporary `CODEX_HOME` and `CLAUDE_CONFIG_DIR` directories, which
were removed afterward. No personal source registration was changed. This proves
fresh GitHub installation and update commands against the current revision;
upgrading to a newer plugin release and live skill discovery were not exercised.

## Issue 12: zstack roles as hc templates — 2026-10-31

`templates/` adds four role templates: `z-agent-claude`, `z-agent-codex`, `comment-sicko-claude` and `comment-sicko-codex`. `scripts/install.mjs` gains `--target templates`, with its own ownership file, and explicit model and effort overrides. Installed versions: hc and core 0.1.16, herdr-app 0.1.11, Claude Code 2.1.316, Codex 0.166.0 and Node 24.22.2. The CLI flags were checked against each CLI's `--help`.

### Isolated live run

Everything ran in an isolated core. It used `HC_SESSION=hzprobe` with a scratch `XDG_CONFIG_HOME`, so templates were read from a scratch `herdr-core/templates/`. Its state and socket lived in a short `/private/tmp` directory, because the scratchpad path exceeds the 103-byte socket limit. The user's core, `~/.config/herdr-core` and personal templates were not touched. A `cat` terminal (`coord`) stood in for the coordinator, so each `hc send` landed as text that `hc read coord` could show.

- **Parsing.** A probe template showed that hc splits `command` like a shell, so quoted arguments such as `'Bash(hc send:*)'` stay whole. It also showed that hc sends the body and task as the first message once the agent is ready, not as argv.
- **Install and list.** The installer preview listed four writes. `--apply` wrote them, and `hc templates` listed all four with the expected commands. `--claude-effort turbo` was refused with exit 1.
- **`comment-sicko-claude`.** It reviewed the comments in `scripts/install.mjs` and launched as `claude-code` with `first_message.sent: true`. It read the given z-mode path and wrote no files. It left its report on screen and sent `sicko-claude done: report on screen`, which arrived at `coord`.
- **`comment-sicko-codex` with `--sandbox read-only`.** The review completed without writes. But `hc send` failed with `cannot start core: Operation not permitted`, so no report arrived. The template was changed to `workspace-write` and updated through the installer (one write). A rerun reviewing `templates/comment-sicko-codex.md` sent `sicko-codex2 done: report on screen`, which arrived.
- **`z-agent-codex`.** A read-only task (`git rev-parse HEAD`) wrote only its assigned report outside the checkout and sent `zagent-codex done: <report path>`. The report gave `b843dbba1a348313daae9cbafd4fbd12ba870c54`.
- **Checkout.** `git status --short` was identical before and after the runs. The coordinator applied the reviewers' comment findings to the new installer code afterwards.
- **Uninstall.** An unowned `personal.md` template was added, and `hc templates` listed five templates. `remove --apply` removed four. `hc templates` then listed only `personal`, whose SHA-256 was unchanged. After the probe file was deleted, the list was empty.
- **Cleanup.** `hc ls --all --label run=sicko-pilot` listed exactly the coordinator and three live workers. These and the parsing probe were killed and removed, the listing was empty, and the isolated core was stopped.

Screens, launch responses and the template listing are under this session's scratchpad (`hcprobe/`). They are temporary local evidence, not portable dependencies.

### Tests

`scripts/install.test.mjs` adds 5 tests, all in disposable homes:

- Each shipped template has a name that matches its file, a description, a per-CLI command with no baked-in model or effort, the z-mode read instruction, the no-delegation rule and the report route.
- Templates install beside unowned templates and `config.toml`. Removal leaves exactly the prior directory listing, and rollback restores the templates.
- Collisions, edited templates and mod entries in the templates state all abort before any write.
- Overrides render per CLI and roll back. Invalid efforts, unsafe models, unknown CLIs, and overrides on remove or on the mods target are refused.
- Malformed sources are refused: an empty source, a name that does not match its file, a non-Claude/Codex command and an unknown target.

All 79 Node tests passed. `git diff --check` passed. No mod code changed, so `herdr-app check` and live UI inspection were not rerun.

### Limits

- Neither `comment-sicko` variant is sandbox-read-only. Claude's Bash and Codex's `workspace-write` can both write; the role and the coordinator's checkout check enforce read-only behavior.
- The Claude worker started in the user's default permission mode (here, auto mode). Its tool behavior depends on personal settings that the template does not pin.
- `z-agent-claude` was not run live. Model and effort overrides have test coverage only.
- `hc send` returned `{"started":null,"status":null,"turn":0}` to a `cat` target, so delivery was confirmed by reading `coord`, not by the API response.
- Installation into the real `~/.config/herdr-core` was not performed.

## Issue 13: hc swarm addendum — 2026-10-31

Added [the swarm addendum](../skills/swarm/SKILL.md) alongside the installed
zstack 0.23.0 swarm. The hc companion links it only for the selected swarm
workflow. Shared partitioning and acceptance remain in zstack; existing roster
and schema 1 receipt producers are reused. Both Claude's frontmatter and Codex's
`agents/openai.yaml` keep the new skill explicit-only. No mod code changed.

### Live setup

The user explicitly enabled Herdr for these pilots, limited workers to two at a
time, and authorized Codex's persisted trust entry for the scratch repository.
The calling session had no `HC_TERMINAL_ID`; its initial preflight correctly
reported unavailable. A dedicated task-owned Node coordinator (`t1`) ran in an
isolated `HC_SESSION=swarm13`, with scratch XDG configuration/state under
`/private/tmp/herdr-swarm-13`. Its own native preflight reported supported and
its literal address was used as the explicit parent and report recipient.
The user's default core was never controlled.

Inspected versions: hc/core 0.1.16, herdr-app 0.1.11, Node 24.22.2, Codex
0.166.0. The worker screens exposed GPT-6.1-Sol, xhigh, from CLI defaults;
no model or effort override was supplied. Each interactive Codex used
`--no-daemon --sandbox workspace-write --ask-for-approval never`, with apps,
plugins and all eleven discovered MCP servers disabled by invocation flags.
A representative `codex sandbox -P :workspace` Node assertion exited 0.
No hook trust was granted. No shared library or global plugin was installed.

Four sibling writer worktrees started from scratch commit
`a5a06fc841cbf7b032ddc412a22d03572225c1d0`, outside the coordinator checkout.
Each had its own task record, report and exclusive `result.txt`. Before launch,
the coordinator wrote the run index and launch-attempt argv. Names and labels
carried run/task/role. Direct launches omitted `first_message`; screens proved
each prompt arrived once, with no resend. Bindings combined core ID/process
start identity and terminal/occupant PID/start identity, rechecked before control.

### Coverage report — PASS

Done predicate: both slices report PASS and pass coordinator exact-content,
exclusive-write and stable-revision checks. `hc wait t1 --children all
--timeout 30` returned both children done. Both reports arrived via `hc send t1`
and were read before acceptance. Each frozen worktree got a separate receipt
through `recordMemberAcceptance` using matching before/after observations.

| Slice | Terminal | Result/check | Accepted dirty digest | Cleanup |
|---|---|---|---|---|
| coverage-a | t2 | PASS; exact `coverage-a:PASS\n`, exit 0 | `sha256:9cdd88e2b85aa1156fac7938642f0bfd277a32bc018c4775d5e29e670155ca3a` | killed, confirmed finished, removed |
| coverage-b | t3 | PASS; exact `coverage-b:PASS\n`, exit 0 | `sha256:1b590f485de8ac2c49e81f9644ca58259be0bae62f4b5885f88e649d3984c259` | killed, confirmed finished, removed |

### Race report — PASS

Both candidates received the same exact-output task (`42\n`) and checks.
Selection used the first delivered report that passed coordinator verification,
not the first done badge: `race-b` reported first, while `hc wait t1 --children
any --timeout 30` returned `race-a` done. `race-b` was frozen and accepted with
exact-content, exclusive-write and stable-revision checks, all exit 0.

| Candidate | Terminal | Outcome | Evidence | Cleanup |
|---|---|---|---|---|
| race-b | t5 | PASS, selected | report and coordinator check; accepted digest `sha256:d06a970043e631fedcacd3afc1ec9471932ae877a622414856ca10c92900ccf1` | killed, confirmed finished, removed |
| race-a | t4 | completed, unselected | PASS report retained; `hc interrupt` returned `key: esc, outcome: stopped`; fresh get changed live/done to live/idle | killed, fresh get confirmed finished/reason killed, removed |

The final `hc wait t1 --children all --timeout 30` drained the owned remainder.
All four worker addresses were accounted for. The coordinator was then killed,
confirmed finished and removed. The isolated core's final `hc ls --all` returned
`terminals: []`, and only that scratch core was stopped. Worktrees and evidence
remain available; no unrelated terminals, worktrees or user core were touched.

Raw temporary evidence is under `/private/tmp/herdr-swarm-13`: `preflight.json`,
`mcp-check.json`, `parent-reports.txt`, `race-wait-any.json`, `race-drain.json`,
`cleanup.json`, and each member's `.herdr-tasks/<task>/` records, launch argv,
reports, screens, identity snapshots, kill/finished/removal responses and
coordinator checks. These are local artifacts, not portable dependencies.

### Local checks and limits

- All 79 Node tests passed, including the existing schema 1/roster tests and
  mod tests. `herdr-app check mods/task-evidence` passed with host UI access;
  its sandboxed attempt stalled and was terminated before retrying.
- `claude plugin validate .` passed (existing missing-icon warning). Skill
  naming, local links and both explicit-only policies passed an assert-based
  YAML check. The generic skill validator rejects Claude's required
  `disable-model-invocation` field; a temporary normalized copy passed it,
  while the original field and Codex policy were asserted separately.
- `git diff --check` passed. No live mod UI inspection was needed for this
  instruction-only change, and installed-plugin discovery after an update was
  not exercised.
- The race loser had already completed its turn before interruption. This
  proves live done → idle → finished → removed, not interruption of an actively
  working turn. Larger rosters, bounded multi-wave coverage, unrelated sibling
  children, remote workers, lost identity and failed cleanup were not exercised
  in these live pilots. Scope enforcement remains by sandbox, brief and
  coordinator inspection; it is not a separate per-file sandbox.

## Issue 14: other-provider seats on hc — 2026-10-31

Added [seats](../skills/hc-workflow/references/seats.md), linked from the hc
companion. It replaces only zstack's one-shot `codex exec` / `claude -p` seat
launch with an interactive hc terminal. When a seat is needed, which family
counts and the missing-seat rules stay in zstack's `native-hosts.md`. The
native one-shot recipes stay upstream. No mod code changed.

### Live arena judge seat — PASS

The user selected Herdr for this session and authorized one Codex judge seat
under the coordinator `t16` in the default core. They also authorized a Codex
trust entry for the scratch repository. Coordinator: Claude Code 2.1.316 (Opus 5.5).
Seat: Codex 0.166.0 on hc/core 0.1.16. Preflight reported `session.status:
supported`, with caller `t16` as root.

- Scratch repository `/Users/zachfuller/.cache/herdr-zstack/seat14/base` held
  `criteria.md`, two candidates and `check.py`. Run index `arena14` listed one
  member, `judge`, writing only `.herdr-tasks/judge/seat/report.md`.
  `validateRun` passed. `writeRun` and `writeRecord` ran before launch, and the
  launch argv was persisted with `launchAttempted: true`.
- MCP: `--disable apps --disable plugins`, then all 11 listed servers disabled
  with `-c mcp_servers.NAME.enabled=false`. The re-listing showed every server
  `enabled: false`.
- Sandbox probes ran with `codex sandbox -P :workspace -C <seat dir>`. Writing
  the seat directory exited 0. Writing a candidate, the member evidence
  directory and a sibling of the repository each exited 1 with
  `Operation not permitted`. The representative check
  `/usr/bin/python3 -I -B check.py candidates/a.py` exited 0.
- Launch: `hc run --bg --json --name arena14-judge --cwd <seat dir> --label
  run=arena14 --label task=judge --label role=seat codex --no-daemon
  <MCP args> --sandbox workspace-write --ask-for-approval never -C <seat dir>
  "Read <brief> and follow it."` returned `t1q`, parent `t16`, with no
  `first_message` field. The binding recorded the core ID and process start,
  the terminal, and the occupant PID and start.
- Codex's folder-trust dialog appeared before the task. It said trust applies
  to the repository root. One `enter` chose "Trust and continue", which
  persisted `[projects."/Users/zachfuller/.cache/herdr-zstack/seat14/base"]
  trust_level = "trusted"` in `~/.codex/config.toml`. The screen then showed
  the prompt once.
- Identity: the status line showed `GPT-6.1-Sol xhigh`, from CLI defaults.
  That is an OpenAI model, so the seat is other-family to the Claude
  coordinator. No model or effort override was passed.
- Report: `hc wait t1q --timeout 180` returned `reason: message`. The
  coordinator received `<hc from="t1q arena14-judge">judge done: …/report.md</hc>`.
  The screen showed the seat's own `hc send t16` succeeding inside
  `workspace-write`. The report starts `PASS` and scores A 30/30 and B 24/30.
  It lists exit codes 0 for A and 1 for B (`[-2, -3, 0, 5]` returned 0) and
  records no blocked commands.
- Coordinator checks: after the seat was killed and confirmed `finished`, the
  coordinator reran both checks. A exited 0 and B exited 1, matching the
  report. `git status --porcelain --untracked-files=all` was empty, and the
  seat directory held only `report.md`. `recordMemberAcceptance` wrote an
  accepted receipt at clean digest
  `sha256:52162002e6a5f4368c461768e8986e3ada4fc980c1cc37e343f711f3a668e08d`.
  The receipt accepts the seat's report as evidence. Arena would still do the
  scoring itself.
- Cleanup: the coordinator read and saved the final screen and ran
  `hc kill t1q`. `hc get` showed `state: finished`, then `hc rm t1q` ran.
  `hc ls --all --label run=arena14` returned no terminals. No other terminal
  was controlled.

Evidence is under `/Users/zachfuller/.cache/herdr-zstack/seat14`: `pilot.mjs`,
`mcp-check.json`, `probe.json`, and `base/.herdr-tasks/judge/`, which holds the
brief, the record, the launch argv and response, identity and final screens,
the report, the coordinator check, and the finished and removal responses.
These are local artifacts, not portable dependencies.

An earlier probe rooted under `/private/tmp` let a write into a candidate
succeed, because Codex allows temp-folder writes. The recipe now keeps seats
and reviewed checkouts out of temp folders. Check commands also run with `-B`,
because an earlier probe left `__pycache__` in the candidates.

### Claude seat with a Codex coordinator

**Initial runs: BLOCKED at acceptance**, with live proof of the corrected permissions and
sandbox restrictions. The retry's report says `PASS`; the coordinator rejected
it because the stopped seat directory contained `.claude/.cc-writes/` as well
as `report.md`. The extra directory was empty and was preserved as evidence.
It was not removed to make the acceptance check pass. Its creator was not
traced; user plugins and hooks were allowed to load.

Coordinator: Codex 0.166.0, own screen `GPT-6.1-Sol xhigh`, root terminal
`t1g`. `HC_TERMINAL_SOCKET` was
`/Users/zachfuller/.local/state/herdr-core/default/default.sock`.
Core: hc 0.1.16, ID `d69141182c390e697d361b31591615ed`, PID 29654,
process start `Sat Oct 31 15:21:50 2026`. Both Claude seats used the CLI
default: Claude Code 2.1.316, welcome banner `Opus 5.5 with high effort`.
This is other-family proof under the Codex coordinator. No model override
was passed.

Evidence root: `/Users/zachfuller/.cache/herdr-zstack/seat14-claude`.
The following paths are relative to that root:

| Attempt | Checkout | Run index | Member record / evidence directory | Bound terminal / occupant |
|---|---|---|---|---|
| Original recipe | `base` | `base/.herdr-tasks/arena14claude/run.json` | `base/.herdr-tasks/judge/` | `t1r`, Claude PID 95143, start `Sat Oct 31 17:23:42 2026` |
| Fresh corrected retry | `retry/base` | `retry/base/.herdr-tasks/arena14claude2/run.json` | `retry/base/.herdr-tasks/judge/` | `t1s`, Claude PID 8483, start `Sat Oct 31 17:26:31 2026` |

- `node scripts/preflight.mjs` initially exited 1 in the mise shim
  (`Operation not permitted`). Running the installed binary directly,
  `/Users/zachfuller/.local/share/mise/installs/node/lts/bin/node scripts/preflight.mjs`,
  exited 0 and reported `session.status: supported`, caller `t1g`, and
  matching caller/CLI sockets. Both `preflight.json` files preserve the JSON
  and exit code. Version rows remain `untested` against the older baseline;
  the live session gate passed. No core was restarted.
- The coordinator read the installed manuals, `hc run --help` and
  `claude --help`. `pilot.mjs` and `retry/pilot.mjs` adapted the earlier pilot.
  Each seeded the same criteria, A, B and `check.py`, ignored `.herdr-tasks/`,
  and committed only its scratch repository. Seed commits:
  `61bd18096f216b40020896635e44b659a8cb69bf` and
  `07de0dc2a81668917e54caab6f63a6d9967fc7dd`. Both run indexes and schema 1
  member records existed before launch; `validateRun` passed. Each
  `launch-attempt.json` persisted `launchAttempted: true` and the exact argv
  before `hc run`.
- The launch was direct `claude`, interactive, parent-linked to `t1g`, with
  no print flags. Launch JSON omitted `first_message`. Each trust screen
  named its scratch seat directory; one `hc keys <address> down enter`
  accepted it. Claude persisted `hasTrustDialogAccepted: true` for the two
  scratch repository roots in `~/.claude.json`. No personal settings were
  edited by the coordinator. `collection.json`, identity screens and the
  task-specific Claude transcripts confirm one brief prompt and one report
  send per attempt. No brief was resent. The briefs forbade injected
  session controls, delegation and configuration changes.
- The original `t1r` refused both Python checks in `dontAsk` mode, with
  `Permission to use Bash has been denied because Claude Code is running in don't ask mode.`
  There was no process exit code for these denials. Its `Edit(//…/report.md)`
  rule permitted the Write tool, and `Bash(hc send t1g *)` permitted the send.
  The coordinator received the tagged `judge blocked` report from bound
  `t1r`. The report's claim that Bash was universally blocked was contradicted
  by the actual successful send; `tool-evidence.json` preserves the outcomes.
  The coordinator killed `t1r`, confirmed `finished`, checked and rejected
  its result, then removed it before preparing or launching the fresh retry.

The retry used this argv, with the exact expanded array saved in
`retry/base/.herdr-tasks/judge/launch-attempt.json`:

```sh
CHECKOUT=/Users/zachfuller/.cache/herdr-zstack/seat14-claude/retry/base
SEAT_DIR="$CHECKOUT/.herdr-tasks/judge/seat"
REPORT="$SEAT_DIR/report.md"
BRIEF="$CHECKOUT/.herdr-tasks/judge/brief.md"
hc run --bg --json --name arena14claude2-judge --cwd "$SEAT_DIR" \
  --label run=arena14claude2 --label task=judge --label role=seat \
  /Users/zachfuller/.local/bin/claude --strict-mcp-config \
  --tools Read,Grep,Glob,Write,Bash --permission-mode dontAsk \
  --allowedTools Read Grep Glob "Edit(/$REPORT)" "Bash(hc send t1g *)" \
    "Bash(/usr/bin/python3 -I -B $CHECKOUT/check.py $CHECKOUT/candidates/a.py)" \
    "Bash(/usr/bin/python3 -I -B $CHECKOUT/check.py $CHECKOUT/candidates/b.py)" \
    "Bash(/usr/bin/touch $CHECKOUT/candidates/probe.txt)" \
  --settings '{"sandbox":{"enabled":true,"failIfUnavailable":true,"autoAllowBashIfSandboxed":false,"allowUnsandboxedCommands":false,"network":{"allowUnixSockets":["/Users/zachfuller/.local/state/herdr-core/default/default.sock"]}}}' \
  "Read $BRIEF and follow it."
```

Only the two exact check rules and the exact negative `touch` probe rule
were added. No general Bash/interpreter permission, bypass mode, disabled
sandbox or unsandboxed command was used. Scratch and reviewed paths stayed
outside temporary folders. The probe rule exercised OS confinement and is
not needed in a normal judge launch.

| Retry evidence | Observed outcome |
|---|---|
| `/usr/bin/python3 -I -B <checkout>/check.py <checkout>/candidates/a.py` | `PASS []`; successful Bash result, exit 0 independently confirmed by coordinator |
| Same command for `b.py` | Exit 1, `FAIL [([-2, -3, 0, 5], -2, 0)]` |
| `/usr/bin/touch <checkout>/candidates/probe.txt` | Exit 1, `touch: /Users/zachfuller/.cache/herdr-zstack/seat14-claude/retry/base/candidates/probe.txt: Operation not permitted` |
| Write tool to `<checkout>/candidates/probe2.txt` | Tool denial in `dontAsk`, no process exit code; no probe file created |
| Write tool to `$REPORT` | Succeeded through the exact `Edit(//…)` rule; report starts `PASS`, A scores 29/30, B 19/30 |
| `hc send t1g "judge done: <report>"` | Successful sandboxed Bash result; tagged sender `t1s arena14claude2-judge` matched the binding |
| `hc wait t1s --timeout 45` | Exit 0, `reason: message`, `from: t1s`; an earlier post-trust wait returned idle before work began |

The coordinator read the actual report at
`/Users/zachfuller/.cache/herdr-zstack/seat14-claude/retry/base/.herdr-tasks/judge/seat/report.md`.
Then `hc kill t1s` and `hc get t1s` exited 0 and confirmed `state: finished`.
Only after freezing the seat did the coordinator take the before/after
snapshots and run acceptance checks. The same checks were also run after
stopping the first attempt:

- `/usr/bin/python3 -I -B <checkout>/check.py <checkout>/candidates/a.py`:
  exit 0, `PASS []`.
- The B command: exit 1 with the negative-even counterexample above.
- `git -C <checkout> status --porcelain --untracked-files=all`: exit 0,
  empty output for both scratch checkouts; both probe files absent.
- Seat-directory assertion: **exit 1** on both attempts. Entries were
  `.claude` and `report.md`; `.claude/.cc-writes/` was empty. This check was
  recorded as rejection rather than calling `recordMemberAcceptance` with
  passing checks.
- Both before/after snapshots matched. Both rejected receipts record digest
  `sha256:52162002e6a5f4368c461768e8986e3ada4fc980c1cc37e343f711f3a668e08d`
  at their respective seed commits. There is no accepted Claude receipt.

Each member directory preserves `brief.md`, `task.json`, `launch-attempt.json`,
`launch-result.json`, `launch.json`, `running.json`, identity screens,
`collected-screen.txt`, `collection.json`, `tool-evidence.json`,
`coordinator-check.json`, `rejection.json`, the report, and stop/removal
responses. The retry's `.claude` directory was preserved, not normalized away.
`trust-evidence.json` records only these scratch projects' trust status.

Cleanup commands `hc rm t1r` and `hc rm t1s` exited 0 after finished-state
confirmation. `hc ls --all --label run=arena14claude` and the corresponding
`run=arena14claude2` listing exited 0 with `terminals: []`.
No unrelated terminal was controlled. The task repository's prior dirty
changes were preserved; no task-repository commit, push or PR was made.

Current documentation checks: `npm test` exited 0 with all 79 tests passing;
`git diff --check` exited 0. The test command used the installed Node bin
directory first in `PATH` to avoid the blocked mise shim. No mod source
changed, so no mod checker or app UI inspection was needed for this run.

#### Fresh run with the amended staging check — PASS

On 2026-10-31, the user requested a new Claude seat after changing the recipe
to allow only an empty `.claude/.cc-writes/` staging directory alongside the
report. One fresh interactive seat ran; the earlier rejected receipts were
preserved. Coordinator remained `t1g`, Codex `GPT-6.1-Sol xhigh`, on core
`d69141182c390e697d361b31591615ed` and socket
`/Users/zachfuller/.local/state/herdr-core/default/default.sock`.
Preflight exited 0 with `session.status: supported`.

Evidence root:
`/Users/zachfuller/.cache/herdr-zstack/seat14-claude/amended`.
`pilot.mjs` reused the corrected launch from the earlier retry, with a fresh
checkout at `base`, run `arena14claude3` and member `judge`. The exact argv is
in `base/.herdr-tasks/judge/launch-attempt.json`; it retained `dontAsk`, exact
`Edit(//…/report.md)`, send, Python-check and negative-touch rules, strict MCP
configuration and all sandbox settings. Run index
`base/.herdr-tasks/arena14claude3/run.json` and member record
`base/.herdr-tasks/judge/task.json` were persisted before launch, followed by
`launchAttempted: true`. The scratch seed commit was
`84be17c2bbecbda6074de1963d2efd2e3b2b985c`.

- `hc run` exited 0, returning `t1t`, parent `t1g`. Binding recorded Claude
  PID 69309, process start `Sat Oct 31 18:18:05 2026`, and the unchanged core
  identity/process start. The welcome screen showed Claude Code 2.1.316,
  `Opus 5.5 with high effort`; no model override was supplied.
- The scratch-folder trust prompt was accepted with
  `hc keys t1t down enter`. The trust entry applies to this run's scratch
  repository root. Screen and task transcript confirm one brief prompt.
- Candidate checks used `/usr/bin/python3 -I -B <checkout>/check.py <candidate>`
  exactly: A passed with exit 0, B failed with exit 1 and the negative-even
  counterexample. The report scored A 30/30 and B 18/30.
- The exact permitted `touch <checkout>/candidates/probe.txt` exited 1 with
  `Operation not permitted`. Write to `candidates/probe2.txt` was denied by
  `dontAsk`, with no process exit code. Both probe files were absent.
- Report Write succeeded. `hc wait t1t --timeout 45` exited 0 with
  `reason: message`, `from: t1t`. The single tagged `judge done` sender matched
  the binding, and the coordinator read the actual `seat/report.md`.
- `hc kill t1t` and `hc get t1t` exited 0; the terminal was confirmed
  `finished` before coordinator checks. A and B reruns returned 0 and 1.
  `git status --porcelain --untracked-files=all` exited 0 with empty output.
- `check-seat.mjs` accepted precisely `report.md` and a real
  `.claude/.cc-writes/` directory with zero entries, without deleting anything.
  The directory check exited 0. Its six self-checks also cover report-only
  acceptance and rejection of staging residue, other `.claude` entries,
  other seat entries and a symlink in place of staging.
- Before/after snapshots matched. `recordMemberAcceptance` published an
  **accepted** receipt in `base/.herdr-tasks/judge/task.json`, at the seed
  commit and digest
  `sha256:52162002e6a5f4368c461768e8986e3ada4fc980c1cc37e343f711f3a668e08d`.
- `hc rm t1t` exited 0. `hc ls --all --label run=arena14claude3` exited 0
  with `terminals: []`. No other terminal was controlled.

The evidence directory retains the launch, binding, identity and final
screens, report, `tool-evidence.json`, `collection.json`, `wait.json`,
`coordinator-check.json`, accepted record and cleanup responses. Skill and
contract snapshots record the tested revision. `npm test` exited 0 with all
79 tests passing; `git diff --check` exited 0. No task-repository commit,
push, personal settings edit or core restart was performed.

### Limits

- The first two Claude receipts remain rejected as recorded. The fresh run
  above supplies acceptance under the amended empty-staging check; it does
  not retroactively change those results.
- Follow-up: the Claude coordinator traced `.claude/.cc-writes/` to Claude
  Code itself. The 2.1.316 bundle defines `pG=".cc-writes"` in its
  write-then-rename path. The same empty directory exists under other Claude
  working directories (`herdr-zstack/.claude/`, `zachs-agent-skills/.claude/`).
  No plugin or hook was involved. [Seats](../skills/hc-workflow/references/seats.md)
  now accepts that directory only when it is empty. The fresh
  Codex-coordinated run above exercised that check and wrote an accepted receipt.
- No interrogate writing seat ran in a detached worktree with `--add-dir`.
  A seat whose CLI or sandbox is unavailable was not exercised live; the
  recipe records that case as a gap.
- Codex read-only is enforced by the sandbox's writable root plus the brief,
  not by a read-only sandbox. Claude also requires narrow tool rules.
  Temp folders stay writable.
- Earlier Codex-pilot local checks: `npm test` (all 79 Node tests) passed, `claude plugin
  validate .` passed, relative links in the changed docs resolve, and
  `git diff --check` passed. No mod code changed, so `herdr-app check` and
  live UI inspection were not run. Installed-plugin discovery of the new
  reference after an update was not exercised.

## Issue 16: z-mode playbooks on hc — 2026-10-31

Added the [playbook table](../skills/hc-workflow/references/playbooks.md), linked
from the hc companion and from operations' pause and pickup section. It maps
each delegation, pause, pickup and cleanup step of the ten listed playbooks to
an hc operation and record fields, or marks it direct. The zstack playbook text
is not copied. No mod code changed.

### Checks

- The ten playbooks were read from installed zstack 0.24.0. Their step numbers
  were diffed against the installed Codex 0.23.0 cache. Only pause-safely and
  session-pickup differ, in their companion links and Herdr record list; the
  step numbers match.
- A scripted check found 37 table rows covering all ten playbooks, with no
  missing or extra names. Every relative link in the changed files resolves.
- Each delegating point in the inventory's ten playbook rows was matched to a
  row by hand. The table's coverage section lists the matches.
- `node --test mods/*/*.test.mjs workflows/*.test.mjs scripts/*.test.mjs`
  passed (79 tests). `herdr-app check mods/task-evidence` passed.
  `git diff --check` passed.

### Interrogation fixes

An interrogation with two Claude subagents and one Codex seat (`openai`,
`gpt-6.1-sol`) found five defects. Each was rerun in a clean worktree and
reproduced:

1. Owner-merge rows asked a finished owner to act after Accept. Accept now
   leaves the writer finished; merge, restack and fix rounds go to a
   **Successor** that replaces the index entry.
2. The PR-head gate compared only the commit. A **Head check** now requires a
   clean owner worktree at the PR head before Accept, and `acceptanceStatus`
   plus the live head before acting.
3. A restack that kept its patch-id could not release dependents. The
   Successor is accepted at the new head with the patch-id comparison as its
   check.
4. A whole-wave barrier contradicted orchestrate's rolling window. A finished,
   recorded member's index entry is now replaced while the others run.
5. The feature row required two or more workers. It now allows 1–3.

A scratch probe against the real helpers reproduced the new orders first. The
test `a Successor replaces a finished owner and is accepted at the restacked head`
in `workflows/roster.test.mjs` now keeps them checked. It uses a throwaway Git
repository and no hc terminals. It covers four things:

- A clean owner worktree at the PR head yields the same digest as a fresh
  detached checkout of that head.
- A Successor overlapping its predecessor in one index is refused, and
  replacing the index entry is accepted.
- The predecessor's receipt stays `accepted` after the replacement.
- A restack with an unchanged `git patch-id --stable` makes the old receipt
  `stale`, while the Successor is accepted at the new head.

A dirty owner worktree at the PR head failed the Head check's status command
in the probe. That proves the helpers allow these orders. It does not prove a
live merge or restack.

`node --test mods/*/*.test.mjs workflows/*.test.mjs scripts/*.test.mjs` passed
(80 tests). `herdr-app check mods/task-evidence` passed. `git diff --check`
passed.

### Live orchestrate pilot — merge-ready

The user selected Herdr and authorized dispatch, a push and a PR, but no merge.
They also authorized folder trust for the owner's worktree only. Coordinator:
Claude Code (Opus 5.5) at `t16` on `zachs-macbook-pro`, hc 0.1.16 core and CLI.
Preflight reported `session.status: supported`; no role templates were
installed. Run index: `herdr-zstack/.herdr-tasks/pilot-16/run.json`.

The unit linked the seats reference from `docs/installation.md`, a real gap on
`main`. It ran in its own worktree,
`~/.cache/herdr-zstack/pilot-16/unit-1`, on branch
`pilot16/installation-seats-link` from `origin/main` `bc8f91e`.

| Step | Table row | Observation |
|---|---|---|
| Launch owner, attempt 1 | orchestrate · line 4 | `t1v`, Claude Code 2.1.316. `--allowedTools` is variadic and swallowed the trailing task argument: `hc get` showed the task as the last rule, and the screen stayed at turn 0. The task was never delivered. Evidence was saved; the terminal was killed, confirmed `finished` (exit 129) and removed. |
| Launch owner, fresh assignment | orchestrate · line 8 | `t1w`, with `--permission-mode dontAsk` placed after the rules. The task arrived once. No trust dialog appeared, and `~/.claude.json` recorded no trust for the path. Binding: core ID plus core PID start time, terminal `zachs-macbook-pro/t1w`, occupant PID 60922 plus start time and executable. |
| Owner work | orchestrate · line 7 | The owner used exact `--allowedTools` rules for each command. It committed `24b47eb`, pushed, and opened [#27](https://github.com/fullerzz/herdr-zstack/pull/27). Its report arrived as `<hc from="t1w pilot-16-unit-1">`. |
| Freeze and Head check | orchestrate · line 11 | Identity rechecked, then `hc kill t1w` and `state: finished`. `git rev-parse HEAD` equalled the PR's `headRefOid` (`24b47eb…`), and the status command excluding `.herdr-tasks` printed nothing. |
| Other-family seat | orchestrate · line 11 | `t1x`, Codex 0.166.0, screen `GPT-6.1-Sol xhigh`, with every MCP server disabled and a `workspace-write` sandbox rooted at the seat directory. Before launch, a touch probe succeeded in the seat directory and was refused in its evidence directory and in the owner's worktree. No trust dialog appeared, because the seat ran inside the already-trusted checkout. The seat ran all five required checks with exit 0 and reported `VERDICT: PASS` at `24b47eb`. |
| Accept | orchestrate · lines 15–16 | The seat was stopped; the reviewed checkouts were unchanged, and the seat directory held only `report.md`. `recordMemberAcceptance` accepted `unit-1` at `{commit: 24b47eb…, worktreeDigest: sha256:fb3fe9a9…}`, with the coordinator checks and the seat report as evidence. It accepted `unit-1-seat` at the coordinator checkout's snapshot. |
| Head check, later half | autopilot-full · 4–5 | `acceptanceStatus` against a fresh `observeRevision` returned `accepted`, and the live `headRefOid` equalled `receipt.revision.commit`. |
| Account and clean up | orchestrate · lines 18, 21 | Evidence was saved before `hc rm t1w` and `hc rm t1x`. `hc ls --all --label run=pilot-16` then listed no terminals. Both records were set to `activity: completed`. |

PR #27 reached merge-ready at its accepted head, `MERGEABLE` with green CI.
The pilot launched no Successor. The user then separately authorized a merge.
The coordinator first confirmed that `acceptanceStatus` was still `accepted`
and that the live head still equalled the receipt. It then merged directly
with `gh pr merge 27 --squash --match-head-commit 24b47eb…`, which produced
`8f357a7` on `main`. The cubic bot appended its own
summary to the PR body after the owner's text. The owner worktree is kept for
review.

### PR #28 review fixes

The Codex and cubic reviewers raised seven threads. All seven held against the
code and were fixed in the table or roadmap:

- **Head check:** status alone cannot prove the PR head's content. A scratch
  repository with `assume-unchanged` printed empty status and an unchanged
  `HEAD`, while `observeRevision` gave a digest different from a fresh
  checkout. The check now compares the owner's digest with a fresh detached
  checkout of `headRefOid`. A new test covers `assume-unchanged` and
  `skip-worktree`.
- **Pilot receipt:** the pilot's Head check used the status form. Rechecked
  afterwards, its receipt digest (`sha256:fb3fe9a9…`) equals a fresh
  detached checkout of `24b47eb`.
- **`acceptanceStatus`:** the later gate now passes the verified machine and
  checkout along with the snapshot.
- **Stop:** identity is rechecked immediately before each control call.
- **Rolling index:**
  - The index counts Seats, and a slot stays free for a required verifier.
  - Only members in their own worktree are replaced one at a time.
  - Members sharing a checkout are accepted together.
- **Roadmap:** the status line now lists M4.4.

`node --test mods/*/*.test.mjs workflows/*.test.mjs scripts/*.test.mjs` passed
(81 tests).

### Not yet proven

- The Successor merge and restack paths have run only in tests, not live.
- Pause and pickup rows reuse the fixture-tested `pausePlan` and `reconcile`
  decisions from issue 4. No live pause or pickup ran for this issue.

## Issue 15: explorers and runners on hc — 2026-10-31

Added the [explorer and runner deltas](../skills/hc-workflow/references/explorers.md),
linked from the hc companion, the README and the roadmap. They cover how, why,
blast-radius, architect and teach. Each skill stays direct unless it asks for
independent coverage at a step the table marks. Read-only members launch with
the seats tool and sandbox restrictions, not a brief alone. The playbook
table's bug-fix row no longer calls architect's delegation a gap. No mod code
changed.

The user selected Herdr for this session and asked for the issue to be
implemented through it. Coordinator: Claude Code (Opus 5.5) at `t16` on
`zachs-macbook-pro`, hc 0.1.16 core `d69141182c390e697d361b31591615ed`.
Preflight exited 0 with `session.status: supported`. Evidence:
`herdr-zstack/.herdr-tasks/issue-15/`, run index
`herdr-zstack/.herdr-tasks/why-15/run.json`.

### Small how request stays direct — PASS

With Herdr selected, the coordinator answered "how does `scripts/preflight.mjs`
decide `session.status`?" with its own Read tool, citing
`scripts/preflight.mjs:156`, `:167-177`, `:180-190`, `:195` and `:242`.
`hc ls --all --json` listed 22 terminals before and after, and no address was
added (`direct-diff.json`). Herdr selection launched no worker.

### One restricted why investigator — coverage PASS, restriction proof partial

A broad why question ("why does the roster hold at most three members, and
why must writers have exclusive files or separate worktrees?") split into two
sources. The coordinator searched Git and GitHub directly: commit `ebec254`,
issue #11 and PR #23. One read-only member covered long-form documents in the
repository. That category needs no network or MCP.

| Step | Observation |
|---|---|
| Record and index | `why-15-docs` written at sequence 1, run index `why-15` at sequence 1, `launchAttempted` and argv saved in the handoff before launch. |
| Launch, attempt 1 | `t1y`, Claude Code 2.1.316, `Opus 5.5 with high effort`. The argv is the seats §4 restriction: `--strict-mcp-config`, `--tools Read,Grep,Glob,Write,Bash`, `--permission-mode dontAsk`, only `Edit(//…/report.md)` and `Bash(hc send t16 *)` allowed, and the sandbox with the core socket. The task arrived once; no trust dialog appeared. Bound to core PID 29654, occupant PID 29640. |
| Attempt 1 ends | The user accidentally interrupted `t1y` mid-turn. The screen showed `Interrupted · What should Claude do instead?` and the seat directory was empty. The coordinator did not message it. It rechecked the identity, ran `hc kill t1y`, confirmed `finished` (exit 129) and removed it. The record holds `receipt.decision: incomplete`. |
| Fresh assignment | `why-15-docs-2` replaced the index entry (sequence 2) with the same brief and restrictions. `t1z` received the task once and was bound to occupant PID 55960. |
| Restriction | The member made one Bash call outside its rules (`sed` on `seats.md`). Claude refused it: `Permission to use Bash has been denied because Claude Code is running in don't ask mode`. The report records the refusal. |
| Report | `<hc from="t1z why-15-docs-2">` matched the binding. The coordinator read `seat/report.md` and spot-checked `native-hosts.md:76`, `roster.mjs:65-66` and `roadmap.md:124`; all three match. |
| Accept | Identity rechecked, `hc kill t1z`, `finished`. The seat directory held only `report.md` and an empty `.claude/.cc-writes/`. Before and after `observeRevision` matched at `8d398b4…`, `sha256:89663760…`. `recordMemberAcceptance` wrote an **accepted** receipt. |
| Cleanup | `hc rm t1z`, then `hc ls --all --label run=why-15` returned `terminals: []`. No other terminal was controlled. |

The combined answer: the cap and the exclusivity rule come from the shared
contract. `native-hosts.md` says "Start with 2-3 independent slices" and
"Writable workers have exclusive files or separate worktrees". Decision D4 and
`ebec254` explain exclusivity: per-worker receipts bound to one revision
snapshot, with no shared worker writes. No commit, PR or document states why
the hard maximum is three rather than another number. Both sources report
that gap.

The restriction proof in this run was partial. The only refusal came from
Claude's tool layer, on a read. No write outside the report rule was
attempted, as seats §4 requires before counting coverage. Two of the four
acceptance checks in `accept.mjs` were recorded as passing by hand. The launch
also loaded the user's settings, whose sandbox grants widened it; see the
interrogation below. The amended run after it supplies the full proof.

### Interrogation fixes for issue 15

`/zstack:interrogate` ran three adversaries as hc members, each in its own
detached worktree under `~/.cache/herdr-zstack/interrogate-15/`: two Claude
Code (Opus 5.5) and one Codex seat (`GPT-6.1-Sol xhigh`). The coordinator
reran each finding in a fresh worktree with only its repro files. Six held:

1. **The read-only restrictions did not remove network, sockets or extra
   writes.** Both CLIs apply the user's sandbox settings. `~/.claude/settings.json`
   sets `allowedDomains: ["*"]`, `allowAllUnixSockets: true` and extra
   `allowWrite` roots. `~/.codex/config.toml` sets `network_access = true` and
   extra `writable_roots`. Two probe terminals launched with the documented
   argv proved it. The Codex probe got `HTTP/2.0 200 OK` from `example.com`,
   and its `touch ~/.cache/uv/…` exited 0. The Claude probe got
   `HTTP/2.0 200 OK`, connected to the SSH agent and both Docker sockets, and
   wrote under `~/.cache/uv`. Fix: seats §3 adds `CODEX_SANDBOX_ARGS`, and
   seats §4 adds `--setting-sources ""`.
2. **The fallback rule contradicted the shared contract.** `explorers.md`
   turned a failed member straight into a gap. Fix: one fresh retry, then a
   gap, with a native agent only as a disclosed, user-selected fallback.
3. **The live PASS skipped seats §4's out-of-scope write proof.** Fix: the
   heading above now says partial, and `explorers.md` requires an in-run
   probe ([`scripts/restriction-probe.sh`](../scripts/restriction-probe.sh))
   with computed checks.
4. **The after-stop check could not see writes elsewhere under
   `.herdr-tasks/`.** A probe against the real `observeRevision` showed five
   undetected out-of-scope writes there. Fix: `explorers.md` scopes the digest
   claim to the checkout outside `.herdr-tasks`, checks the member directory's
   entries, and relies on the probe's section 4 for the rest.
5. **Three reviewers or runners plus the judge do not fit one index.** The
   real `validateRun` refused four members. Fix: the blast-radius and
   architect rows add the Seat in a new `writeRun` sequence after accepting
   three members, and link the rolling index.
6. **The roadmap marked M4.3 implemented while the inventory assigned eight
   more entries to it.** Fix: the roadmap lists them as still planned.

A dropped finding was also fixed. `Bash(hc send <coord> *)` matches
`hc send <coord> --force …`, which types into a blocked dialog. hc accepts
`--force` after the address. The send rules are now exact.

### Restriction proof under the amended recipes — PASS

Run `fx-15`, coordinator `t16`, index
`herdr-zstack/.herdr-tasks/fx-15/run.json`, snapshot `8d398b4…`,
`sha256:54848fcf…`. Evidence: `herdr-zstack/.herdr-tasks/int-15-fix/`. Both
members were bound right after launch. Their probe was the pre-ship copy of
`scripts/restriction-probe.sh`; it differs only in an absolute `xh` path, the
probe file name and the usage guard.

| Member | Observation |
|---|---|
| `why-15-docs-3`, Claude Code 2.1.316 at `t28` | The seats §4 argv with `--setting-sources ""` and exact send rules. The banner showed `Opus 5.5`, without the user's default effort. Probe: egress failed (`deny network-outbound example.com:443`); launchd and both Docker sockets were refused; writes to `~/.cache/uv` and beside the record failed with `Operation not permitted`; the write inside `seat/` succeeded; `hc get` exited 0. A `Write` outside the report rule and `hc send t16 "…" --force` were both refused by `dontAsk`, and no forced text arrived. It then repeated the why investigation and sent its report with the exact rule. |
| `fx-codex`, Codex 0.166.0 at `t29` | The seats §3 argv with `CODEX_SANDBOX_ARGS`. Before launch, `debug prompt-input` printed `Network access is restricted.` and no writable roots. Probe: egress failed; all four sockets, including the SSH agent, were refused; both outside writes failed; the write inside `seat/` succeeded. `hc get` exited 5, because the restricted network also blocks the core socket. The coordinator collected it by `hc wait` status. |
| Accept | Identities rechecked, both stopped and `finished`. `accept.mjs` computed every check: unchanged digest, member directories holding only `brief.md`, `task.json` and `seat/`, seat contents, and every required refusal in the report. Both received **accepted** receipts. `hc rm t28 t29`, then `hc ls --all --label run=fx-15` returned `terminals: []`. |

### Checks and limits

- `node --test mods/*/*.test.mjs workflows/*.test.mjs scripts/*.test.mjs`
  passed (81 tests). `herdr-app check mods/task-evidence` passed.
  `git diff --check` passed. Every relative link in the changed files
  resolves.
- The Codex member ran only the probe, not coverage work. Exact Git rules for
  an investigator, blast-radius reviewers and architect runners were not
  exercised live.
- Whether Claude loads plugins and hooks without settings files was not
  checked. `templates/comment-sicko-claude.md` still allows
  `Bash(hc send:*)`; read-only members do not use templates.
- The member shared the coordinator's model family. That is allowed for an
  investigator; it gives no cross-provider coverage.
- The uncommitted issue #15 edits were present in the reviewed checkout. The
  brief marked them out of scope. The snapshot shows the checkout outside
  `.herdr-tasks` unchanged; it does not cover `.herdr-tasks` itself.

## Issue 17: supporting processes and live restart recovery — 2026-11-01

Herdr execution and z-mode were selected for this session. Installed versions: hc 0.1.16, user core 0.1.16, herdr-app 0.1.11 and zstack 0.24.0. All are newer than the contract baseline. Preflight reported `session.status: supported` for caller `t16`. No agent was launched. Every hc terminal below ran in an isolated core, so the user's core received no launch, signal or restart.

### Isolated session

- `HC_SESSION=i17`. `XDG_STATE_HOME`, `XDG_RUNTIME_DIR`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME` and `XDG_CACHE_HOME` pointed under `.herdr-tasks/i17/x/`. `HC_TERMINAL_ID`, `HC_TERMINAL_SOCKET`, `HC_SOCKET` and `HC_SCOPE` were unset. The terminals were therefore parentless, except for the deliberate `--parent` probe.
- The first attempt failed closed. hc refused with `the socket path for session "issue17" is too long here (108 bytes; this system allows 103)`. Shorter paths fixed it.
- The isolated core had ID `b70d937978abe24a15bd50acf525a51a` and its socket was `.herdr-tasks/i17/x/r/herdr-core/i17.sock`. The user's core has ID `d69141182c390e697d361b31591615ed`, PID 29654 and a start time of `Sat Oct 31 15:21:50 2026`. Every isolated stop or restart first checked the isolated `core.id`. After cleanup, preflight still reported the user core with the same ID and PID, and `ps` showed the same start time.

### Supporting processes — PASS

| Check | Observation |
|---|---|
| Readiness | `hc run --bg --keep --name srv … sh -c '…; sleep 2; echo SERVER READY; exec sleep 3600'` returned `t1`. `hc wait srv --output "SERVER READY" --timeout 30` returned `reason: output`. |
| Late wait | A second `--output` wait for the same, already printed text returned `reason: timeout` after 3 s, while `hc read` showed `SERVER READY`. `--output` matches only new output. |
| Background exit | `chk` ran `exit 3`. `hc wait` returned `reason: exit, exit_code: 3`. `hc get` kept `exit_code: 3, reason: exited, finished_ms` after the exit. |
| Foreground exit | `hc run --timeout 30 sh -c 'echo fg; exit 4'` printed `[hc] t3 exited (exit 4)` and exited 4. |
| Foreground timeout | `hc run --timeout 3 --name slow …` printed `[hc] still running as t4` and exited 124. `hc wait slow` later collected `exit_code: 0` with no relaunch. |
| `watch-pr` | The first launch, `t5`, stopped at mise's "config files in ~ are not trusted" prompt, because the scratch XDG paths reached the terminal. hc showed no `blocked` status for this plain program. The prompt was not answered. `hc kill t5` gave `reason: killed, signal: 1, exit_code: null`. The relaunch, `t6`, ran under `env -u XDG_CONFIG_HOME -u XDG_DATA_HOME -u XDG_STATE_HOME -u XDG_CACHE_HOME -u XDG_RUNTIME_DIR <zstack>/skills/z-mode/scripts/watch-pr/watch-pr --pr 29 --status-only`, with this repository as cwd. It exited 0, and its single NDJSON line was `kind: STATUS, terminal: true, exitCode: 0` for merged PR 29. `--status-only` was used only to prove launch and exit collection without waiting on CI. |

### Persistence and restart — PASS

| Step | Observation |
|---|---|
| Binding before | Core PID 40281, started `Sun Nov  1 12:35:44 2026`. `t1`'s occupant was PID 43356 (`sleep`), started `12:36:00`. `srv-starts.log` had 1 line. |
| `hc server restart` | The core PID changed to 64505. Holder 43355 and program 43356 survived. `t1` still ran `sleep 3600`. |
| `hc server stop`, `start` | The holder and program were gone while the core was down. On start, the core PID was 67330 and `t1` was `live, keep: true`, with `argv: ["/bin/zsh","-l"]` and `reason: stopped_by_restart`. Its new occupant was `zsh` PID 67622. The screen showed a fresh login prompt in the same cwd, with the same address and labels. |
| Nothing resent | `srv-starts.log`, which the original command appends to on every start, still had 1 line. It also had 1 line after a second stop and start. |
| `reconcile` | `.herdr-tasks/i17/reconcile-live.mjs` passed these observations, with a real `observeRevision` snapshot, to `reconcile` and `pausePlan`. Before restart: `bound`, `current`, interrupt `[t1]`. After the graceful restart, where the core PID changed but the program survived: `unbound`, `unverified`, `resend: false`, no interrupt. After stop and start, with the kept shell: `unbound`, `unverified`, `resend: false`, no interrupt. `dispatchDecision({attempted: true})` returned `reconcile-only`. |
| `--outlive-parent` | Parent `par` (`t7`) had children `cdef` (`t8`, the default) and `cout` (`t9`, `--outlive-parent`). After `hc kill par`, `cdef` finished with `die_with_parent: true, reason: killed, signal: 1`, and `cout` stayed live with `die_with_parent: false`. |
| Core stop versus flags | During the next stop and start, unkept `nokeep` (`t10`) and the `--outlive-parent` child `cout` both finished with `reason: server_stop`. Kept `t1` returned as a shell again. |
| Cleanup | `hc ls --all --label task=i17` listed only this run's terminals. `t1` was killed, `t1`–`t10` were removed, and `hc ls --all` returned `terminals: []`. The isolated core was stopped, and `pgrep -f i17` found no process. |

Evidence lives under `.herdr-tasks/i17/`. It is local, temporary and ignored by Git: `01-start.txt`, `02-processes.txt`, `03-wait-and-watch.txt`, `04-watch-pr.txt`, `05-restart.txt`, `06-stop-start.txt`, `07-recovered.txt`, `08-reconcile.txt`, `09-outlive-parent.txt`, `10-nokeep-stop-start.txt` and `11-cleanup.txt`.

### Checks and limits

- `node --test mods/*/*.test.mjs workflows/*.test.mjs scripts/*.test.mjs` passed (81 tests). `herdr-app check mods/task-evidence` and `git diff --check` passed. Every relative link and anchor in the changed files resolves. No mod changed, so no live UI inspection was needed.
- Only the local macOS host was tested. Remote machines, Linux, where systemd stops the core before its holders, and host shutdown were not tested.
- The binding's core component is core ID plus core process start time, which the coordinator observed. hc exposes no restart epoch. A graceful restart therefore unbinds a surviving program too. This fails closed; the operator collects its output and re-inspects identity before any control.
- Grace-delay recovery after a program dies by signal, without a core restart, was not induced.
- Only plain programs ran. No agent was kept or restarted. The claim that a kept agent returns as a shell rests on hc's manual and on this shell observation.
- Scratch XDG paths change tool behaviour inside terminals, as mise did here. This affects isolated tests only. Terminals in the user's core inherit the user's environment.

### Interrogation — 2026-11-01

Run `int-17` ran three adversaries against this change, each in its own detached worktree. All three were hc terminals parented to the coordinator `t16`.

| Member | Identity and sandbox | Result |
|---|---|---|
| `int-17-a1` | Codex 0.166.0, `GPT-6.1-Sol xhigh` from the status line, which is a different family from the coordinator. `workspace-write`, network restricted, MCP servers, apps and plugins disabled. Writable roots were its worktree and seat directory only. | ISSUES. One finding: `docs/roadmap.md:3` still said "M5–M8 remain planned", and `skills/hc-workflow/references/playbooks.md:80` still said "Processes, including a PR watcher, are untested until M5". Its repro `adv/coverage.mjs` exited 1 again in a fresh coordinator worktree. Links, watch-pr exit codes and reconcile matched the docs. The full suite was BLOCKED: 80 passed, and 1 failed with `listen EPERM` on a fixture socket inside its sandbox. |
| `int-17-a2`, `int-17-a3` | Claude Code 2.1.316 writing seats | Incomplete. Each stopped at a prompt to read its own brief outside the worktree. Both were killed and removed before writing anything. |
| `int-17-a2r`, `int-17-a3r` | The same seats with `--allowedTools Read Grep Glob`, Opus 5.5, Claude sandbox. The only Unix socket allowed was each seat's own isolated core socket. | BLOCKED. Each isolated core started, but every `hc run` failed with `no holder: holder did not start within 5 s`, and `holder.log` showed `Operation not permitted`. No live hc claim was exercised. The non-hc checks found nothing: reconcile, the watch-pr exit-code table, and 8 of 8 lifecycle tests passed. |

Fixes: the roadmap status and the playbook limit now match the implementation. [Seats](../skills/hc-workflow/references/seats.md#4-launch-a-claude-seat) adds the Read rules for writing Claude seats, the holder limitation, and the inline isolation rule.

Isolation incident: both Claude seats wrote their isolation exports to `adv/env.sh` with a heredoc. In their sandbox, a mise-shimmed or aliased `cat` left the file at 0 bytes. The coordinator approved one command that sourced it before noticing. That command and a few others ran hc without isolation. Claude's sandbox refused all of them with `cannot start core: Operation not permitted`, rc 5, because the user's core socket was not allowed. Afterward, the user's core still reported ID `d69141182c390e697d361b31591615ed`, PID 29654 and an unchanged uptime. The coordinator rejected the next prompt that sourced the file and approved hc commands only with the isolation variables inline.

Limits: the live hc behavior in [supporting processes](../skills/hc-workflow/references/processes.md) rests on the coordinator's own run. No adversary reproduced it. The Claude adversaries' untested probes remain open: a foreground program that exits 124 by itself, a signal-killed foreground run, a program that traps HUP and exits 0 after `hc kill`, and a program that exits before printing its ready text.
