import { join, resolve, dirname, basename } from 'node:path';
import { realpathSync, lstatSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { withFileLock, observeRevision } from '../records/task-record-store.mjs';
import { observeRemoteRevision } from '../records/remote-revision.mjs';
import { reconcile, recordAcceptance } from './worker-lifecycle.mjs';
import { validateRunShape, recordPath, runPath, memberMachine, isRemote, MAX_ROSTER } from '../records/roster.js';

export { recordPath, runPath, memberMachine, isRemote, MAX_ROSTER };

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

export function validateRun(run) {
  const errors = validateRunShape(run);
  if (errors.length) return errors;
  try { return scopeConflicts(run); }
  catch (error) { return [`cannot resolve scope: ${error.message}`]; }
}

// Writers need exclusive files or separate, non-nested checkouts; nobody but the
// coordinator may write a member record or the run index. Every record, remote
// members' included, is a local file here.
export function scopeConflicts(run) {
  const conflicts = [];
  const coordinatorCheckout = scopePath(run.checkout);
  const memberRecords = run.members.map(member => scopePath(recordPath(member, run)));
  if (new Set(memberRecords).size !== memberRecords.length) conflicts.push('duplicate member record paths');
  const protectedPaths = memberRecords.concat(scopePath(runPath(run)));
  // The local filesystem cannot resolve another machine's paths, so a remote
  // member gets its own checkout, compared by text with case folded, and its
  // writes are never checked against local paths.
  const remote = run.members.filter(member => isRemote(member, run));
  const folded = path => path.normalize('NFC').toLowerCase();
  remote.forEach((member, index) => {
    for (const other of remote.slice(index + 1)) {
      if (memberMachine(other, run) === memberMachine(member, run) && overlaps(folded(member.checkout), folded(other.checkout)))
        conflicts.push(`${member.taskId} and ${other.taskId}: remote members need distinct, non-nested checkouts`);
    }
  });
  const members = run.members.filter(member => !isRemote(member, run)).map(member => ({ ...member, checkout: scopePath(member.checkout),
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

const sameCheckout = (run, left, right) => memberMachine(left, run) === memberMachine(right, run) &&
  (isRemote(left, run) ? left.checkout === right.checkout : scopePath(left.checkout) === scopePath(right.checkout));
const qualified = (terminal, machine) => {
  const [host, id, ...rest] = String(terminal).split('/');
  return host === machine && /^t\d+$/.test(id ?? '') && !rest.length;
};

/**
 * Fresh evidence for `reconcile` and acceptance. `host` is the `{worker, state}`
 * the coordinator just read with `hc get`, or null when that query failed. The
 * revision is observed on the member's own machine: locally for a local member,
 * through `hc exec --on` for a remote one. `reachable` is true only when this
 * call observed it; any failure returns an unreachable observation, never a revision.
 */
export async function observeMember(run, taskId, host, { exec } = {}) {
  const member = run.members.find(entry => entry.taskId === taskId);
  if (!member) throw new Error(`${taskId} is not a run member`);
  const machine = memberMachine(member, run);
  const { commit, worktreeDigest, reachable, ...facts } = host ?? {};
  const base = { ...facts, machine, checkout: member.checkout };
  if (!host) return { ...base, reachable: false, error: 'host query failed' };
  try {
    const revision = isRemote(member, run)
      ? await observeRemoteRevision(machine, member.checkout, exec ? { exec } : {})
      : { machine, checkout: member.checkout, ...await observeRevision(member.checkout) };
    return { ...base, ...revision, reachable: true };
  } catch (error) { return { ...base, reachable: false, error: error.message }; }
}

// Accept one member only when every writer sharing its checkout is finished, so
// the coordinator's single before/after snapshot covers all of them. A remote
// member has its checkout to itself, and every snapshot must come from its machine.
export async function recordMemberAcceptance(run, taskId, { writer, observedByTask, before, after, checks }) {
  const { readFile } = await import('node:fs/promises');
  const errors = validateRun(run);
  if (errors.length) throw new Error(errors.join('; '));
  if (writer !== run.coordinator) throw new Error('only the run coordinator may accept');
  const member = run.members.find(entry => entry.taskId === taskId);
  if (!member) throw new Error(`${taskId} is not a run member`);
  if (isRemote(member, run)) {
    const machine = memberMachine(member, run);
    for (const [label, snapshot] of [['before', before], ['after', after], ['observed', observedByTask?.[taskId]]]) {
      if (snapshot?.machine !== machine || snapshot?.checkout !== member.checkout)
        throw new Error(`${taskId}: ${label} revision was not observed on ${machine}`);
    }
  }
  return withFileLock(runPath(run), async () => {
    const current = JSON.parse(await readFile(runPath(run), 'utf8'));
    if (!isDeepStrictEqual(current, run)) throw new Error('stale run: does not match persisted index');
    for (const sibling of current.members.filter(entry => sameCheckout(current, entry, member))) {
      const machine = memberMachine(sibling, current);
      const saved = JSON.parse(await readFile(recordPath(sibling, current), 'utf8'));
      if (saved.taskId !== sibling.taskId || !sameCheckout(current, { ...sibling, checkout: saved.checkout }, sibling) ||
        saved.coordinator !== run.coordinator || saved.machine !== machine)
        throw new Error(`${sibling.taskId}: record does not match the run index`);
      if (isRemote(sibling, current) && !qualified(saved.worker?.terminal, machine))
        throw new Error(`${sibling.taskId}: a remote worker address must be qualified as ${machine}/tN`);
      if (saved.owner === writer) throw new Error(`${sibling.taskId}: a worker cannot accept its own work`);
      if (reconcile(saved, observedByTask?.[sibling.taskId]).state !== 'finished')
        throw new Error(`${sibling.taskId}: writer is not confirmed finished`);
    }
    return recordAcceptance(recordPath(member, current), { writer, observed: observedByTask[taskId], before, after, checks });
  });
}
