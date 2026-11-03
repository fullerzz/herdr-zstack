---
name: hc-first
description: Use when HC_TERMINAL_ID is set, meaning you run inside an hc (herdr-core) terminal, and you are about to run a slow or unknown-duration command such as a test suite, build, install, CI watch (`gh run watch`) or dev server, or reach for a background shell, a sleep or poll loop, or a monitor tool. Runs that work through hc so you stay reachable for messages and child reports. Does not select Herdr execution or authorize delegation.
---

# hc first

A slow command in your own shell blocks you until it ends: no messages, no child reports, no other work. Inside an hc terminal, run it in its own hc terminal instead and wait with hc.

## When this applies

1. `HC_TERMINAL_ID` is set. Otherwise stop; this skill does not apply.
2. Once per session, before the first hc command, run the read-only preflight: `node "<root>/scripts/preflight.mjs"`. `<root>` is the directory that holds `skills/`: this file's real path is `<root>/skills/hc-first/SKILL.md`. Continue only if `session.status` is `supported`. Do not run `hc server status`, `hc get` or other core commands to check instead: they can start a core that is not there. If preflight is missing or fails, stay with your own shell and say why once.
3. If this session explicitly selected Native execution, stop; that choice wins.
4. If you are a worker that a coordinator started, stop unless your task or role template explicitly allows hc terminals for checks. Preflight's `caller.template` names your template when one launched you. Your template and task govern; for example, the Codex role templates ban `hc run` because an hc terminal runs outside their sandbox.
5. If z-mode is active and Herdr is selected, the herdr-zstack `hc-workflow` companion governs. Its "Default to hc" table matches this skill.

Read `hc --skill` once per session before relying on the syntax below, and `hc <command> --help` for any flag you have not used.

## Slow commands

Keep in your own shell only file edits and commands you expect to finish in under about 30 seconds. Run anything slower, or of unknown length, like this:

```sh
hc run --bg --no-notify --name "$HC_TERMINAL_ID-<purpose>" --cwd <checkout> <command>
hc wait <name> --timeout 90 --json    # reason: exit, exit_code
hc read <name> --lines 100
hc rm <name>
```

- Names are unique among all live terminals in the core, not per caller. The `$HC_TERMINAL_ID-` prefix keeps yours from colliding with another agent's. If a launch fails, for example with `name_taken`, fix it before anything else; never wait on, read or remove a name you did not start.
- Keep `--timeout` below your shell tool's own command limit. Claude Code's Bash tool stops waiting after 120 seconds by default and moves the command to a background task. A bare `hc wait` uses hc's default of 180 seconds.
- `reason: timeout` is a check-in. Wait again on the same name; never start a duplicate.
- Keep working while it runs. Start several independent checks at once, then collect each with `hc wait --children any --timeout 90`.
- Only `exit_code: 0` with `reason: exit` from `hc wait` passes (`hc get` reports the same exit as `reason: exited`). Report the command, its exit code and the output you read.
- A CI watch: `hc run --bg --no-notify --name "$HC_TERMINAL_ID-ci" --cwd <checkout> -- gh run watch <id> --exit-status`, then `hc wait "$HC_TERMINAL_ID-ci" --timeout 90`.
- A server: `hc run --bg --name "$HC_TERMINAL_ID-<purpose>" --cwd <checkout> <command>`, then `hc wait <name> --output "<ready text>" --timeout 30` started right after the launch. `--output` matches only text printed after the wait begins, so after `reason: timeout` run `hc read <name>` before waiting again: the server may already be ready.
- Never sleep or poll for anything hc runs. `hc wait` replaces host background shells, sleep loops and monitor tools.

The [supporting processes](../hc-workflow/references/processes.md) reference covers readiness, exit evidence and persistence in full.

## Delegation

This skill grants no authority to delegate. When the user asks for a helper agent, or a selected workflow delegates and passes its own gates, launch it through hc rather than the host's native agent tool, as the "Delegate a task" section of `hc --skill` describes: `--bg`, a name, an exact scope, the task in the launch, and a report sent to your literal address. Under z-mode, follow the `hc-workflow` companion instead.

## Limits

- hc runs a program in the core, outside your host's sandbox and outside the permission check on the inner command. Use it only for commands you would run directly anyway. Never use it to get past a sandbox refusal, a permission denial or a blocked dialog.
- Never add a broad allow rule such as `Bash(hc run *)`. It would allow any command.
- Clean up only terminals you started. `hc ls` shows other live work.
- Never stop or restart the user's core.
