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
  const call = (action, apply = true) => run({ home, source, action, apply });
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
