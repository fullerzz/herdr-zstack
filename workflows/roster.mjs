import { join, resolve, dirname, basename } from 'node:path';
import { realpathSync, lstatSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { withFileLock } from '../records/task-record-store.mjs';
import { reconcile, recordAcceptance } from './worker-lifecycle.mjs';

// A run index groups 1–3 schema 1 task records (D4). Each member keeps its own
// binding, revision and receipt; the index grants no aggregate acceptance.
export const MAX_ROSTER = 3;

const text = value => typeof value === 'string' && value.trim().length > 0;
const segment = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
const absolute = value => text(value) && value.startsWith('/') && resolve(value) === value;
const relative = value => text(value) && !value.startsWith('/') &&
  value.replace(/\/$/, '').split('/').every(part => part && part !== '.' && part !== '..');
const overlaps = (left, right) => left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);

// Resolve existing ancestors for files not created yet; case-fold conservatively
// so a roster remains exclusive on case-insensitive filesystems too.
function scopePath(path) {
  let ancestor = resolve(path);
  const missing = [];
  for (;;) {
    try { return resolve(realpathSync(ancestor), ...missing).normalize('NFC').toLowerCase(); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      try {
        if (lstatSync(ancestor).isSymbolicLink()) throw new Error(`unresolved symlink: ${ancestor}`);
      } catch (statError) { if (statError.code !== 'ENOENT') throw statError; }
      missing.unshift(basename(ancestor));
      ancestor = dirname(ancestor);
    }
  }
}

export const recordPath = member => join(member.checkout, '.herdr-tasks', member.taskId, 'task.json');
export const runPath = run => join(run.checkout, '.herdr-tasks', run.runId, 'run.json');

export function validateRun(run) {
  if (run === null || typeof run !== 'object' || Array.isArray(run)) return ['run must be an object'];
  const errors = [];
  if (run.schemaVersion !== 1) errors.push('unsupported schemaVersion');
  if (!Number.isSafeInteger(run.sequence) || run.sequence < 1) errors.push('sequence must be positive');
  if (!segment(run.runId)) errors.push('runId must be one path segment');
  for (const key of ['coordinator', 'machine']) if (!text(run[key])) errors.push(`${key} is required`);
  if (!absolute(run.checkout)) errors.push('checkout must be a normalized absolute path');
  if (!Array.isArray(run.members) || run.members.length < 1 || run.members.length > MAX_ROSTER) {
    errors.push(`members must list 1-${MAX_ROSTER} tasks`);
    return errors;
  }
  const ids = new Set();
  for (const member of run.members) {
    if (!segment(member?.taskId)) { errors.push('member taskId must be one path segment'); continue; }
    if (member.taskId === run.runId || ids.has(member.taskId)) errors.push(`duplicate task ID ${member.taskId}`);
    ids.add(member.taskId);
    if (!absolute(member.checkout)) errors.push(`${member.taskId}: checkout must be a normalized absolute path`);
    if (!Array.isArray(member.writes) || !member.writes.length || !member.writes.every(relative))
      errors.push(`${member.taskId}: writes must be checkout-relative paths`);
  }
  if (errors.length) return errors;
  try { return scopeConflicts(run); }
  catch (error) { return [`cannot resolve scope: ${error.message}`]; }
}

// Writers need exclusive files or separate, non-nested checkouts; nobody but the
// coordinator may write a member record or the run index.
export function scopeConflicts(run) {
  const conflicts = [];
  const coordinatorCheckout = scopePath(run.checkout);
  const protectedPaths = run.members.map(member => scopePath(recordPath(member))).concat(scopePath(runPath(run)));
  const members = run.members.map(member => ({ ...member, checkout: scopePath(member.checkout),
    writes: member.writes.map(path => scopePath(join(member.checkout, path))) }));
  members.forEach((member, index) => {
    const { checkout } = member;
    if (checkout !== coordinatorCheckout && overlaps(checkout, coordinatorCheckout))
      conflicts.push(`${member.taskId}: nested coordinator and member checkouts`);
    for (const write of member.writes) {
      if (!write.startsWith(`${checkout}/`)) conflicts.push(`${member.taskId}: write escapes checkout: ${write}`);
      for (const guarded of protectedPaths) {
        if (overlaps(write, guarded)) conflicts.push(`${member.taskId}: ${write} overlaps coordinator file ${guarded}`);
      }
    }
    for (const other of members.slice(index + 1)) {
      const otherCheckout = other.checkout;
      if (checkout !== otherCheckout) {
        if (overlaps(checkout, otherCheckout)) conflicts.push(`${member.taskId} and ${other.taskId}: nested checkouts`);
        continue;
      }
      for (const write of member.writes) for (const theirs of other.writes) {
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
  return withFileLock(runPath(run), async () => {
    const current = JSON.parse(await readFile(runPath(run), 'utf8'));
    if (!isDeepStrictEqual(current, run)) throw new Error('stale run: does not match persisted index');
    for (const sibling of current.members.filter(entry => scopePath(entry.checkout) === scopePath(member.checkout))) {
      const saved = JSON.parse(await readFile(recordPath(sibling), 'utf8'));
      if (saved.taskId !== sibling.taskId || scopePath(saved.checkout) !== scopePath(sibling.checkout) ||
        saved.coordinator !== run.coordinator || saved.machine !== run.machine)
        throw new Error(`${sibling.taskId}: record does not match the run index`);
      if (saved.owner === writer) throw new Error(`${sibling.taskId}: a worker cannot accept its own work`);
      if (reconcile(saved, observedByTask?.[sibling.taskId]).state !== 'finished')
        throw new Error(`${sibling.taskId}: writer is not confirmed finished`);
    }
    return recordAcceptance(recordPath(member), { writer, observed: observedByTask[taskId], before, after, checks });
  });
}
