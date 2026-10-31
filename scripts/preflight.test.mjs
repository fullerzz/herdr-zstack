import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preflight, isAllowed, cliSocket, mentionsSocketKey, socketRpc, discoverZstack, readOnlyMethods } from './preflight.mjs';

const script = fileURLToPath(new URL('./preflight.mjs', import.meta.url));
const ok = text => ({ code: 0, stdout: text, stderr: '' });
const missing = { code: null, stdout: '', stderr: '', spawnError: 'ENOENT' };
const notFound = { error: { code: -32000, message: 'no terminal', data: { kind: 'not_found' } } };

function tempHome(t) {
  const home = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'herdr-preflight-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  return home;
}

function zstackAt(root, { version = '0.22.0', nativeHosts = true } = {}) {
  fs.mkdirSync(path.join(root, '.claude-plugin'), { recursive: true });
  fs.mkdirSync(path.join(root, 'skills/z-mode/references'), { recursive: true });
  fs.writeFileSync(path.join(root, '.claude-plugin/plugin.json'), JSON.stringify({ name: 'zstack', version }));
  fs.writeFileSync(path.join(root, 'skills/z-mode/SKILL.md'), 'z-mode');
  if (nativeHosts) fs.writeFileSync(path.join(root, 'skills/z-mode/references/native-hosts.md'), 'native');
  return root;
}

function registerClaude(dir, root) {
  fs.mkdirSync(path.join(dir, 'plugins'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'plugins/installed_plugins.json'), JSON.stringify({ plugins: { 'zstack@local': [{ installPath: path.join(dir, 'stale-cache') }] } }));
  fs.writeFileSync(path.join(dir, 'plugins/known_marketplaces.json'), JSON.stringify({ local: { source: { source: 'directory', path: root } } }));
}

function fixture(t, { env = {}, versions = {}, replies = {}, answer = null, config = null, zstackVersion = '0.22.0' } = {}) {
  const home = tempHome(t);
  const zstack = zstackVersion ? zstackAt(path.join(home, 'zstack'), { version: zstackVersion }) : null;
  if (zstack) registerClaude(path.join(home, '.claude'), zstack);
  if (config !== null) {
    fs.mkdirSync(path.join(home, '.config/herdr-core'), { recursive: true });
    fs.writeFileSync(path.join(home, '.config/herdr-core/config.toml'), config);
  }
  const socket = path.join(home, '.local/state/herdr-core/default/default.sock');
  const fullEnv = { HC_TERMINAL_ID: 't16', HC_TERMINAL_SOCKET: socket, CLAUDECODE: '1', ...env };
  for (const [key, value] of Object.entries(fullEnv)) if (value === undefined) delete fullEnv[key];
  const table = { 'hc --version': ok('hc 0.1.15\n'), 'herdr-app --version': ok('herdr-app 0.1.10\n'), ...versions };
  const core = { id: 'core-1', name: 'mac' };
  const methods = {
    hello: { result: { generation: 1, version: '0.1.15', core } },
    'server.status': { result: { core, version: '0.1.15', pid: 7 } },
    'terminal.get': { result: { address: 't16', state: 'live', parent: null, name: null, template: null, status: { msg: 'private screen text' } } },
    'templates.list': { result: { templates: [] } },
    'machine.list': { result: { machines: [{ name: 'vps', state: 'connected', version: '0.1.15' }] } },
    ...replies,
  };
  const calls = [], dialed = [];
  const run = async (command, args) => { calls.push([command, ...args].join(' ')); return table[[command, ...args].join(' ')] ?? missing; };
  const rpc = async (target, requests) => { dialed.push({ target, requests }); return answer ?? { ok: true, replies: requests.map(([method]) => methods[method]) }; };
  const call = (extra = {}) => preflight({ env: fullEnv, home, platform: 'darwin', run, rpc, now: () => new Date(0), ...extra });
  return { call, calls, dialed, socket, home, zstack };
}

const operation = (report, name) => report.operations.find(row => row.operation === name);

test('inside an hc terminal reports a supported native session over the caller socket', async t => {
  const { call, calls, dialed, socket, zstack } = fixture(t);
  const report = await call();
  assert.equal(report.session.status, 'supported');
  assert.equal(report.readOnly, true);
  assert.deepEqual(dialed.map(d => d.target), [socket]);
  assert.ok(dialed[0].requests.every(([method]) => readOnlyMethods.includes(method)));
  assert.deepEqual(dialed[0].requests.find(([method]) => method === 'terminal.get')[1], { terminal: 't16' });
  assert.deepEqual(report.caller, { status: 'supported', address: 't16', machine: 'mac', state: 'live', topology: { kind: 'root', parent: null }, name: null, template: null });
  assert.equal(report.core.id, 'core-1');
  assert.equal(report.templates.status, 'unavailable');
  assert.equal(report.machines.status, 'supported');
  assert.equal(report.zstack.status, 'supported');
  assert.equal(report.zstack.path, zstack);
  assert.equal(operation(report, 'start-worker').status, 'untested');
  assert.deepEqual(calls, ['hc --version', 'herdr-app --version']);
  assert.deepEqual(report.commands, calls);
  assert.doesNotMatch(JSON.stringify(report), /private screen text/);
});

test('a child terminal reports its parent', async t => {
  const report = await fixture(t, { replies: { 'terminal.get': { result: { address: 't16', state: 'live', parent: 't1' } } } }).call();
  assert.deepEqual(report.caller.topology, { kind: 'child', parent: 't1' });
});

test('missing terminal ID is unavailable and never contacts a core', async t => {
  const { call, dialed } = fixture(t, { env: { HC_TERMINAL_ID: undefined } });
  const report = await call();
  assert.equal(report.session.status, 'unavailable');
  assert.match(report.session.reason, /HC_TERMINAL_ID is not set/);
  assert.deepEqual(dialed, []);
  assert.equal(operation(report, 'start-worker').status, 'unavailable');
  assert.equal(operation(report, 'local-edits').status, 'supported');
});

test('legacy-only HERDR_ENV is diagnostic and never enables execution', async t => {
  const { call, dialed } = fixture(t, { env: { HC_TERMINAL_ID: undefined, HC_TERMINAL_SOCKET: undefined, HERDR_ENV: '1' } });
  const report = await call();
  assert.equal(report.session.status, 'unavailable');
  assert.match(report.session.reason, /legacy-only environment/);
  assert.deepEqual(report.session.legacy, { HERDR_ENV: '1', enablesExecution: false });
  assert.deepEqual(dialed, []);
});

test('unresolvable, finished and mismatched caller addresses are not a native session', async t => {
  for (const [reply, pattern] of [
    [notFound, /terminal.get t16 did not resolve: not_found/],
    [{ result: { address: 't16', state: 'finished' } }, /is finished, not live/],
    [{ result: { address: 't17', state: 'live' } }, /resolved a different address t17/],
  ]) {
    const report = await fixture(t, { replies: { 'terminal.get': reply } }).call();
    assert.equal(report.session.status, 'unavailable');
    assert.match(report.session.reason, pattern);
    assert.equal(report.caller.status, 'unavailable');
    assert.equal(report.templates.status, 'unavailable');
  }
});

test('an unreachable or vanished core is unavailable and no hc core command ever runs', async t => {
  for (const answer of [{ ok: false, reason: 'ECONNREFUSED' }, { ok: false, reason: 'connection closed before every reply' }]) {
    const { call, calls } = fixture(t, { answer });
    const report = await call();
    assert.equal(report.session.status, 'unavailable');
    assert.match(report.session.reason, new RegExp(`caller core did not answer .*${answer.reason}`));
    assert.equal(report.core.status, 'unavailable');
    assert.deepEqual(calls, ['hc --version', 'herdr-app --version']);
  }
});

test('a protocol or identity mismatch is not a native session', async t => {
  const other = await fixture(t, { replies: { hello: { result: { generation: 2, core: { id: 'core-1' } } } } }).call();
  assert.match(other.session.reason, /protocol generation 2 is not 1/);
  const swapped = await fixture(t, { replies: { hello: { result: { generation: 1, core: { id: 'core-0' } } } } }).call();
  assert.match(swapped.session.reason, /core identity changed/);
});

test('HC_SOCKET that names the caller core is supported; one naming another core is refused', async t => {
  const shared = await fixture(t, { env: { HC_SOCKET: '/tmp/y.sock', HC_TERMINAL_SOCKET: '/tmp/y.sock', HC_SESSION: 'b' } }).call();
  assert.equal(shared.session.status, 'supported');
  assert.equal(shared.session.cliSocket, '/tmp/y.sock');
  const { call, dialed } = fixture(t, { env: { HC_SOCKET: '/tmp/elsewhere.sock' } });
  const split = await call();
  assert.equal(split.session.status, 'unavailable');
  assert.match(split.session.reason, /hc CLI would address \/tmp\/elsewhere.sock/);
  assert.deepEqual(dialed, []);
});

test('other CLI socket mismatches refuse before dialing', async t => {
  for (const env of [{ HC_SESSION: 'other' }, { HC_TERMINAL_SOCKET: undefined }, { XDG_RUNTIME_DIR: '/run/user/1' }]) {
    const { call, dialed } = fixture(t, { env });
    assert.equal((await call()).session.status, 'unavailable');
    assert.deepEqual(dialed, []);
  }
  const { call, dialed } = fixture(t);
  assert.match((await call({ platform: 'win32' })).session.reason, /unverified on Windows/);
  assert.deepEqual(dialed, []);
});

test('any configured socket key, quoted or bare, refuses; a comment does not', async t => {
  for (const config of ['socket = "/x.sock"\n', '"socket" = "/x.sock"\n', "'socket'='/x.sock'\n", '[core]\n  socket = "/x"\n', 'core.socket = "/x"\n']) {
    const { call, dialed } = fixture(t, { config });
    const report = await call();
    assert.equal(report.session.status, 'unavailable', config);
    assert.match(report.session.reason, /sets a socket/);
    assert.deepEqual(dialed, []);
  }
  assert.equal((await fixture(t, { config: '# socket = "/x"\nnotes = false\n' }).call()).session.status, 'supported');
  assert.equal(mentionsSocketKey('sockets_dir = 1'), false);
});

test('core status failure and version drift are reported, not assumed', async t => {
  const down = await fixture(t, { replies: { 'server.status': { error: { message: 'reset', data: { kind: 'io' } } } } }).call();
  assert.match(down.session.reason, /server.status did not answer: io/);
  const drift = await fixture(t, { versions: { 'hc --version': ok('hc 0.2.0') }, replies: { 'server.status': { result: { core: { id: 'core-1', name: 'mac' }, version: '0.2.0' } } }, zstackVersion: '0.23.0' }).call();
  assert.equal(drift.session.status, 'supported');
  assert.equal(drift.hc.status, 'untested');
  assert.equal(drift.core.status, 'untested');
  assert.equal(drift.zstack.status, 'untested');
});

test('missing binaries and missing zstack are unavailable', async t => {
  const report = await fixture(t, { versions: { 'hc --version': missing, 'herdr-app --version': missing }, zstackVersion: null }).call();
  assert.match(report.session.reason, /hc is unavailable: ENOENT/);
  assert.equal(report.herdrApp.status, 'unavailable');
  assert.equal(report.zstack.status, 'unavailable');
  assert.equal(operation(report, 'shared-instructions').status, 'unavailable');
});

test('the detected host copy decides zstack status; another host copy cannot stand in', async t => {
  const home = tempHome(t);
  registerClaude(path.join(home, '.claude'), zstackAt(path.join(home, 'src'), { nativeHosts: false }));
  zstackAt(path.join(home, '.codex/plugins/cache/local/zstack/0.22.0'));
  const report = await fixture(t).call({ home, env: { CLAUDECODE: '1' } });
  assert.equal(report.zstack.status, 'unavailable');
  assert.equal(report.zstack.path, path.join(home, 'src'));
  assert.match(report.zstack.reason, /native-host contract/);
  assert.equal(operation(report, 'shared-instructions').status, 'unavailable');
  const codex = await fixture(t).call({ home, env: { CODEX_THREAD_ID: 'x' } });
  assert.equal(codex.zstack.status, 'supported');
  assert.equal(codex.zstack.path, path.join(home, '.codex/plugins/cache/local/zstack/0.22.0'));
});

test('without a detected host, differing copies need --host; one path is supported', async t => {
  const home = tempHome(t);
  registerClaude(path.join(home, '.claude'), zstackAt(path.join(home, 'src')));
  zstackAt(path.join(home, '.codex/plugins/cache/local/zstack/0.22.0'));
  const report = await fixture(t).call({ home, env: {} });
  assert.equal(report.zstack.status, 'untested');
  assert.equal(report.zstack.path, null);
  assert.match(report.zstack.reason, /pass --host or --zstack/);
  assert.equal((await fixture(t).call({ home, env: {}, host: 'claude' })).zstack.path, path.join(home, 'src'));
  assert.equal((await fixture(t).call({ home, env: {}, zstack: path.join(home, 'src') })).zstack.status, 'supported');
});

test('CLAUDE_CONFIG_DIR and CODEX_HOME locate installed zstack', t => {
  const home = tempHome(t), claude = tempHome(t), codex = tempHome(t);
  registerClaude(claude, zstackAt(path.join(claude, 'src')));
  zstackAt(path.join(codex, 'plugins/cache/local/zstack/0.22.0'));
  const found = discoverZstack({ home, env: { CLAUDE_CONFIG_DIR: claude, CODEX_HOME: codex } });
  assert.deepEqual(found.map(c => [c.host, c.path]), [['claude', path.join(claude, 'src')], ['codex', path.join(codex, 'plugins/cache/local/zstack/0.22.0')]]);
  assert.deepEqual(discoverZstack({ home, env: {} }), []);
});

test('only version commands are allowlisted', () => {
  assert.ok(isAllowed('hc', ['--version']));
  for (const args of [['server', 'status', '--json'], ['get', 't16', '--json'], ['templates', '--json'], ['run', '--bg', 'claude'], ['send', 't16', 'x']]) assert.equal(isAllowed('hc', args), false);
  assert.equal(isAllowed('sh', ['-c', 'hc --version']), false);
});

test('CLI socket mirrors hc placement and honors HC_SOCKET', () => {
  assert.equal(cliSocket({}, '/home/u'), '/home/u/.local/state/herdr-core/default/default.sock');
  assert.equal(cliSocket({ HC_SESSION: 'x', XDG_STATE_HOME: '/s' }, '/home/u'), '/s/herdr-core/x/x.sock');
  assert.equal(cliSocket({ HC_SESSION: 'x', XDG_RUNTIME_DIR: '/r' }, '/home/u'), '/r/herdr-core/x.sock');
  assert.equal(cliSocket({ HC_SESSION: 'x', XDG_RUNTIME_DIR: '/r', HC_SOCKET: '/y.sock' }, '/home/u'), '/y.sock');
});

test('socketRpc speaks line-delimited JSON-RPC and fails closed without a core', async t => {
  const dir = tempHome(t), socket = path.join(dir, 's.sock'), seen = [];
  const server = net.createServer(client => {
    let buffer = '';
    client.on('data', chunk => {
      buffer += chunk;
      for (let end; (end = buffer.indexOf('\n')) >= 0;) {
        const message = JSON.parse(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
        seen.push(message);
        if (message.method === 'hang') client.end();
        else client.write(JSON.stringify(message.method === 'bad' ? { jsonrpc: '2.0', id: message.id, error: { data: { kind: 'x' } } } : { jsonrpc: '2.0', id: message.id, result: message.params }) + '\n');
      }
    });
  });
  await new Promise(resolve => server.listen(socket, resolve));
  t.after(() => server.close());
  assert.deepEqual(await socketRpc(socket, [['a', { n: 1 }], ['bad', {}]]), { ok: true, replies: [{ result: { n: 1 } }, { error: { data: { kind: 'x' } } }] });
  assert.equal(seen[0].jsonrpc, '2.0');
  assert.deepEqual(await socketRpc(socket, [['hang', {}]]), { ok: false, reason: 'connection closed before every reply' });
  assert.equal((await socketRpc(path.join(dir, 'absent.sock'), [['a', {}]])).ok, false);
  assert.equal(fs.existsSync(path.join(dir, 'absent.sock')), false);
});

test('CLI flags without values are usage errors', () => {
  for (const args of [['--zstack'], ['--zstack', '--host', 'claude'], ['--host'], ['--host', 'foo'], ['--bogus']]) {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { PATH: process.env.PATH } });
    assert.equal(result.status, 2, args.join(' '));
    assert.equal(result.stdout, '');
  }
});
