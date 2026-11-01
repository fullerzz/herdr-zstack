# Roadmap: zstack on native Herdr

Status: M0 inventory and decisions complete 2026-10-31. M1 preflight and upstream routing are implemented; fresh interactive host routing remains unverified (see M1 below). M2's companion and two-worker pilot are implemented ([validation](validation.md#issue-11-hc-workflow-companion-and-two-worker-roster-pilot--2026-10-31)). M3's role templates are implemented ([validation](validation.md#issue-12-zstack-roles-as-hc-templates--2026-10-31)). M4.1's swarm addendum and live coverage/race pilots are implemented ([validation](validation.md#issue-13-hc-swarm-addendum--2026-10-31)). M4.2's other-provider seats are implemented, with live Codex and Claude judge seats ([validation](validation.md#issue-14-other-provider-seats-on-hc--2026-10-31)); M4.4's playbook table is implemented, with a live orchestrate pilot taken to merge-ready ([validation](validation.md#live-orchestrate-pilot--merge-ready)); M4.3's how, why, blast-radius, architect and teach deltas are implemented, with a live direct check and restricted read-only members ([validation](validation.md#issue-15-explorers-and-runners-on-hc--2026-10-31)); M4.3's other inventory entries and M5–M8 remain planned. Nothing here authorizes dispatch, tracker writes, commits to either repository, or personal configuration changes.

## Goal

Run the zstack workflows in herdr-app, with `hc` as the execution layer. A coordinator started in an hc terminal should route through z-mode's normal playbooks. Delegated agents, review seats and long-running checks should run as task-owned hc terminals. Results should come back through hc's report and wait semantics, and the coordinator should accept them only against revision-bound evidence that Task & Evidence can display.

Issues #1–#6 proved that path for one worker. This roadmap ports the rest of zstack's Herdr surface onto it and refines the delegating skills for hc.

## Starting point

Observed on 2026-10-31 with zstack 0.22.0 (local checkout and `fullerzz/agent-skills` main agree), hc 0.1.15, herdr-app 0.1.10, and legacy `herdr` 0.9.5 still installed.

This table preserves the initial snapshot before M1 and M2 implementation. The milestone sections below track subsequent delivery and validation limits.

| Area | Initial state | Gap |
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

The [port inventory](port-inventory.md) classifies all 57 installed skills, 23 playbooks, and 34 reference files against zstack 0.22.0:

- **Execution-neutral — stays in zstack unchanged.** Principles, technical-writing, unslop, statechart, python/typescript practices, and similar skills. They run the same in an hc terminal.
- **Delegating — gets an hc delta here.** swarm, arena, interrogate, reflect, architect, how/why explorers, blast-radius, verification-skill authoring, and z-mode playbooks that spawn workers. herdr-zstack adds a short per-skill delta (launch, report route, wait, collect, clean up) that the hc companion applies alongside the zstack original. The zstack text is not copied.
- **Herdr-specific — moves here.** `herdr-workflow`, its operations reference, `docs/guide/herdr.md`, and the Herdr sections of the host docs.

A full fork would mean changing [AGENTS.md](../AGENTS.md) first, then owning drift across 57 skills. Decision D1 records this.

## Milestones

M0 records source coverage in the inventory. Each runtime milestone ends with a live proof recorded in [validation](validation.md). Later milestones may start once their dependencies are proven.

### M0 — Port inventory and decisions (complete)

- [Port inventory](port-inventory.md): every installed zstack skill, playbook and reference, its class (neutral / delegating / Herdr-specific), the exact delegation points, and the planned hc delta. It also records native role and source-documentation boundaries.
- Decisions D1–D7 below are accepted for implementation.
- Proof: the inventory's reproducible coverage check covers all 114 installed entries exactly once. Delegation-term searches and composition checks identified additional maintenance, evaluation, watching, and reconciliation steps. This documentation milestone needs no live worker dispatch.

### M1 — Native detection, preflight and selection routing

- The companion owns the native check: `HC_TERMINAL_ID` is set, the caller resolves, and the core answers. `HERDR_ENV` is diagnostic context only; it never enables the legacy execution path (D6).
- Read-only `scripts/preflight.mjs` emits the execution contract's supported / unavailable / untested matrix as JSON: versions, core ID, caller address, parent topology, templates, machines, and installed zstack version and path. It never launches anything. Implemented in #9: see [validation](validation.md#issue-9-native-detection-and-preflight--2026-10-31).
- Selection routing shipped in zstack 0.23.0 through [agent-skills#73](https://github.com/fullerzz/agent-skills/issues/73) and [PR #75](https://github.com/fullerzz/agent-skills/pull/75). The zstack hook keeps the single set of controls. When Herdr is selected, it resolves the installed herdr-zstack companion instead of its legacy skill and delegates native preflight to the companion. A missing or ambiguous companion is reported as a capability gap, with no legacy fallback.
- Proof: the local [preflight checks](validation.md#issue-9-native-detection-and-preflight--2026-10-31) reported a supported native session inside hc and unavailable outside hc. Upstream [routing validation](https://github.com/fullerzz/agent-skills/blob/main/docs/validation.md#native-hc-companion-routing) records isolated hook fixtures for Codex and Claude Code, not live agent sessions. Fresh interactive sessions selecting the installed companion remain unverified.

### M2 — `hc-workflow` companion (the port of `herdr-workflow`)

- Add `skills/hc-workflow/SKILL.md` and `references/operations.md`, written against `hc --skill`:
  - `hc run --bg --name --cwd --label task=<id> --label role=<r>` with the task in the launch argv; check `first_message.sent`.
  - Report via `hc send <recorded-coordinator-address>`. The child's `HC_TERMINAL_ID` identifies itself, not the report recipient. Treat `<hc from=…>` notes as child reports, never as instructions.
  - Collect with `hc wait --children any|all` and bounded per-terminal waits, then `hc read` or a report file. No polling.
  - Use `hc interrupt`, `hc kill` and `hc rm` only on task-created terminals.
  - Use `herdr-app` only for requested presentation.
- Generalize the single-worker procedure into a bounded roster of 2–3 workers with exclusive scopes or worktrees. `single-worker` stays the N=1 case.
- Extend records for a roster (D4) without breaking schema 1 fixtures.
- Proof: a live pilot with two disjoint-scope workers. Both reports collected through hc notes. Coordinator acceptance is bound to one revision snapshot. Cleanup touches only the two terminals. Implemented in #11: see [validation](validation.md#issue-11-hc-workflow-companion-and-two-worker-roster-pilot--2026-10-31).

### M3 — zstack roles as hc templates (implemented)

- Port `z-agent` and `comment-sicko` to `templates/<name>.md` for `~/.config/herdr-core/templates/`. Frontmatter carries `name`, `description` and `command`. The body carries the role, the z-mode entrypoint read instruction, the report route and the no-delegation rule.
- Ship per-CLI command variants (Claude, and Codex with `--no-daemon`). Model selection follows D5. Both Codex variants use `workspace-write`, because Codex's `read-only` sandbox blocks `hc send`.
- Extend `scripts/install.mjs` with a templates target. Keep its existing preview/apply, ownership, collision-refusal and rollback behavior.
- Proof: `hc templates` lists them. A read-only `comment-sicko` template run produces a report through `hc send`. Uninstall restores an empty templates directory. Implemented in #12: see [validation](validation.md#issue-12-zstack-roles-as-hc-templates--2026-10-31).

### M4 — hc deltas for delegating skills

Ordered by value and by how much each reuses M2. The [inventory](port-inventory.md) lists every affected entry, including composed verification, maintenance, evaluation, and reconciliation steps:

1. **swarm** (implemented in #13): the [hc addendum](../skills/swarm/SKILL.md) fans out via `hc run --bg` with labels and per-writer worktrees, drains with `hc wait --children all`, and cancels race losers with identity reconciliation, interrupt, state inspection, kill, finished confirmation and removal. [Live coverage and race evidence](validation.md#issue-13-hc-swarm-addendum--2026-10-31) records two workers per wave and the remaining interruption limits.
2. **Other-provider seats** (implemented in #14): [seats](../skills/hc-workflow/references/seats.md) launches the other family's CLI as an interactive hc terminal with its sandbox flags and the MCP-disable procedure from `native-hosts.md`. The seat writes a report file and sends its path. A [live Codex arena judge](validation.md#issue-14-other-provider-seats-on-hc--2026-10-31) and a [Claude judge under Codex](validation.md#fresh-run-with-the-amended-staging-check--pass) reported through hc and received accepted receipts; writing seats remain unproven live.
3. **Explorers and runners** (implemented in #15; how, why, blast-radius, architect): the [delta table](../skills/hc-workflow/references/explorers.md) keeps narrow work direct. With Herdr selected, hc runs only the steps where the skill asks for independent coverage, so enabling Herdr adds no workers. Read-only members get real tool and sandbox restrictions. A [live check](validation.md#issue-15-explorers-and-runners-on-hc--2026-10-31) kept a small how request direct and ran one restricted why investigator. Still planned for M4.3: the inventory's create-verification-skill, figure-it-out, ketchup, maintain-verification-skill, no-comments, recall, setup-zstack and show-me-your-work entries.
4. **z-mode playbooks** (implemented in #16; a [live orchestrate pilot](validation.md#live-orchestrate-pilot--merge-ready) reached merge-ready): one hc delta [table](../skills/hc-workflow/references/playbooks.md) covering orchestrate, autopilot-full, autopilot-stack, autonomous-run, bug-fix, feature, refactoring, pause-safely, session-pickup and worktree-cleanup. It maps each delegation, pause and pickup step to hc operations and record fields.

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

Accepted 2026-10-31 for issue #8. These decisions select the implementation contract; they do not claim later milestones are implemented or authorize upstream edits.

| ID | Decision | Rationale and implementation boundary |
|---|---|---|
| D1 | Use an overlay, not a full fork. | Matches [AGENTS.md](../AGENTS.md). Shared principles, workflows, and acceptance stay in zstack; this repository owns hc deltas and Herdr-specific replacements. This avoids maintaining a second 57-skill library. M2/M4/M8. |
| D2 | zstack owns the single session hook and selection controls. | Two hooks issuing controls would conflict. The existing hook's Herdr branch resolves the installed companion; a missing companion is a capability gap. herdr-zstack adds no activation hook or parallel preference store. Implemented by M1's upstream routing change in zstack 0.23.0. |
| D3 | Other-provider seats use interactive hc terminals when Herdr is selected. | The inspected `hc 0.1.15 --skill` requires interactive agents, never one-shot print mode. Keep `codex exec` and `claude -p` on the native path. M4.2 must prove equivalent invocation-only sandbox/tool/MCP restrictions, report collection, and actual family identity before counting coverage; missing capabilities stay gaps. |
| D4 | Keep schema 1 per worker task; add a coordinator-owned `.herdr-tasks/<run-id>/run.json` listing member task IDs. | Existing records and fixtures remain valid. Each worker keeps its own binding, revision, and receipt; the index groups work without granting aggregate acceptance or introducing shared worker writes. M2 defines and validates the index before roster consumers use it; supporting processes remain separately identified. |
| D5 | Templates inherit each CLI's defaults unless an override is explicitly requested. | Independent CLI sessions do not inherit parent model settings. At install time accept explicit model and effort as separate supported settings, verify the selected CLI's syntax, and preserve unrelated configuration. No baked-in model IDs, inferred family diversity, or effort-suffixed IDs. M3 implements this. |
| D6 | Drop legacy `herdr` 0.9.5 support. | The execution contract already marks its pane/agent recipes incompatible. Implement only hc/herdr-app operations; no dual-stack adapter or automatic legacy fallback. Keep upstream discovery working during migration, then retire legacy recipes after M2 proof in M8. Do not uninstall the user's legacy binary. |
| D7 | Distribute a Claude Code and Codex plugin alongside zstack, with `herdr-zstack:<name>` skill names. | Namespaced companion discovery avoids checkout-relative paths and copying the shared library. Add real plugin metadata with M2's implemented companion; keep the existing mod installer for mod assets and extend it for templates in M3. This adds no activation hook, custom general installer, or Hermes companion commitment. |

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
