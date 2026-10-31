import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateName = '.herdr-zstack-install.json';
const prefix = 'mods/zstack-task-evidence/';
const tabsPrefix = 'mods/zstack-task-evidence-tabs/';
const hash = data => createHash('sha256').update(data).digest('hex');
const validPath = name => [prefix, tabsPrefix].some(p => name.startsWith(p) && /^[a-zA-Z0-9_-]+\.(js|json)$/.test(name.slice(p.length)));

function replaceFile(target, data) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  const mode = fs.existsSync(target) ? fs.statSync(target).mode & 0o777 : 0o666 & ~process.umask();
  const file = fs.openSync(temporary, 'wx', mode);
  try {
    fs.writeFileSync(file, data);
    fs.fchmodSync(file, mode);
    fs.renameSync(temporary, target);
  } finally {
    fs.closeSync(file);
    fs.rmSync(temporary, { force: true });
  }
}

// Reject symlinks at every boundary, including ancestors of a not-yet-created home.
function safePath(home, name = '') {
  const target = path.join(home, name);
  let current = path.parse(target).root;
  for (const part of target.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    let stat;
    try { stat = fs.lstatSync(current); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (stat?.isSymbolicLink()) throw new Error(`Symlink refused: ${current}`);
  }
  return target;
}

export function run({ home, action = 'install', apply = false, source = path.join(root, 'mods/task-evidence'), tabsSource = path.join(root, 'mods/task-evidence-tabs') }) {
  if (!home || !path.isAbsolute(home)) throw new Error('--home must be an explicit absolute app configuration directory');
  if (!['install', 'update', 'remove', 'rollback'].includes(action)) throw new Error('Expected install, update, remove, or rollback');
  safePath(home);
  if (!apply) return transact({ home, action, apply, source, tabsSource });
  fs.mkdirSync(home, { recursive: true });
  const lockPath = safePath(home, '.herdr-zstack-install.lock');
  const lock = fs.openSync(lockPath, 'wx');
  try { return transact({ home, action, apply, source, tabsSource }); }
  finally { fs.closeSync(lock); fs.unlinkSync(lockPath); }
}

function transact({ home, action, apply, source, tabsSource }) {
  const statePath = safePath(home, stateName);
  const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : { version: 1, owned: {}, previous: null };
  if (state.version !== 1 || !state.owned || typeof state.owned !== 'object' || Array.isArray(state.owned)) throw new Error('Invalid installation state');
  for (const [name, digest] of Object.entries(state.owned)) {
    if (!validPath(name) || typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest)) throw new Error('Invalid ownership entry');
  }
  const wanted = {};
  if (action === 'install' || action === 'update') {
    for (const [directory, destination] of [[source, prefix], ...(tabsSource ? [[tabsSource, tabsPrefix]] : [])]) {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (!(entry.name.endsWith('.js') || entry.name === 'mod.json')) continue;
        const name = destination + entry.name;
        if (!validPath(name) || !entry.isFile() || entry.isSymbolicLink()) throw new Error(`Invalid runtime file: ${entry.name}`);
        wanted[name] = fs.readFileSync(path.join(directory, entry.name));
      }
      if (!wanted[destination + 'main.js'] || !wanted[destination + 'mod.json']) throw new Error('Incomplete mod source');
    }
  } else if (action === 'rollback') {
    if (!state.previous || !state.previous.files || !state.previous.owned) throw new Error('No transaction to roll back');
    for (const [name, data] of Object.entries(state.previous.files)) {
      if (!validPath(name) || (data !== null && typeof data !== 'string')) throw new Error('Invalid rollback entry');
      if (data !== null) wanted[name] = Buffer.from(data, 'base64');
    }
  }
  const names = new Set([...Object.keys(state.owned), ...Object.keys(wanted)]);
  const before = {}, changes = [], owned = {};
  for (const name of names) {
    const target = safePath(home, name);
    const exists = fs.existsSync(target);
    if (exists && !fs.statSync(target).isFile()) throw new Error(`Not a regular file: ${name}`);
    const current = exists ? fs.readFileSync(target) : null;
    if (current && (!state.owned[name] || hash(current) !== state.owned[name])) throw new Error(`Unowned or modified file preserved: ${name}`);
    before[name] = current?.toString('base64') ?? null;
    const next = wanted[name] ?? null;
    if (next) owned[name] = hash(next);
    if ((current === null) !== (next === null) || current && next && !current.equals(next)) changes.push({ name, operation: next ? 'write' : 'remove' });
  }
  if (!apply || !changes.length) return changes;
  fs.mkdirSync(home, { recursive: true });
  const restore = files => {
    for (const [name, data] of Object.entries(files)) {
      const target = safePath(home, name);
      if (data === null) fs.rmSync(target, { force: true });
      else replaceFile(target, Buffer.from(data, 'base64'));
    }
  };
  try {
    for (const { name } of changes) {
      const target = safePath(home, name);
      if (wanted[name]) replaceFile(target, wanted[name]);
      else fs.unlinkSync(target);
    }
    const temporary = statePath + '.tmp';
    // Leave an interrupted/failed state write available for manual recovery.
    fs.writeFileSync(temporary, JSON.stringify({ version: 1, owned, previous: { owned: state.owned, files: before } }, null, 2) + '\n', { flag: 'wx' });
    fs.renameSync(temporary, statePath);
  } catch (error) { restore(before); throw error; }
  return changes;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const action = args.shift();
    let home, apply = false;
    while (args.length) {
      const flag = args.shift();
      if (flag === '--home') home = args.shift();
      else if (flag === '--apply') apply = true;
      else throw new Error(`Unknown argument: ${flag}`);
    }
    console.log(JSON.stringify({ apply, changes: run({ home, action, apply }) }, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
