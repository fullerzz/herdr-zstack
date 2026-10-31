---
name: single-worker
description: Explicitly invoked, one authorized native hc worker with coordinator acceptance and safe pause/pickup.
disable-model-invocation: true
---

# Single worker

Read the installed zstack `z-mode/SKILL.md` and its `references/native-hosts.md`, then this repository's `docs/execution-contract.md` and `docs/worker-lifecycle.md`. Reading this skill does not select execution, authorize dispatch, or inherit any parent controls. Follow the current host's permissions. If execution is not explicitly authorized, stop before launch and report the missing authority.

Use the numbered procedure in `docs/worker-lifecycle.md`. It implements one independent interactive worker, one assignment, durable task and handoff files, collection, coordinator verification, and owned cleanup. Do not fan out. Use the pure decision helpers in `workflows/worker-lifecycle.mjs` to check dispatch, pickup, pause, and acceptance. These helpers never contact hc or manufacture host identity. Missing identity is an unbound worker, never permission to send.

Report the task record and evidence paths, commands and outcomes, observed revision, cleanup result, and capability gaps. A done badge or worker report cannot accept the work. Do not commit, publish, replay saved assignments, restart the user's core, or change preferences unless separately authorized.
