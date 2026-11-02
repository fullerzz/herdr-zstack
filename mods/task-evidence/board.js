// Pure board helpers: no host imports, safe in the read-only GPUI runtime.
// A board is an explicit, coordinator-written list of task records and run
// indexes. It lists where to read; it never states activity or acceptance.
import { readMember, readRoster } from "./roster.js";
export const MAX_BOARD = 50;

/** @import { TaskChoice } from "./model.js" */
/** @import { ReadText } from "./roster.js" */

/**
 * @typedef {object} BoardEntry
 * @property {string} label
 * @property {string} [record] Exactly one of `record` and `run`, absolute.
 * @property {string} [run]
 * @property {string | null} [machine] The machine that owns the entry's files; null is this computer.
 * @property {number} [added] The board sequence that added the entry, so a re-added entry is new.
 */

/**
 * The coordinator board, as accepted by `validateBoard`.
 * @typedef {object} Board
 * @property {1} schemaVersion
 * @property {number} sequence
 * @property {BoardEntry[]} tasks At most {@link MAX_BOARD}, unique by `boardKey`.
 */

/** @param {unknown} value */
const text = value => typeof value === "string" && value.trim().length > 0;
/** @param {unknown} value */
const absolute = value => typeof value === "string" && value.startsWith("/");

/**
 * @param {any} board Untrusted parsed JSON.
 * @returns {string[]} Empty when `board` is a valid {@link Board}.
 */
export function validateBoard(board) {
  if (board === null || typeof board !== "object" || Array.isArray(board)) return ["board must be an object"];
  const errors = [];
  if (board.schemaVersion !== 1) errors.push("unsupported schemaVersion");
  if (!Number.isSafeInteger(board.sequence) || board.sequence < 1) errors.push("sequence must be positive");
  if (!Array.isArray(board.tasks) || board.tasks.length > MAX_BOARD) {
    errors.push(`tasks must list at most ${MAX_BOARD} entries`);
    return errors;
  }
  const seen = new Set();
  board.tasks.forEach((/** @type {any} */ task, /** @type {number} */ index) => {
    if (task === null || typeof task !== "object" || Array.isArray(task)) { errors.push(`task ${index} must be an object`); return; }
    if (!text(task.label)) errors.push(`task ${index}: label is required`);
    if (absolute(task.record) === absolute(task.run) || [task.record, task.run].some(v => v !== undefined && !absolute(v)))
      errors.push(`task ${index}: name exactly one absolute record or run`);
    if (task.machine !== undefined && task.machine !== null && !text(task.machine)) errors.push(`task ${index}: machine must be null or a name`);
    if (task.added !== undefined && !(Number.isSafeInteger(task.added) && task.added > 0)) errors.push(`task ${index}: added must be a positive sequence`);
    const key = boardKey(task);
    if (seen.has(key)) errors.push(`task ${index}: duplicate entry`);
    seen.add(key);
  });
  return errors;
}

/** @param {Pick<BoardEntry, "record" | "run" | "machine">} task */
export const boardKey = task => JSON.stringify([task.record ?? null, task.run ?? null, task.machine ?? null]);

/** @param {ReadText} read @param {TaskChoice} task */
export async function completedTask(read, task) {
  const machine = task.machine ?? null;
  const members = task.run ? (await readRoster(read, task.run, machine)).members :
    [await readMember(read, task.record, machine)];
  return members.length > 0 && members.every(member => member.record?.activity === "completed");
}

/**
 * @param {string} source
 * @returns {{ board: Board | null, errors: string[] }}
 */
export function parseBoard(source) {
  try {
    const board = JSON.parse(source);
    const errors = validateBoard(board);
    return { board: errors.length ? null : board, errors };
  } catch { return { board: null, errors: ["invalid JSON"] }; }
}

// The board file lives on this computer; each entry's machine routes its own reads.
/**
 * @param {ReadText} read
 * @param {string} path
 * @returns {Promise<{ tasks: TaskChoice[] | null, state: string }>} Tasks are null when the
 *   board is unreadable or malformed: its contents are unknown, not empty.
 */
export async function readBoard(read, path) {
  let source;
  try { source = await read(path, { on: null }); }
  catch (error) { return { tasks: null, state: `Board unavailable: ${String(error)}` }; }
  if (source === null) return { tasks: [], state: "Board has no tracked tasks yet." };
  const { board, errors } = parseBoard(source);
  if (!board) return { tasks: null, state: `Malformed board: ${errors.join("; ")}` };
  const listed = board.tasks.map(task => ({ label: task.label, ...(task.record ? { record: task.record } : { run: task.run }),
    machine: task.machine ?? null, added: task.added ?? null, board: true }));
  let removals;
  try { removals = parseRemovals(await read(removedPath(path), { on: null })); }
  catch (error) { removals = { removed: null, errors: [String(error)] }; }
  // An unreadable removal list hides nothing: showing a removed entry loses nothing.
  const hidden = new Set((removals.removed ?? []).map(removalKey));
  const tasks = listed.filter(task => !hidden.has(removalKey(task)));
  const note = removals.removed ? "" : ` Removed-task list unreadable (${removals.errors.join("; ")}); showing every entry.`;
  return { tasks, state: `Board: ${tasks.length} tracked task${tasks.length === 1 ? "" : "s"}. Activity is reported, never acceptance.${note}` };
}

/**
 * An entry the panel removed. `added` ties it to one addition, so the entry
 * shows again when a coordinator adds it anew.
 * @typedef {Pick<BoardEntry, "record" | "run"> & { machine: string | null, added: number | null }} Removal
 */

// The panel never writes the board: the host's conditional write checks and then
// renames, and Herdr serializes it only against its own writes, so a CLI commit
// between the two would be lost. Removals go to this panel-owned file instead.
/** @param {string} path The board file. */
export const removedPath = path => path.replace(/(\.json)?$/, ".removed.json");

/** @param {Pick<BoardEntry, "record" | "run" | "machine" | "added">} task */
const removalKey = task => JSON.stringify([task.record ?? null, task.run ?? null, task.machine ?? null, task.added ?? null]);

/**
 * @param {string | null} source
 * @returns {{ removed: Removal[] | null, errors: string[] }} Null removals when malformed.
 */
export function parseRemovals(source) {
  if (source === null) return { removed: [], errors: [] };
  let value;
  try { value = JSON.parse(source); } catch { return { removed: null, errors: ["invalid JSON"] }; }
  if (value?.schemaVersion !== 1 || !Array.isArray(value.removed)) return { removed: null, errors: ["expected schemaVersion 1 and a removed list"] };
  const valid = value.removed.every((/** @type {any} */ r) => r !== null && typeof r === "object" && absolute(r.record) !== absolute(r.run)
    && (r.machine === null || text(r.machine)) && (r.added === null || (Number.isSafeInteger(r.added) && r.added > 0)));
  return valid ? { removed: value.removed, errors: [] } : { removed: null, errors: ["malformed removal"] };
}

/**
 * The host's `writeTextFile`: replaces `path` only while it still holds `expected`; null creates it.
 * @callback WriteText
 * @param {string} path
 * @param {string} text
 * @param {string | null} expected
 * @returns {Promise<unknown>}
 */

/**
 * Records a board entry as removed in the panel-owned list. Only Herdr writes
 * that list, so its conditional write is serialized. Removals of entries no
 * longer on the board are dropped, which keeps the list as small as the board.
 * @param {ReadText} read
 * @param {WriteText} write
 * @param {string} path The board file on this computer.
 * @param {Pick<TaskChoice, "record" | "run" | "machine"> & { added?: number | null }} task
 * @returns {Promise<string | null>} Why nothing was removed, or null once the entry is hidden.
 */
export async function removeEntry(read, write, path, task) {
  const listPath = removedPath(path);
  let boardSource, listSource;
  try {
    boardSource = await read(path, { on: null });
    listSource = await read(listPath, { on: null });
  } catch (error) { return `Board unavailable: ${String(error)}`; }
  const { board, errors } = boardSource === null ? { board: null, errors: [] } : parseBoard(boardSource);
  if (boardSource !== null && !board) return `Malformed board: ${errors.join("; ")}`;
  const key = removalKey(task);
  const onBoard = new Set((board?.tasks ?? []).map(removalKey));
  if (!onBoard.has(key)) return null;
  const { removed, errors: listErrors } = parseRemovals(listSource);
  if (!removed) return `Malformed removed-task list: ${listErrors.join("; ")}; it was not changed.`;
  const kept = removed.filter(r => onBoard.has(removalKey(r)) && removalKey(r) !== key);
  /** @type {Removal} */
  const entry = { ...(task.record ? { record: task.record } : { run: task.run }), machine: task.machine ?? null, added: task.added ?? null };
  try { await write(listPath, `${JSON.stringify({ schemaVersion: 1, removed: [...kept, entry] }, null, 2)}\n`, listSource); }
  catch (error) { return `Removed-task list changed; try again (${String(error)}).`; }
  return null;
}

// Watch the task's evidence folder (`<checkout>/.herdr-tasks`), which holds the
// record, run index, brief and status written by the task CLI.
/**
 * @param {Pick<TaskChoice, "record" | "run">} choice
 * @returns {string | null} Null when the path is too shallow to have that folder.
 */
export function evidenceFolder(choice) {
  const path = choice.record ?? choice.run;
  const parts = path.split("/");
  return parts.length > 3 ? parts.slice(0, -2).join("/") : null;
}

/** @param {string} path */
export const parentFolder = path => path.slice(0, path.lastIndexOf("/")) || "/";
