# zstack port inventory

Baseline: installed **zstack 0.22.0**, inspected 2026-10-31 for [issue #8](https://github.com/fullerzz/herdr-zstack/issues/8). This is the M0 plan for the [roadmap](roadmap.md), not an implemented execution adapter.

## Source and classification

The inspected package is `~/.codex/plugins/cache/zstack-local/zstack/0.22.0/`. Its `.codex-plugin/plugin.json` declares version 0.22.0. Paths and line numbers below are relative to that package. Resolve the real installed package on other machines; do not assume this cache path exists there.

The package contains **57 `SKILL.md` files, 23 z-mode playbooks, and 34 reference files**, including nested source playbooks, examples, the TSV template, and the license reference. All 114 appear individually below. Four native role files are listed separately because M3 consumes their role contracts. Scripts, test fixtures, generated output, and metadata are not skills, playbooks, or references; they remain upstream unless a later milestone explicitly needs an adapter.

| Class | Ownership and planned treatment |
|---|---|
| N — execution-neutral | Stays in zstack unchanged. Includes reusable prompts and general engineering principles even when they discuss workers. Their delegating caller supplies the execution envelope. |
| D — delegating | Shared workflow stays in zstack. A short hc delta here binds its specific launch, collection, supervision, or reconciliation steps. No workflow text is copied. |
| H — Herdr-specific | Native replacement moves here. zstack retains a thin discovery pointer after the replacement is proven, as described in M8. |

A class does not grant invocation, delegation, write, publication, or installation authority. Explicit-only skills remain explicit-only. Reading these sources for this inventory does not invoke them.

## Common hc deltas

These are planned mechanics shared by the D rows. Per-row notes identify where they apply. Small direct work stays direct, and enabling Herdr adds no workers.

| Delta | Planned behavior and milestone |
|---|---|
| L — worker lifecycle | M2/M3: preflight the explicit task parent, host restrictions, CLI capabilities, and concurrency budget. Start a fresh interactive CLI with `hc run --bg`, explicit cwd/name/task/role labels and a consolidated scoped brief. Use exclusive files or worktrees for writers. Check `first_message.sent`; reconcile before resending. Give the worker the real installed shared instruction paths and a report destination. It sends the report path to the coordinator's explicit address with `hc send`. Collect through bounded `hc wait` and `hc read` or the report file, inspect artifacts, and record revision-bound acceptance separately. Drain or interrupt losers/replaced writers before transferring scope. Kill/remove only task-created terminals. |
| S — independent seat | M4.2: L with the required CLI/model family independently verified. Carry required instructions in the brief. Adapt `native-hosts.md`'s invocation-only sandbox, tool, and MCP restrictions to interactive launches. Codex uses `--no-daemon`. Prove a representative required check inside the seat's sandbox and verify MCP disablement. Preserve blocked coverage and each caller's missing-seat policy; do not substitute an unverified family. Native one-shot recipes stay upstream. |
| P — supporting process | M5: run useful long tests, servers, and watchers as named task-owned hc terminals. Use `hc wait --output` for readiness and collect output plus exit status. A run timeout leaves the process alive; reconcile rather than launch a duplicate. Preserve evidence through task-only cleanup. No new scheduler or persistence promise. Brief checks use direct tools. |
| R — reconciliation | M2/M4.4/M5: record durable task ID separately from core, machine-qualified terminal, and occupant identity. On pickup resolve the recorded endpoint, current occupant, checkout, revision, assignment, and evidence before any prompt. A recovered shell is unbound. Never replay an assignment automatically. Pause accounts for every worker and supporting process; controls change preference only. |

`hc 0.1.15 --skill`, `hc run --help`, and `hc wait --help` were read for these mechanics. Their syntax is documented capability, not live proof. In particular, `hc wait --children all` means none is working, not that every result passed. Handle message, timeout, blocked, and error results before deciding whether to wait again. Apply the host's wait limits. Record the coordinator address explicitly: a child's `HC_TERMINAL_ID` identifies the child, not its report recipient.

## Skills

Every path in this table names an installed `SKILL.md`. Locations in the last column identify the baseline step, not a future file here.

| Installed path | Class | Delegation point and planned delta, or reason unchanged |
|---|---|---|
| `skills/architect/SKILL.md` | D | Line 17's contested-design candidates through arena; line 33's delegated-candidate contract. L for isolated design runners; S for arena's judge. Keep the direct single-sketch case. M4.3. |
| `skills/arena/SKILL.md` | D | Step 1 (line 11) launches 2–3 candidates; step 4 (line 14) requires a fresh other-family read-only judge; steps 5–6 integrate and verify. L for candidates, S for judge, collect each candidate before selecting/grafting. Preserve the explicit no-judge fallback. M4.2. |
| `skills/automate-me/SKILL.md` | N | Scoped history and personal-skill authoring; no worker launch recipe. |
| `skills/benchmark-checklist/SKILL.md` | N | Measurement quality and sampling rules; no execution-specific coordination. |
| `skills/blast-radius/SKILL.md` | D | Step 6 (line 38) uses arena and independent read-only reviewers for broad changes. L/S through arena, then coordinator reproduces critical claims. No reviewers for the narrow direct path. M4.3. |
| `skills/bro/SKILL.md` | N | Restates text. |
| `skills/correct/SKILL.md` | N | Finds recurring mistakes and proves prevention; review evidence does not request workers. |
| `skills/create-formal-verification-skill/SKILL.md` | N | Generates and executes formal checks with isolated mutations, not delegated agents. Long verifier runs use the common P policy without changing proof rules. |
| `skills/create-verification-skill/SKILL.md` | D | Sections 2 and 4 (lines 29–34, 42) specify app launch/readiness, drive, teardown, and an end-to-end proof. P for long-lived instances and harnesses; coordinator retains driving and evidence. No source-reader agents are prescribed here. M4.3/M5. |
| `skills/figure-it-out/SKILL.md` | D | Phase B (lines 30–31) uses architect/arena and exclusive worker seams; Phase C (line 41) pairs delegated work with a judge; Phase D uses show-me-your-work. L/S at those boundaries, retain the parent-owned experiment and log. M4.3. |
| `skills/herdr-workflow/SKILL.md` | H | Replace legacy environment gate (line 21), operations routing (line 23), roster and lifecycle (lines 25–31) with `hc-workflow` here. zstack keeps selection rules and later a pointer. M1/M2/M8. |
| `skills/how/SKILL.md` | D | Step 2 (line 12) delegates 2–3 broad read-only angles. L for explorers and, when used, the explainer described by its reference. Pass findings explicitly; narrow questions stay direct. M4.3. |
| `skills/in-your-own-words/SKILL.md` | N | Restates the user's goal. |
| `skills/interrogate/SKILL.md` | D | Step 2 (line 12) launches 2–3 adversaries in detached worktrees including the scoped dirty snapshot, with an other-provider seat when available. L/S, retain isolation and real repro evidence, collect before judging findings. M4.2. |
| `skills/ketchup/SKILL.md` | D | Gather scoped evidence (line 19) takes one current agent snapshot; line 13 forbids new/messaged agents and lifecycle changes. Read only the task's recorded terminals with `hc get`/`hc read`; no L, wait loop, interrupt, or cleanup. M4.3. |
| `skills/maintain-formal-verification-skill/SKILL.md` | N | Per-check correspondence, mutation, and checkpoint maintenance. No agent wave; long verifier runs use common P. |
| `skills/maintain-verification-skill/SKILL.md` | D | Source wave (line 29) uses bounded read-only readers per feature; live pass (line 33) reserves all driving for coordinator. L for readers, P for owned instances. Keep the documented direct fallback when delegation is unavailable under the selected-execution fallback rules. M4.3/M5. |
| `skills/no-comments/SKILL.md` | D | Line 9 selects comment-sicko or an equivalent read-only reviewer. L with the M3 role contract; collect its report, parent checks claims and owns any authorized edits. M3/M4.3. |
| `skills/principle-attack-the-premise/SKILL.md` | N | General diagnosis principle; the worker example is not a dispatch step. |
| `skills/principle-boundary-discipline/SKILL.md` | N | Boundary validation principle. |
| `skills/principle-build-the-lever/SKILL.md` | N | General tool-first and scoped delegation discipline; execution comes from the calling workflow. |
| `skills/principle-encode-lessons-in-structure/SKILL.md` | N | Enforcement principle. |
| `skills/principle-exhaust-the-design-space/SKILL.md` | N | Compare alternative designs; no mandatory parallel agents. |
| `skills/principle-experience-first/SKILL.md` | N | User-experience principle. |
| `skills/principle-explain-the-number/SKILL.md` | N | Quantitative explanation principle. |
| `skills/principle-fix-root-causes/SKILL.md` | N | Root-cause principle. |
| `skills/principle-foundational-thinking/SKILL.md` | N | Dependency-order principle. |
| `skills/principle-guard-the-context-window/SKILL.md` | N | General permission-bound bulk isolation, with targeted direct reads otherwise. Uses the shared execution contract, not a separate hc workflow. |
| `skills/principle-laziness-protocol/SKILL.md` | N | Minimal-change principle. |
| `skills/principle-make-operations-idempotent/SKILL.md` | N | Retry and crash semantics; no agent recipe. |
| `skills/principle-migrate-callers-then-delete-legacy-apis/SKILL.md` | N | API migration principle. |
| `skills/principle-minimize-reader-load/SKILL.md` | N | Code readability principle. |
| `skills/principle-model-the-domain/SKILL.md` | N | Domain modeling principle. |
| `skills/principle-never-block-on-the-human/SKILL.md` | N | Reversible-work principle; no additional authority. |
| `skills/principle-outcome-oriented-execution/SKILL.md` | N | Outcome and scope principle. |
| `skills/principle-prove-it-works/SKILL.md` | N | Evidence standard; does not prescribe workers. |
| `skills/principle-redesign-from-first-principles/SKILL.md` | N | Design principle. |
| `skills/principle-separate-before-serializing-shared-state/SKILL.md` | N | Ownership principle applies to both native and hc workers unchanged. |
| `skills/principle-sequence-verifiable-units/SKILL.md` | N | Verification order principle. |
| `skills/principle-subtract-before-you-add/SKILL.md` | N | Scope reduction principle. |
| `skills/principle-test-behavior-not-implementation/SKILL.md` | N | Behavioral test principle. |
| `skills/principle-type-system-discipline/SKILL.md` | N | Type design principle. |
| `skills/python-best-practices/SKILL.md` | N | Python engineering guidance. |
| `skills/recall/SKILL.md` | D | Line 11 allows delegation across many independent sessions. L for bounded read-only history slices with verified access and scoped exports; no inherited parent history or credentials. M4.3. |
| `skills/reflect/SKILL.md` | D | Step 1 (line 11) launches judgment, tooling, and divergent read-only lenses; step 2 synthesizes. L, queue within host limits, pass the scoped transcript/digest explicitly, then parent reconciles. The baseline does not require other-family reviewers. M4.2. |
| `skills/setup-zstack/SKILL.md` | D | Line 12 calls for a delegated read-only investigation in a new session. L only when that verification is requested/permitted; distinguish installed templates from actually loaded roles. Configuration edits retain separate request scope. M3/M4.3. |
| `skills/sharpen/SKILL.md` | N | Rewrites a prompt and stops; never executes the embedded workflow. |
| `skills/show-me-your-work/SKILL.md` | D | Independent review (line 74) uses a fresh read-only reviewer over scoped session evidence. L, give it the canonical trail and verified transcript/digest, preserve parent-only disclosure when unavailable. Log ownership stays with coordinator. M4.3. |
| `skills/statechart/SKILL.md` | N | Local model-checking and rendering instructions. TLC's “worker” is a checker thread, not an agent. Useful long runs use common P without changing model semantics. |
| `skills/swarm/SKILL.md` | D | Lines 13–15 launch workers, wait for results, retry once, and cancel/drain race losers. L with per-slice artifacts/worktrees and explicit race predicate; collect via child waits and reports, confirm writers stopped before reuse. M4.1. |
| `skills/tdd/SKILL.md` | N | Local regression-test workflow. |
| `skills/teach/SKILL.md` | D | Step 2 composes how/why and their bounded broad-question slices. Apply those L deltas once; parent weaves the explanation without duplicating their fan-out. Narrow explanations stay direct. M4.3. |
| `skills/technical-writing/SKILL.md` | N | Writing guidance; examples of procedures are not execution requests. |
| `skills/typescript-best-practices/SKILL.md` | N | TypeScript engineering guidance. |
| `skills/unslop/SKILL.md` | N | Prose editing. |
| `skills/why/SKILL.md` | D | Step 3 (line 13) delegates broad independent source categories; step 4 reconciles. L with only each source's scoped instructions and verified capabilities, report missing connectors, synthesize collected findings. Narrow questions stay direct. M4.3. |
| `skills/z-mode/SKILL.md` | D | Lines 17–19 select the execution companion and controls; line 29 supplies workflow-driven delegation. Apply L/P/R through the selected playbook and resolve the installed companion through zstack's single hook (D2). Do not add a second mode or copy principles. M1/M4.4. |

## z-mode playbooks

These are all files under `skills/z-mode/playbooks/`, including playbooks whose only delegation is inherited through a companion.

| Installed path | Class | Delegation point and planned delta, or reason unchanged |
|---|---|---|
| `skills/z-mode/playbooks/authoring-a-skill.md` | N | Skill authoring and validation; no dispatch step. |
| `skills/z-mode/playbooks/autonomous-run.md` | D | Step 2's persistent/event watcher and step 4's show-me-your-work review. P/L through those companions; R on inability to continue. Keep the bounded loop and no overnight guarantee. M4.4/M5. |
| `skills/z-mode/playbooks/autopilot-full.md` | D | Steps 2–3 assign fresh owners and independent reviewers/fix rounds; step 6 reconciles children. L for exclusive item owners/verifiers, S when another family is required, R for stop. Bind each verdict to its head; publication remains separately authorized. M4.4. |
| `skills/z-mode/playbooks/autopilot-stack.md` | D | Inherits autopilot-full owners/reviewers; step 3 releases dependents after acceptance. L/R with parent commit and member receipts in the run index; preserve no-merge and no further push after handoff. M4.4. |
| `skills/z-mode/playbooks/babysit.md` | D | Steps 2 and 6 run the bundled watch-pr helper. P with its real absolute resource path and target repository; status-only stays a brief direct read. Keep check/drive/threads/background authority separate. M4.4/M5. |
| `skills/z-mode/playbooks/bug-fix.md` | D | Step 3's optional delegation and architect composition. L only for useful exclusive slices; do not add workers to small fixes. M4.4. |
| `skills/z-mode/playbooks/eval.md` | D | Step 3 uses isolated candidate sessions; step 5 uses a fresh blind judge. L for separate ordinary directories and sanitized outputs; retain parent-only result when judge unavailable. No other-family requirement is added. M4.4. |
| `skills/z-mode/playbooks/feature.md` | D | Step 3 delegates independent exclusive slices. L, then coordinator verifies integration against one snapshot. M4.4. |
| `skills/z-mode/playbooks/hillclimb.md` | D | Step 3 composes show-me-your-work, including its independent trail review. L for that review only; common P for long measurements, keep the serial hypothesis loop and fixed metric. M4.4/M5. |
| `skills/z-mode/playbooks/investigation.md` | N | Direct evidence-driven diagnosis; no worker step. |
| `skills/z-mode/playbooks/multi-phase-plan.md` | D | Step 3 permits independent reviewers when they prove a relevant requirement. L for those scoped read-only checks; planning remains parent-owned and stops at requested review gates. M4.4. |
| `skills/z-mode/playbooks/opening-a-pr.md` | N | Publication and stack-readiness rules, not an agent launch procedure. |
| `skills/z-mode/playbooks/orchestrate.md` | D | Line 4 dispatches units and watches PRs; lines 8–11 define fresh owners, optional sub-coordinators, reuse exceptions, and other-family verifiers; lines 19–21 replace/reconcile workers. L/S/P/R with coordinator-owned run index. Nest only when host permits and explicitly assigned. Report paths travel through hc; no sibling status relay. M4.4. |
| `skills/z-mode/playbooks/pause-safely.md` | D | Steps 1 and 4 drain/interrupt children and retain endpoint/task mappings/processes. R, bounded L cleanup, evidence and first resume action preserved. Detach is not pause. M4.4/M5. |
| `skills/z-mode/playbooks/perf-issue.md` | N | Profiling and measurement discipline; common P handles any long command. |
| `skills/z-mode/playbooks/prototype.md` | N | Scoped disposable prototype; no worker step. |
| `skills/z-mode/playbooks/refactoring.md` | D | Step 4 allows isolated delegated mechanical slices. L with exclusive ownership and equivalence evidence before accepting each unit. M4.4. |
| `skills/z-mode/playbooks/runtime-forensics.md` | N | Scoped runtime evidence collection; no worker step. |
| `skills/z-mode/playbooks/session-pickup.md` | D | Step 4 reconciles saved Herdr assignments and processes before any prompt. R with explicit endpoint/occupant checks, no launch or replay from a restored terminal alone. M4.4/M5. |
| `skills/z-mode/playbooks/shipping.md` | D | Step 1 requires an independent verifier for substantial behavior changes. L/S as required by the calling workflow, collect exact-head receipts before authorized landing. Preserve pinned leases, live CI, stack boundaries, and merge authority. M4.4. |
| `skills/z-mode/playbooks/trace-forensics.md` | N | Trace analysis; no worker step. |
| `skills/z-mode/playbooks/visual-parity.md` | N | Screenshot and interaction evidence; no worker step. |
| `skills/z-mode/playbooks/worktree-cleanup.md` | D | Steps 2–3 inspect active agents/processes before deletion. R using recorded task terminals and their owning checkout; unknown occupant or live writer holds the candidate. No new worker, no inferred deletion authority. M4.4. |

## References

Reusable prompt bodies stay upstream and travel in scoped briefs; an hc envelope supplies role, working directory, permitted tools, report path, and no-delegation constraint. Their mentions of native runs or sibling agents do not create a second launcher. Coordinator synthesis remains direct unless the selected workflow actually calls for a separate synthesizer.

| Installed path | Class | Planned treatment |
|---|---|---|
| `skills/architect/references/design-red-flags.md` | N | Design assessment rubric. |
| `skills/architect/references/rationale-template.md` | N | Candidate rationale format. |
| `skills/architect/references/runner-prompt.md` | N | Candidate design body (lines 3–5, 20); architect's L envelope supplies hc execution and isolation. No independent nested arena. |
| `skills/create-verification-skill/references/feature-map-example/README.md` | N | Feature-map index example. |
| `skills/create-verification-skill/references/feature-map-example/create-note.md` | N | Example user journey. |
| `skills/create-verification-skill/references/feature-map-example/search.md` | N | Example search journey. |
| `skills/herdr-workflow/references/operations.md` | H | Replace legacy `herdr pane`/`herdr agent` dispatch (lines 7–34), supporting processes, pickup/pause/cleanup (lines 51–61), and remote endpoint guidance (lines 63–67) with hc operations here. Separate app presentation. M2/M5/M7/M8. |
| `skills/how/references/explainer-prompt.md` | N | Synthesis body for collected explorer findings; how owns any separate explainer launch. |
| `skills/how/references/explorer-prompt.md` | N | Read-only per-angle findings format; how supplies L. |
| `skills/ketchup/references/HUMANLAYER-LICENSE.txt` | N | Preserve upstream license notice. |
| `skills/ketchup/references/decision-visuals.md` | N | Catch-up visualization guidance. |
| `skills/python-best-practices/references/patterns.md` | N | Python patterns. |
| `skills/reflect/references/divergent-reviewer.md` | N | Divergent lens; reflect supplies L and scoped evidence. |
| `skills/reflect/references/judgment-reviewer.md` | N | Judgment lens; reflect supplies L and scoped evidence. |
| `skills/reflect/references/synthesizer.md` | N | Reconcile the three reports; no dispatch in this template. |
| `skills/reflect/references/tooling-reviewer.md` | N | Tooling lens; reflect supplies L and scoped evidence. |
| `skills/show-me-your-work/references/decision-log-template.tsv` | N | Coordinator-owned log header; no worker writes. |
| `skills/statechart/references/render.md` | N | Pele rendering and style rules. |
| `skills/typescript-best-practices/references/patterns.md` | N | TypeScript patterns. |
| `skills/why/references/epistemics.md` | N | Evidence and confidence rules. |
| `skills/why/references/investigator-prompt.md` | N | Per-source evidence body, carried unchanged by why's L envelope. |
| `skills/why/references/source-playbook.md` | D | Line 3 assigns one investigator per available evidence category. Apply why's bounded L wave once, queue categories, attach each category reference, and collect missing-source gaps. Do not launch a second wave from the index. M4.3. |
| `skills/why/references/sources/code-archaeology.md` | N | Git and PR research recipe, not agent coordination. |
| `skills/why/references/sources/databricks.md` | N | Analytics research recipe. |
| `skills/why/references/sources/datadog.md` | N | Observability research recipe. |
| `skills/why/references/sources/incident-postmortem.md` | N | Incident research recipe. |
| `skills/why/references/sources/linear.md` | N | Ticket research recipe. |
| `skills/why/references/sources/notion.md` | N | Document research recipe. |
| `skills/why/references/sources/sentry.md` | N | Error research recipe. |
| `skills/why/references/sources/slack.md` | N | Scoped chat research recipe; no contact authority. |
| `skills/why/references/synthesizer-prompt.md` | N | Reconcile historical evidence; why owns execution. |
| `skills/z-mode/references/bugbot-triage.md` | N | Review triage rules; references to parallel code paths are not worker launches. |
| `skills/z-mode/references/history.md` | N | Scoped history and digest provenance. Resume commands are not read-only history probes. |
| `skills/z-mode/references/native-hosts.md` | D | Execution selection (lines 21–25), independent CLI delegation/roles (29–41), other-provider seats (45–64), lifecycle (68–76), and persistence (90). L/S/P/R here, thin Herdr discovery pointer upstream. Keep native recipes, host restrictions, controls, model fallback, and acceptance rules in zstack. M1/M3/M4/M8. |

## Roles, hook, and source documentation

The four installed role definitions stay in zstack for native use. M3 adds hc templates here that preserve their scoped behavior and supply the explicit installed instruction path and reporting envelope.

| Installed path | Class | Planned hc delta |
|---|---|---|
| `agents/claude/z-agent.md` | D | Scoped engineering role, z-mode resource resolution, concurrent-edit protection. L via Claude interactive template; CLI defaults unless requested override. |
| `agents/claude/comment-sicko.md` | D | Read-only review role. L via a restricted Claude interactive template; preserve legal headers and parent-owned fixes. |
| `agents/codex/z-agent.toml` | D | Same engineering contract in Codex template, interactive `--no-daemon`, separate model/effort settings. |
| `agents/codex/comment-sicko.toml` | D | Same read-only report contract in restricted Codex template, interactive `--no-daemon`. |

`hooks/session_start.py:184–189` currently routes selected Herdr execution to the installed legacy skill. It stays owned by zstack (D2). M1 changes resolution there in the separately scoped upstream issue; this inventory changes no hook or session state.

The installed package has no `docs/` tree. The following supplemental move targets were inspected in the local zstack source checkout at commit `8a4963d0ec4708a526b9cab9569299b993e84d96`; they are not counted among the 114 installed entries.

| Source path/section | Class | Planned treatment |
|---|---|---|
| `docs/guide/herdr.md` | H | Native setup, lifecycle, and troubleshooting guide here; upstream discovery link after M2 proof. Replace legacy pane/environment guidance. M8. |
| `docs/hosts/codex.md`, Herdr execution section | H | Move hc launch/detection detail here, retain Codex selection controls and host security guidance upstream. M1/M8. |
| `docs/hosts/claude-code.md`, Herdr execution section | H | Same split: native adapter mechanics here, shared hook/control behavior upstream. M1/M8. |
| `docs/hosts/hermes.md`, Herdr portions of Session hooks and delegation guidance | H | Point adapter mechanics here; Hermes hook, discovery, and session-ID limits stay upstream. D7 does not promise a Hermes companion plugin. M8. |

## Coverage and delegation spot-check

The source set was enumerated from the installed package, then searched for delegation, agent, reviewer, judge, lifecycle, and process terms. Matching workflow sections and their compositions were read to classify the points above. A keyword hit alone is not a delegation step: TLC workers, parallel statechart regions, and principles remain neutral. Conversely, composition needs inspection: teach, hillclimb, and shipping inherit execution requirements even when a short keyword search misses them.

The spot-check caught the source wave in maintain-verification-skill, setup-zstack's delegated investigation, show-me-your-work's fresh reviewer, eval's blind judge, babysit's watcher, and ketchup/worktree-cleanup's read-only runtime reconciliation. Reflect requires three lenses, not three model families. create-verification-skill supervises an app but does not prescribe source-reader agents. These distinctions keep the overlay from adding work the baseline never asked for.

Set `ZSTACK_ROOT` to the baseline's real installed package path, then reproduce the path-coverage check from this repository:

```sh
uv run --no-project python - "$ZSTACK_ROOT" <<'PY'
from pathlib import Path
import re
import sys

root = Path(sys.argv[1]).resolve()
skills = set(root.glob("skills/*/SKILL.md"))
playbooks = set(root.glob("skills/z-mode/playbooks/**/*"))
references = set(root.glob("skills/*/references/**/*"))
expected = {p.relative_to(root).as_posix()
            for p in skills | playbooks | references if p.is_file()}
text = Path("docs/port-inventory.md").read_text()
listed = re.findall(r"^\| `(skills/[^`]+)` \| [NDH] \|", text, re.M)
assert len(listed) == len(set(listed)), "duplicate inventory rows"
assert set(listed) == expected, (sorted(expected - set(listed)),
                                 sorted(set(listed) - expected))
print(f"PASS: {len(skills)} skills, "
      f"{sum(p.is_file() for p in playbooks)} playbooks, "
      f"{sum(p.is_file() for p in references)} references")
PY
rg -n -i 'delegat|spawn|sub.?agent|explorer|reader|runner|reviewer|judge|selected execution|herdr|codex exec|claude -p|watch-pr|background|worker|seat|orchestrat|parallel|launch|cleanup|resume' \
  "$ZSTACK_ROOT/skills" --glob SKILL.md --glob '**/playbooks/**' --glob '**/references/**'
```

The coverage check must report **57 skills, 23 playbooks, 34 references** for this baseline. It checks enumeration, not semantic correctness of the classifications. Reinspect changed content after an upstream upgrade rather than treating equal counts as compatibility proof.

M0 validation: all 114 paths covered once; all four role paths present; D1–D7 recorded as accepted in the roadmap; `git diff --check` passes. Hashes of the inventoried installed files and roles were compared before and after this documentation change to check they were unchanged. No zstack content was copied or modified. No agents, templates, plugin manifests, controls, or runtime configuration were installed or activated. Live dispatch, sandbox enforcement, report delivery, recovery, and remote execution remain milestone proofs, not claims made by this inventory.
