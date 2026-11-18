# Execution contract

This is the native herdr-core adapter contract for herdr-zstack. It defines the boundary for the single-worker pilot; reading or installing it starts nothing. Task ownership, runtime identity, observed activity, and coordinator acceptance are separate facts.

## Shared rules and compatibility

The compatibility baseline is **zstack 0.28.0** and **hc 0.1.21**, validated on 2026-11-17, and **herdr-app 0.1.10**, inspected on 2026-10-31. The hc and zstack entries moved only after the [live checks](validation.md#2026-11-17--bounded-supervision-and-per-outcome-evidence-47) covered caller resolution, launch, delivery, reporting, completion and cleanup. herdr-app presentation was not exercised again, so newer herdr-app versions stay untested. This is a validated baseline, not a promise that every newer release works. Re-run preflight after an upgrade.

Resolve z-mode through the installed catalog or its real installed `skills/z-mode/SKILL.md`, then read `references/native-hosts.md` relative to that file. Resolve requested principles and playbooks from the same installation; do not assume a zstack checkout exists in the task repository. This repository does not vendor or redefine the shared library. Missing shared instructions are a capability gap, not permission to improvise their contents.

zstack owns selection, action authority, scoped briefs, exclusive write ownership, fresh-agent lifecycle, concurrency, and acceptance. This adapter owns native `hc` execution and `herdr-app` presentation. zstack 0.22.0's `herdr-workflow/references/operations.md` describes the older `herdr pane` / `herdr agent` interface. Those command recipes are **not compatible** with this native pilot; do not translate them by guessing flags or invoke the old TUI. Apply the shared semantic rules through the installed native manuals and this explicit adapter. If a selected workflow requires a legacy-only operation with no verified native equivalent, mark it unavailable and follow the fallback rule below.

## Selection and authority

Native host execution remains the default outside a verified live hc terminal. zstack's shared session control owns activation and persisted selection; this companion has no preference store or activation hook. On explicit activation, the shared control captures fresh host plugin metadata and runs the [verified preflight launcher](installation.md#preflight-bootstrap-and-installation-selection). It persists Herdr only when both `companion.status` and `session.status` are `supported`, the activation has not changed, and no explicit execution choice superseded the probe. An explicit Native choice wins, including during preflight or re-enabling z-mode. Headless callers qualify; installation or GUI presence grants no activation or authority.

Consume the shared control's JSON result: `state` gives stored activation, execution and Native opt-out; `persistence` distinguishes a completed write from failure; `reason` explains the result. Detection also returns companion location, execution guidance and preflight evidence. Do not perform a separate agent-mediated persistence step or call conversational intent persisted selection. This companion guidance (`0.1.3`) requires the shared transition in zstack `0.27.0` or later, which supports POSIX Claude Code and Codex; update older shared hooks first. The probe remains read-only.

Resume and compact restore this session's preferences and attempt selection only for an active session without a choice. Disable clears activation and execution, but a failed or partial write must report what remains. Follow the current host's existing approval flow once for a blocked state write; rejection stops agent retries. Do not add broad allowances or automatic escalation. Preserve a refusal or conversational opt-out in resume notes; the hook cannot infer a host approval decision it was never given. Selection alone authorizes no worker, tracker or configuration writes. Never copy controls, session IDs, plugin state paths, credentials, or approval authority into a child. A new session must make its own selection.

A **native session** requires all three: `HC_TERMINAL_ID` is set, `hc server status` answers for the caller's core, and `hc get "$HC_TERMINAL_ID"` resolves that same address as a live terminal. `HERDR_ENV` is legacy diagnostic context only. It neither establishes nor enables native execution, and `HERDR_ENV=1` without `HC_TERMINAL_ID` is a legacy-only environment, not a native session. The hc 0.1.15 CLI starts a core on demand for `server status`, `get`, and other core commands. Detection must not invoke them when the caller's core could be missing. Ask the core named by `HC_TERMINAL_SOCKET` instead; that socket is the caller core's address. The hc CLI addresses `HC_SOCKET` when it is set, and otherwise a socket derived from `HC_SESSION` and the XDG directories. Dispatch through the CLI therefore needs that address to equal `HC_TERMINAL_SOCKET`. For parent-linked execution, the resolved caller is the parent; verify the intended machine/core before dispatch. An operator may instead supply an explicit verified task parent. A standalone coordinator without a core terminal may deliberately use `--no-parent`, provided it records ownership, collection and cleanup responsibility itself. This is an explicit topology choice, never an automatic fallback for a stale parent. Focus and the app's current agent are never substitutes for identity. Task ownership and execution authorization are required even when no parent exists.

Host restrictions, available sandbox enforcement, user authorization, and the host's concurrency limit still apply to CLI workers. Count native and hc workers together. Do not install tools, log in, change personal configuration, restart the user's core, or expand permissions as preflight repair.

## Operation matrix

“Supported” below means exposed by the inspected installed manual/help. “Untested” means no live end-to-end proof in this contract's validation. “Unavailable” means this adapter provides no such capability; it does not assert that another product can never provide it.

| Operation | Owner / interface | Capability and evidence boundary |
|---|---|---|
| Local file edits and quick checks | Host file and execution tools | Supported for edits and commands expected to finish in under about 30 seconds. Slower or unknown-duration commands run as a [quick background check](../skills/hc-workflow/references/processes.md#quick-background-check). |
| Start an authorized worker | An installed role template through `hc run --bg --name … --cwd …`; a direct CLI launch only for the [exceptions](../skills/hc-workflow/references/operations.md#direct-launches) | Supported. Live launches and role templates are recorded in [validation](validation.md). Model overrides are untested live. Always interactive; Codex requires `--no-daemon`, and its `read-only` sandbox blocks `hc send`. |
| Other-provider review seat | Interactive `hc run` of the other family's CLI, per [seats](../skills/hc-workflow/references/seats.md) | Supported for a Codex seat under Claude ([validation](validation.md#issue-14-other-provider-seats-on-hc--2026-10-31)) and a Claude seat under Codex ([accepted Claude run](validation.md#fresh-run-with-the-amended-staging-check--pass)). Claude proved exact check rules, report write, tagged send and both negative probes; acceptance permits only the report and an empty `.claude/.cc-writes/` staging directory. Writing-seat coverage remains untested. Native one-shot `codex exec` / `claude -p` stays upstream; a missing CLI or failed sandbox check is a coverage gap. |
| Start a useful long check, server or watcher | `hc run` with explicit cwd and ownership, per [supporting processes](../skills/hc-workflow/references/processes.md) | Supported on hc 0.1.21; re-run preflight after an upgrade. [Live checks](validation.md#issue-17-supporting-processes-and-live-restart-recovery--2026-11-01) on hc 0.1.16 cover readiness through `hc wait --output`, exit codes and `watch-pr`; [hc 0.1.21 checks](validation.md#2026-11-17--bounded-supervision-and-per-outcome-evidence-47) cover timeouts, aggregate waits, masked pipes and kill. Plain programs report no `blocked` status. |
| Inspect, collect and wait | `hc get`, `hc read`, `hc wait --timeout …` | Supported; bounded waits, then fresh output/artifacts. No polling sleeps; idle/done is readiness, not acceptance. |
| Interrupt and clean up | `hc interrupt`, then task-owned `hc kill` / `hc rm` as appropriate | Supported; interruption stops a turn, not necessarily the process. Local core-restart recovery was proven on hc 0.1.16 in an isolated session, and was not repeated on 0.1.21: a kept terminal returned as a shell, `reconcile` reported it unbound, and nothing was resent. Remote recovery is untested. |
| Remote commands and artifacts | `hc run --on`, `hc exec --json --on`, `hc file read --on`, qualified `machine/tN` addresses | Supported syntax. Remote revision observation and remote-member records are implemented and pass fixture tests ([task record](task-record.md#producing-revision-evidence)); live connectivity, permissions, acceptance and recovery are untested. Host file tools remain local. |
| Show, navigate or arrange a workspace | `herdr-app ls`, `status`, `commands`, `do` | Supported; status inspection succeeded. Structural changes require requested presentation scope and explicit returned IDs. |
| Check and inspect a mod | `herdr-app check`, `shot`; generated installed types | Supported; a checker pass covers initial rendering only. |
| Shared principles, planning and acceptance | Installed zstack instructions; coordinator | Supported instruction contract; no automatic acceptance from a terminal label, report or exit status. |
| Legacy pane/agent command recipes | Old `herdr` TUI | Unavailable in this native adapter. |
| Parent conversation/model/tools/permissions inheritance | Independent worker CLI | Unavailable as a contract; explicitly supply context and verify capabilities. |
| Automatic assignment replay or post-exit coordination | No adapter interface | Unavailable. A kept terminal recovers to a shell, never reruns the task. |

## Capability preflight

Before dispatch, record each requirement as **supported**, **unavailable**, or **untested**, with the command/evidence and consequence. Command presence alone does not establish runtime proof.

Use the [preflight launcher](installation.md#preflight-bootstrap-and-installation-selection) with an approved absolute Node executable and a fresh `claude plugin list --json` or `codex plugin list --json` listing captured in the executing checkout. It selects one canonical, host-enabled companion and reports its version, source and payload digest before detection. Bootstrap, installation and probe failures exit 2 with session detection untested; they are not evidence that hc is absent. Exit 0 or 1 always carries a matching JSON report. Missing or conflicting installations require host refresh/restart, never a cache guess or permission change. Shared initial host routing remains owned by zstack.

The direct `preflight.mjs` diagnostic emits the machine-checkable part of this matrix as JSON. It exits 0 for a supported native session, 1 when the session is unavailable, and 2 on a usage or internal error, including a flag without a value. It reports executing companion provenance but marks host selection unverified; use the launcher before dispatch.

Discovery details:
- The report covers hc, herdr-app, core and zstack versions against the baseline, the core ID, the caller address and parent topology, templates, machines, and the installed zstack path.
- zstack is judged by the current host's installed copy: `CLAUDECODE=1` selects Claude and `CODEX_THREAD_ID` selects Codex. Claude copies are found under `CLAUDE_CONFIG_DIR` (default `~/.claude`), and Codex copies under `CODEX_HOME` (default `~/.codex`).
- Pass `--host claude|codex` when the host cannot be detected and the installed copies differ.
- Pass `--zstack <dir>` to choose a copy explicitly.

Preflight is strictly read-only:
- It runs only `hc --version` and `herdr-app --version`, and lists them in `commands`. It never queries or opens an app window.
- It never runs an hc core command.
- It sends only the read-only core methods `hello`, `server.status`, `terminal.get` (without `caller`, which would mark child news as seen), `templates.list` and `machine.list`. It sends them as JSON-RPC over `HC_TERMINAL_SOCKET` and lists them in `requests`.
- A missing or vanished core is a failed connection, never a new core.
- It reads local plugin manifests and the herdr-core configuration.
- It never launches, sends, signals, or changes configuration.

Before dialing the core, it requires that the hc CLI would address the same core. Any `socket` key in the herdr-core configuration, quoted or bare, makes that address unverified. So does Windows, where the CLI's socket placement has not been inspected.

Automatic selection requires only a supported native session. The app is optional: it need not be installed, running, or displaying the caller. App membership and app core identity are not checked; the caller’s core identity and CLI socket agreement are still verified.

When a check fails, the report says why the session is unavailable. The steps below that need judgment (selection, authorization, scope, CLI capabilities) still apply. A supported report does not perform them.

1. Confirm current-session selection, authorization, native-session detection, explicit task repository, requested action scope, and host concurrency budget. Source inspection can continue if execution is unavailable.
2. Read `hc --version`, `hc --skill`, `hc --help`, relevant subcommand help, `herdr-app --version`, `herdr-app --skill`, and `herdr-app --help`. `hc server status` establishes the running core version; a binary version alone does not. `herdr-app status` establishes window availability only when presentation is needed.
3. Resolve a parent-linked caller with an explicit `hc get` address, or record the deliberately parentless standalone coordinator. Record machine/core identity, parent address or its absence, coordinator ownership, repository/worktree, branch/revision and dirty files. Do not expose unrelated terminal contents. Read-only discovery never authorizes writes.
4. Inspect available templates (`hc templates`) and the actual selected CLI's help/configuration within the authorized boundary. Verify interactive launch syntax, requested model and effort as separate settings, reporting route, needed tools, and permission/sandbox enforcement. A read-only brief is not a sandbox. Do not assume template names, bundled roles, credentials or models are inherited. Report model identity when exposed; otherwise record unavailable. Handle rejected model identifiers using the shared native-host contract; never repeatedly guess IDs.
5. Give each writer exclusive files or an authorized isolated worktree. Confirm any representative sandbox/tool check required by the shared contract before depending on worker verification. A missing required capability blocks that worker slice; independent direct work may continue.

Preflight is task-sized: do not start a worker just to prove documentation. A later pilot must supply runtime proof for launch, delivery, collection and stop before calling that path validated.

## One-worker assignment and lifecycle

The coordinator owns the task record and acceptance. The worker gets a consolidated brief naming goal, context paths, read/write scope, machine and repository, requested CLI/model/effort, allowed actions, acceptance commands, stop condition, and report/artifact format. Include the absolute real z-mode entrypoint when the worker should follow it and instruct it to read that first; this conveys instructions, not activation controls. Say the worker is not alone, must preserve concurrent edits, may not delegate, and must not write coordinator records. Supply only necessary context, never assume access to the parent's conversation or approval decisions.

Use one fresh interactive worker and one outstanding assignment. Put the first task in `hc run` and inspect `first_message.sent`; if it is false or absent, read the screen before any input. Report startup blockers such as login, trust or access dialogs to the user instead of answering them. After a timeout or transport error, reconcile terminal state and output before any resend or replacement: the original task may already be running. Never force input past a blocked permission decision.

Record the returned machine-qualified terminal address, CLI identity, owner, scope and assignment separately from the durable task ID. `hc wait` reports state; collect the report with `hc read` or a task-scoped artifact on the owning machine. Treat a blocked check as blocked, never passing. The coordinator inspects changes, runs acceptance checks against the recorded revision/working tree, and records accepted, rejected or incomplete with evidence. A worker report cannot approve itself.

Use fresh workers for new work and retries. Reuse only for costly agent-held state under zstack's lifecycle exception. Confirm an old writer can no longer write before replacement, or assign a disjoint scope. A restored address, `--keep` shell, app restart, or done badge never triggers automatic prompt replay. On pause, account for task-owned processes, preserve edits and evidence, and record the first reconciliation action. On accepted completion, clean up only task-created terminals after confirming no needed process remains. Parent exit normally ends children; `--outlive-parent` is a separate explicit persistence decision, not a default or a promise of unattended supervision. The [persistence policy](../skills/hc-workflow/references/processes.md#persistence-policy) says when `--outlive-parent` or `--keep` is justified and what each recovers.

If a required Herdr capability fails, disclose the exact gap. Continue independent direct work, but use only an explicitly user-selected fallback for the affected delegated slice; do not silently substitute native agents. Opt-out stops new dispatch and requires accounting for in-flight workers before transferring ownership.

See [validation](validation.md#issue-1-execution-contract--2026-10-31) for observed checks and remaining proof, and [native detection and preflight](validation.md#issue-9-native-detection-and-preflight--2026-10-31) for the preflight's live results.
