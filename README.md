# herdr-zstack

Herdr-specific workflows and native UI for zstack. This repository owns integration with herdr-core (`hc`) and herdr-app; zstack remains the source for shared engineering principles, scope, ownership, and verification standards.

## Available now

- [Task & Evidence](mods/task-evidence/README.md): read-only task notes and artifact viewer with separate live space activity.
- Seven behavioral tests, including real host configuration access, stale reads, and remote routing guards.

The initial migration does not yet provide an orchestration skill, plugin installer, automatic task registration, or a shared task-record protocol. Those are future work, not activated capabilities.

## Develop

```sh
node --test mods/task-evidence/*.test.mjs
herdr-app check mods/task-evidence
```

Herdr supplies `gpui-kit`, `gpui-base`, and `herdr` at runtime; do not install them from npm. Read the generated `~/.config/herdr-app/AGENTS.md` and type definitions for the installed app version. The native checker covers initial rendering only: verify file navigation and refresh in the running app too.

## Install locally

Follow the [mod guide](mods/task-evidence/README.md). Copy the three runtime files into a new personal mod folder, then add its block to a personal layout clone. Inspect an existing destination before updating it. Installed files are copies; source edits require resync. No installation happens from running tests.

For the initial development setup, `personal-task-evidence` is a copy of the existing personal layout; switching back to `personal` restores the previous presentation. Task paths are explicit and the viewer does not infer success from agent status.

## Direction

Prove one complete flow before expanding: establish task → launch one authorized worker through hc → collect result → verify revision → present evidence → pause and reconcile on pickup. Keep durable supervision outside layout-owned mod lifetimes.

Next steps are tracked in GitHub:

1. [Execution contract and zstack compatibility](https://github.com/fullerzz/herdr-zstack/issues/1)
2. [Task records and verification receipts](https://github.com/fullerzz/herdr-zstack/issues/2)
3. [Single-worker hc pilot](https://github.com/fullerzz/herdr-zstack/issues/3)
4. [Pause and pickup reconciliation](https://github.com/fullerzz/herdr-zstack/issues/4)
5. [Connect the evidence panel to tasks](https://github.com/fullerzz/herdr-zstack/issues/5)
6. [Reproducible installation and CI](https://github.com/fullerzz/herdr-zstack/issues/6)

See [repository contract](AGENTS.md), [migration record](docs/migration.md), [validation](docs/validation.md), and [provenance](NOTICE.md).
