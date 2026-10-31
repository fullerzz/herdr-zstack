# Single-worker task records (schema 1)

The coordinator owns `.herdr-tasks/<task-id>/task.json` in the task checkout. Only that coordinator writes; workers report in Markdown and cannot approve themselves. A record is a single task and one worker binding, not a workflow engine. Briefs, handoffs and verification narratives remain Markdown. Local records are task state, not shipped fixtures.

The JSON fixtures in `records/fixtures/` are the complete format:

- `schemaVersion: 1`, positive integer `sequence`, durable `taskId`, and `coordinator` identity.
- `machine` and absolute `checkout`; machine identifies the owning host, not the UI host. The checkout must be the repository root.
- `owner` and human-readable `scope`; these describe assignment responsibility, not permission enforcement.
- `worker: {core, terminal, occupant}` or `null` when missing. The occupant is a session/agent identity independently reconciled with the runtime. A terminal restored as a shell does not satisfy an old occupant binding. Never replay an assignment from a record.
- `activity: "active" | "completed"` is reported activity, never acceptance.
- `brief`, `handoff`, and `artifacts: string[]` are paths on the owning machine, absolute or relative to checkout. A listed path may not exist yet; show read failures as incomplete evidence.
- `revision: {commit, worktreeDigest}` or `null` when unknown. Commit is the full lowercase Git object ID. Digest is `"clean"` or `"sha256:<64 lowercase hex>"`.
- `receipt: null | {coordinator, decision, revision, evidence}`. Decision is `accepted`, `rejected`, or `incomplete`; evidence is a nonempty array of paths to coordinator inspection and check results. The receipt coordinator must equal the record coordinator. Status or a worker report cannot manufacture this receipt.

`mods/task-evidence/task-record.js` has no host imports. `validateRecord(record)` returns errors, `parseRecord(json)` returns `{record, errors}` with a null record on errors, and `sameRevision(a,b)` compares known revision snapshots. Unknown versions and malformed records fail visibly rather than being guessed or migrated.

`acceptanceStatus(record, observed = null)` returns `malformed`, `unverified`, `stale`, or the receipt decision. Observed is `{machine, checkout, commit, worktreeDigest}`. Acceptance requires exact record/receipt/observed revision agreement and observed machine/checkout agreement. A changed commit or dirty snapshot is stale; unknown observation is unverified. The native read-only panel can show the saved receipt decision and revision as a **receipt snapshot**, but cannot independently establish current Git state, so it must not label that snapshot current acceptance. Missing worker information stays visible independently of receipt history.

## Producing revision evidence

`observeRevision(checkout)` in `records/task-record-store.mjs` observes the local checkout only. The coordinator must freeze writers, observe before checks, run the checks, and observe again; publish acceptance only if both observations match. Supply the independently verified owning machine and checkout when calling `acceptanceStatus`. A failed observation/check is unknown or incomplete, never clean. Remote coordinators run observation on the owning machine, never against a coincidentally matching local path.

The observer always emits a SHA-256 digest, even when Git reports a clean checkout. It hashes a format marker, the staged index entries, and sorted paths from HEAD, the index, and nonignored untracked files. Each path contributes its actual filesystem mode and bytes (or symlink target), or an explicit missing marker. Each hash part is byte-length prefixed. Git index flags, line-ending normalization, and `core.filemode` cannot hide tracked input changes. This covers staged/unstaged edits, staged index differences, tracked deletions, executable changes and untracked content changes. Earlier diff-based receipts, including `clean` receipts, require fresh verification; the schema still permits reading them as historical evidence.

`.herdr-tasks/` is excluded from the snapshot to prevent evidence writes invalidating their own receipt. Store only task evidence there, never executable task inputs. Ignored untracked files and submodule interiors are outside this policy: if checks depend on them, do not accept using this observer; obtain separate evidence or report incomplete. No filesystem/Git observation is an atomic worktree snapshot; pause task writers and keep them paused through acceptance.

## Writing and reading

`writeRecord(path, record, {writer, expectedSequence = 0})` is the coordinator-side Node helper. The parent directory must exist. Writer must equal `coordinator`. Creation uses sequence 1 and expected 0; updates increment sequence and supply the prior value. Existing task ID, coordinator, machine and checkout cannot change; create a new task record for a different checkout. Revision changes may retain historical receipts, but those receipts become stale automatically.

Updates acquire an exclusive sibling `.lock`, validate the existing record and sequence, fsync a uniquely named temporary file, then rename it over the record. Readers see the old or new complete JSON. A stale writer or concurrent writer fails; reconcile and retry deliberately. A crash may leave a lock/temp file; inspect ownership before manually removing it, never automatically steal locks. Atomic rename is a local filesystem visibility guarantee, not a distributed lock or a guarantee against storage loss after power failure. The writer string is an authority assertion by the calling coordinator, not authentication; filesystem permissions and execution scope enforce access. The UI imports only the pure helper and never calls this writer or observer.

## Run index for a roster

A roster of two or three workers keeps one schema 1 record per worker (decision D4). The coordinator also owns `.herdr-tasks/<run-id>/run.json` in its checkout. `records/fixtures/run.json` shows the format:

- `schemaVersion: 1`, positive `sequence`, `runId`, `coordinator`, `machine` and absolute `checkout`.
- `members`: 1–3 entries of `{taskId, checkout, writes}`. `taskId` and `runId` are single path segments, and every ID is distinct. Each member's record lives at `<checkout>/.herdr-tasks/<taskId>/task.json`. `writes` lists checkout-relative paths that only that member may write.

`validateRun` and `parseRun` live in `workflows/roster.mjs`. Members in one checkout need disjoint writes: equal paths and parent/child paths both conflict. Members in separate worktrees may share relative paths, but their checkouts must not nest. No member may write any member record or the index. All members are on the index's machine; remote members are a later milestone.

The index holds no worker binding, revision or receipt. A run is never accepted as a whole: each member's record carries its own receipt. `writeRun(path, run, {writer, expectedSequence})` in `records/task-record-store.mjs` uses the same lock, sequence and identity rules as `writeRecord`, with `runId` in place of `taskId`. Existing schema 1 records and fixtures are unchanged.

`recordMemberAcceptance(run, taskId, {writer, observedByTask, before, after, checks})` accepts one member through `recordAcceptance`. First, every member sharing that checkout must match its index entry and coordinator. It must also reconcile as `finished`. The writer must be the run coordinator and must not own any of those members. Pass the same before/after snapshot for every member in a checkout, so all of their receipts bind one tested revision.
