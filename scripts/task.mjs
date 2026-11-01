#!/usr/bin/env node
// Coordinator-side task tracking for the Task & Evidence board. It writes only
// the coordinator's own `.herdr-tasks/<task>/` files and its board entry. It
// never runs hc, binds workers, observes revisions or writes receipts.
import { execFile } from 'node:child_process';
import { mkdir, readFile, realpath } from 'node:fs/promises';
import { hostname, homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { parseArgs, promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { updateBoard, withFileLock, writeAtomic, writeRecord } from '../records/task-record-store.mjs';
import { parseRecord } from '../mods/task-evidence/task-record.js';
import { boardKey, MAX_BOARD } from '../mods/task-evidence/board.js';
import { DECISION_HEADER, decisionCell } from '../mods/task-evidence/decisions.js';

const USAGE = `Usage:
  task.mjs start --task <id> --scope <text> --goal <text> [--label <text>]
  task.mjs note --task <id> <status>
  task.mjs artifact --task <id> <path>
  task.mjs decide --task <id> --phase <text> --why <text> --evidence <pointers> --result <text> <decision>
  task.mjs finish --task <id> [<outcome>]
  task.mjs board add (--record <path> | --run <path>) --label <text> [--machine <name>]
  task.mjs board remove (--record <path> | --run <path>) [--machine <name>]

Common options:
  --checkout <path>     repository root (default: Git root of the current directory)
  --coordinator <id>    writer identity (default: $HC_TERMINAL_ID)
  --board <path>        board file (default: $HERDR_ZSTACK_BOARD, else
                        $XDG_STATE_HOME/herdr-zstack/board.json)`;

const options = {
  task: { type: 'string' }, scope: { type: 'string' }, goal: { type: 'string' }, label: { type: 'string' },
  checkout: { type: 'string' }, coordinator: { type: 'string' }, board: { type: 'string' },
  record: { type: 'string' }, run: { type: 'string' }, machine: { type: 'string' }, help: { type: 'boolean', short: 'h' },
  phase: { type: 'string' }, why: { type: 'string' }, evidence: { type: 'string' }, result: { type: 'string' },
};

export function defaultBoard(env = process.env) {
  if (env.HERDR_ZSTACK_BOARD) return resolve(env.HERDR_ZSTACK_BOARD);
  return join(env.XDG_STATE_HOME || join(env.HOME || homedir(), '.local', 'state'), 'herdr-zstack', 'board.json');
}

const segment = value => /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value ?? '');
const line = value => value.replace(/\s+/g, ' ').trim();

async function gitRoot(cwd) {
  const { stdout } = await promisify(execFile)('git', ['-C', cwd, 'rev-parse', '--show-toplevel']);
  return stdout.trim();
}

async function checkoutOf(value, cwd) {
  const checkout = value ? resolve(cwd, value) : await gitRoot(cwd);
  if (await realpath(checkout) !== await realpath(await gitRoot(checkout))) throw new Error('--checkout must be the repository root');
  return checkout;
}

const statusDocument = (taskId, now, entries) => `# Status: ${taskId}\n\n**Now:** ${now}\n\n## Log\n\n${entries.join('\n')}\n`;

// status.md is CLI-owned: the latest line plus a newest-first log.
async function appendStatus(path, taskId, text, at) {
  await withFileLock(path, async () => {
    let entries = [];
    try {
      const previous = await readFile(path, 'utf8');
      entries = previous.slice(previous.indexOf('## Log')).split('\n').filter(entry => entry.startsWith('- '));
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await writeAtomic(path, statusDocument(taskId, text, [`- ${at} — ${text}`, ...entries]));
  });
}

// decisions.tsv is CLI-owned and append-only: the header, then one row per decision.
async function readDecisionLog(path) {
  let previous = `${DECISION_HEADER}\n`;
  try { previous = await readFile(path, 'utf8'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (previous.split(/\r?\n/, 1)[0] !== DECISION_HEADER) throw new Error(`${path} is not a decision log; refusing to append`);
  return previous;
}

async function readOwnRecord(path) {
  const { record, errors } = parseRecord(await readFile(path, 'utf8'));
  if (!record) throw new Error(`task record is malformed: ${errors.join('; ')}`);
  return record;
}

function boardEntry(values) {
  const target = values.record ?? values.run;
  if (!target || (values.record && values.run)) throw new Error('name exactly one of --record or --run');
  if (!isAbsolute(target)) throw new Error('--record and --run must be absolute paths');
  return { label: values.label, ...(values.record ? { record: values.record } : { run: values.run }), machine: values.machine ?? null };
}

// The newest entry goes first. The board keeps its newest MAX_BOARD entries.
export const addEntry = entry => tasks =>
  [entry, ...tasks.filter(task => boardKey(task) !== boardKey(entry))].slice(0, MAX_BOARD);

export async function main(argv, { env = process.env, cwd = process.cwd(), now = () => new Date().toISOString(), out = console.log } = {}) {
  const { values, positionals } = parseArgs({ args: argv, options, allowPositionals: true });
  const [command, ...rest] = positionals;
  if (values.help || !command) { out(USAGE); return; }
  const board = values.board ? resolve(cwd, values.board) : defaultBoard(env);

  if (command === 'board') {
    const [action] = rest;
    const entry = boardEntry(values);
    if (action === 'add') {
      if (!values.label?.trim()) throw new Error('--label is required');
      const result = await updateBoard(board, addEntry(entry));
      out(JSON.stringify({ board, sequence: result.sequence }));
    } else if (action === 'remove') {
      const result = await updateBoard(board, tasks => tasks.filter(task => boardKey(task) !== boardKey(entry)));
      out(JSON.stringify({ board, sequence: result.sequence }));
    } else throw new Error(`unknown board action: ${action ?? '(none)'}\n${USAGE}`);
    return;
  }

  if (!segment(values.task)) throw new Error('--task must be one path segment of letters, digits, ".", "_" or "-"');
  const coordinator = values.coordinator ?? env.HC_TERMINAL_ID;
  if (!coordinator?.trim()) throw new Error('--coordinator is required outside an hc terminal');
  const checkout = await checkoutOf(values.checkout, cwd);
  const folder = join(checkout, '.herdr-tasks', values.task);
  const recordPath = join(folder, 'task.json');
  const relative = name => `.herdr-tasks/${values.task}/${name}`;
  const statusPath = join(folder, 'status.md');

  if (command === 'start') {
    for (const key of ['scope', 'goal']) if (!values[key]?.trim()) throw new Error(`--${key} is required`);
    const label = line(values.label ?? `${values.task} · ${checkout.split('/').at(-1)}`);
    if (!label) throw new Error('--label must not be blank');
    await mkdir(join(checkout, '.herdr-tasks'), { recursive: true });
    // Claim the task before writing evidence; preserve partial starts for reconciliation.
    try { await mkdir(folder); }
    catch (error) {
      if (error.code === 'EEXIST') throw new Error(`task ${values.task} already exists; inspect its files before updating or retrying`);
      throw error;
    }
    await writeAtomic(join(folder, 'brief.md'), `# ${label}\n\n## Goal\n\n${values.goal.trim()}\n\n## Scope\n\n${values.scope.trim()}\n\nOwner and coordinator: ${coordinator}\n`);
    await appendStatus(statusPath, values.task, 'Started.', now());
    await writeRecord(recordPath, {
      schemaVersion: 1, sequence: 1, taskId: values.task, coordinator, machine: hostname(), checkout,
      owner: coordinator, scope: line(values.scope), activity: 'active', worker: null, revision: null,
      brief: relative('brief.md'), handoff: relative('status.md'), artifacts: [], receipt: null,
    }, { writer: coordinator, expectedSequence: 0 });
    await updateBoard(board, addEntry({ label, record: recordPath, machine: null }));
    out(JSON.stringify({ record: recordPath, status: statusPath, board, label: `hc label ${coordinator} task=${values.task}` }));
    return;
  }

  await withFileLock(join(folder, 'cli'), async () => {
    const record = await readOwnRecord(recordPath);
    if (record.coordinator !== coordinator) throw new Error(`only the coordinator ${record.coordinator} may update this task`);
    const update = changes => writeRecord(recordPath, { ...record, ...changes, sequence: record.sequence + 1 },
      { writer: coordinator, expectedSequence: record.sequence });

    if (command === 'note') {
      const text = line(rest.join(' '));
      if (!text) throw new Error('note needs a status');
      await appendStatus(statusPath, record.taskId, text, now());
    } else if (command === 'artifact') {
      const [path] = rest;
      if (!path) throw new Error('artifact needs a path');
      if (!record.artifacts.includes(path)) await update({ artifacts: [...record.artifacts, path] });
    } else if (command === 'decide') {
      const row = { phase: values.phase, decision: rest.join(' '), why: values.why, evidence: values.evidence, result: values.result };
      for (const [key, value] of Object.entries(row)) {
        if (!value?.trim()) throw new Error(key === 'decision' ? 'decide needs a decision' : `decide needs --${key}`);
      }
      // Always the task's own log, so the CLI never writes outside its task folder.
      const decisions = relative('decisions.tsv');
      const path = join(checkout, decisions);
      const previous = await readDecisionLog(path);
      if (record.decisions !== decisions) await update({ decisions });
      const separator = previous.endsWith('\n') ? '' : '\n';
      await writeAtomic(path, `${previous}${separator}${[now(), ...Object.values(row)].map(decisionCell).join('\t')}\n`);
    } else if (command === 'finish') {
      const text = line(rest.join(' '));
      await appendStatus(statusPath, record.taskId, text ? `Finished: ${text}` : 'Finished.', now());
      // Completed is reported activity only; acceptance needs a coordinator receipt.
      if (record.activity !== 'completed') await update({ activity: 'completed' });
    } else throw new Error(`unknown command: ${command}\n${USAGE}`);
  }, { waitMs: 5000 });
  out(JSON.stringify({ record: recordPath, status: statusPath }));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).catch(error => { console.error(`task.mjs: ${error.message}`); process.exitCode = 1; });
}
