import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Read-only capability preflight for the native hc execution contract.
// It never launches, sends, signals or writes. The hc CLI starts a core on demand
// for any core command, so preflight never runs one: it asks the caller's own
// core directly over `HC_TERMINAL_SOCKET` with read-only JSON-RPC methods.
// A missing core is a failed connection, never a new core.

export const baseline = { hc: '0.1.15', herdrApp: '0.1.10', zstack: '0.22.0', protocol: 1 };

// The only external commands preflight runs; neither contacts a core.
const allowed = [['hc', '--version'], ['herdr-app', '--version']];
export const isAllowed = (command, args) => allowed.some(([name, ...rest]) => name === command && rest.join('\0') === args.join('\0'));

// Read-only core methods. `terminal.get` omits `caller`, which would mark child news as seen.
export const readOnlyMethods = ['hello', 'server.status', 'terminal.get', 'templates.list', 'machine.list'];

function defaultRun(command, args) {
  return new Promise(resolve => execFile(command, args, { timeout: 10_000, maxBuffer: 1 << 20 }, (error, stdout, stderr) => {
    const code = error ? (typeof error.code === 'number' ? error.code : null) : 0;
    resolve({ code, stdout: String(stdout ?? ''), stderr: String(stderr ?? ''), spawnError: error && code === null ? String(error.code ?? error.message) : null });
  }));
}

// JSON-RPC 2.0, one message per line (herdr-core protocol generation 1).
// Resolves to { ok, replies: [{ result } | { error }] } in request order.
export function socketRpc(socket, requests, timeout = 5_000) {
  return new Promise(resolve => {
    const replies = new Array(requests.length);
    let buffer = '', settled = false, pending = requests.length;
    const client = net.connect(socket);
    const done = result => { if (settled) return; settled = true; client.destroy(); resolve(result); };
    client.setTimeout(timeout, () => done({ ok: false, reason: 'timeout' }));
    client.once('error', error => done({ ok: false, reason: error.code ?? error.message }));
    client.once('close', () => done({ ok: false, reason: 'connection closed before every reply' }));
    client.once('connect', () => requests.forEach(([method, params], id) => client.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')));
    client.on('data', chunk => {
      buffer += chunk;
      for (let end; (end = buffer.indexOf('\n')) >= 0;) {
        const message = parseJson(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
        if (!Number.isInteger(message?.id) || message.id < 0 || message.id >= requests.length || replies[message.id]) continue;
        replies[message.id] = 'error' in message ? { error: message.error } : { result: message.result };
        if (--pending === 0) done({ ok: true, replies });
      }
    });
  });
}

// The socket the hc 0.1.15 CLI addresses, as observed on macOS (see docs/validation.md).
export function cliSocket(env, home) {
  if (env.HC_SOCKET) return env.HC_SOCKET;
  const session = env.HC_SESSION || 'default';
  if (env.XDG_RUNTIME_DIR) return path.join(env.XDG_RUNTIME_DIR, 'herdr-core', `${session}.sock`);
  return path.join(env.XDG_STATE_HOME || path.join(home, '.local/state'), 'herdr-core', session, `${session}.sock`);
}

// Any bare, quoted or dotted `socket` key outside a comment; refusing errs toward safety.
export const mentionsSocketKey = text => /(^|[\s.{,])["']?socket["']?\s*=/m.test(text.replace(/#.*$/gm, ''));

const parseJson = text => { try { return JSON.parse(text); } catch { return null; } };
const versionOf = text => text.match(/(\d+\.\d+\.\d+)/)?.[1] ?? null;
const readJson = file => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };
const listDir = dir => { try { return fs.readdirSync(dir); } catch { return []; } };
const rpcError = reply => reply?.error?.data?.kind ?? reply?.error?.message ?? 'no reply';

function versionCheck(result, expected) {
  if (result.code !== 0) return { status: 'unavailable', version: null, reason: result.spawnError ?? `exit ${result.code}` };
  const version = versionOf(result.stdout);
  if (!version) return { status: 'unavailable', version: null, reason: 'unrecognized version output' };
  return version === expected ? { status: 'supported', version }
    : { status: 'untested', version, reason: `differs from inspected baseline ${expected}` };
}

function inspectZstack(root, host, via) {
  const manifest = ['.claude-plugin/plugin.json', '.codex-plugin/plugin.json']
    .map(name => readJson(path.join(root, name))).find(data => data?.name === 'zstack');
  return { host, via, path: root, version: manifest?.version ?? null,
    zMode: fs.existsSync(path.join(root, 'skills/z-mode/SKILL.md')),
    nativeHosts: fs.existsSync(path.join(root, 'skills/z-mode/references/native-hosts.md')) };
}

export function discoverZstack({ home, env = {}, explicit = null }) {
  if (explicit) return [inspectZstack(path.resolve(explicit), null, 'explicit')];
  const candidates = [];
  // Claude Code runs directory-marketplace plugins from their source path, not the cache copy.
  const claude = env.CLAUDE_CONFIG_DIR || path.join(home, '.claude');
  const installed = readJson(path.join(claude, 'plugins/installed_plugins.json'));
  const markets = readJson(path.join(claude, 'plugins/known_marketplaces.json')) ?? {};
  for (const [key, entries] of Object.entries(installed?.plugins ?? {})) {
    if (!key.startsWith('zstack@') || !Array.isArray(entries)) continue;
    const source = markets[key.slice('zstack@'.length)]?.source;
    for (const entry of entries) {
      const root = source?.source === 'directory' && source.path ? source.path : entry?.installPath;
      if (typeof root === 'string') candidates.push(inspectZstack(root, 'claude', source?.source === 'directory' ? 'directory marketplace' : 'plugin cache'));
    }
  }
  const codexCache = path.join(env.CODEX_HOME || path.join(home, '.codex'), 'plugins/cache');
  for (const market of listDir(codexCache)) {
    for (const version of listDir(path.join(codexCache, market, 'zstack'))) candidates.push(inspectZstack(path.join(codexCache, market, 'zstack', version), 'codex', 'plugin cache'));
  }
  return candidates;
}

// Judge only the copies the current host loads; other hosts' copies stay listed as candidates.
function zstackCheck(candidates, host) {
  const result = (status, version, selected, reason) => ({ status, version, path: selected?.path ?? null, ...(reason ? { reason } : {}), candidates });
  if (!candidates.length) return result('unavailable', null, null, 'no installed zstack found; pass --zstack <dir>');
  const relevant = candidates.some(c => c.via === 'explicit') ? candidates : host ? candidates.filter(c => c.host === host) : candidates;
  if (!relevant.length) return result('unavailable', null, null, `no zstack installed for host ${host}; pass --zstack <dir>`);
  const broken = relevant.find(c => !(c.version && c.zMode && c.nativeHosts));
  if (broken) return result('unavailable', broken.version, broken, `${broken.path} lacks a zstack manifest, z-mode or the native-host contract`);
  const versions = [...new Set(relevant.map(c => c.version))];
  if (versions.length > 1) return result('untested', null, null, `installed copies disagree (${versions.join(', ')}); pass --zstack <dir>`);
  const paths = [...new Set(relevant.map(c => c.path))];
  if (paths.length > 1) return result('untested', versions[0], null, 'host not detected and installed copies differ; pass --host or --zstack');
  return versions[0] === baseline.zstack ? result('supported', versions[0], relevant[0])
    : result('untested', versions[0], relevant[0], `differs from inspected baseline ${baseline.zstack}`);
}

function operations(native, checks) {
  // Rows that do not depend on the hc session, including ones this adapter never provides.
  const independent = new Set(['local-edits', 'shared-instructions', 'legacy-pane-agent', 'parent-inheritance', 'assignment-replay']);
  const row = (operation, status, evidence) => native || independent.has(operation) ? { operation, status, evidence }
    : { operation, status: 'unavailable', evidence: 'native session unavailable' };
  return [
    row('local-edits', 'supported', 'host file and execution tools'),
    row('start-worker', 'untested', 'hc run syntax per inspected manual; preflight launches nothing'),
    row('long-check', 'untested', 'hc run with explicit cwd and ownership; not exercised by preflight'),
    row('inspect-collect-wait', 'supported', 'terminal.get resolved the caller; read/wait not exercised'),
    row('interrupt-cleanup', 'untested', 'task-owned hc interrupt/kill/rm; not exercised by preflight'),
    row('remote', checks.machines.status === 'supported' ? 'untested' : 'unavailable', checks.machines.status === 'supported' ? 'machines listed; remote execution not exercised' : 'no connected machines'),
    row('presentation', checks.herdrApp.status === 'unavailable' ? 'unavailable' : 'untested', 'herdr-app version only; status/do not run by preflight'),
    row('shared-instructions', checks.zstack.status, checks.zstack.reason ?? `zstack ${checks.zstack.version}`),
    row('legacy-pane-agent', 'unavailable', 'legacy herdr TUI recipes are not part of the native adapter'),
    row('parent-inheritance', 'unavailable', 'workers get explicit context only'),
    row('assignment-replay', 'unavailable', 'no adapter interface; recovery never reruns a task'),
  ];
}

const unchecked = reason => ({ status: 'unavailable', reason });

export async function preflight({ env = process.env, home = os.homedir(), platform = process.platform, run = defaultRun, rpc = socketRpc, zstack = null, host = null, now = () => new Date() } = {}) {
  const commands = [], requests = [];
  const exec = async (command, ...args) => {
    if (!isAllowed(command, args)) throw new Error(`preflight refused a non-allowlisted command: ${command} ${args.join(' ')}`);
    commands.push([command, ...args].join(' '));
    return run(command, args);
  };
  const legacy = { HERDR_ENV: env.HERDR_ENV ?? null, enablesExecution: false };
  const session = { status: 'unavailable', reason: null, terminalId: env.HC_TERMINAL_ID || null, socket: env.HC_TERMINAL_SOCKET || null, cliSocket: null, legacy };
  const checks = { core: unchecked('not reached'), caller: unchecked('not reached'), templates: unchecked('not reached'), machines: unchecked('not reached') };
  const resolvedHost = host ?? (env.CLAUDECODE === '1' ? 'claude' : env.CODEX_THREAD_ID ? 'codex' : null);

  checks.hc = versionCheck(await exec('hc', '--version'), baseline.hc);
  checks.herdrApp = versionCheck(await exec('herdr-app', '--version'), baseline.herdrApp);
  checks.zstack = zstackCheck(discoverZstack({ home, env, explicit: zstack }), resolvedHost);

  // Dispatch uses the hc CLI, so it must address the caller's core too.
  const configPath = path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), 'herdr-core/config.toml');
  let config = '';
  try { config = fs.readFileSync(configPath, 'utf8'); } catch {}
  const gate = () => {
    if (!session.terminalId) return env.HERDR_ENV === '1' ? 'legacy-only environment: HERDR_ENV=1 without HC_TERMINAL_ID; HERDR_ENV never enables native execution' : 'HC_TERMINAL_ID is not set; not running inside an hc terminal';
    if (checks.hc.status === 'unavailable') return `hc is unavailable: ${checks.hc.reason}`;
    if (!session.socket) return 'HC_TERMINAL_SOCKET is not set; the caller core is unknown';
    if (platform === 'win32') return 'the hc CLI socket placement is unverified on Windows';
    if (mentionsSocketKey(config)) return `${configPath} sets a socket; the hc CLI's core address is unverified`;
    session.cliSocket = cliSocket(env, home);
    if (path.resolve(session.cliSocket) !== path.resolve(session.socket)) return `the hc CLI would address ${session.cliSocket}, not the caller core ${session.socket}`;
    return null;
  };
  session.reason = gate();
  if (!session.reason) {
    const sent = [['hello', { generation: baseline.protocol }], ['server.status', {}], ['terminal.get', { terminal: session.terminalId }], ['templates.list', {}], ['machine.list', {}]];
    requests.push(...sent.map(([method]) => method));
    const answer = await rpc(session.socket, sent);
    const [hello, status, got, templates, machines] = answer.ok ? answer.replies : [];
    const core = status?.result?.core, terminal = got?.result;
    if (!answer.ok) session.reason = `caller core did not answer at ${session.socket} (${answer.reason})`;
    else if (hello?.result?.generation !== baseline.protocol) session.reason = `core protocol generation ${hello?.result?.generation ?? rpcError(hello)} is not ${baseline.protocol}`;
    else if (!core?.id) session.reason = `server.status did not answer: ${rpcError(status)}`;
    else if (core.id !== hello.result.core?.id) session.reason = 'core identity changed between hello and server.status';
    else if (!terminal?.address) session.reason = `terminal.get ${session.terminalId} did not resolve: ${rpcError(got)}`;
    else if (terminal.address !== session.terminalId) session.reason = `terminal.get ${session.terminalId} resolved a different address ${terminal.address}`;
    else if (terminal.state !== 'live') session.reason = `caller terminal ${terminal.address} is ${terminal.state}, not live`;
    if (core?.id) checks.core = { status: status.result.version === baseline.hc ? 'supported' : 'untested', id: core.id, name: core.name ?? null, version: status.result.version ?? null, pid: status.result.pid ?? null,
      ...(status.result.version === baseline.hc ? {} : { reason: `core differs from inspected baseline ${baseline.hc}` }) };
    if (!session.reason) {
      session.status = 'supported';
      checks.caller = { status: 'supported', address: terminal.address, machine: core.name ?? null, state: terminal.state,
        topology: terminal.parent ? { kind: 'child', parent: terminal.parent } : { kind: 'root', parent: null }, name: terminal.name ?? null, template: terminal.template ?? null };
      const names = templates?.result?.templates;
      checks.templates = !Array.isArray(names) ? unchecked(`templates.list failed: ${rpcError(templates)}`)
        : names.length ? { status: 'supported', names: names.map(t => t?.name ?? t) }
          : { status: 'unavailable', names: [], reason: 'no templates; launch interactive CLIs explicitly' };
      const list = machines?.result?.machines;
      const connected = Array.isArray(list) && list.some(m => m?.state === 'connected');
      checks.machines = !Array.isArray(list) ? unchecked(`machine.list failed: ${rpcError(machines)}`)
        : { status: connected ? 'supported' : 'unavailable', items: list.map(m => ({ name: m?.name ?? null, state: m?.state ?? null, version: m?.version ?? null })),
          ...(connected ? {} : { reason: 'no connected machines' }) };
    }
  }

  return {
    schema: 1, generatedAt: now().toISOString(), readOnly: true, baseline, host: resolvedHost,
    session, hc: checks.hc, herdrApp: checks.herdrApp, core: checks.core, caller: checks.caller,
    templates: checks.templates, machines: checks.machines, zstack: checks.zstack,
    operations: operations(session.status === 'supported', checks), commands, requests,
    limits: [
      'A resolved address is not occupant identity: a restored terminal may hold a fresh shell.',
      'Supported means the interface answered; worker launch, delivery, collection and stop need runtime proof.',
      'The hc CLI socket rule mirrors hc 0.1.15 on macOS; re-check it after hc upgrades.',
    ],
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    let zstack = null, host = null;
    const value = flag => {
      const next = args.shift();
      if (!next || next.startsWith('--')) throw new Error(`${flag} requires a value`);
      return next;
    };
    while (args.length) {
      const flag = args.shift();
      if (flag === '--zstack') zstack = value(flag);
      else if (flag === '--host') {
        host = value(flag);
        if (!['claude', 'codex'].includes(host)) throw new Error('--host must be claude or codex');
      } else throw new Error(`Unknown argument: ${flag}`);
    }
    const report = await preflight({ zstack, host });
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.session.status === 'supported' ? 0 : 1;
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
