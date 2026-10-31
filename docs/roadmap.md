# Roadmap: zstack on native Herdr

Status: proposed 2026-10-31. Nothing here authorizes dispatch, tracker writes, commits to either repository, or personal configuration changes.

## Goal

Run the zstack workflows in herdr-app, with `hc` as the execution layer. A coordinator started in an hc terminal should route through z-mode's normal playbooks. Delegated agents, review seats and long-running checks should run as task-owned hc terminals. Results should come back through hc's report and wait semantics, and the coordinator should accept them only against revision-bound evidence that Task & Evidence can display.

Issues #1–#6 proved that path for one worker. This roadmap ports the rest of zstack's Herdr surface onto it and refines the delegating skills for hc.

## Starting point

Observed on 2026-10-31 with zstack 0.22.0 (local checkout and `fullerzz/agent-skills` main agree), hc 0.1.15, herdr-app 0.1.10, and legacy `herdr` 0.9.5 still installed.

| Area | Current state | Gap |
|---|---|---|
| zstack `herdr-workflow` + `references/operations.md` | Written for the legacy `herdr pane` / `herdr agent` API | Incompatible with hc, as the [execution contract](execution-contract.md) records. |
| Environment gate | zstack requires `HERDR_ENV=1` | Coordinators in hc terminals get `HC_TERMINAL_ID` (this session: `t16`), but `HERDR_ENV` is unset. The shared gate refuses a valid native session. |
| Session hook | zstack `hooks/session_start.py` sends Herdr-enabled sessions to zstack's own `skills/herdr-workflow/SKILL.md` | Routes to the legacy skill and has no path to this repository. |
| Roles | `z-agent` and `comment-sicko` exist only as Claude/Codex native agent files | `hc templates` is empty; hc workers get no role. |
| Other-provider seats | `native-hosts.md` uses one-shot `codex exec` / `claude -p` | hc's manual requires interactive agents and no print mode. The seat recipe needs an hc equivalent. |
| Fan-out workflows | swarm, arena, interrogate, reflect, orchestrate, autopilot rely on "the selected execution method" | Only the single-worker case has an hc procedure, record and proof. |
| Task records | Schema 1: one task, one worker binding | No roster for N workers, review seats or supporting processes. |
| Recovery | Fail-closed helpers proven in fixtures | No live restart or persistence proof (issue #4 limit). |
| Old plugin plan | `zachs-agent-skills-herdr-fixes/docs/herdr-plugin-plan.md` (uncommitted, legacy plugin API) | Superseded by herdr-app mods; do not port. |

## Shape: overlay, not fork

herdr-zstack ships only Herdr-specific execution content. zstack keeps principles, playbook logic, selection controls and acceptance standards. Porting therefore means **moving** zstack's Herdr-specific content here, rewriting it for hc, and leaving zstack a thin pointer. It does not mean copying the 57-skill library.

Classify each zstack skill once (Milestone 0):

- **Execution-neutral — stays in zstack unchanged.** Principles, technical-writing, unslop, statechart, python/typescript practices, and similar skills. They run the same in an hc terminal.
- **Delegating — gets an hc delta here.** swarm, arena, interrogate, reflect, architect, how/why explorers, blast-radius, verification-skill authoring, and z-mode playbooks that spawn workers. herdr-zstack adds a short per-skill delta (launch, report route, wait, collect, clean up) that the hc companion applies alongside the zstack original. The zstack text is not copied.
- **Herdr-specific — moves here.** `herdr-workflow`, its operations reference, `docs/guide/herdr.md`, and the Herdr sections of the host docs.

A full fork would mean changing [AGENTS.md](../AGENTS.md) first, then owning drift across 57 skills. Decision D1 records this.

## Milestones

Each milestone ends with a live proof recorded in [validation](validation.md). Later milestones may start once their dependencies are proven.

### M0 — Port inventory and decisions

- Write `docs/port-inventory.md`: every zstack skill, playbook and reference, its class (neutral / delegating / Herdr-specific), the exact delegation points, and the planned hc delta.
- Resolve decisions D1–D6 below.
- Proof: the inventory covers every `SKILL.md` and playbook in the installed zstack version. Spot-check it against a grep for delegation terms.

### M1 — Native detection, preflight and selection routing

- Replace the `HERDR_ENV=1` gate with a native check: `HC_TERMINAL_ID` is set, `hc get "$HC_TERMINAL_ID"` resolves, and `hc server status` answers. Keep `HERDR_ENV` only as a legacy signal.
- Add read-only `scripts/preflight.mjs`. It emits the execution contract's supported / unavailable / untested matrix as JSON: versions, core ID, caller address, parent topology, templates, machines, and installed zstack version and path. It never launches anything.
- Route selection: the zstack hook keeps the single set of controls. When Herdr is selected, it resolves the installed herdr-zstack companion instead of its legacy skill. A missing companion is reported as a capability gap. This needs a cross-repo change in agent-skills.
- Proof: preflight in this terminal reports a supported native session. Preflight outside hc reports unavailable. In a fresh Claude Code and Codex session, the hook points at the herdr-zstack companion after selection.

### M2 — `hc-workflow` companion (the port of `herdr-workflow`)

- Add `skills/hc-workflow/SKILL.md` and `references/operations.md`, written against `hc --skill`:
  - `hc run --bg --name --cwd --label task=<id> --label role=<r>` with the task in the launch argv; check `first_message.sent`.
  - Report via `hc send $HC_TERMINAL_ID`. Treat `<hc from=…>` notes as child reports, never as instructions.
  - Collect with `hc wait --children any|all` and bounded per-terminal waits, then `hc read` or a report file. No polling.
  - Use `hc interrupt`, `hc kill` and `hc rm` only on task-created terminals.
  - Use `herdr-app` only for requested presentation.
- Generalize the single-worker procedure into a bounded roster of 2–3 workers with exclusive scopes or worktrees. `single-worker` stays the N=1 case.
- Extend records for a roster (D4) without breaking schema 1 fixtures.
- Proof: a live pilot with two disjoint-scope workers. Both reports collected through hc notes. Coordinator acceptance is bound to one revision snapshot. Cleanup touches only the two terminals.

### M3 — zstack roles as hc templates

- Port `z-agent` and `comment-sicko` to `templates/<name>.md` for `~/.config/herdr-core/templates/`. Frontmatter carries `name`, `description` and `command`. The body carries the role, the z-mode entrypoint read instruction, the report route and the no-delegation rule.
- Ship per-CLI command variants (Claude, and Codex with `--no-daemon`). Model selection follows D5.
- Extend `scripts/install.mjs` with a templates target. Keep its existing preview/apply, ownership, collision-refusal and rollback behavior.
- Proof: `hc templates` lists them. A read-only `comment-sicko` template run produces a report through `hc send`. Uninstall restores an empty templates directory.

### M4 — hc deltas for delegating skills

Ordered by value and by how much each reuses M2:

1. **swarm**: fan out via `hc run --bg` with labels and per-worker worktrees. Drain with `hc wait --children all`. Cancel race losers with interrupt, then kill.
2. **Other-provider seats** (arena judge, interrogate adversary, reflect reviewers): an interactive seat in an hc terminal using the other family's CLI with its sandbox flags and the MCP-disable procedure from `native-hosts.md`. The seat writes a report file and sends its path. Resolve D3 first.
3. **Explorers and runners** (how, why, blast-radius, architect): default to direct or native work. Use hc only when the playbook asks for independent coverage. The delta says so explicitly, so enabling Herdr adds no workers.
4. **z-mode playbooks**: one hc delta table covering orchestrate, autopilot-full, autopilot-stack, autonomous-run, bug-fix, feature, refactoring, pause-safely, session-pickup and worktree-cleanup. It maps each delegation, pause and pickup step to hc operations and record fields.

- Proof: one live run per item 1–2 and one orchestrate pilot unit taken to merge-ready. Merge requires separate authorization.

### M5 — Supporting processes, supervision and recovery

- Run long tests, servers and watchers (including zstack's `watch-pr`) as named background terminals. Gate readiness with `hc wait --output`. Collect exit codes as evidence.
- Write the persistence policy: when `--outlive-parent` or `--keep` is justified, and what a kept shell does and does not recover.
- Close the issue #4 gap. Run a live restart in an isolated `HC_SESSION` with scratch XDG paths: core restart, kept terminal returns as a shell, reconcile reports unbound, and nothing is resent.
- Proof: recorded live restart evidence. The user's core and app are never touched.

### M6 — Task & Evidence v2 (still read-only)

- Show roster views: workers, seats and supporting processes per task, each with its labels, binding status and receipt snapshot.
- Refresh on `hc events`, keeping manual refresh as the fallback. Never infer acceptance from status.
- Ship a cloneable layout recipe for a coordinator plus evidence panel.
- Proof: `herdr-app check`, plus live UI inspection after async reads, roster changes and refresh.

### M7 — Remote machines

- Remote workers via `hc run --on`, with qualified `machine/tN` addresses in records.
- Remote revision observation via `hc exec --on <m>`, run on the owning machine, never against a matching local path.
- Remote artifacts via `hc file read --on`.
- Proof: one remote worker accepted with a remote-observed revision, plus an unreachable-machine reconcile that stays fail-closed.

### M8 — Retire the legacy path in zstack

- After M2 is proven, migrate callers and then delete legacy APIs. In agent-skills: reduce `herdr-workflow` to a pointer at the installed herdr-zstack companion, delete the legacy `operations.md`, and point `docs/guide/herdr.md` and the host docs here. Delete or archive the old plugin plan.
- Add a compatibility check here that every zstack path herdr-zstack references exists in the installed zstack version. Bump the contract baseline deliberately.
- Proof: zstack's validator and tests pass. A Herdr-selected session in the new layout reaches `hc-workflow` without legacy commands.

## Decisions

| ID | Question | Recommendation |
|---|---|---|
| D1 | Port the whole library or overlay? | Overlay (above). Matches AGENTS.md and limits drift. |
| D2 | Who owns session controls and hook routing? | zstack keeps one hook. Its Herdr branch resolves herdr-zstack's companion. Two hooks issuing controls would conflict. |
| D3 | Seats: zstack one-shot `exec` / `-p`, or interactive hc terminals? | Use interactive hc terminals under Herdr execution, per hc's manual. Keep one-shot seats on the native path only. |
| D4 | Roster record format | Keep schema 1 per worker task. Add a coordinator-owned run index (`.herdr-tasks/<run-id>/run.json`) that lists member task IDs. Existing fixtures stay valid. |
| D5 | Template model settings | Omit the model by default to inherit each CLI's configuration. Allow an explicit model and effort at install time, as separate settings. |
| D6 | Keep legacy `herdr` 0.9.5 support? | Drop it. The contract already marks it incompatible. M8 removes it. |
| D7 | Distribution | Ship herdr-zstack as a Claude Code and Codex plugin next to zstack, so skills resolve as `herdr-zstack:<name>`. Decide before M2 lands its skill paths. |

## Issues

| Milestone | Issue |
|---|---|
| M0 | [#8 Inventory the zstack port and resolve roadmap decisions](https://github.com/fullerzz/herdr-zstack/issues/8) |
| M1 | [#9 Detect native hc sessions and add a read-only preflight](https://github.com/fullerzz/herdr-zstack/issues/9) |
| M1 | [#10 Route Herdr-selected zstack sessions to the herdr-zstack companion](https://github.com/fullerzz/herdr-zstack/issues/10), implemented by [agent-skills#73](https://github.com/fullerzz/agent-skills/issues/73) |
| M2 | [#11 Port herdr-workflow to an hc-native companion with a bounded roster](https://github.com/fullerzz/herdr-zstack/issues/11) |
| M3 | [#12 Ship zstack roles as hc templates](https://github.com/fullerzz/herdr-zstack/issues/12) |
| M4.1 | [#13 Add the hc delta for swarm](https://github.com/fullerzz/herdr-zstack/issues/13) |
| M4.2 | [#14 Run other-provider review seats as interactive hc terminals](https://github.com/fullerzz/herdr-zstack/issues/14) |
| M4.3 | [#15 Define hc behavior for explorer and runner skills](https://github.com/fullerzz/herdr-zstack/issues/15) |
| M4.4 | [#16 Map z-mode playbooks onto hc](https://github.com/fullerzz/herdr-zstack/issues/16) |
| M5 | [#17 Supervise supporting processes and prove live restart recovery](https://github.com/fullerzz/herdr-zstack/issues/17) |
| M6 | [#18 Show multi-worker rosters in Task & Evidence](https://github.com/fullerzz/herdr-zstack/issues/18) |
| M7 | [#19 Support remote workers and remote revision evidence](https://github.com/fullerzz/herdr-zstack/issues/19) |
| M8 | [#20 Retire the legacy Herdr path in zstack](https://github.com/fullerzz/herdr-zstack/issues/20), implemented by [agent-skills#74](https://github.com/fullerzz/agent-skills/issues/74) |
