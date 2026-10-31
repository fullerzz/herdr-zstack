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

Limits: app closure, core restart and remote failure were simulated, not induced on the user's runtime. No live host-persistence claim is made. Issue 4's implementation and fixture coverage are complete; live restart/persistence acceptance remains unverified and must use isolated task-owned runtime state. See [recovery checks and proof limits](worker-lifecycle.md#recovery-checks-and-proof-limits).

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
