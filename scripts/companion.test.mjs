import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { provenance, resolveCompanion } from './companion.mjs';

const checkout = fileURLToPath(new URL('..', import.meta.url));
function fixture(t) {
  const home = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'companion spaces '));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const write = (file, value) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
  };
  const plugin = (root, version = '0.1.1', probe = 'export const preflight = async () => ({session:{status:"unavailable",reason:"no caller"}});') => {
    for (const file of ['.claude-plugin/plugin.json', '.codex-plugin/plugin.json']) write(path.join(root, file), { name: 'herdr-zstack', version });
    write(path.join(root, 'skills/hc-workflow/SKILL.md'), 'current guidance');
    write(path.join(root, 'scripts/preflight.mjs'), probe);
    write(path.join(root, 'docs/installation.md'), 'installation');
    write(path.join(root, 'records/task-record-store.mjs'), 'export const revision = 1;');
    write(path.join(root, 'workflows/roster.mjs'), 'export const revision = 1;');
    write(path.join(root, 'templates/z-agent-claude.md'), 'worker guidance');
    for (const file of ['companion.mjs', 'preflight.sh']) write(path.join(root, 'scripts', file), fs.readFileSync(path.join(checkout, 'scripts', file), 'utf8'));
    return root;
  };
  // Entry shape copied from `claude plugin list --json` (Claude Code 2.1.325) in disposable configs.
  const claudeEntry = (fields) => ({ id: 'herdr-zstack@remote', scope: 'user', enabled: true, version: '0.1.1', ...fields });
  const listing = (entries) => {
    const file = path.join(home, 'claude list.json');
    write(file, entries);
    return file;
  };
  return { home, write, plugin, claudeEntry, listing };
}

test('Claude directory listing selects the host read folder and reports a stale registered cache', t => {
  const { home, plugin, claudeEntry, listing } = fixture(t);
  const current = plugin(path.join(home, 'market/plugins/companion'));
  const stale = path.join(home, 'stale cache');
  const entry = claudeEntry({ id: 'herdr-zstack@local', version: '0.1.0', installPath: stale, readFromFolder: current, folderVersion: '0.1.1' });
  const resolve = () => resolveCompanion({ host: 'claude', metadata: listing([entry]), cwd: home });
  const selected = resolve();
  assert.equal(selected.path, current);
  assert.equal(selected.version, '0.1.1');
  assert.equal(selected.sha256, provenance(current).sha256);
  assert.deepEqual(selected.staleRegistrations, [{ scope: 'user', version: '0.1.0', installPath: stale }]);
  entry.version = '0.1.1';
  assert.equal(resolve().staleRegistrations, undefined);
  // A listing taken before the folder changed no longer describes what the host loads.
  entry.folderVersion = '0.1.0';
  assert.throws(resolve, /version mismatch/);
});

test('Claude git listing uses installPath, honors host-disabled state and refuses ambiguous registrations', t => {
  const { home, plugin, claudeEntry, listing } = fixture(t);
  const first = plugin(path.join(home, 'git cache'));
  const resolve = entries => resolveCompanion({ host: 'claude', metadata: listing(entries), cwd: home });
  assert.equal(resolve([claudeEntry({ installPath: first })]).path, first);
  assert.throws(() => resolve([claudeEntry({ installPath: first, enabled: false })]), /missing or disabled/);
  assert.throws(() => resolve([claudeEntry({ installPath: first, version: '0.1.0' })]), /version mismatch/);
  const other = plugin(path.join(home, 'other'));
  assert.throws(() => resolve([claudeEntry({ installPath: first }), claudeEntry({ installPath: other, scope: 'project', projectPath: home })]), /ambiguous/);
  assert.throws(() => resolve([claudeEntry({ installPath: first, scope: 'managed' })]), /unsupported Claude installation scope: managed/);
  assert.throws(() => resolveCompanion({ host: 'claude', cwd: home }), /--metadata must name/);
});

test('Claude project and local installations apply only to the exact capture directory', t => {
  const { home, plugin, claudeEntry, listing } = fixture(t);
  const user = plugin(path.join(home, 'user cache'));
  const old = plugin(path.join(home, 'project cache'), '0.1.0');
  const project = path.join(home, 'project A');
  fs.mkdirSync(path.join(project, 'sub'), { recursive: true });
  const metadata = listing([
    claudeEntry({ installPath: user }),
    claudeEntry({ installPath: old, version: '0.1.0', scope: 'project', projectPath: project }),
    claudeEntry({ installPath: old, version: '0.1.0', scope: 'local', projectPath: '/nonexistent/other project' }),
  ]);
  // The host lists another project's entry as enabled whenever the plugin id is enabled here.
  assert.equal(resolveCompanion({ host: 'claude', metadata, cwd: home }).path, user);
  // Claude matched project settings to the exact cwd, not the enclosing project, in the CLI probe.
  assert.equal(resolveCompanion({ host: 'claude', metadata, cwd: path.join(project, 'sub') }).path, user);
  // No observed host precedence decides between a user and a project root.
  assert.throws(() => resolveCompanion({ host: 'claude', metadata, cwd: project }), /ambiguous/);
  const only = listing([claudeEntry({ installPath: old, version: '0.1.0', scope: 'local', projectPath: project })]);
  assert.equal(resolveCompanion({ host: 'claude', metadata: only, cwd: project }).path, old);
  assert.throws(() => resolveCompanion({ host: 'claude', metadata: only, cwd: home }), /missing or disabled/);
});

test('Codex metadata ignores stale caches and detects same-version content drift and refresh', t => {
  const { home, write, plugin } = fixture(t);
  const source = plugin(path.join(home, 'source'));
  const current = plugin(path.join(home, '.codex/plugins/cache/local/herdr-zstack/0.1.1'));
  plugin(path.join(home, '.codex/plugins/cache/local/herdr-zstack/0.1.0'), '0.1.0');
  const metadata = path.join(home, 'installed.json');
  const entry = { name: 'herdr-zstack', marketplaceName: 'local', version: '0.1.1', installed: true, enabled: true, source: { source: 'local', path: source } };
  write(metadata, { installed: [entry] });
  const resolve = () => resolveCompanion({ host: 'codex', home, env: {}, metadata });
  assert.equal(resolve().path, current);
  write(path.join(source, 'skills/hc-workflow/SKILL.md'), 'updated');
  assert.throws(resolve, /content mismatch/);
  fs.cpSync(source, current, { recursive: true });
  assert.equal(resolve().sha256, provenance(source).sha256);
  for (const file of ['records/task-record-store.mjs', 'workflows/roster.mjs', 'templates/z-agent-claude.md']) {
    const before = provenance(source).sha256;
    fs.appendFileSync(path.join(source, file), '\nchanged runtime payload\n');
    assert.notEqual(provenance(source).sha256, before, file);
    assert.throws(resolve, /content mismatch/, file);
    fs.cpSync(source, current, { recursive: true });
    assert.equal(resolve().sha256, provenance(source).sha256, file);
  }
  write(metadata, { installed: [{ ...entry, source: { source: 'local', path: path.join(home, 'moved source') } }] });
  assert.throws(resolve, /local source missing or unreadable; content drift cannot be verified/);
  write(metadata, { installed: [{ ...entry, enabled: false }] });
  assert.throws(resolve, /missing or disabled/);
  write(metadata, { installed: [{ ...entry, marketplaceName: '../escape' }] });
  assert.throws(resolve, /invalid installation identity/);
});

const launch = (launcher, node, cwd, args = []) => spawnSync('/bin/sh', [launcher, node, '--host', 'claude', ...args], { cwd, env: { PATH: '/usr/bin:/bin' }, encoding: 'utf8' });
const bootstrapFailed = (result, reason) => {
  assert.equal(result.status, 2, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.bootstrap.status, 'failed');
  assert.match(report.bootstrap.reason, reason);
  assert.equal(report.session.status, 'untested');
};

test('bootstrap failure is not a missing caller; approved Node runs from unrelated cwd with spaces', t => {
  const { home, write, plugin, claudeEntry, listing } = fixture(t);
  const blocked = path.join(home, 'blocked shim');
  write(blocked, '#!/bin/sh\necho "Operation not permitted" >&2\nexit 1\n');
  fs.chmodSync(blocked, 0o755);
  const root = plugin(path.join(home, 'active plugin'));
  const launcher = path.join(root, 'scripts/preflight.sh');
  const metadata = listing([claudeEntry({ installPath: root })]);
  bootstrapFailed(launch(launcher, blocked, home, ['--metadata', metadata]), /approved absolute Node/);
  const result = launch(launcher, process.execPath, home, ['--metadata', metadata]);
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.bootstrap.status, 'supported');
  assert.equal(report.companion.path, path.join(home, 'active plugin'));
  assert.equal(report.session.reason, 'no caller');
});

test('a missing, unparseable or reportless companion module is a bootstrap failure, never exit 1', t => {
  const { home, write } = fixture(t);
  const launcher = path.join(home, 'partial copy/scripts/preflight.sh');
  write(launcher, fs.readFileSync(path.join(checkout, 'scripts/preflight.sh'), 'utf8'));
  bootstrapFailed(launch(launcher, process.execPath, home), /missing or unreadable/);
  const module = path.join(path.dirname(launcher), 'companion.mjs');
  // Node itself exits 1 on a module syntax error, the same code as an unavailable session.
  write(module, 'export const = ;\n');
  const parse = launch(launcher, process.execPath, home);
  assert.match(parse.stderr, /SyntaxError/);
  bootstrapFailed(parse, /Node exited 1 without a valid preflight report/);
  write(module, 'console.log("{}"); process.exitCode = 1;\n');
  bootstrapFailed(launch(launcher, process.execPath, home), /Node exited 1 without a valid preflight report/);
});

test('an old launcher refuses a different selected payload; canonical and symlink paths agree', t => {
  const { home, plugin, claudeEntry, listing } = fixture(t);
  const old = plugin(path.join(home, 'old'), '0.1.0');
  const current = plugin(path.join(home, 'current'));
  const metadata = listing([claudeEntry({ installPath: current })]);
  const stale = launch(path.join(old, 'scripts/preflight.sh'), process.execPath, home, ['--metadata', metadata]);
  assert.equal(stale.status, 2, stale.stderr);
  const report = JSON.parse(stale.stdout);
  assert.equal(report.companion.status, 'unavailable');
  assert.equal(report.companion.executing.path, old);
  assert.equal(report.companion.path, current);
  assert.match(report.companion.action, /Reload.*restart/);
  assert.equal(report.session.status, 'untested');
  const alias = path.join(home, 'symlink');
  fs.symlinkSync(current, alias, 'dir');
  for (const root of [current, alias]) {
    const result = launch(path.join(root, 'scripts/preflight.sh'), process.execPath, home, ['--metadata', metadata]);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(JSON.parse(result.stdout).companion.path, current);
  }
});

test('invalid host and metadata arguments are bootstrap usage failures', t => {
  const { home } = fixture(t);
  const launcher = path.join(checkout, 'scripts/preflight.sh');
  for (const [args, reason] of [[['--host', 'clade'], /--host must/], [[], /--metadata requires/], [['--metadata', 'relative.json'], /--metadata requires/]]) {
    bootstrapFailed(launch(launcher, process.execPath, home, args), reason);
  }
});

test('a selected probe that fails keeps companion provenance and is reported as a probe failure', t => {
  const { home, write, plugin, claudeEntry, listing } = fixture(t);
  const root = plugin(path.join(home, 'plugin'), '0.1.1', 'export const preflight = async () => { throw new Error("probe bug: socket parse"); };');
  const metadata = listing([claudeEntry({ installPath: root })]);
  const launcher = path.join(root, 'scripts/preflight.sh');
  const failed = launch(launcher, process.execPath, home, ['--metadata', metadata]);
  assert.equal(failed.status, 2, failed.stderr);
  const report = JSON.parse(failed.stdout);
  assert.equal(report.bootstrap.status, 'supported');
  assert.equal(report.companion.status, 'supported');
  assert.equal(report.companion.sha256, provenance(root).sha256);
  assert.deepEqual([report.probe.status, report.probe.reason], ['failed', 'probe bug: socket parse']);
  assert.doesNotMatch(report.probe.action, /refresh/);
  assert.equal(report.session.status, 'untested');
  write(path.join(root, 'scripts/preflight.mjs'), 'export const preflight = async () => ({session:{status:"untested"}});');
  const incomplete = launch(launcher, process.execPath, home, ['--metadata', metadata]);
  assert.equal(incomplete.status, 2, incomplete.stderr);
  assert.equal(JSON.parse(incomplete.stdout).probe.status, 'failed');
  write(path.join(root, 'scripts/preflight.mjs'), 'export const preflight = async () => ({session:{status:"unavailable",reason:"no caller"}});');
  const fixed = launch(launcher, process.execPath, home, ['--metadata', metadata]);
  assert.equal(fixed.status, 1, fixed.stderr);
  assert.equal(JSON.parse(fixed.stdout).probe, undefined);
  assert.equal(JSON.parse(fixed.stdout).session.reason, 'no caller');
});

test('release manifests stay synchronized and provenance changes with guidance', t => {
  assert.equal(provenance(checkout).version, '0.1.4');
  const { home, write, plugin } = fixture(t);
  const root = plugin(path.join(home, 'plugin'));
  const before = provenance(root).sha256;
  write(path.join(root, 'skills/hc-workflow/SKILL.md'), 'changed');
  assert.notEqual(provenance(root).sha256, before);
  write(path.join(root, '.codex-plugin/plugin.json'), { name: 'herdr-zstack', version: '0.1.2' });
  assert.throws(() => provenance(root), /manifests disagree/);
});
