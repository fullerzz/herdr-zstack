# Explorers and runners on hc

Use this when Herdr is the selected execution method and the selected workflow is zstack's `how`, `why`, `blast-radius` or `architect`, or `teach` composing `how` and `why`. The installed zstack skill still decides whether coverage is needed, which angles or sources to cover, and how to synthesize. This file says when that coverage runs on hc and how each worker is restricted. Read [operations](operations.md) first. Pass the hc-workflow gate before any launch.

Step numbers refer to installed zstack 0.24.0. Recheck them after an upgrade, as the [inventory](../../../docs/port-inventory.md) describes.

## Direct by default

Selecting Herdr adds no workers to these skills. Each one runs directly with the coordinator's own tools, including its narrow path, unless the skill itself asks for independent coverage at one of the steps marked **coverage** below. The skill's own condition decides: broad scope for `how`, broad independent sources for `why`, a big or wide change for `blast-radius`, a contested or novel design for `architect`. An explicit user request for coverage also counts. When the condition is unclear, stay direct.

When a step does ask for coverage, it launches only the members the skill names, 1–3 at a time in one run index. Count native and hc workers together against the host limit. Retry a failed member once, as a fresh assignment with a corrected brief. If hc is unavailable or the retry fails, that member is a gap. Never substitute a native agent silently; use one only when the user selects that fallback for the affected slice, and say so in the report.

## Read-only members

A read-only brief is not enforcement. Launch every read-only explorer, investigator and reviewer with real tool and sandbox restrictions:

- **Claude:** the restricted launch in [seats](seats.md) §4: `--setting-sources ""`, `--strict-mcp-config` with no MCP configuration, `--tools Read,Grep,Glob,Write,Bash`, `--permission-mode dontAsk`, an `Edit(/<report>)` rule for the report only, the two exact `hc send <coord> "<task> done|blocked: <report>"` rules, and the sandbox settings with only the core socket allowed. Add exact `Bash(<command>)` rules only for the probe below and for checks the brief requires. Never allow a shell or interpreter generally, and never a wildcard send rule.
- **Codex:** the launch in [seats](seats.md) §3: every MCP server, app and plugin disabled, `--sandbox workspace-write` rooted at the member's empty report directory, and the `CODEX_SANDBOX_ARGS` overrides. The member cannot reach the core, so it writes its report and stops; collect it by status, as seats §5 describes.
- **Directories:** follow seats §1 steps 2–4. The report directory is `<checkout>/.herdr-tasks/<task>/seat/`, never a temporary folder. Before a Codex launch, prove the write probes.
- **Family:** an explorer, investigator or reviewer may share the coordinator's model family. Only a judge must come from another family, and it is a Seat.
- **Templates:** the installed role templates do not apply these restrictions. Do not use them for read-only members.

Without `--setting-sources ""` or `CODEX_SANDBOX_ARGS`, the user's own sandbox settings add network egress, other Unix sockets such as Docker's, and extra write roots. With them, these restrictions remove network access and MCP connectors. A source that needs them, such as `gh`, a ticket tracker, chat or observability, cannot run inside a read-only member. Investigate it directly with the coordinator's own tools, or report it as unsearched. Never relax a member's sandbox or tool list to reach a source.

Prove the restrictions in the run that counts. The member's first action is the exact command `sh <repo>/scripts/restriction-probe.sh <checkout>/.herdr-tasks/<task>`. Sections 1–4 (egress, other sockets, a user write root, a write beside its record) must be refused and section 5 (a write inside `seat/`) must succeed. A Claude member also attempts one `Write` outside its report rule and one `hc send <coord> "<text>" --force`; both must be refused. Count the member's coverage only when its report shows every refusal.

After the member stops, check three things. The reviewed checkout's `observeRevision` digest is unchanged; that digest excludes `.herdr-tasks`, so it says nothing about the evidence tree. The member's directory holds only `brief.md`, `task.json` and `seat/`, and `seat/` holds only the report, plus the empty Claude staging directory that seats §4 describes. The rest of `.herdr-tasks` is protected by the sandbox's writable root, which the probe's section 4 proves. Compute each check from the files; never record a check as passing by hand. Then Accept the member as operations §5 describes. Its report is evidence for the skill's synthesis, not a verdict.

## Delta table

| Skill · step | zstack point | hc operation | Record fields |
|---|---|---|---|
| how · 1, 4 | Anchor; present | **Direct.** | None. |
| how · 2, narrow | Trace a narrow question directly | **Direct.** Herdr selection does not change this. | None. |
| how · 2, broad | **Coverage:** 2–3 independent read-only angles | Launch one read-only member per angle. Fill the explorer prompt with the question and angle, and add the report path and send rule to the brief. | One record per angle. `members[].writes` holds only the report. |
| how · 3 | Wait, reconcile, synthesize | Collect every angle and read each report. The coordinator reconciles contradictions against the code and writes the synthesis directly with the explainer prompt. A missing angle is a gap. | `receipt.evidence` lists each report. |
| why · 1–2 | Anchor history; map sources | **Direct.** Map each relevant category to the coordinator's tools or to a member. | Notes: categories, and which are delegated, direct or unavailable. |
| why · 3, narrow | Narrow questions run directly | **Direct.** | None. |
| why · 3, broad | **Coverage:** one investigator per broad independent source | Launch one read-only member per delegated category. Its brief carries the investigator prompt, that category's playbook and, for defensive code, the incident-postmortem playbook. Delegate only categories the member can reach under its restrictions: repository files and documents, and local Git through exact rules. Queue extra categories in the [rolling index](playbooks.md#terms). Run one wave; the source index does not launch another. | One record per category. Notes list each unavailable category. |
| why · 4 | Synthesize; spot-check citations | **Direct.** Read every report and spot-check its citations against the source. | `receipt.evidence` lists each report. |
| blast-radius · 1–5 | Read; find the safety fact; prove it | **Direct.** The coordinator runs the step 5 proof. A member's claim never replaces it. | None. |
| blast-radius · 6 | **Coverage:** an arena of independent read-only reviewers for a big or wide change | Launch 2–3 read-only members, each with the same change and grounding. Arena's step 4 judge is a Seat, and an index holds at most three members. With three reviewers, Accept them all, then replace their entries with the Seat in a new `writeRun` sequence ([rolling index](playbooks.md#terms)). With two, the Seat can join the same index. Without one, apply arena's no-judge rule and say so. The coordinator verifies and merges the findings, and reproduces each critical claim directly before reporting it. | One record per reviewer, plus the Seat's. |
| architect · A | Ground with how and why | Apply the how and why rows above. | As those rows. |
| architect · B, constrained | One sketch and its constraint | **Direct.** | None. |
| architect · B, contested | **Coverage:** arena candidates with the runner prompt | Launch 2–3 runners as writers, each with an exclusive sketch directory or its own worktree. The brief carries the runner prompt, the Phase A artifacts and the output path. Runners never start a nested arena. Arena's step 4 judge is a Seat; with three runners, add it as blast-radius · 6 describes. Freeze and Accept each runner before you compare candidates. | `members[].writes` per runner. One `receipt` per candidate. |
| architect · C, E | Agree; scrap | **Direct.** | None. |
| architect · D | Implement when authorized | Follow the feature or bug-fix row in the [playbook table](playbooks.md). | As that row. |
| teach · 2 | Compose how and why | Apply the how and why rows once. The teaching explanation is direct and does not repeat their fan-out. | As those rows. |

## Limits

- Live proof covers one read-only Claude investigator under `why`, with the in-run probe, and one Codex probe member under the same overrides. See [validation](../../../docs/validation.md#restriction-proof-under-the-amended-recipes--pass).
- Exact Git rules for an investigator, a Codex member doing real coverage work, blast-radius reviewers and architect runners have not run live.
- A Claude member launched without settings files also loses the user's defaults, such as effort. Pass any needed `--model` or `--effort` explicitly.
- A delegated source that needs network or MCP is unavailable inside a read-only member. It runs directly or is a gap.
