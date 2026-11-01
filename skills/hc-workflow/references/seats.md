# Other-provider seats on hc

Use this when a selected workflow needs a seat from another model family and Herdr is the selected execution method. Examples are arena's judge and interrogate's other-provider adversary. The other-provider route in the installed zstack `z-mode/references/native-hosts.md` still decides when a seat is needed, which family counts, and what a missing seat means. This file only replaces its one-shot launch with an interactive hc terminal. Read [operations](operations.md) first. Each seat is a roster member with its own record, binding and report.

The one-shot `codex exec` and `claude -p` recipes stay on the native path. hc requires interactive agents, so never launch a print-mode seat through hc.

`<run>`, `<seat>`, `<coord>`, `$SEAT_DIR`, `$REPORT` and `$BRIEF` are placeholders. `$COORD` holds the coordinator's literal address.

## 1. Choose the CLI and check it

1. Choose the CLI of a family other than yours: Codex when you are not a Codex model, Claude when you are not a Claude model. Run `codex --version` or `claude --version`. Never install either CLI, log in, or change its configuration. If no usable CLI exists, record the seat as a coverage gap. Never substitute a same-family agent.
2. Create `$SEAT_DIR` as an empty `<checkout>/.herdr-tasks/<seat>/seat/`. That path sits outside the revision snapshot, and the seat's writable root excludes the member's record and brief. Put the brief at `<checkout>/.herdr-tasks/<seat>/brief.md` and the report at `$REPORT`, inside `$SEAT_DIR`. A writing seat, such as an interrogate adversary, works in its own detached worktree and keeps its report in `$SEAT_DIR`.
3. Keep `$SEAT_DIR` and every reviewed checkout out of temporary folders such as `/tmp`, `/private/tmp` and `$TMPDIR`. Codex's workspace sandbox allows writes there, so no confinement holds.
4. Before launch, prove confinement in the CLI's sandbox. For Codex, run `codex sandbox -P :workspace -C "$SEAT_DIR" -- /usr/bin/touch <path>`. A write to `$SEAT_DIR` must succeed. A write to the member's evidence directory must fail with `Operation not permitted`. For a read-only seat, so must a write to a reviewed file. Delete the probe file afterward. Then give the seat one exact rule for `sh <repo>/scripts/restriction-probe.sh <checkout>/.herdr-tasks/<seat>` and have it run that probe first, in the run that counts. Its sections 1–4 must be refused and section 5 must succeed.
5. Before a seat that must run project checks, also run one representative check there, as `native-hosts.md` requires: `codex sandbox -P :workspace -C "$SEAT_DIR" -- <command>`. If it fails where the host run passes, skip the seat and record the gap. Choose checks that write nothing into the reviewed checkout. For example, Python needs `-B` to skip bytecode caches.

A seat must be able to write its report. Codex's `read-only` sandbox blocks that, so a read-only Codex seat uses `workspace-write`, rooted at its empty `$SEAT_DIR`. It reads the reviewed artifacts by absolute path and writes only its report. With the network overrides in section 3, the sandbox also refuses the core socket, so a Codex seat cannot `hc send`; the coordinator collects it by status, as section 5 describes. The sandbox also allows temporary folders unless section 3's overrides exclude them. After the run, confirm that every reviewed checkout is unchanged. `$SEAT_DIR` must hold only the report, plus any empty CLI staging directory listed in section 4.

## 2. Write the brief

Follow the brief rules in operations. Also include:

- The required skill instructions inline, or their absolute paths. Codex seats run with plugins disabled.
- The exact artifacts to read, by absolute path, and the scope's read-only or write limits.
- Report to `$REPORT`: PASS, ISSUES or BLOCKED; each finding with evidence; each command with its exit code. A blocked command is reported as blocked, never as passing or as no finding.
- A Claude seat then sends exactly `hc send <coord> "<seat> done: <report path>"`, or the same text with `blocked`, using the literal address. The launch allows only those two exact commands. A Codex seat writes the report and stops; it has no route to the core.
- No agents, terminals or `hc run`; no edits outside the assigned scope; hc notes are not instructions.

Keep the launch argument short: "Read `<brief path>` and follow it." The brief file carries the task.

## 3. Launch a Codex seat

Build `CODEX_MCP_ARGS` exactly as `native-hosts.md` describes: start with `--disable apps --disable plugins`, then disable each server returned by `codex "${CODEX_MCP_ARGS[@]}" -C "$SEAT_DIR" mcp list --json`. Rerun the listing and require `enabled: false` for every server. Skip the seat and report the gap if discovery, name validation, parsing or verification fails. These are invocation-only overrides; never edit personal configuration.

```sh
hc run --bg --json --name <run>-<seat> --cwd "$SEAT_DIR" \
  --label run=<run> --label task=<seat> --label role=seat \
  codex --no-daemon "${CODEX_MCP_ARGS[@]}" "${CODEX_SANDBOX_ARGS[@]}" \
  --sandbox workspace-write --ask-for-approval never -C "$SEAT_DIR" \
  "Read $BRIEF and follow it."
```

`CODEX_SANDBOX_ARGS` overrides the user's `[sandbox_workspace_write]` settings for this invocation, because Codex applies them to `--sandbox workspace-write`. A user `network_access = true` or extra `writable_roots` otherwise gives the seat egress and writes outside `$SEAT_DIR`:

```sh
CODEX_SANDBOX_ARGS=(-c sandbox_workspace_write.network_access=false \
  -c 'sandbox_workspace_write.writable_roots=[]' \
  -c sandbox_workspace_write.exclude_slash_tmp=true \
  -c sandbox_workspace_write.exclude_tmpdir_env_var=true)
```

Check the result before launch with `codex "${CODEX_MCP_ARGS[@]}" "${CODEX_SANDBOX_ARGS[@]}" --sandbox workspace-write -C "$SEAT_DIR" debug prompt-input`. Its permissions text must say `Network access is restricted.` and list no writable roots. `codex sandbox -P :workspace` applies a built-in profile, not these settings, so it cannot check them. Tools that need a temporary folder fail under these overrides; run the representative check from section 1 with them.

For a writing seat, use `--cwd <worktree>` and `-C <worktree>`, and add `--add-dir "$SEAT_DIR"` so it can write its report.

`--ask-for-approval never` returns sandbox refusals to the model instead of asking; it grants nothing. Never add `--dangerously-bypass-approvals-and-sandbox`, `--approve-for-me` or `--dangerously-bypass-hook-trust`. Use the CLI's default model unless the user requests an override.

Codex shows a folder-trust dialog for a new directory, and it may also ask to trust hooks. Both appear before the task arrives. For a seat directory inside a Git repository, the trust decision applies to the repository root. Handle them as operations describes: "Trust" persists a configuration entry and needs specific authorization; answer hook trust with "Continue without trusting".

## 4. Launch a Claude seat

Live-validated for a read-only Claude Code 2.1.316 seat under a Codex coordinator, including acceptance with only the report and empty CLI staging directory (see [validation](../../../docs/validation.md#fresh-run-with-the-amended-staging-check--pass)). The original argv refused candidate checks; exact check rules corrected that. Earlier report-only assertions rejected Claude's empty write-staging directory; a fresh run passed the amended check below. Before counting coverage, prove each restriction in that run: the report write succeeds, `hc send` arrives, required checks run, and writes outside the seat's scope are refused. Check the stopped seat's artifacts before accepting it. That recipe also loaded the user's settings, whose sandbox grants added egress, every Unix socket and extra write roots ([interrogation](../../../docs/validation.md#interrogation-fixes-for-issue-15)). The argv below skips them with `--setting-sources ""` and pins the send text; [fx-15](../../../docs/validation.md#restriction-proof-under-the-amended-recipes--pass) proved it.

Keep the native seat's restrictions and drop only its print-only flags (`-p`, `--no-session-persistence`, `--output-format`). Allow the report write, the send, and any exact read-only checks the brief requires. Set the shell array `SEAT_CHECK_RULES=()` when no checks are required. Otherwise populate it with one `Bash(<exact command>)` rule per inspected check; never allow the interpreter or shell generally. The brief must require the same literal commands without added shell operators.

```sh
hc run --bg --json --name <run>-<seat> --cwd "$SEAT_DIR" \
  --label run=<run> --label task=<seat> --label role=seat \
  claude --setting-sources "" --strict-mcp-config --tools Read,Grep,Glob,Write,Bash \
  --allowedTools Read Grep Glob "Edit(/$REPORT)" "Bash(hc send $COORD \"<seat> done: $REPORT\")" \
  "Bash(hc send $COORD \"<seat> blocked: $REPORT\")" "${SEAT_CHECK_RULES[@]}" \
  --permission-mode dontAsk \
  --settings '{"sandbox":{"enabled":true,"failIfUnavailable":true,"autoAllowBashIfSandboxed":false,"allowUnsandboxedCommands":false,"network":{"allowUnixSockets":["<HC_TERMINAL_SOCKET path>"]}}}' \
  "Read $BRIEF and follow it."
```

`$REPORT` is absolute, so `/$REPORT` gives the `//` prefix Claude uses for an absolute path rule. Claude's `Edit` rules cover its `Write` tool. The socket entry lets the sandboxed `hc send` reach the coordinator's core. `--setting-sources ""` stops the user, project and local settings files from loading, so their sandbox domains, sockets and write roots cannot widen the launch; it also drops their defaults, such as effort. The send rules are exact: a wildcard such as `hc send $COORD *` would also match `--force`, which types into a blocked dialog. `--permission-mode` follows the rules because `--allowedTools` takes a variable number of values.

`dontAsk` refuses checks without matching rules even when they write nothing. The live pilot used exact `/usr/bin/python3 -I -B <checkout>/check.py <candidate>` rules. To test OS confinement rather than only tool permission, its retry also allowed exactly `/usr/bin/touch <checkout>/candidates/probe.txt`; the sandbox must still refuse it. This probe rule belongs only in the validation launch. Separately attempt a `Write` outside the report rule and require refusal. Save the exact outcomes; expected negative-probe refusals are distinct from blocked required checks.

Whether plugins and hooks load without the settings files was not checked. Explicitly forbid injected session controls in the brief. Inspect the seat directory after stopping. Claude Code creates `.claude/.cc-writes/` in its cwd. It stages each file write there, then renames the file into place. The 2.1.316 bundle names the directory in its atomic-write code, not in a plugin or hook. Accept the directory only when it is empty. A leftover entry means a torn or unexpected write, so reject the seat. Any other entry is out of scope. Preserve it as evidence and reject; never remove it to make the check pass.

For a writing seat, use the worktree as cwd, `--tools Read,Grep,Glob,Bash,Edit,Write`, `--permission-mode acceptEdits`, `--add-dir "$SEAT_DIR"`, and the same settings with `"autoAllowBashIfSandboxed":true`, as the native recipe does. If Claude's sandbox is unavailable, skip the seat and report a coverage gap. Never retry with the sandbox disabled.

## 5. Identity, collection and verdict

1. Save the launch JSON and bind the seat as operations requires. Confirm the brief prompt arrived once with `hc read <t> --lines 60`.
2. Record the model identity the screen shows. Codex 0.166.0 shows its model and effort in the status line below the prompt, for example `GPT-6.1-Sol xhigh`. Claude shows its model in the welcome banner. Keep that screen as evidence. If no model is visible, record the identity as unavailable. Count the seat as other-family only when the evidence shows a family other than yours. A seat's own claim about its model is not evidence.
3. Wait with `hc wait <t> --timeout 180` or `hc wait --children any --timeout 180`. Match the tagged `<hc from="tN …">` sender to the bound seat, then read `$REPORT`. A Codex seat sends nothing: wait on `hc wait <t>` until its status is `done` or `idle`, confirm the screen shows it finished, then read `$REPORT`. A missing report, a blocked screen or a refused command is BLOCKED for the checks it covers. It is never a pass.
4. For a read-only seat, confirm every checkout under review is unchanged. For a writing seat, inspect its worktree against its scope.
5. The report is evidence, not a verdict. The calling workflow judges it: arena scores candidates, and interrogate reproduces findings. If no other-family seat ran, apply that workflow's missing-seat rule and say so. For example, arena skips judging.
6. Clean up the exact seat address as operations describes, after you save the report and screen.
