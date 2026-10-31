[Issue #13](https://github.com/fullerzz/herdr-zstack/issues/13) · Closes #13

## Why the change

Give Herdr-selected zstack swarms an hc procedure for bounded fan-out, coverage drain, and verified race cancellation without copying the shared workflow.

## Special things to note

- Every writer gets its own worktree; the existing roster and per-member revision receipts remain authoritative.
- A race winner must pass coordinator checks, and all losers must be confirmed stopped; uncertain cleanup returns BLOCKED.
- Validation: 79 Node tests, native mod checker, plugin and skill checks, and two-worker coverage/race pilots passed; the race interrupt tested a completed loser, with evidence and limits in [validation](https://github.com/fullerzz/herdr-zstack/blob/13-add-the-hc-delta-for-swarm/docs/validation.md#issue-13-hc-swarm-addendum--2026-10-31).

## Change outline

```text
installed zstack swarm             # scope, done predicate, selection, acceptance
  hc-workflow                     # preflight, roster, launch-once, receipts
    herdr-zstack:swarm             # hc execution addendum
      fan-out: hc run --bg         # task/role labels, one worktree per writer
      coverage: wait --children all → collect → verify each member
      race: wait --children any → verify candidate → select winner
        losers: reconcile → interrupt → observe → kill → confirm finished → rm
      one PASS / ISSUES / BLOCKED report, including every member and cleanup
```
