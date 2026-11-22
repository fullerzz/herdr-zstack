---
name: alt-harness-review
description: Request an independent, read-only code review from the other harness in an interactive hc child session. Use when a Codex user asks for a Claude Code review or a Claude Code user asks for a Codex review through hc.
---

# Alternate harness review

Run one reviewer in the other harness. Launch only when the user requests a cross-harness review through hc or invokes this skill for a review. Honor the current session's execution selection, host permissions and delegation limits.

## Prepare

1. Resolve this skill's real path under the installed plugin and use that plugin root as `$COMPANION_ROOT`. Read `hc --skill` and relevant command help.
2. Identify the absolute checkout and exact review scope. For a commit or branch review, resolve the requested refs and capture the diff. For a working-tree review, capture the staged and unstaged diffs separately and identify any in-scope untracked files. Give the reviewer the patch and file paths in a task-owned brief readable from the core. Claude's review uses file-reading tools and needs the prepared diff.
3. In the brief, state the scope and review criteria. Ask for concrete bugs and regressions ordered by severity, with file and line, impact and evidence. Ask for an explicit no-findings result when appropriate and coverage limits in either case. Keep the role read-only and local. It must leave its full report in its final response, without editing files, running other agents, using `hc` or posting anywhere. Provide only the repository context needed for this review.

## Launch

Use a fresh `$NAME` for this review, the absolute `$CHECKOUT`, and a short `$TASK` prompt that names the absolute brief path and asks the reviewer to follow it. Pass the task as one argument. Use the current hc terminal as the parent.

Before the first hc core command and immediately before dispatch, follow the fresh caller check in [hc-workflow Gate 2](../hc-workflow/SKILL.md#gate). Capture new host plugin metadata and run the [companion preflight](../../docs/installation.md#preflight-bootstrap-and-installation-selection) from the same coordinator checkout. Require `companion.status` and `session.status` to be `supported`. Stop on failure so hc cannot start or address another core.

| Coordinator | `$TEMPLATE` | Reviewer default |
|---|---|---|
| Codex | `alt-harness-review-claude` | Opus 5.5 (`claude-opus-5-5`), `xhigh` |
| Claude Code | `alt-harness-review-codex` | `gpt-6.2-astra`, `high` |

Prefer the matching [installed template](../../docs/installation.md#alternate-harness-review-templates). Check `hc templates --json` for its name and expected command, including any model or effort override the user installed. Both Codex paths use the shared launcher in the review checkout. It pins that invocation to untrusted project settings, checks and disables MCP servers locally, and enforces the one-reviewer limit.

```sh
hc run --bg --json --parent "$HC_TERMINAL_ID" --name "$NAME" --cwd "$CHECKOUT" "$TEMPLATE" "$TASK"
```

### Direct fallback

Use the matching direct recipe if the template is unavailable or the user requests a different model or effort for this review. Set `$MODEL` and `$EFFORT` to the values from the verified installed command's `--model` and `--effort` flags. Use the table defaults when no template is installed. Replace only the setting the user requested for this run, so an effort-only override keeps the installed model and a model-only override keeps the installed effort. Put the same role and reporting instructions in the brief.

**Codex coordinator → Claude Code reviewer**

```sh
hc run --bg --json --parent "$HC_TERMINAL_ID" --name "$NAME" --cwd "$CHECKOUT" -- \
  claude --safe-mode --model "$MODEL" --effort "$EFFORT" \
  --tools Read,Grep,Glob --allowedTools Read,Grep,Glob --permission-mode dontAsk "$TASK"
```

**Claude Code coordinator → Codex reviewer**

```sh
hc run --bg --json --parent "$HC_TERMINAL_ID" --name "$NAME" --cwd "$CHECKOUT" -- \
  node "$COMPANION_ROOT/templates/alt-harness-review-codex.mjs" \
  --model "$MODEL" --effort "$EFFORT" -- "$TASK"
```

Use the other harness's own authenticated session. If the CLI, authentication, model or permissions block the launch, report the blocker. Leave login and permission dialogs to the user. If Codex presents a checkout trust prompt, stop the reviewer without continuing past it. A new launch must run the checks again before receiving the brief.

## Collect

1. Save the returned child address and confirm its parent and occupant with `hc get <child> --json`. Check the template's first-message receipt. For a direct launch, verify the task on screen. If delivery is unclear, inspect the screen before sending anything. Resend only after confirming the task was unsent and the intended agent is ready. Verify the harness, model and effort from the startup or status display when visible, and disclose any unverified setting or fallback.
2. Supervise that address with one `hc wait <child> --timeout 30 --json` per tool call. A timeout is a check-in. Collect the completed response with `hc read <child> --lines 200`, increasing the history limit if needed. A startup idle state, error or missing report leaves the review incomplete.
3. Check the findings against the reviewed scope and flag any revision drift. Report the reviewer, findings and coverage limits to the user. After collecting the response, recheck ownership, stop only this child with `hc kill <child>` if live, and remove it with `hc rm <child>` once finished.
