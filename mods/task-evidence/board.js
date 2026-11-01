// Pure board helpers: no host imports, safe in the read-only GPUI runtime.
// A board is an explicit, coordinator-written list of task records and run
// indexes. It lists where to read; it never states activity or acceptance.
export const MAX_BOARD = 50;

const text = value => typeof value === "string" && value.trim().length > 0;
const absolute = value => typeof value === "string" && value.startsWith("/");

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
  board.tasks.forEach((task, index) => {
    if (task === null || typeof task !== "object" || Array.isArray(task)) { errors.push(`task ${index} must be an object`); return; }
    if (!text(task.label)) errors.push(`task ${index}: label is required`);
    if (absolute(task.record) === absolute(task.run) || [task.record, task.run].some(v => v !== undefined && !absolute(v)))
      errors.push(`task ${index}: name exactly one absolute record or run`);
    if (task.machine !== undefined && task.machine !== null && !text(task.machine)) errors.push(`task ${index}: machine must be null or a name`);
    const key = boardKey(task);
    if (seen.has(key)) errors.push(`task ${index}: duplicate entry`);
    seen.add(key);
  });
  return errors;
}

export const boardKey = task => JSON.stringify([task.record ?? null, task.run ?? null, task.machine ?? null]);

export function parseBoard(source) {
  try {
    const board = JSON.parse(source);
    const errors = validateBoard(board);
    return { board: errors.length ? null : board, errors };
  } catch { return { board: null, errors: ["invalid JSON"] }; }
}

// The board file lives on this computer; each entry's machine routes its own reads.
export async function readBoard(read, path) {
  let source;
  try { source = await read(path, { on: null }); }
  catch (error) { return { tasks: [], state: `Board unavailable: ${String(error)}` }; }
  if (source === null) return { tasks: [], state: "Board has no tracked tasks yet." };
  const { board, errors } = parseBoard(source);
  if (!board) return { tasks: [], state: `Malformed board: ${errors.join("; ")}` };
  const tasks = board.tasks.map(task => ({ label: task.label, ...(task.record ? { record: task.record } : { run: task.run }),
    machine: task.machine ?? null, board: true }));
  return { tasks, state: `Board: ${tasks.length} tracked task${tasks.length === 1 ? "" : "s"}. Activity is reported, never acceptance.` };
}

// Watch the task's evidence folder (`<checkout>/.herdr-tasks`), which holds the
// record, run index, brief and status written by the task CLI.
export function evidenceFolder(choice) {
  const path = choice.record ?? choice.run;
  const parts = path.split("/");
  return parts.length > 3 ? parts.slice(0, -2).join("/") : null;
}

export const parentFolder = path => path.slice(0, path.lastIndexOf("/")) || "/";
