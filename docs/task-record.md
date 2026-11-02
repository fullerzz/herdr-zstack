# Single-worker task records (schema 1)

The coordinator owns `.herdr-tasks/<task-id>/task.json` in the task checkout. Only that coordinator writes; workers report in Markdown and cannot approve themselves. A record is a single task and one worker binding, not a workflow engine. Briefs, handoffs and verification narratives remain Markdown. Local records are task state, not shipped fixtures.

The JSON fixtures in `records/fixtures/` are the complete format:

- `schemaVersion: 1`, positive integer `sequence`, durable `taskId`, and `coordinator` identity.
- `machine` and absolute `checkout`; machine identifies the owning host, not the UI host. The checkout must be the repository root.
- `owner` and human-readable `scope`; these describe assignment responsibility, not permission enforcement.
- `worker: {core, terminal, occupant}` or `null` when missing. The occupant is a session/agent identity independently reconciled with the runtime. A terminal restored as a shell does not satisfy an old occupant binding. Never replay an assignment from a record.
- `activity: "active" | "completed"` is reported activity, never acceptance.
- `brief`, `handoff`, and `artifacts: string[]` are paths on the owning machine, absolute or relative to checkout. A listed path may not exist yet; show read failures as incomplete evidence.
- Optional `decisions` is the path of the coordinator's decision log, absolute or relative to checkout. Omit it when the task has no log. The log uses zstack's show-me-your-work TSV format: the header `ts	phase	decision	why	evidence	result`, then one row per decision. Its rows are reported reasoning, never acceptance.
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

## Task board

The board is one user-level file, normally `~/.local/state/herdr-zstack/board.json`, that lists the tasks for Task & Evidence to show. It is shared by every coordinator on this computer:

```json
{ "schemaVersion": 1, "sequence": 4, "tasks": [
  { "label": "fix-1 · herdr-zstack", "record": "/work/herdr-zstack/.herdr-tasks/fix-1/task.json", "machine": null },
  { "label": "roster-pilot", "run": "/work/pilot/.herdr-tasks/roster-pilot/run.json", "machine": null }
] }
```

Each entry has a `label` and exactly one absolute `record` or `run`. `machine` routes the entry's reads, and null means this computer. `added`, which the CLI sets, is the board `sequence` that added the entry; a removal names it, so the same record or run added again is a new entry. The board holds at most 50 entries, and no two can share the same target kind (`record` or `run`), path and machine. `validateBoard` and `readBoard` in `mods/task-evidence/board.js` have no host imports. The board says where to read. It never states activity, ownership or acceptance.

`updateBoard(path, change)` in `records/task-record-store.mjs` creates the parent folder. It holds the board's `.lock`, rereads and validates the current board, and applies `change(tasks)`. Then it writes the next sequence atomically. A busy lock is retried for about a second and never stolen. A malformed board is refused, not repaired. Task & Evidence never writes the board. When the user confirms an entry's ✕, the panel records it in `board.removed.json` beside the board, and its `readBoard` hides listed entries. Only Herdr writes that file, with the host's conditional `writeTextFile`; removals of entries no longer on the board are dropped on the next write.

`scripts/task.mjs` is the coordinator's command-line interface for its own task. `start` writes `brief.md`, `status.md` and a sequence 1 record. The record names the coordinator as owner, with no worker binding, revision or receipt. Then `start` adds the record to the board, newest first. `note` updates the status file's latest line and its newest-first log. `artifact` appends an evidence path to the record. `decide` appends one row to the task's `decisions.tsv` and names that file in the record on first use. It requires `--phase`, `--why`, `--evidence`, `--result` and the decision text. Like show-me-your-work's `log.sh`, it stamps the time, folds each cell onto one line and quotes a cell that starts with `=`, `+`, `-` or `@`. Pass such a value as `--result=-1`, because a separate argument that starts with `-` reads as an option. It refuses to append to a file that lacks the header. `finish` records `activity: completed`, which is reported activity, never acceptance. `board add` and `board remove` manage entries for run indexes and other records. Only the recorded coordinator, `$HC_TERMINAL_ID` by default, may update a task. The CLI never runs hc, binds workers, observes revisions or writes receipts.

`start` validates required text, including the label and coordinator, before exclusively creating the task folder and writing evidence. A concurrent start or an existing folder is refused, even if `task.json` is absent. An I/O failure after creation leaves partial files for inspection; use a new task ID or reconcile those files before retrying.

Task CLI updates (`note`, `artifact`, `decide`, and `finish`) serialize through the task folder's `cli.lock`, waiting up to five seconds for acquisition and rereading the record under that lock. This includes first-use decision-log registration and appending its row, so concurrent decisions and artifact/activity updates retain one another's changes. Waiting is bounded, is not a FIFO queue, and never steals an existing lock. A timeout changes no task evidence; inspect the lock's owner before retrying. The record and acceptance helpers retain their fail-fast locks and sequence checks; callers outside the CLI must still reconcile conflicts.

`decide` validates required arguments and the existing log header before updating the record. It accepts LF or CRLF headers, including a header without a final newline, preserves existing log bytes, and inserts a missing newline before appending. It registers the task-local log path before writing the row. These are two separate atomic file writes, not a transaction: a crash or I/O failure can leave a registered path without a new row, and a crash after append can leave a committed row without a success response. Inspect the log before retrying an interrupted command; retries are not deduplicated. Crashes may also leave `cli.lock` or temporary files requiring manual reconciliation.

## Run index for a roster

A roster of two or three workers keeps one schema 1 record per worker (decision D4). The coordinator also owns `.herdr-tasks/<run-id>/run.json` in its checkout. `records/fixtures/run.json` shows the format:

- `schemaVersion: 1`, positive `sequence`, `runId`, `coordinator`, `machine` and absolute `checkout`.
- `members`: 1–3 entries of `{taskId, checkout, writes}`. `taskId` and `runId` are single path segments, and every ID is distinct. Each member's record lives at `<checkout>/.herdr-tasks/<taskId>/task.json`. `writes` lists checkout-relative paths that only that member may write.

`validateRun` and `parseRun` live in `workflows/roster.mjs`. Their structural checks come from `validateRunShape` in `mods/task-evidence/roster.js`, which Task & Evidence uses to display a roster without filesystem access. Members in one checkout need disjoint writes: equal paths and parent/child paths both conflict. Scope validation reads the local filesystem, resolves existing symlinks and ancestors of files not yet created, and compares absolute targets. Checkout paths must be normalized absolute paths. Case and Unicode-normalization variants conservatively conflict even on case-sensitive filesystems. Unresolvable symlinks and writes escaping a checkout fail validation. Members in separate worktrees may share relative paths, but their checkouts must not nest with each other or the coordinator checkout. No member may write any member record or the index, including through aliases. All members are on the index's machine; remote members are a later milestone.

Revalidate scopes before launch on the owning machine. Scope validation is an observation, not filesystem access control: keep symlink targets stable while workers run, and inspect their actual edits before acceptance.

The index holds no worker binding, revision or receipt. A run is never accepted as a whole: each member's record carries its own receipt. `writeRun(path, run, {writer, expectedSequence})` in `records/task-record-store.mjs` uses the same lock, sequence and identity rules as `writeRecord`, with `runId` in place of `taskId`. Existing schema 1 records and fixtures are unchanged.

`recordMemberAcceptance(run, taskId, {writer, observedByTask, before, after, checks})` accepts one member through `recordAcceptance`. It holds the run index's writer lock through receipt publication and requires the supplied index to match the complete persisted index, including its sequence and members. Missing or stale indexes fail; concurrent index updates fail with the occupied lock. Every member sharing the resolved checkout must match its index entry, coordinator and machine, and reconcile as `finished`. The writer must be the run coordinator and must not own any of those members. The shared receipt helper also checks ownership on the record it accepts, so an ownership change after roster reconciliation cannot bypass the guard. Pass the same before/after snapshot for every member in a checkout, so all of their receipts bind one tested revision.
