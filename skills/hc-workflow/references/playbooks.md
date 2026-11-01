# z-mode playbooks on hc

Use this table when Herdr is the selected execution method and the selected z-mode playbook reaches a delegation, pause, pickup or cleanup step. The installed zstack playbook still owns that step's logic: whether to delegate, scope, ownership, review policy and authority. This file names only the hc operation and the record fields that carry it. It adds no workers. A step marked **direct** runs with the coordinator's own tools exactly as the playbook says.

Read [operations](operations.md) and the [worker lifecycle](../../../docs/worker-lifecycle.md) first. Pass the hc-workflow gate before any launch.

Step numbers refer to installed zstack 0.24.0, checked against 0.23.0. Both versions number these steps the same way. Recheck the steps after an upgrade, as the [inventory](../../../docs/port-inventory.md) describes.

## Terms

- **Launch** means operations §2–3 for one member. Write its schema 1 record (`taskId`, `owner`, `scope`, `brief`, `handoff`) and add it to the run index (`members[].checkout`, `members[].writes`). Persist `launchAttempted` and the argv in the handoff. Then run `hc run --bg --json` with `run`, `task` and `role` labels. Check `first_message.sent` or read the screen, and bind `worker.core`, `worker.terminal` and `worker.occupant`.
- **Collect** means operations §4. Run bounded `hc wait --children any|all` or `hc wait <t>`, match the tagged `<hc from=…>` sender to a bound member, and read the report file. Use `hc read` for screen evidence only.
- **Accept** means operations §5. Freeze the writers that share the checkout, take before and after `observeRevision` snapshots, and run `recordMemberAcceptance`. The result is `receipt.decision` and `receipt.revision` (`commit`, `worktreeDigest`). A receipt covers one revision. A new commit or a dirty change needs a new receipt. Accept leaves the writer finished, because `recordMemberAcceptance` refuses a live one. Any later push, merge or restack on that branch is a Successor's work.
- **Head check** applies whenever a receipt must cover a PR head. Before Accept, in the owner's worktree, `git rev-parse HEAD` must equal the PR's `headRefOid`, and `git status --porcelain --untracked-files=all -- . ':(exclude).herdr-tasks'` must print nothing. Then the receipt's `worktreeDigest` is the PR head's content, not uncommitted bytes. Before acting on the receipt later, `acceptanceStatus` against a fresh `observeRevision` must be `accepted`, and the live `headRefOid` must equal `receipt.revision.commit`. Commit equality alone is not enough.
- **Successor** means a fresh owner for the same branch after the previous owner is finished and recorded as accepted, rejected or incomplete. Replace the previous member's run index entry with it, keeping the same `checkout` and `writes`, through a new `writeRun` sequence. Both cannot sit in one index, because their writes overlap. The previous record keeps its receipt. The brief carries the current head, the previous receipt and report paths, any verifier report, and the one assigned action. A Successor that moves the head needs Accept again at the new head.
- **Stop** means: reconcile the exact binding, save evidence, then `hc interrupt <t>`, `hc get <t>`, `hc kill <t>`, confirm `state: finished`, then `hc rm <t>`. A terminal already finished, for example by Accept, skips interrupt and kill. Use Stop only on addresses this run created.
- **Seat** means [seats](seats.md): an interactive verifier from another model family, launched as a roster member.
- **Process** means a task-owned supporting terminal: `hc run --bg` with explicit cwd, readiness through `hc wait --output`, and output plus exit status as evidence. Its supervision and recovery belong to M5 ([#17](https://github.com/fullerzz/herdr-zstack/issues/17)) and are untested here.
- **Notes** means the coordinator's user-owned notes or handoff file. Record facts there that have no schema 1 field: PR, head, verdict, coordinator address, run index path, `launchAttempted`, launch argv and delivery state.

A run index holds 1–3 live members. When a member is collected, finished and recorded as accepted, rejected or incomplete, replace its entry with the next assignment in a new `writeRun` sequence. The other members keep running. The replaced member's record and evidence stay, and the notes list it. Count native and hc workers together against the host limit.

## Delta table

| Playbook · step | zstack point | hc operation | Record fields |
|---|---|---|---|
| orchestrate · line 4 | Spawn workers through the selected method | Launch each unit owner, one member per unit, with an exclusive worktree and branch. Start with one pilot unit and fan out only after it reaches merge-ready. | Run index `members[]`. Notes: unit, owner `taskId`, terminal address. Keep live status apart from `receipt`. |
| orchestrate · line 4 | Native task tracker and notes file | **Direct.** The notes file stays the program ledger. hc state is evidence in it, not a substitute. | Notes: goal, authority, directives, and per unit the owner, PR, head and verdict. |
| orchestrate · line 4 | Watch PRs with native subscriptions | **Direct**, through `gh pr view` / `gh pr checks` or host PR events. A long-running watcher is a Process (M5). | Notes: PR head and CI state at each verdict. |
| orchestrate · line 4 | Never relay messages between agents | Never `hc send` one member's report to another. Paste an upstream report into the dependent member's brief at launch. | `brief` holds the pasted report. |
| orchestrate · line 7 | Only the owner writes, pushes or retargets its branch | The brief grants the owner its branch and only the publication actions the user covered. The coordinator never edits the owner's worktree. | `owner`, `scope`, `members[].writes`. |
| orchestrate · line 8 | Fresh worker per task, upstream reports pasted, exclusive worktree | Launch a new member for each task and fix round. Never `hc send` new work to a finished member. | A new `taskId` per assignment. The old record keeps its `receipt`. |
| orchestrate · line 9 | Nest only when the host supports it | **Gap.** Briefs ban `hc run`, and nested coordinators are unproven on hc. Stay at one coordinator level and use the rolling index above. | None. |
| orchestrate · line 10 | Reuse only for built state | `hc send <t>` to the bound member, only after `reconcile` reports it bound and only for agent-held state. Never message a worker to check on it; use `hc get` / `hc read`. | `worker` binding re-reconciled before the send. Notes record the reason. |
| orchestrate · line 11 | Other-family verifier passes at the current head | When the owner reports its pushed head, freeze it (Accept step 1) and run the Head check. Then run a Seat, read-only with exact check rules, at that head. Its report is evidence. Finish Accept with the seat report among the coordinator's evidence. Without a usable seat, stop at merge-ready and report the gap. | Seat record and report path. Owner `receipt.revision` from the Head check. |
| orchestrate · line 11 | Owner merges per Shipping, when authorized | Under explicit merge authority, launch a Successor whose only task is Shipping's merge, pinned to `receipt.revision.commit` (on GitHub, `gh pr merge --match-head-commit`). A rebase or retarget moves the head and returns the unit to the verifier row. Confirm the merge with `gh pr view`. Without merge authority, the unit stops at merge-ready. | Successor record. Notes: merge-ready head, verdict, merge authority, merge result. |
| orchestrate · lines 15–16 | Brief names done evidence; read the diff | Accept. Read the diff in the owner's worktree, not only the report. | `receipt.evidence` lists coordinator checks. |
| orchestrate · line 18 | Account for every spawned worker | `hc ls --all --label run=<run>`, then `hc get` for each bound address. Mark each one done, replaced or absorbed. | Every `taskId` the run used, current or replaced in the index, has an outcome in notes. |
| orchestrate · line 19 | Judge by pushes, stop, retry once fresh | Judge with `gh`, not hc status. Stop the stalled member, then Launch a fresh one with a corrected brief. A late report from a stopped member is checked against the PR's current head. | Old `receipt.decision: incomplete`. New `taskId`, new `launchAttempted`. |
| orchestrate · line 21 | Reconcile before completion or pause | Collect, then Stop or pause-safely below. | Final `activity`, notes. |
| autopilot-full · 2 | Owners with exclusive worktrees; fresh owner per item and fix round | Launch, one member per item, in the rolling index above. A retained terminal never implies reuse of its conversation. | `members[]`, a new `taskId` per item or round. |
| autopilot-full · 3 | Independent reviewers at exact heads; blocking defects to a fresh owner | Reviewer: a read-only member or, when another family is required, a Seat. Accept the owner with a Head check at the reviewed head. A blocking defect gets a Successor whose brief carries the prior report and paths. | Reviewer report path. Owner `receipt.revision` at that head. |
| autopilot-full · 4–5 | Publish, re-check heads, merge only if authorized | **Direct** by the coordinator, or by a Successor when the user's authority covers it. Before acting, repeat the Head check's later half against the live head. | `receipt.revision` against a fresh `observeRevision` and the live `headRefOid`. |
| autopilot-full · 6 | Honor stop; reconcile children | Pause-safely rows below. | See pause-safely. |
| autopilot-stack · 1 | Stop at verified; no push after handoff | Accept each item with a Head check at its head. Accept already finished the owner, so save its evidence and `hc rm` it. Launch no Successor after handoff without the operator's go, so no task terminal can push. | `receipt` per item, `activity: completed`. |
| autopilot-stack · 2 | Dependent branch bases on parent; owner relays parent outputs | Launch the child only after the parent is accepted. Its brief carries the parent's report and commit. | Notes: parent commit under the child. Child `brief`. |
| autopilot-stack · 3 | Release dependents after artifact acceptance | Release a dependent only when the parent's latest owner record has `acceptanceStatus` `accepted` at its current head. Done, idle or a report is not release. A restack is a Successor's work, and it makes the old receipt `stale`. If `git patch-id --stable` is unchanged, the verdict carries: Accept the Successor at the new head, using the patch-id comparison and the kept review report as its checks, with no new review. Otherwise re-verify per autopilot-full · 3. | Successor `receipt`. Notes: old and new patch-id. |
| autonomous-run · 2 | Event watcher or background facility | Process, only if a useful watcher exists. A skill supplies no overnight scheduler. | Notes: process address, purpose, owner. |
| autonomous-run · 3 | Iterate and verify | **Direct.** | None. |
| autonomous-run · 4 | show-me-your-work's independent trail review | Launch one read-only reviewer (the single-worker case). Use a Seat only if the reviewer must be another family. | Reviewer record and report path. |
| autonomous-run · 5 and closing | Stop; pause-safely if execution cannot persist | Pause-safely rows below. | See pause-safely. |
| bug-fix · 3 | Optional delegation; architect for non-obvious shape | **Direct** by default. Delegate only a useful exclusive slice, as the single-worker case. Architect's own delegation is outside this table. Treat it as a gap until architect's hc delta ships (#15); do not substitute native agents. | Single member when delegated. |
| feature · 3 | Delegate independent exclusive slices when useful | **Direct** for a small task. Otherwise Launch 1–3 members, one per slice the playbook chose, with disjoint `writes` in one checkout, or separate worktrees. | `members[].writes`, checked by `validateRun`. |
| feature · 4–5 | Integrate and verify observable behavior | Freeze every member, then verify integration once. Accept each member against the same before and after snapshot. | One `receipt.revision` shared by all members in the checkout. |
| refactoring · 4 | Isolate delegated mechanical slices | Launch one member per slice with exclusive `writes`. The coordinator runs each unit's equivalence check before accepting it. | `receipt.evidence` includes the equivalence check. |
| refactoring · 5 | Verify equivalence on the artifact | **Direct.** | None. |
| pause-safely · 1 | Cancel or drain children; detach is not pause | Per member: fresh `hc get` plus identity evidence, then `reconcile` and `pausePlan`. Drain with bounded `hc wait`, or `hc interrupt` only the exact reconciled occupant, then observe. Report every member that could not be stopped. Closing or detaching `herdr-app` does nothing to workers. | `worker`, `activity`, notes: per-member state. |
| pause-safely · 2–3, 5 | Preserve files; durable note; verify it survives | **Direct.** Re-read the note from disk before stopping. | Handoff path. |
| pause-safely · 4 | Record Herdr state | Write the coordinator address, run index path, and for each member its `taskId`, binding, `launchAttempted`, delivery state, writer status, report path and receipt. Add each Process's address and owner, and the next safe action. Never write session controls. | Handoff, plus each record's `worker`, `revision` and `receipt`. |
| session-pickup · 2 | New session needs its own selection | The new session selects Herdr explicitly, then runs `node scripts/preflight.mjs`. Never run inherited controls. | None. |
| session-pickup · 4 | Reconcile run index, bindings, occupants and processes before any prompt | Per member, before any `hc run` or `hc send`: run `hc get <t>` and identity evidence on the owning machine, and `observeRevision`. Pass them to `reconcile`. Collect a bound survivor with Collect. An unbound or unavailable member blocks only its own resumption. Resuming it needs a fresh, explicitly authorized assignment. Never resend a saved brief. | `worker` against fresh evidence. `revision` against the snapshot. A changed revision makes the receipt `stale`. |
| worktree-cleanup · 2–3 | Inspect active agents and processes per candidate | For each candidate, match recorded `checkout` values in task records and run indexes. Then run `hc ls --all` and compare `hc get` `foreground.cwd` with the worktree path. A live writer, a Process or an unknown occupant holds the candidate. This step sends no signal. | `members[].checkout`, `worker`, `activity`. |
| worktree-cleanup · 4–5 | Remove authorized clean worktrees; report | **Direct** `git worktree remove` without `--force`. Stopping a terminal is a separate, task-owned Stop. | None. |

## Coverage

Each delegating point in the inventory's ten playbook rows appears above:

- orchestrate: line 4's dispatch and PR watch; lines 8–11's owners, sub-coordinators, reuse and verifiers; lines 19–21's replace and reconcile.
- autopilot-full: steps 2, 3 and 6. Autopilot-stack: inherited owners plus step 3's release.
- autonomous-run: steps 2 and 4, plus its stop.
- bug-fix: step 3. Feature: step 3. Refactoring: step 4.
- pause-safely: steps 1 and 4. Session-pickup: step 4. Worktree-cleanup: steps 2–3.

Steps not listed are execution-neutral and stay direct.

## Limits

- Nested sub-coordinators and more than three live members per index are unavailable. The rolling index keeps at most three in flight.
- Processes, including a PR watcher, are untested until M5.
- Writing seats are unproven live. A verifier that must write repro files is a coverage gap until that is proven.
- Remote members are a later milestone. Every member runs on the index's machine.
