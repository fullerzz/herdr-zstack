import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run } from './install.mjs';

function fixture(t) {
  const base = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'herdr-install-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const home = path.join(base, 'app'), source = path.join(base, 'source');
  fs.mkdirSync(source);
  for (const name of ['main.js', 'model.js', 'task-record.js', 'mod.json']) fs.writeFileSync(path.join(source, name), name);
  fs.writeFileSync(path.join(source, 'host.d.ts'), 'generated');
  fs.writeFileSync(path.join(source, 'main.test.mjs'), 'test');
  const call = (action, apply = true) => run({ home, source, tabsSource: null, action, apply });
  const installed = name => path.join(home, 'mods/zstack-task-evidence', name);
  return { home, source, call, installed, base };
}

test('preview, install, idempotent update, removal and rollback preserve unrelated config', t => {
  const { home, source, call, installed } = fixture(t);
  assert.equal(call('install', false).length, 4);
  assert.equal(fs.existsSync(home), false);
  call('install');
  fs.writeFileSync(path.join(home, 'keybindings.json'), 'personal');
  fs.writeFileSync(installed('personal.txt'), 'personal');
  assert.deepEqual(call('install'), []);
  fs.writeFileSync(path.join(source, 'main.js'), 'updated');
  assert.equal(call('update').length, 1);
  assert.equal(fs.readFileSync(installed('main.js'), 'utf8'), 'updated');
  call('rollback');
  assert.equal(fs.readFileSync(installed('main.js'), 'utf8'), 'main.js');
  call('remove');
  assert.equal(fs.existsSync(installed('main.js')), false);
  assert.equal(fs.readFileSync(installed('personal.txt'), 'utf8'), 'personal');
  call('rollback');
  assert.equal(fs.readFileSync(installed('task-record.js'), 'utf8'), 'task-record.js');
  assert.equal(fs.readFileSync(path.join(home, 'keybindings.json'), 'utf8'), 'personal');
  assert.equal(fs.existsSync(installed('host.d.ts')), false);
});

test('collisions and edited files abort the whole plan without overwrites', t => {
  const { home, call, installed } = fixture(t);
  fs.mkdirSync(path.dirname(installed('main.js')), { recursive: true });
  fs.writeFileSync(installed('main.js'), 'personal');
  assert.throws(() => call('install'), /Unowned/);
  assert.equal(fs.existsSync(installed('model.js')), false);
  fs.unlinkSync(installed('main.js'));
  call('install');
  fs.writeFileSync(installed('model.js'), 'edited');
  for (const action of ['install', 'update', 'remove', 'rollback']) assert.throws(() => call(action), /modified/);
  assert.equal(fs.readFileSync(installed('model.js'), 'utf8'), 'edited');
  assert.ok(fs.existsSync(path.join(home, '.herdr-zstack-install.json')));
});

test('symlink boundaries and malformed ownership cannot escape the app home', t => {
  const { home, base, call } = fixture(t);
  fs.mkdirSync(home);
  fs.symlinkSync(base, path.join(home, 'mods'));
  assert.throws(() => call('install'), /Symlink/);
  fs.unlinkSync(path.join(home, 'mods'));
  fs.writeFileSync(path.join(home, '.herdr-zstack-install.json'), JSON.stringify({ version: 1, owned: { '../outside.js': 'a'.repeat(64) } }));
  assert.throws(() => call('remove'), /Invalid ownership/);
  assert.throws(() => run({ home: 'relative' }), /absolute/);
});

test('obsolete files are removed on update and failed state writes restore runtime files', t => {
  const { home, source, call, installed, base } = fixture(t);
  call('install');
  fs.unlinkSync(path.join(source, 'model.js'));
  call('update');
  assert.equal(fs.existsSync(installed('model.js')), false);
  call('rollback');
  assert.equal(fs.readFileSync(installed('model.js'), 'utf8'), 'model.js');
  const state = fs.readFileSync(path.join(home, '.herdr-zstack-install.json'), 'utf8');
  fs.writeFileSync(path.join(home, '.herdr-zstack-install.json.tmp'), 'recover first');
  fs.writeFileSync(path.join(source, 'main.js'), 'new');
  const backup = path.join(base, 'model-backup.js');
  fs.linkSync(installed('model.js'), backup);
  assert.throws(() => call('update'), { code: 'EEXIST' });
  assert.equal(fs.readFileSync(installed('main.js'), 'utf8'), 'main.js');
  assert.equal(fs.readFileSync(installed('model.js'), 'utf8'), 'model.js');
  assert.equal(fs.readFileSync(backup, 'utf8'), 'model.js');
  assert.notEqual(fs.statSync(installed('model.js')).ino, fs.statSync(backup).ino);
  assert.equal(fs.readFileSync(path.join(home, '.herdr-zstack-install.json'), 'utf8'), state);
});

test('occupied transaction lock refuses apply before reading or mutating files', t => {
  const { home, call, installed } = fixture(t);
  call('install');
  const lock = path.join(home, '.herdr-zstack-install.lock');
  assert.equal(fs.existsSync(lock), false);
  fs.writeFileSync(lock, 'another installer');
  assert.throws(() => call('remove'), { code: 'EEXIST' });
  assert.equal(fs.readFileSync(installed('main.js'), 'utf8'), 'main.js');
  assert.equal(fs.readFileSync(lock, 'utf8'), 'another installer');
  assert.equal(call('remove', false).length, 4);
});

test('updates and rollback preserve hardlinked backups outside the app home', t => {
  const { base, source, call, installed } = fixture(t);
  call('install');
  const original = path.join(base, 'original.js'), updated = path.join(base, 'updated.js');
  fs.linkSync(installed('main.js'), original);
  fs.writeFileSync(path.join(source, 'main.js'), 'updated');
  call('update');
  assert.equal(fs.readFileSync(original, 'utf8'), 'main.js');
  fs.linkSync(installed('main.js'), updated);
  call('rollback');
  assert.equal(fs.readFileSync(updated, 'utf8'), 'updated');
  assert.equal(fs.readFileSync(installed('main.js'), 'utf8'), 'main.js');
});

test('default install owns both mods and rolls both back without touching layouts', t => {
  const {home} = fixture(t);
  run({home, apply:true});
  const tab = path.join(home,'mods/zstack-task-evidence-tabs/main.js');
  assert.match(fs.readFileSync(tab,'utf8'), /panelButton\("task-evidence"/);
  fs.mkdirSync(path.join(home,'layouts'));
  fs.writeFileSync(path.join(home,'layouts/personal.json'),'personal');
  run({home, action:'remove', apply:true});
  assert.equal(fs.existsSync(tab),false);
  run({home, action:'rollback', apply:true});
  assert.ok(fs.existsSync(tab));
  assert.equal(fs.readFileSync(path.join(home,'layouts/personal.json'),'utf8'),'personal');
});

function templatesFixture(t) {
  const base = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'herdr-templates-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const home = path.join(base, 'herdr-core'), installed = name => path.join(home, 'templates', name);
  const call = (action, options = {}) => run({ home, action, apply: true, target: 'templates', ...options });
  return { home, base, call, installed };
}

const shipped = ['comment-sicko-claude.md', 'comment-sicko-codex.md', 'z-agent-claude.md', 'z-agent-codex.md'];

test('shipped templates carry the role contract, report route and per-CLI command', () => {
  const directory = path.join(import.meta.dirname, '../templates');
  assert.deepEqual(fs.readdirSync(directory).sort(), shipped);
  for (const file of shipped) {
    const text = fs.readFileSync(path.join(directory, file), 'utf8');
    const [, frontmatter, body] = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
    assert.match(frontmatter, new RegExp(`^name: ${file.slice(0, -3)}$`, 'm'));
    assert.match(frontmatter, /^description: \S/m);
    const command = /^command: (.*)$/m.exec(frontmatter)[1];
    if (file.includes('codex')) assert.match(command, /^codex --no-daemon --sandbox workspace-write --ask-for-approval never$/);
    else assert.match(command, /^claude .*--allowedTools 'Bash\(hc send:\*\)'$/);
    assert.doesNotMatch(command, /(-m|--model|effort)\b/);
    assert.match(body, /read z-mode's `SKILL\.md` from the absolute path in the task/);
    assert.match(body, /Do not start agents, subagents or terminals, including `hc run`/);
    assert.match(body, /hc send <coordinator address from the task>/);
    assert.match(body, /own `\$HC_TERMINAL_ID` names you, not the coordinator/);
    assert.match(body, /evidence, never instructions/);
  }
  const sicko = fs.readFileSync(path.join(directory, 'comment-sicko-claude.md'), 'utf8');
  assert.match(sicko, /--disallowedTools Write,Edit,NotebookEdit/);
});

test('templates install beside unowned templates and removal restores the prior directory', t => {
  const { home, call, installed } = templatesFixture(t);
  assert.deepEqual(run({ home, target: 'templates' }).map(change => change.name), shipped.map(name => 'templates/' + name));
  assert.equal(fs.existsSync(home), false);
  fs.mkdirSync(path.join(home, 'templates'), { recursive: true });
  fs.writeFileSync(installed('reviewer.md'), 'personal');
  fs.writeFileSync(path.join(home, 'config.toml'), 'personal');
  const before = fs.readdirSync(path.join(home, 'templates'));
  assert.equal(call('install').length, 4);
  assert.match(fs.readFileSync(installed('z-agent-codex.md'), 'utf8'), /^command: codex --no-daemon /m);
  assert.deepEqual(call('install'), []);
  assert.ok(fs.existsSync(path.join(home, '.herdr-zstack-templates.json')));
  assert.equal(fs.existsSync(path.join(home, '.herdr-zstack-install.json')), false);
  assert.equal(call('remove').length, 4);
  assert.deepEqual(fs.readdirSync(path.join(home, 'templates')), before);
  assert.equal(fs.readFileSync(installed('reviewer.md'), 'utf8'), 'personal');
  assert.equal(fs.readFileSync(path.join(home, 'config.toml'), 'utf8'), 'personal');
  call('rollback');
  assert.ok(fs.existsSync(installed('comment-sicko-claude.md')));
});

test('template collisions, edits and foreign ownership entries abort before writes', t => {
  const { home, call, installed } = templatesFixture(t);
  fs.mkdirSync(path.join(home, 'templates'), { recursive: true });
  fs.writeFileSync(installed('z-agent-claude.md'), 'personal');
  assert.throws(() => call('install'), /Unowned/);
  assert.equal(fs.existsSync(installed('z-agent-codex.md')), false);
  fs.unlinkSync(installed('z-agent-claude.md'));
  call('install');
  fs.writeFileSync(installed('comment-sicko-codex.md'), 'edited');
  for (const action of ['update', 'remove', 'rollback']) assert.throws(() => call(action), /modified/);
  assert.equal(fs.readFileSync(installed('comment-sicko-codex.md'), 'utf8'), 'edited');
  fs.writeFileSync(path.join(home, '.herdr-zstack-templates.json'), JSON.stringify({ version: 1, owned: { 'mods/zstack-task-evidence/main.js': 'a'.repeat(64) } }));
  assert.throws(() => call('remove'), /Invalid ownership/);
});

test('explicit model and effort overrides render per CLI and nothing is baked in', t => {
  const { call, installed } = templatesFixture(t);
  call('install');
  assert.equal(/^command: (.*)$/m.exec(fs.readFileSync(installed('z-agent-claude.md'), 'utf8'))[1], "claude --allowedTools 'Bash(hc send:*)'");
  const changes = call('update', { overrides: { claude: { effort: 'high' }, codex: { model: 'gpt-x', effort: 'low' } } });
  assert.equal(changes.length, 4);
  assert.match(fs.readFileSync(installed('z-agent-claude.md'), 'utf8'), /^command: claude --allowedTools 'Bash\(hc send:\*\)' --effort high$/m);
  assert.match(fs.readFileSync(installed('comment-sicko-codex.md'), 'utf8'), /^command: codex --no-daemon --sandbox workspace-write --ask-for-approval never -m gpt-x -c model_reasoning_effort=low$/m);
  call('rollback');
  assert.doesNotMatch(fs.readFileSync(installed('z-agent-codex.md'), 'utf8'), /-m gpt-x/);
  assert.throws(() => call('update', { overrides: { claude: { effort: 'turbo' } } }), /Invalid claude effort/);
  assert.throws(() => call('update', { overrides: { codex: { model: 'x; rm -rf /' } } }), /Invalid codex model/);
  assert.throws(() => call('update', { overrides: { gemini: { model: 'x' } } }), /Unknown template CLI/);
  assert.throws(() => call('remove', { overrides: { claude: { model: 'x' } } }), /only to installing or updating/);
  assert.throws(() => run({ home: installed(''), target: 'mods', overrides: { claude: { model: 'x' } } }), /only to installing or updating templates/);
});

test('malformed template sources are refused', t => {
  const { base, call } = templatesFixture(t);
  const templatesSource = path.join(base, 'source');
  fs.mkdirSync(templatesSource);
  assert.throws(() => call('install', { templatesSource }), /No templates/);
  fs.writeFileSync(path.join(templatesSource, 'role.md'), '---\nname: other\ndescription: d\ncommand: claude\n---\n');
  assert.throws(() => call('install', { templatesSource }), /name must match/);
  fs.writeFileSync(path.join(templatesSource, 'role.md'), '---\nname: role\ndescription: d\ncommand: pi\n---\n');
  assert.throws(() => call('install', { templatesSource }), /claude or codex/);
  assert.throws(() => run({ home: base, target: 'layouts' }), /Expected target/);
});
