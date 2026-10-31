---
name: swarm
description: "hc execution addendum applied alongside zstack's swarm for authorized coverage and race runs in Herdr-selected sessions."
disable-model-invocation: true
---

# Swarm on hc

Apply this addendum alongside the installed zstack `swarm/SKILL.md` and
[hc-workflow](../hc-workflow/SKILL.md), including its
[operations](../hc-workflow/references/operations.md). zstack owns partitioning,
the done predicate, selection rule and acceptance. This file supplies only the
hc fan-out, drain and race-stop procedure. Loading it grants no dispatch or
execution selection authority.

## Before fan-out

Pass hc-workflow's selection, native-session and host-permission gates first.
Record the mode (coverage or race), required slices, done predicate, selection
rule and worker budget before launching. Use the smallest useful count, at
most the remaining host/user allowance and the roster's three-member limit;
count native and hc workers together. If required coverage cannot fit, run
bounded waves and collect/stop one wave before starting the next. Never silently
drop a slice or enlarge the budget.

Give every writer its own authorized, non-nested worktree outside the
coordinator checkout, even when coverage slices have disjoint files. Race
candidates start at the same recorded revision, each in its own worktree;
include the same input data and check conditions. Read-only workers may share
a checkout with exclusive report paths. Record task files and the run index
with the existing producer before dispatch; each member keeps its schema 1
record, binding, report and acceptance. No new aggregate receipt is implied.

## Fan out and collect

Follow operations' launch-once and delivery checks for each member. Supply the
task in argv and retain the full response, including `first_message.sent` when
present. `<run>`, `<task>`, `<role>`, `<worktree>` and `<brief>` are placeholders:

```sh
hc run --bg --json --name <run>-<task> --cwd <worktree> \
  --label run=<run> --label task=<task> --label role=<role> \
  <interactive-cli-or-template> "<brief>"
```

Keep the verified coordinator parent and literal report address from operations.
Every brief bans further delegation and coordinator-record writes, gives its
exclusive output, checks and report path, and requests PASS / ISSUES / BLOCKED
with evidence. A worker's own `HC_TERMINAL_ID` is not its report recipient.
Use each CLI's default model unless the user requests an override.

For coverage, drain the roster with bounded waits:

```sh
hc wait --children all --timeout 30
```

A message can end the wait before the drain completes. Match its tagged sender
to a bound member, collect the actual report, and wait again for outstanding
members. A timeout is a check-in; blocked/error needs screen inspection and any
required user decision. Do not force input past it. `all` covers the parent's
children, which may include unrelated work: never signal those children; use
bounded per-address waits for this run if unrelated children prevent completion.
Done/idle is not acceptance, and a missing report or required slice is BLOCKED.

## Race selection and cancellation

Use `hc wait --children any --timeout 30` to collect candidates as they report.
Apply the predeclared selection rule to actual evidence. The first done badge
or PASS claim is only a candidate: freeze it and run coordinator checks in its
worktree before selecting it. Preserve each rejected candidate's report and
reason; let the remaining candidates continue until one qualifies or all end.

After a winner qualifies, cancel every remaining task-owned loser:

1. Reconcile its exact recorded core/terminal/occupant binding with fresh host
   evidence. An ambiguous occupant blocks control and leaves cleanup BLOCKED;
   do not replace identity with a name, label or focus.
2. Save any report, current screen and partial artifacts. If still live, run
   `hc interrupt <loser> --timeout 10`, then `hc get <loser>` and, as needed,
   `hc read <loser> --lines 100`. Record state/status and the interrupt result.
   A stopped turn can still write later; it is not a stopped process.
3. Recheck ownership, run `hc kill <loser>` if live, and confirm
   `state: finished` with `hc get <loser>`. On failure preserve the address and
   report BLOCKED; do not remove an unconfirmed live terminal.
4. Save the finished evidence before `hc rm <loser>`. A loser already finished
   needs no interrupt/kill. Record its outcome as cancelled, rejected or
   completed, never as an accepted winner or silently missing coverage.

Drain the owned remainder with `hc wait --children all --timeout 30` and inspect
each bound address. Accept the winner with the existing per-member receipt
procedure against matching before/after revision observations. Never apply
loser changes to the winner's worktree or the coordinator checkout automatically.
If no candidate qualifies, retain all outcomes and report ISSUES or BLOCKED.

## Consolidated result and cleanup

Return one report with an overall PASS / ISSUES / BLOCKED, the declared
selection rule, and a row per member: slice/candidate, exposed model identity,
terminal binding, outcome, report/check evidence, accepted revision (if any),
and cleanup state. Coverage passes only when every required slice is verified;
a race passes only with a verified winner and every loser stopped and accounted
for. Missing proof or uncertain cleanup is BLOCKED even when a candidate passed.

Collect reports before killing/removing successful workers, following
operations. Account for every exact address this run created; a labelled listing
is an audit aid, not authority to control a terminal. Preserve worktrees and
partial changes for review until their evidence is saved and removal is
authorized. No unrelated terminal, core, personal layout or configuration is
part of cleanup.
