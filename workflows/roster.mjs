import { join } from 'node:path';
import { reconcile, recordAcceptance } from './worker-lifecycle.mjs';

// A run index groups 1–3 schema 1 task records (D4). Each member keeps its own
// binding, revision and receipt; the index grants no aggregate acceptance.
export const MAX_ROSTER = 3;

const text = value => typeof value === 'string' && value.trim().length > 0;
const segment = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
const absolute = value => text(value) && value.startsWith('/');
const relative = value => text(value) && !value.startsWith('/') &&
  value.replace(/\/$/, '').split('/').every(part => part && part !== '.' && part !== '..');
const clean = path => path.replace(/\/+$/, '');
const overlaps = (left, right) => left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);

export const recordPath = member => join(member.checkout, '.herdr-tasks', member.taskId, 'task.json');
export const runPath = run => join(run.checkout, '.herdr-tasks', run.runId, 'run.json');

export function validateRun(run) {
  if (run === null || typeof run !== 'object' || Array.isArray(run)) return ['run must be an object'];
  const errors = [];
  if (run.schemaVersion !== 1) errors.push('unsupported schemaVersion');
  if (!Number.isSafeInteger(run.sequence) || run.sequence < 1) errors.push('sequence must be positive');
  if (!segment(run.runId)) errors.push('runId must be one path segment');
  for (const key of ['coordinator', 'machine']) if (!text(run[key])) errors.push(`${key} is required`);
  if (!absolute(run.checkout)) errors.push('checkout must be absolute');
  if (!Array.isArray(run.members) || run.members.length < 1 || run.members.length > MAX_ROSTER) {
    errors.push(`members must list 1-${MAX_ROSTER} tasks`);
    return errors;
  }
  const ids = new Set();
  for (const member of run.members) {
    if (!segment(member?.taskId)) { errors.push('member taskId must be one path segment'); continue; }
    if (member.taskId === run.runId || ids.has(member.taskId)) errors.push(`duplicate task ID ${member.taskId}`);
    ids.add(member.taskId);
    if (!absolute(member.checkout)) errors.push(`${member.taskId}: checkout must be absolute`);
    if (!Array.isArray(member.writes) || !member.writes.length || !member.writes.every(relative))
      errors.push(`${member.taskId}: writes must be checkout-relative paths`);
  }
  return errors.length ? errors : scopeConflicts(run);
}

// Writers need exclusive files or separate, non-nested checkouts; nobody but the
// coordinator may write a member record or the run index.
export function scopeConflicts(run) {
  const conflicts = [];
  const protectedPaths = run.members.map(member => ({ checkout: clean(member.checkout), path: `.herdr-tasks/${member.taskId}/task.json` }))
    .concat({ checkout: clean(run.checkout), path: `.herdr-tasks/${run.runId}/run.json` });
  run.members.forEach((member, index) => {
    const checkout = clean(member.checkout);
    for (const write of member.writes.map(clean)) {
      for (const guarded of protectedPaths) {
        if (guarded.checkout === checkout && overlaps(write, guarded.path)) conflicts.push(`${member.taskId}: ${write} overlaps coordinator file ${guarded.path}`);
      }
    }
    for (const other of run.members.slice(index + 1)) {
      const otherCheckout = clean(other.checkout);
      if (checkout !== otherCheckout) {
        if (overlaps(checkout, otherCheckout)) conflicts.push(`${member.taskId} and ${other.taskId}: nested checkouts`);
        continue;
      }
      for (const write of member.writes.map(clean)) for (const theirs of other.writes.map(clean)) {
        if (overlaps(write, theirs)) conflicts.push(`${member.taskId} and ${other.taskId}: ${write} overlaps ${theirs}`);
      }
    }
  });
  return conflicts;
}

export function parseRun(source) {
  try {
    const run = JSON.parse(source);
    const errors = validateRun(run);
    return { run: errors.length ? null : run, errors };
  } catch { return { run: null, errors: ['invalid JSON'] }; }
}

// Accept one member only when every writer sharing its checkout is finished, so
// the coordinator's single before/after snapshot covers all of them.
export async function recordMemberAcceptance(run, taskId, { writer, observedByTask, before, after, checks }) {
  const { readFile } = await import('node:fs/promises');
  const errors = validateRun(run);
  if (errors.length) throw new Error(errors.join('; '));
  if (writer !== run.coordinator) throw new Error('only the run coordinator may accept');
  const member = run.members.find(entry => entry.taskId === taskId);
  if (!member) throw new Error(`${taskId} is not a run member`);
  for (const sibling of run.members.filter(entry => clean(entry.checkout) === clean(member.checkout))) {
    const saved = JSON.parse(await readFile(recordPath(sibling), 'utf8'));
    if (saved.taskId !== sibling.taskId || clean(saved.checkout) !== clean(sibling.checkout) || saved.coordinator !== run.coordinator)
      throw new Error(`${sibling.taskId}: record does not match the run index`);
    if (saved.owner === writer) throw new Error(`${sibling.taskId}: a worker cannot accept its own work`);
    if (reconcile(saved, observedByTask?.[sibling.taskId]).state !== 'finished')
      throw new Error(`${sibling.taskId}: writer is not confirmed finished`);
  }
  return recordAcceptance(recordPath(member), { writer, observed: observedByTask[taskId], before, after, checks });
}
