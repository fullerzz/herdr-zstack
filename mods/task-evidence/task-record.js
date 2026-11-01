// Pure data helpers: safe to import in the read-only GPUI runtime.

/**
 * @typedef {object} Revision
 * @property {string} commit Full 40- or 64-hex Git object ID.
 * @property {string} worktreeDigest `"clean"` or `sha256:<64 hex>` over uncommitted changes.
 */

/**
 * The worker's saved binding. A panel cannot confirm it against the live core.
 * @typedef {object} WorkerBinding
 * @property {string} core
 * @property {string} terminal
 * @property {string} occupant
 */

/**
 * The coordinator's acceptance snapshot of one revision.
 * @typedef {object} Receipt
 * @property {"accepted" | "rejected" | "incomplete"} decision
 * @property {Revision} revision
 * @property {string} coordinator Must equal the record's coordinator.
 * @property {string[]} evidence At least one path.
 */

/**
 * A schema 1 task record (`.herdr-tasks/<task>/task.json`), as accepted by `validateRecord`.
 * @typedef {object} TaskRecord
 * @property {1} schemaVersion
 * @property {number} sequence Positive; increments on every write.
 * @property {string} taskId
 * @property {string} coordinator
 * @property {string} machine
 * @property {string} checkout Absolute path.
 * @property {string} owner
 * @property {string} scope
 * @property {string} brief Path, relative to `checkout` or absolute.
 * @property {string} handoff Path, relative to `checkout` or absolute.
 * @property {"active" | "completed"} activity Reported activity, never acceptance.
 * @property {WorkerBinding | null} worker
 * @property {Revision | null} revision
 * @property {string[]} artifacts
 * @property {Receipt | null} receipt
 */

/**
 * A revision the caller observed directly in a checkout on a machine.
 * @typedef {Revision & { machine: string, checkout: string }} ObservedRevision
 */

/** @typedef {"malformed" | "unverified" | "stale" | Receipt["decision"]} AcceptanceStatus */

/** @param {unknown} value */
const text = value => typeof value === "string" && value.trim().length > 0;
/** @param {unknown} value */
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
/** @param {unknown} value */
const digest = value => typeof value === "string" && (value === "clean" || /^sha256:[a-f0-9]{64}$/.test(value));
/** @param {any} value */
const revision = value => object(value) && typeof value.commit === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value.commit) && digest(value.worktreeDigest);

/**
 * @param {any} record Untrusted parsed JSON.
 * @returns {string[]} Empty when `record` is a valid {@link TaskRecord}.
 */
export function validateRecord(record) {
  const errors = [];
  if (!object(record)) return ["record must be an object"];
  if (record.schemaVersion !== 1) errors.push("unsupported schemaVersion");
  if (!Number.isSafeInteger(record.sequence) || record.sequence < 1) errors.push("sequence must be positive");
  for (const key of ["taskId", "coordinator", "machine", "checkout", "owner", "scope", "brief", "handoff"]) {
    if (!text(record[key])) errors.push(`${key} is required`);
  }
  if (text(record.checkout) && !record.checkout.startsWith("/")) errors.push("checkout must be absolute");
  if (!["active", "completed"].includes(record.activity)) errors.push("invalid activity");
  if (record.worker !== null && (!object(record.worker) ||
    !["core", "terminal", "occupant"].every(key => text(record.worker[key])))) errors.push("worker must be null or bind core, terminal and occupant");
  if (record.revision !== null && !revision(record.revision)) errors.push("invalid revision");
  if (!Array.isArray(record.artifacts) || !record.artifacts.every(text)) errors.push("artifacts must be paths");
  if (record.receipt !== null && (!object(record.receipt) ||
    !["accepted", "rejected", "incomplete"].includes(record.receipt.decision) ||
    !revision(record.receipt.revision) || !text(record.receipt.coordinator) ||
    record.receipt.coordinator !== record.coordinator ||
    !Array.isArray(record.receipt.evidence) || !record.receipt.evidence.length ||
    !record.receipt.evidence.every(text))) errors.push("invalid coordinator receipt");
  return errors;
}

/**
 * @param {string} source
 * @returns {{ record: TaskRecord | null, errors: string[] }}
 */
export function parseRecord(source) {
  try {
    const record = JSON.parse(source);
    const errors = validateRecord(record);
    return { record: errors.length ? null : record, errors };
  } catch { return { record: null, errors: ["invalid JSON"] }; }
}

/**
 * @param {Revision | null} left
 * @param {Revision | null} right
 * @returns {boolean}
 */
export function sameRevision(left, right) {
  return revision(left) && revision(right) && left.commit === right.commit && left.worktreeDigest === right.worktreeDigest;
}

/**
 * @param {any} record Validated first; a malformed value yields `"malformed"`.
 * @param {ObservedRevision | null} [observed]
 * @returns {AcceptanceStatus}
 */
export function acceptanceStatus(record, observed = null) {
  if (validateRecord(record).length) return "malformed";
  if (!record.receipt) return "unverified";
  if (!sameRevision(record.revision, record.receipt.revision)) return "stale";
  // A saved receipt is a snapshot; a read-only panel cannot establish current git state.
  if (!observed || observed.machine !== record.machine || observed.checkout !== record.checkout || !revision(observed)) return "unverified";
  if (!sameRevision(record.receipt.revision, observed)) return "stale";
  return record.receipt.decision;
}
