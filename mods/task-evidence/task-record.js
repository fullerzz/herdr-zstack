// Pure data helpers: safe to import in the read-only GPUI runtime.
const text = value => typeof value === "string" && value.trim().length > 0;
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const digest = value => typeof value === "string" && (value === "clean" || /^sha256:[a-f0-9]{64}$/.test(value));
const revision = value => object(value) && typeof value.commit === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value.commit) && digest(value.worktreeDigest);

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

export function parseRecord(source) {
  try {
    const record = JSON.parse(source);
    const errors = validateRecord(record);
    return { record: errors.length ? null : record, errors };
  } catch { return { record: null, errors: ["invalid JSON"] }; }
}

export function sameRevision(left, right) {
  return revision(left) && revision(right) && left.commit === right.commit && left.worktreeDigest === right.worktreeDigest;
}

export function acceptanceStatus(record, observed = null) {
  if (validateRecord(record).length) return "malformed";
  if (!record.receipt) return "unverified";
  if (!sameRevision(record.revision, record.receipt.revision)) return "stale";
  // A saved receipt is a snapshot; a read-only panel cannot establish current git state.
  if (!observed || observed.machine !== record.machine || observed.checkout !== record.checkout || !revision(observed)) return "unverified";
  if (!sameRevision(record.receipt.revision, observed)) return "stale";
  return record.receipt.decision;
}
