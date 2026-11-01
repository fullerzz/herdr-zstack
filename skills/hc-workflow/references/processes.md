# Supporting processes on hc

This file covers long tests, servers and watchers, such as zstack's `watch-pr`, run as task-owned hc terminals. A supporting process is a plain program, not an agent. It has no brief, report or receipt. A brief check that finishes inside one host command stays direct. The selected playbook still decides whether a process is needed, and the user's request still bounds what it may do. Running in the background never adds authority.

The [execution contract](../../../docs/execution-contract.md)'s baseline is hc 0.1.15. This procedure was observed live only on hc 0.1.16 on macOS, which is newer than that baseline, as recorded in [validation](../../../docs/validation.md#issue-17-supporting-processes-and-live-restart-recovery--2026-11-01). Re-read `hc --skill` and the help for `run`, `wait`, `get` and `keep` before you rely on this syntax. `<run>`, `<task>`, `<purpose>` and `<t>` are placeholders.

## Launch

```sh
hc run --bg --json --name <run>-<purpose> --cwd <checkout> \
  --label run=<run> --label task=<task> --label role=process \
  <program and args>
```

- Save the JSON response and its `address`. In the notes, record the address, purpose, exact argv, cwd, readiness text, and who stops the process. Supporting processes stay out of the run index and out of member records. Labels and names locate a terminal. They never prove ownership.
- A process is parent-linked to the coordinator by default. It ends when the coordinator's program ends. See the persistence policy below.
- For a check you expect to finish, a foreground `hc run --timeout <s> --cwd <checkout> <program>` returns the program's exit code as its own. On timeout, it prints `[hc] still running as tN` and exits 124. The program keeps running. Wait on that address. Never launch a duplicate.
- Plain programs report no hc status. A program stuck at an interactive prompt never shows `blocked`. It shows up only as a wait timeout. Read the screen with `hc read <t> --lines 40` after every timeout. Never answer a prompt that changes trust or configuration without specific authorization. Kill the terminal and fix the launch instead.

## Readiness

Gate on the text the program prints when it is ready:

```sh
hc wait <t> --output "<ready text>" --timeout 30 --json
```

- `reason: output` means the text appeared. Readiness is not a passing check.
- `--output` matches only output printed after the wait starts. Start the wait immediately after launch. After `reason: timeout`, run `hc read <t>`. The text may have printed before the wait began. Blocked, error or exit also end the wait. Check `ended` and `exit_code`.

## Exit codes and evidence

```sh
hc wait <t> --timeout <s> --json   # reason: exit, exit_code, signal
hc get <t> --json                  # exit_code, reason, signal, finished_ms persist after exit
hc read <t> --lines 200            # output for the evidence file
```

Record the argv, cwd, `exit_code`, `reason`, `signal` and an output path in the notes. Only `exit_code: 0` with `reason: exited` is a passing run, and the coordinator still judges the output. A killed or signalled program has `exit_code: null`. It never passes. A `timeout` reason is a check-in, so wait again within the host's limit.

## watch-pr

Run the bundled watcher from its absolute installed path, with the target repository as cwd:

```sh
hc run --bg --json --name <run>-watch-pr --cwd <target repo> \
  --label run=<run> --label task=<task> --label role=watcher \
  <zstack>/skills/z-mode/scripts/watch-pr/watch-pr --pr <n>
hc wait <run>-watch-pr --timeout <s> --json
```

- The babysit playbook allows background watching only with a supported native runtime and an explicit request. A one-pass `--status-only` check stays a direct command.
- The watcher writes NDJSON. Its last line has `"terminal": true` and an `exitCode` that equals the process exit code. The zstack fixtures show 0 for READY, COMPLETE and STATUS, 5 for TIMEOUT, and 2, 3, 4, 6 and 7 for BLOCKER kinds. Its CLI returns 64 for a usage error. Read the last line before acting on the verdict.
- Each `reason: timeout` from `hc wait` is a check-in. The watcher keeps running. Wait again instead of starting a second watcher.

## Persistence policy

The default is no persistence flag. The process is the coordinator's child and ends with it. Collect its evidence, then `hc kill <t>`, confirm `state: finished`, and `hc rm <t>`.

Each flag needs an explicit decision. Record the reason, owner and stop responsibility in the notes. Neither flag is a fallback for a lost parent, nor a promise of supervision.

| Flag | Justified when | Recovers | Does not recover |
|---|---|---|---|
| `--outlive-parent` | The user asks for the process to continue after the coordinator ends, for example a watcher across a planned pause. The handoff names who collects and stops it. | Survival of its parent's exit. Live: the default child ended with signal 1, and the `--outlive-parent` child stayed live. | Core stop. Live: it ended with `reason: server_stop`. No one restarts it. |
| `--keep` | A person needs the terminal's address, name, labels and cwd to remain after loss, for example to restart a dev server by hand. | The terminal itself, as a fresh login shell in the same cwd. Live: `argv: ["/bin/zsh","-l"]`, `reason: stopped_by_restart`, same address and labels. | The program, its process, memory, readiness and output stream. The original command never reruns, and no assignment is resent. An agent comes back as a shell, not as the agent. |

Never put `--keep` on an agent to make it survive a restart. A kept shell is a new occupant, so `reconcile` reports it `unbound`. Pickup reads its evidence and makes a fresh decision. It never sends keys or relaunches automatically.

## Core restarts

- `hc server restart` keeps programs running under their holder. The core PID still changes, so a binding that includes the core's process start identity reports `unbound`. Collect the surviving program's output with `hc get` and `hc read`. Do not interrupt or send to it until you have fresh identity evidence and authority.
- A core stop ends every program. Unkept terminals finish with `reason: server_stop`. Kept terminals return as shells on the next start.
- Never stop or restart the user's core. Restart tests use an isolated session:
  - Set `HC_SESSION` and every XDG directory (`XDG_STATE_HOME`, `XDG_RUNTIME_DIR`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `XDG_CACHE_HOME`) to scratch paths.
  - Unset `HC_TERMINAL_ID`, `HC_TERMINAL_SOCKET`, `HC_SOCKET` and `HC_SCOPE`.
  - Keep paths short: macOS allows a 103-byte socket path, and hc refuses a longer one.
  - Before every stop or restart, compare `hc server status --json` `core.id` with the isolated core's ID.
  - Terminals inherit the scratch XDG paths. A tool such as mise then asks to trust the user's configuration again, so run that one program under `env -u XDG_CONFIG_HOME …` rather than answering the prompt.

## Pause, pickup and cleanup

- Pause: account for every process in the handoff, with its address, binding, purpose and last observation. Stop it, or, with explicit authority, leave it running under a recorded `--outlive-parent` decision.
- Pickup: reconcile each process like a member. An unbound process keeps its evidence. Relaunching it is a fresh decision, never a replay.
- Cleanup: list `hc ls --all --label run=<run>`, account for each terminal, and remove only the addresses this run created.
