import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prefix = 'mods/zstack-task-evidence/';
const tabsPrefix = 'mods/zstack-task-evidence-tabs/';
const hash = data => createHash('sha256').update(data).digest('hex');
// Separate state per target: rolling back one target never reverts the other.
const targets = {
  mods: {
    stateName: '.herdr-zstack-install.json',
    lockName: '.herdr-zstack-install.lock',
    validPath: name => [prefix, tabsPrefix].some(p => name.startsWith(p) && /^[a-zA-Z0-9_-]+\.(js|json)$/.test(name.slice(p.length))),
  },
  templates: {
    stateName: '.herdr-zstack-templates.json',
    lockName: '.herdr-zstack-templates.lock',
    validPath: name => /^templates\/[a-z0-9][a-z0-9-]*\.md$/.test(name),
  },
};
// Flag syntax from Claude Code 2.1.316 and Codex 0.166.0 help. Codex help lists no effort values, so only their shape is checked.
const overrideFlags = {
  claude: { model: value => `--model ${value}`, effort: value => `--effort ${value}`, efforts: /^(low|medium|high|xhigh|max)$/ },
  codex: { model: value => `-m ${value}`, effort: value => `-c model_reasoning_effort=${value}`, efforts: /^[a-z]+$/ },
};

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

// Roadmap D5: templates keep each CLI's defaults; flags are appended only for explicitly requested settings.
function renderTemplate(text, file, overrides) {
  const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1];
  const field = key => frontmatter?.split('\n').find(line => line.startsWith(`${key}: `))?.slice(key.length + 2);
  if (field('name') !== path.basename(file, '.md') || !field('description')) throw new Error(`Template name must match its file and have a description: ${file}`);
  const command = field('command');
  const flags = overrideFlags[command?.split(' ')[0]];
  if (!flags) throw new Error(`Template command must start with claude or codex: ${file}`);
  const { model, effort } = overrides[command.split(' ')[0]] ?? {};
  const extra = [model && flags.model(model), effort && flags.effort(effort)].filter(Boolean);
  return Buffer.from(extra.length ? text.replace(`\ncommand: ${command}\n`, `\ncommand: ${[command, ...extra].join(' ')}\n`) : text);
}

function validateOverrides(overrides, target, action) {
  for (const [cli, settings] of Object.entries(overrides)) {
    if (!overrideFlags[cli] || !settings || typeof settings !== 'object') throw new Error(`Unknown template CLI: ${cli}`);
    for (const [key, value] of Object.entries(settings)) {
      if (value === undefined) continue;
      if (target !== 'templates' || !['install', 'update'].includes(action)) throw new Error('Model and effort overrides apply only to installing or updating templates');
      if (key === 'model' && !/^[A-Za-z0-9][A-Za-z0-9._:/@-]*$/.test(value)) throw new Error(`Invalid ${cli} model: ${value}`);
      else if (key === 'effort' && !overrideFlags[cli].efforts.test(value)) throw new Error(`Invalid ${cli} effort: ${value}`);
      else if (!['model', 'effort'].includes(key)) throw new Error(`Unknown ${cli} setting: ${key}`);
    }
  }
}

export function run({ home, action = 'install', apply = false, target = 'mods', source = path.join(root, 'mods/task-evidence'), tabsSource = path.join(root, 'mods/task-evidence-tabs'), templatesSource = path.join(root, 'templates'), overrides = {} }) {
  if (!home || !path.isAbsolute(home)) throw new Error('--home must be an explicit absolute configuration directory');
  if (!['install', 'update', 'remove', 'rollback'].includes(action)) throw new Error('Expected install, update, remove, or rollback');
  if (!Object.hasOwn(targets, target)) throw new Error('Expected target mods or templates');
  validateOverrides(overrides, target, action);
  safePath(home);
  const options = { home, action, apply, target: targets[target], sources: target === 'mods' ? { source, tabsSource } : { templatesSource, overrides } };
  if (!apply) return transact(options);
  fs.mkdirSync(home, { recursive: true });
  const lockPath = safePath(home, targets[target].lockName);
  const lock = fs.openSync(lockPath, 'wx');
  try { return transact(options); }
  finally { fs.closeSync(lock); fs.unlinkSync(lockPath); }
}

function modFiles({ source, tabsSource }, validPath) {
  const wanted = {};
  for (const [directory, destination] of [[source, prefix], ...(tabsSource ? [[tabsSource, tabsPrefix]] : [])]) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!(entry.name.endsWith('.js') || entry.name === 'mod.json')) continue;
      const name = destination + entry.name;
      if (!validPath(name) || !entry.isFile() || entry.isSymbolicLink()) throw new Error(`Invalid runtime file: ${entry.name}`);
      wanted[name] = fs.readFileSync(path.join(directory, entry.name));
    }
    if (!wanted[destination + 'main.js'] || !wanted[destination + 'mod.json']) throw new Error('Incomplete mod source');
  }
  return wanted;
}

function templateFiles({ templatesSource, overrides }, validPath) {
  const wanted = {};
  for (const entry of fs.readdirSync(templatesSource, { withFileTypes: true })) {
    if (!entry.name.endsWith('.md')) continue;
    const name = 'templates/' + entry.name;
    if (!validPath(name) || !entry.isFile() || entry.isSymbolicLink()) throw new Error(`Invalid template file: ${entry.name}`);
    wanted[name] = renderTemplate(fs.readFileSync(path.join(templatesSource, entry.name), 'utf8'), entry.name, overrides);
  }
  if (!Object.keys(wanted).length) throw new Error('No templates to install');
  return wanted;
}

function transact({ home, action, apply, target: { stateName, validPath }, sources }) {
  const statePath = safePath(home, stateName);
  const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : { version: 1, owned: {}, previous: null };
  if (state.version !== 1 || !state.owned || typeof state.owned !== 'object' || Array.isArray(state.owned)) throw new Error('Invalid installation state');
  for (const [name, digest] of Object.entries(state.owned)) {
    if (!validPath(name) || typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest)) throw new Error('Invalid ownership entry');
  }
  let wanted = {};
  if (action === 'install' || action === 'update') {
    wanted = sources.templatesSource ? templateFiles(sources, validPath) : modFiles(sources, validPath);
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
    let home, target, apply = false;
    const overrides = { claude: {}, codex: {} };
    const value = flag => {
      const next = args.shift();
      if (next === undefined || next.startsWith('--')) throw new Error(`${flag} needs a value`);
      return next;
    };
    while (args.length) {
      const flag = args.shift();
      const setting = /^--(claude|codex)-(model|effort)$/.exec(flag);
      if (flag === '--home') home = value(flag);
      else if (flag === '--target') target = value(flag);
      else if (flag === '--apply') apply = true;
      else if (setting) overrides[setting[1]][setting[2]] = value(flag);
      else throw new Error(`Unknown argument: ${flag}`);
    }
    console.log(JSON.stringify({ apply, changes: run({ home, action, apply, target, overrides }) }, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
