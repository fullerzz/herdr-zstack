import test from 'node:test';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { provenance, resolveCompanion } from './companion.mjs';

const codex = process.env.HERDR_TEST_CODEX;
const claude = process.env.HERDR_TEST_CLAUDE;

// Opt in with absolute CLI paths; installs and Git commits live in disposable fixtures.
test('host CLIs refresh local and Git installations', { skip: !codex || !claude }, () => {
  assert.ok(path.isAbsolute(codex) && path.isAbsolute(claude));
  const scratch = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'issue44-refresh-'));
  const repo = fileURLToPath(new URL('..', import.meta.url));
  const oldVersion = '0.1.3', version = provenance(repo).version;
  const reviewSkill = 'skills/alt-harness-review/SKILL.md';
  const run = (bin, args, env, cwd) => execFileSync(bin, args, {
    env, cwd, encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    for (const host of ['claude', 'codex']) for (const kind of ['local', 'git']) {
      const base = path.join(scratch, `${host}-${kind}`);
      const source = path.join(base, 'source with spaces'), config = path.join(base, 'config');
      fs.mkdirSync(source, { recursive: true });
      fs.mkdirSync(config);
      for (const file of ['.claude-plugin', '.codex-plugin', 'scripts', 'skills', 'docs', 'records', 'workflows', 'templates']) {
        fs.cpSync(path.join(repo, file), path.join(source, file), { recursive: true });
      }
      fs.rmSync(path.dirname(path.join(source, reviewSkill)), { recursive: true });
      for (const file of ['.claude-plugin/plugin.json', '.codex-plugin/plugin.json']) {
        const target = path.join(source, file), data = JSON.parse(fs.readFileSync(target));
        data.version = oldVersion;
        fs.writeFileSync(target, JSON.stringify(data));
      }
      const env = {
        ...process.env, PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH}`,
        CODEX_HOME: config, CLAUDE_CONFIG_DIR: config,
        GIT_CONFIG_GLOBAL: path.join(base, 'empty.gitconfig'), GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_COUNT: '0',
      };
      fs.writeFileSync(env.GIT_CONFIG_GLOBAL, '');
      const git = (...args) => run('git', args, env, source);
      const commit = () => {
        git('add', '.');
        git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture');
      };
      if (kind === 'git') {
        git('init', '-q');
        commit();
        // Exercise host Git-source handling with local transport, without publishing a fixture.
        env.GIT_CONFIG_COUNT = '1';
        env.GIT_CONFIG_KEY_0 = `url.file://${source}.insteadOf`;
        env.GIT_CONFIG_VALUE_0 = 'https://github.com/fixture/issue44.git';
      }
      const bin = host === 'claude' ? claude : codex;
      run(bin, ['plugin', 'marketplace', 'add', kind === 'git' ? 'https://github.com/fixture/issue44.git' : source], env, base);
      run(bin, ['plugin', host === 'claude' ? 'install' : 'add', 'herdr-zstack@herdr-zstack-local'], env, base);
      const metadata = path.join(base, 'metadata.json');
      // Capture fresh host metadata each time, as the launcher contract requires.
      const resolve = () => {
        fs.writeFileSync(metadata, run(bin, ['plugin', 'list', '--json'], env, base));
        return resolveCompanion({ host, env, metadata, cwd: base });
      };
      const before = resolve();
      assert.equal(before.version, oldVersion);
      assert.equal(fs.existsSync(path.join(before.path, reviewSkill)), false);
      for (const file of ['.claude-plugin/plugin.json', '.codex-plugin/plugin.json']) {
        fs.copyFileSync(path.join(repo, file), path.join(source, file));
      }
      fs.cpSync(path.dirname(path.join(repo, reviewSkill)), path.dirname(path.join(source, reviewSkill)), { recursive: true });
      if (kind === 'git') commit();
      // Before any host refresh: only a Claude directory marketplace already selects the edited source.
      let edited;
      if (host === 'claude' && kind === 'local') {
        edited = resolve();
        assert.equal(edited.version, version);
        assert.notEqual(edited.sha256, before.sha256);
        assert.deepEqual(edited.staleRegistrations.map(r => r.version), [oldVersion]);
      } else if (host === 'codex' && kind === 'local') {
        assert.throws(resolve, /content mismatch/);
      } else {
        assert.equal(resolve().sha256, before.sha256);
      }
      if (host === 'claude' || kind === 'git') {
        run(bin, ['plugin', 'marketplace', host === 'claude' ? 'update' : 'upgrade', 'herdr-zstack-local'], env, base);
      }
      run(bin, ['plugin', host === 'claude' ? 'update' : 'add', 'herdr-zstack@herdr-zstack-local'], env, base);
      const after = resolve();
      assert.equal(after.version, version);
      assert.deepEqual(fs.readFileSync(path.join(after.path, reviewSkill)), fs.readFileSync(path.join(repo, reviewSkill)));
      assert.notEqual(before.sha256, after.sha256);
      // For a Claude directory source the refresh only updates the registered cache record.
      if (edited) assert.equal(after.sha256, edited.sha256);
      assert.equal(after.staleRegistrations, undefined);
      const probe = spawnSync('/bin/sh', [path.join(after.path, 'scripts/preflight.sh'), process.execPath,
        '--host', host, '--metadata', metadata], {
        cwd: base, env: { ...env, HC_TERMINAL_ID: '' }, encoding: 'utf8', timeout: 15_000,
      });
      assert.equal(probe.status, 1, probe.stderr);
      const report = JSON.parse(probe.stdout);
      assert.equal(report.companion.status, 'supported');
      assert.equal(report.companion.sha256, after.sha256);
      assert.match(report.session.reason, /HC_TERMINAL_ID/);
      const how = { 'claude local': 'source selected before refresh; refresh updated registration',
        'codex local': 'stale cache refused before refresh; refresh changed selection' }[`${host} ${kind}`] ?? 'refresh changed selection';
      console.log(`${host} ${kind}: installation and ${oldVersion} -> ${version} PASS (${how})`);
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});
