# herdr-zstack

Herdr-specific workflows and native UI for zstack. This repository owns integration with herdr-core (`hc`) and herdr-app; zstack remains the source for shared engineering principles, scope, ownership, and verification standards.

## Available now

- [Task & Evidence](mods/task-evidence/README.md): explicit task selection, read-only brief/artifacts/handoff, receipt snapshots, and separate ownership-unverified live activity.
- [Execution contract](docs/execution-contract.md): native operation matrix, capability preflight, zstack compatibility, and single-worker ownership boundaries.
- [Task records and revision receipts](docs/task-record.md): shared schema, coordinator writer, local revision observation, and fail-closed acceptance checks.
- [Installation](docs/installation.md): reproducible namespaced mod installation, personal layout recipe, and CI checks.
- [Worker lifecycle](docs/worker-lifecycle.md): scoped single-worker execution and pause/pickup reconciliation, with [local pilot evidence](docs/validation.md#issue-3-single-worker-hc-pilot--2026-10-31) and [recovery proof limits](docs/validation.md#issue-4-pause-and-pickup-reconciliation--2026-10-31).

Installation does not activate z-mode or Herdr execution. Task registration and selection remain explicit; live pilot evidence and runtime limits are recorded in [validation](docs/validation.md).

## Develop

```sh
node --test mods/task-evidence/*.test.mjs
herdr-app check mods/task-evidence
```

Herdr supplies `gpui-kit`, `gpui-base`, and `herdr` at runtime; do not install them from npm. Read the generated `~/.config/herdr-app/AGENTS.md` and type definitions for the installed app version. The native checker covers initial rendering only: verify file navigation and refresh in the running app too.

## Install locally

Follow the [installation guide](docs/installation.md) and [mod configuration guide](mods/task-evidence/README.md). The installer copies the viewer to `zstack-task-evidence` and its tab bar to
`zstack-task-evidence-tabs`. Follow the [shared sidebar recipe](examples/layout-recipe.md)
to add a collapsible Task & Evidence button beside Files and Changes in a personal layout clone. Installed files are copies; source edits require an explicit update. No installation happens from running tests.

For the initial development setup, `personal-task-evidence` is a copy of the existing personal layout; switching back to `personal` restores the previous presentation. Task paths are explicit and the viewer does not infer success from agent status.

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
