import { sameRevision } from '../mods/task-evidence/task-record.js';

// Decisions only: callers must collect fresh host evidence; this module never sends input.
export function dispatchDecision({ attempted }) {
  if (typeof attempted !== 'boolean') throw new Error('persist an explicit launch-attempt flag before dispatch');
  return attempted ? 'reconcile-only' : 'launch-once';
}

export function reconcile(saved, observed) {
  const result = { state: 'unbound', verification: 'unverified', resend: false };
  if (!observed?.reachable) return { ...result, state: 'unavailable' };
  if (!["live", "finished"].includes(observed.state) || !saved.worker || !observed.worker ||
    ['machine', 'checkout'].some(key => !saved[key] || saved[key] !== observed[key]) ||
    ['core', 'terminal', 'occupant'].some(key => !saved.worker[key] || saved.worker[key] !== observed.worker[key])) return result;
  return { ...result, state: observed.state === 'live' ? 'bound' : 'finished',
    verification: sameRevision(saved.revision, observed) ? 'current' : 'stale' };
}

export function pausePlan(saved, observed) {
  const reconciled = reconcile(saved, observed);
  return { interrupt: reconciled.state === 'bound' ? [saved.worker.terminal] : [],
    nextAction: 'Reconcile machine, core, occupant, checkout, dirty files and revision before any further action; never replay the brief.' };
}

export function acceptanceReceipt(saved, observed, checks) {
  const reconciled = reconcile(saved, observed);
  if (!['bound', 'finished'].includes(reconciled.state) || reconciled.verification !== 'current') throw new Error('binding or verification revision changed');
  if (!Array.isArray(checks) || !checks.length || checks.some(check => !check.command || check.exitCode !== 0 || !check.evidence)) throw new Error('passing coordinator checks with evidence required');
  return { decision: 'accepted', coordinator: saved.coordinator, revision: saved.revision,
    evidence: checks.map(check => check.evidence) };
}

// Invoke only after task writers are frozen and the coordinator has inspected the result.
export async function recordAcceptance(path, { writer, observed, before, after, checks }) {
  const { readFile } = await import('node:fs/promises');
  const { writeRecord } = await import('../records/task-record-store.mjs');
  const saved = JSON.parse(await readFile(path, 'utf8'));
  if (!sameRevision(before, after) || !sameRevision(after, observed)) throw new Error('verification snapshot changed');
  const updated = { ...saved, sequence: saved.sequence + 1, revision: after };
  updated.receipt = acceptanceReceipt(updated, observed, checks);
  await writeRecord(path, updated, { writer, expectedSequence: saved.sequence });
  return updated;
}
