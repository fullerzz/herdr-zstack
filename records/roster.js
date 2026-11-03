// Pure run-index helpers with no host imports.

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
