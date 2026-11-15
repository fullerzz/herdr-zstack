import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const name = 'herdr-zstack';
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const absolute = value => {
  if (typeof value !== 'string' || !path.isAbsolute(value)) throw new Error('installation metadata requires absolute paths');
  return fs.realpathSync(value);
};
const component = value => {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(value)) throw new Error('invalid installation identity');
  return value;
};

export function provenance(root) {
  root = absolute(root);
  const manifests = ['.claude-plugin/plugin.json', '.codex-plugin/plugin.json'].map(file => json(path.join(root, file)));
  if (manifests.some(m => m.name !== name || m.version !== manifests[0].version)) throw new Error('companion manifests disagree');
  component(manifests[0].version);
  const hash = createHash('sha256');
  // Hash shipped execution guidance and code, never local session state or credentials.
  const visit = relative => {
    const file = path.join(root, relative);
    if (fs.lstatSync(file).isSymbolicLink()) throw new Error(`symlink in companion payload: ${relative}`);
    if (fs.statSync(file).isDirectory()) {
      for (const child of fs.readdirSync(file).sort()) visit(`${relative}/${child}`);
    } else hash.update(relative).update('\0').update(fs.readFileSync(file)).update('\0');
  };
  for (const file of ['.claude-plugin/plugin.json', '.codex-plugin/plugin.json', 'skills', 'scripts', 'docs', 'records', 'workflows', 'templates']) visit(file);
  for (const file of ['skills/hc-workflow/SKILL.md', 'scripts/preflight.mjs']) fs.accessSync(path.join(root, file));
  return { path: root, version: manifests[0].version, sha256: hash.digest('hex') };
}

// The host computes enabled state from its own settings precedence; this helper never re-derives it.
// `cwd` must be the directory where the listing was captured: Claude matches project and local
// installations to that exact directory, not to an enclosing Git root.
export function resolveCompanion({ host, home = os.homedir(), env = process.env, metadata, cwd = process.cwd() }) {
  const candidates = [];
  if (!metadata) throw new Error(`--metadata must name a fresh \`${host} plugin list --json\` listing`);
  const listing = json(absolute(metadata));
  if (host === 'codex') {
    // Use a fresh `codex plugin list --json` result, never enumerate cache versions.
    if (!Array.isArray(listing.installed)) throw new Error('invalid Codex plugin listing');
    const base = absolute(env.CODEX_HOME || path.join(home, '.codex'));
    for (const entry of listing.installed.filter(p => p.name === name && p.installed && p.enabled)) {
      const market = component(entry.marketplaceName), version = component(entry.version);
      const root = path.join(base, 'plugins/cache', market, name, version);
      candidates.push({ root, version, via: 'codex plugin list', source: entry.source?.source === 'local' ? entry.source.path : null });
    }
  } else if (host === 'claude') {
    // Use a fresh `claude plugin list --json` result captured in the executing checkout.
    if (!Array.isArray(listing)) throw new Error('invalid Claude plugin listing');
    const here = fs.realpathSync(cwd);
    for (const entry of listing.filter(p => typeof p.id === 'string' && p.id.startsWith(`${name}@`) && p.enabled === true)) {
      if (entry.scope === 'project' || entry.scope === 'local') {
        if (typeof entry.projectPath !== 'string' || !path.isAbsolute(entry.projectPath)) throw new Error('invalid Claude project installation');
        // Another project's installation is listed as enabled whenever the plugin id is enabled here.
        if (!fs.existsSync(entry.projectPath) || fs.realpathSync(entry.projectPath) !== here) continue;
      } else if (entry.scope !== 'user') throw new Error(`unsupported Claude installation scope: ${entry.scope}`);
      const registered = { scope: entry.scope, version: entry.version, installPath: entry.installPath };
      // Directory marketplaces load from the source folder; the registered cache can lag behind it.
      if (entry.readFromFolder) candidates.push({ root: entry.readFromFolder, version: entry.folderVersion ?? null, via: 'claude directory marketplace', registered });
      else candidates.push({ root: entry.installPath, version: component(entry.version), via: 'claude plugin list' });
    }
  } else throw new Error('--host must be claude or codex');
  const roots = [...new Set(candidates.map(c => absolute(c.root)))];
  if (roots.length !== 1) throw new Error(roots.length ? 'ambiguous companion installations; select one in the host and restart' : 'missing or disabled companion installation; install or enable it with the host and restart');
  const selected = provenance(roots[0]);
  for (const candidate of candidates) {
    if (candidate.version && candidate.version !== selected.version) throw new Error('installation version mismatch; refresh the host plugin, capture fresh metadata and restart');
    if (candidate.source) {
      if (!fs.existsSync(candidate.source)) throw new Error('local source missing or unreadable; content drift cannot be verified; restore the source or refresh its marketplace registration');
      if (provenance(candidate.source).sha256 !== selected.sha256) throw new Error('installation content mismatch; refresh the host plugin and restart');
    }
  }
  const stale = candidates.filter(c => c.registered && c.registered.version !== selected.version).map(c => c.registered);
  return { status: 'supported', ...selected, via: candidates[0].via, ...(stale.length && { staleRegistrations: stale }) };
}

const emit = (report, code) => {
  console.log(JSON.stringify(report, null, 2));
  return code;
};

export async function main(args) {
  let host, metadata;
  while (args.length) {
    const flag = args.shift(), value = args.shift();
    if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
    if (flag === '--host') host = value;
    else if (flag === '--metadata') metadata = value;
    else throw new Error(`Unknown argument: ${flag}`);
  }
  if (!['claude', 'codex'].includes(host)) throw new Error('--host must be claude or codex');
  if (!metadata || !path.isAbsolute(metadata)) throw new Error('--metadata requires an absolute path to a fresh host plugin listing');
  const bootstrap = { status: 'supported', executable: fs.realpathSync(process.execPath), version: process.version };
  const untested = { status: 'untested' };
  let companion, report;
  try {
    companion = resolveCompanion({ host, metadata });
    const executing = provenance(fileURLToPath(new URL('..', import.meta.url)));
    if (executing.sha256 !== companion.sha256) {
      return emit({ bootstrap, companion: { ...companion, status: 'unavailable', executing,
        reason: 'the loaded companion differs from the host-selected payload',
        action: 'Reload the host skills or restart the session, then use the selected companion launcher' }, session: untested }, 2);
    }
  } catch (error) {
    return emit({ bootstrap, companion: { status: 'unavailable', reason: error.message, action: 'Check host metadata, refresh the selected plugin and restart the host session' }, session: untested }, 2);
  }
  // Selection succeeded; a failure from here on is the selected probe's, not the installation's.
  try {
    const { preflight } = await import(pathToFileURL(path.join(companion.path, 'scripts/preflight.mjs')));
    report = await preflight({ host });
    if (!['supported', 'unavailable'].includes(report?.session?.status)) throw new Error('probe returned no completed session detection');
  } catch (error) {
    return emit({ bootstrap, companion, probe: { status: 'failed', reason: error.message, action: 'Report this probe failure with the companion provenance; the installation was verified, so reinstalling the same payload will not fix it' }, session: untested }, 2);
  }
  return emit({ ...report, companion, bootstrap }, report.session.status === 'supported' ? 0 : 1);
}

if (process.argv[1] && fs.existsSync(process.argv[1]) && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Finish module evaluation before importing a probe that imports provenance from here.
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }).catch(error => {
    emit({ bootstrap: { status: 'failed', reason: error.message }, session: { status: 'untested' } }, 2);
    process.exitCode = 2;
  });
}
