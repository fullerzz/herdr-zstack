# herdr-zstack

Herdr-specific workflows and native UI for zstack. This repository owns integration with herdr-core (`hc`) and herdr-app; zstack remains the source for shared engineering principles, scope, ownership, and verification standards.

## Available now

- [Execution contract](docs/execution-contract.md): native operation matrix, capability preflight, zstack compatibility, and single-worker ownership boundaries. `node scripts/preflight.mjs` reports native-session detection and the capability matrix as read-only JSON.
- [Task records and revision receipts](docs/task-record.md): shared schema, coordinator writer, local revision observation, and fail-closed acceptance checks.
- [Installation](docs/installation.md): reproducible namespaced tab-bar installation, personal layout recipe, and CI checks.
- [hc workflow companion](skills/hc-workflow/SKILL.md): the hc-native port of zstack's `herdr-workflow`, with [operations](skills/hc-workflow/references/operations.md) for a bounded roster of 1–3 task-owned workers and a coordinator-owned [run index](docs/task-record.md#run-index-for-a-roster). It ships as the `herdr-zstack:hc-workflow` plugin skill; see [installation](docs/installation.md#hc-companion-skills).
- [hc first](skills/hc-first/SKILL.md): a skill agents load on their own inside a verified hc terminal. It runs slow commands, CI watches and servers through `hc run --bg` and `hc wait` instead of host background shells or sleep loops. It grants no delegation authority.
- [Swarm addendum](skills/swarm/SKILL.md): hc fan-out, coverage drain and race cancellation applied alongside zstack's swarm, with per-writer worktrees and one consolidated report.
- [Playbook table](skills/hc-workflow/references/playbooks.md): one hc delta table for z-mode's delegating, pause, pickup and cleanup playbooks. Each step maps to an hc operation and record fields, or stays direct.
- [Explorer and runner deltas](skills/hc-workflow/references/explorers.md): when how, why, blast-radius and architect stay direct under Herdr, and how their coverage steps launch restricted read-only hc members.
- [Other-provider seats](skills/hc-workflow/references/seats.md): interactive hc seats for arena's judge and interrogate's other-provider adversary, replacing zstack's one-shot seat launch when Herdr is selected.
- [Role templates](templates/): `z-agent` and `comment-sicko` as hc templates for Claude Code and Codex, installed with `--target templates`; see [installation](docs/installation.md#hc-role-templates).
- [Worker lifecycle](docs/worker-lifecycle.md): scoped single-worker execution and pause/pickup reconciliation, with [local pilot evidence](docs/validation.md#issue-3-single-worker-hc-pilot--2026-10-31) and [recovery proof limits](docs/validation.md#issue-4-pause-and-pickup-reconciliation--2026-10-31).

Installation does not activate z-mode or Herdr execution. Activating z-mode automatically runs the companion preflight and selects Herdr in a verified live hc terminal, including headless terminals, unless Native was explicitly selected. Task registration follows that session selection; live pilot evidence and runtime limits are recorded in [validation](docs/validation.md).

## Develop

```sh
node --test
herdr-app check mods/task-evidence-tabs
just check
```

`just check` type-checks the JSDoc of the pure helpers in `records/` with TypeScript through `npx`. Herdr supplies the tab bar's `gpui-kit`, `gpui-base`, and `herdr` imports at runtime; do not install them from npm. Read the generated `~/.config/herdr-app/AGENTS.md` and type definitions for the installed app version. The native checker covers initial rendering only: verify panel switching in the running app too.

## Install locally

Follow the [installation guide](docs/installation.md). The installer copies the tab bar to
`zstack-task-evidence-tabs`. It supports [additional sidebar buttons](examples/layout-recipe.md)
through personal layout configuration, so integrations do not require edits to its installed code. Installed files are copies; source edits require an explicit update. No installation happens from running tests.

The Task & Evidence panel has been removed. `just update-sidebar` deletes an unmodified earlier install of `zstack-task-evidence`; remove any `task-evidence` or roster block that still names that mod from your personal layouts.

## Direction

Prove one complete flow before expanding: establish task → launch one authorized worker through hc → collect result → verify revision → present evidence → pause and reconcile on pickup. Keep durable supervision outside layout-owned mod lifetimes.

The [roadmap](docs/roadmap.md) ports zstack's Herdr-specific workflows onto hc and adds hc deltas for its delegating skills. The [port inventory](docs/port-inventory.md) covers the installed zstack 0.22.0 baseline and records the planned execution changes; roadmap decisions D1–D7 are accepted. The completed foundation issues:

1. [Execution contract and zstack compatibility](https://github.com/fullerzz/herdr-zstack/issues/1)
2. [Task records and verification receipts](https://github.com/fullerzz/herdr-zstack/issues/2)
3. [Single-worker hc pilot](https://github.com/fullerzz/herdr-zstack/issues/3)
4. [Pause and pickup reconciliation](https://github.com/fullerzz/herdr-zstack/issues/4)
5. [Connect the evidence panel to tasks](https://github.com/fullerzz/herdr-zstack/issues/5)
6. [Reproducible installation and CI](https://github.com/fullerzz/herdr-zstack/issues/6)

See [repository contract](AGENTS.md), [migration record](docs/migration.md), [validation](docs/validation.md), and [provenance](NOTICE.md).
