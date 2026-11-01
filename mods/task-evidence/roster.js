// Pure roster helpers: no host imports, safe in the read-only GPUI runtime.
import { parseRecord, acceptanceStatus } from "./task-record.js";
/** @import { TaskRecord } from "./task-record.js" */

// A run index groups 1–3 schema 1 task records (D4). Each member keeps its own
// binding, revision and receipt; the index grants no aggregate acceptance.
export const MAX_ROSTER = 3;

/**
 * @typedef {object} RunMember
 * @property {string} taskId One path segment.
 * @property {string} checkout Normalized absolute path.
 * @property {string[]} writes The member's exclusive checkout-relative write scope.
 */

/**
 * A run index (`.herdr-tasks/<run>/run.json`), as accepted by `validateRunShape`.
 * @typedef {object} RunIndex
 * @property {1} schemaVersion
 * @property {number} sequence
 * @property {string} runId One path segment.
 * @property {string} coordinator
 * @property {string} machine
 * @property {string} checkout Normalized absolute path.
 * @property {RunMember[]} members 1 to {@link MAX_ROSTER} entries.
 */

/**
 * The host's `readTextFile`: resolves null when the file is absent and throws when it is unreadable.
 * @callback ReadText
 * @param {string} path
 * @param {{ on: string | null }} options `on` names the machine; null is this computer.
 * @returns {Promise<string | null>}
 */

/**
 * @typedef {object} MemberRead
 * @property {string} path
 * @property {TaskRecord | null} record Null when missing, unreadable, malformed or mismatched.
 * @property {string} state
 */

/** @typedef {MemberRead & { taskId: string | null }} RosterMember */

/**
 * @typedef {object} RosterRead
 * @property {RunIndex | null} run
 * @property {RosterMember[]} members
 * @property {string} state
 */

/**
 * The fields read from one `terminals()` entry (`hc ls --json` plus app fields).
 * @typedef {object} Terminal
 * @property {string} address Prefixed `<machine>/` for another machine.
 * @property {Record<string, unknown>} [labels]
 * @property {string} [state]
 * @property {string | { state?: string }} [status]
 */

/**
 * @typedef {object} TerminalFact
 * @property {string} address
 * @property {string | null} role
 * @property {string | null} task
 * @property {string | null} state
 * @property {string | null} status
 */

/**
 * @typedef {object} MemberFact
 * @property {string | null} taskId
 * @property {string} binding
 * @property {TerminalFact[]} terminals
 */

/**
 * @typedef {object} RosterFacts
 * @property {MemberFact[]} members
 * @property {TerminalFact[]} unlisted Run-labelled terminals whose task is not in the index.
 */

/**
 * @param {unknown} value
 * @returns {value is string}
 */
const text = value => typeof value === "string" && value.trim().length > 0;
/** @param {unknown} value */
const segment = value => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
// Equivalent to POSIX `path.resolve(value) === value` without node:path.
/** @param {unknown} value */
const absolute = value => text(value) && (value === "/" || (value.startsWith("/") && !value.endsWith("/") &&
  value.slice(1).split("/").every(part => part && part !== "." && part !== "..")));
/** @param {unknown} value */
const relative = value => text(value) && !value.startsWith("/") &&
  value.replace(/\/$/, "").split("/").every(part => part && part !== "." && part !== "..");
/** @param {string} checkout @param {string[]} parts */
const under = (checkout, ...parts) => [checkout === "/" ? "" : checkout, ...parts].join("/");

/** @param {Pick<RunMember, "checkout" | "taskId">} member */
export const recordPath = member => under(member.checkout, ".herdr-tasks", member.taskId, "task.json");
/** @param {Pick<RunIndex, "checkout" | "runId">} run */
export const runPath = run => under(run.checkout, ".herdr-tasks", run.runId, "run.json");

// Structure only. Write-scope exclusivity needs the owning filesystem, so the
// coordinator-side `validateRun` in workflows/roster.mjs adds that check.
/**
 * @param {any} run Untrusted parsed JSON.
 * @returns {string[]} Empty when `run` is a valid {@link RunIndex}.
 */
export function validateRunShape(run) {
  if (run === null || typeof run !== "object" || Array.isArray(run)) return ["run must be an object"];
  const errors = [];
  if (run.schemaVersion !== 1) errors.push("unsupported schemaVersion");
  if (!Number.isSafeInteger(run.sequence) || run.sequence < 1) errors.push("sequence must be positive");
  if (!segment(run.runId)) errors.push("runId must be one path segment");
  for (const key of ["coordinator", "machine"]) if (!text(run[key])) errors.push(`${key} is required`);
  if (!absolute(run.checkout)) errors.push("checkout must be a normalized absolute path");
  if (!Array.isArray(run.members) || run.members.length < 1 || run.members.length > MAX_ROSTER) {
    errors.push(`members must list 1-${MAX_ROSTER} tasks`);
    return errors;
  }
  const ids = new Set();
  for (const member of run.members) {
    if (!segment(member?.taskId)) { errors.push("member taskId must be one path segment"); continue; }
    if (member.taskId === run.runId || ids.has(member.taskId)) errors.push(`duplicate task ID ${member.taskId}`);
    ids.add(member.taskId);
    if (!absolute(member.checkout)) errors.push(`${member.taskId}: checkout must be a normalized absolute path`);
    if (!Array.isArray(member.writes) || !member.writes.length || !member.writes.every(relative))
      errors.push(`${member.taskId}: writes must be checkout-relative paths`);
  }
  return errors;
}

/**
 * @param {string} source
 * @returns {{ run: RunIndex | null, errors: string[] }}
 */
export function parseRunShape(source) {
  try {
    const run = JSON.parse(source);
    const errors = validateRunShape(run);
    return { run: errors.length ? null : run, errors };
  } catch { return { run: null, errors: ["invalid JSON"] }; }
}

/**
 * @param {ReadText} read
 * @param {string} path
 * @param {string | null} machine
 * @param {Pick<TaskRecord, "taskId" | "checkout" | "coordinator" | "machine"> | null} [expected]
 *   The run index's view of this member; any differing field rejects the record.
 * @returns {Promise<MemberRead>}
 */
export async function readMember(read, path, machine, expected = null) {
  let source;
  try { source = await read(path, { on: machine }); }
  catch (error) { return { path, record: null, state: `Task record unavailable: ${String(error)}` }; }
  if (source === null) return { path, record: null, state: "Task record missing." };
  const parsed = parseRecord(source);
  if (!parsed.record) return { path, record: null, state: `Malformed task record: ${parsed.errors.join("; ")}` };
  const mismatch = expected ? /** @type {const} */ (["taskId", "checkout", "coordinator", "machine"]).filter(key => parsed.record[key] !== expected[key]) : [];
  if (mismatch.length) return { path, record: null, state: `Record does not match the run index: ${mismatch.join(", ")}.` };
  return { path, record: parsed.record,
    state: `Acceptance: ${acceptanceStatus(parsed.record)}. Current Git revision is not independently observed.` };
}

/**
 * @param {ReadText} read
 * @param {string} path
 * @param {string | null} machine
 * @returns {Promise<RosterRead>}
 */
export async function readRoster(read, path, machine) {
  let source;
  try { source = await read(path, { on: machine }); }
  catch (error) { return { run: null, members: [], state: `Run index unavailable: ${String(error)}` }; }
  if (source === null) return { run: null, members: [], state: "Run index missing." };
  const { run, errors } = parseRunShape(source);
  if (!run) return { run: null, members: [], state: `Malformed run index: ${errors.join("; ")}` };
  const members = await Promise.all(run.members.map(async member => ({ taskId: member.taskId,
    ...await readMember(read, recordPath(member), machine,
      { taskId: member.taskId, checkout: member.checkout, coordinator: run.coordinator, machine: run.machine }) })));
  return { run, members, state: `Roster ${run.runId}: ${members.length} member${members.length === 1 ? "" : "s"}. The run index grants no aggregate acceptance.` };
}

/**
 * @param {Terminal | null} terminal
 * @returns {Record<string, unknown>}
 */
const labelsOf = terminal => terminal?.labels && typeof terminal.labels === "object" ? terminal.labels : {};
// App addresses for another machine carry a `<machine>/` prefix; bare ones are local.
/** @param {unknown} address @param {string | null} machine */
const qualify = (address, machine) => typeof address !== "string" ? null : address.includes("/") || !machine ? address : `${machine}/${address}`;
/** @param {Terminal} terminal @param {string | null} machine */
const onMachine = (terminal, machine) => typeof terminal?.address === "string" &&
  (machine ? terminal.address.startsWith(`${machine}/`) : !terminal.address.includes("/"));

// Labels and addresses locate terminals; they never prove ownership or acceptance.
/**
 * @param {{ runId?: string | null, members: { taskId: string | null, record: TaskRecord | null }[] }} roster
 * @param {Terminal[]} terminals The app's live listing; anything else counts as empty.
 * @param {string | null} [machine]
 * @returns {RosterFacts}
 */
export function rosterFacts({ runId = null, members }, terminals, machine = null) {
  const local = (Array.isArray(terminals) ? terminals : []).filter(t => onMachine(t, machine));
  const tagged = runId ? local.filter(t => labelsOf(t).run === runId) : [];
  const ids = members.map(member => member.taskId);
  const facts = members.map(member => {
    const bound = qualify(member.record?.worker?.terminal, machine);
    const labelled = (runId ? tagged : local).filter(t => labelsOf(t).task === member.taskId);
    const atBinding = bound ? local.find(t => t.address === bound) ?? null : null;
    const terminalsFor = [...new Set([...labelled, ...(atBinding ? [atBinding] : [])])];
    return { taskId: member.taskId, binding: bindingStatus(member.record, atBinding), terminals: terminalsFor.map(describe) };
  });
  return { members: facts, unlisted: tagged.filter(t => !ids.includes(/** @type {string} */ (labelsOf(t).task))).map(describe) };
}

/** @param {TaskRecord | null} record @param {Terminal | null} atBinding */
function bindingStatus(record, atBinding) {
  if (!record) return "No readable record.";
  if (!record.worker) return "No worker binding recorded.";
  const where = `Saved binding ${record.worker.terminal} (unconfirmed)`;
  // The app's live listing omits finished terminals that `hc ls --all` still shows.
  if (!atBinding) return `${where}: address not in the app's live listing; it may have finished or been removed.`;
  return `${where}: address is ${atBinding.state ?? "unknown"}; core and occupant identity are not observable here.`;
}

/**
 * @param {Terminal} terminal
 * @returns {TerminalFact}
 */
function describe(terminal) {
  const labels = labelsOf(terminal);
  const status = typeof terminal.status === "string" ? terminal.status : terminal.status?.state;
  return { address: terminal.address, role: typeof labels.role === "string" ? labels.role : null,
    task: typeof labels.task === "string" ? labels.task : null, state: terminal.state ?? null, status: status ?? null };
}

// A change in this key means a core fact about the shown roster changed (the
// facts `hc events` streams). It triggers a reread; it never implies acceptance.
/**
 * @param {RosterFacts} facts
 * @returns {string}
 */
export function factKey(facts) {
  /** @param {TerminalFact} t */
  const entry = t => [t.address, t.role, t.task, t.state, t.status];
  return JSON.stringify([facts.members.map(m => [m.taskId, m.terminals.map(entry)]), facts.unlisted.map(entry)]);
}
