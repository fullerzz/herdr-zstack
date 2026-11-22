import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

function readLaunchOptions() {
  try {
    const { values: { model, effort }, positionals } = parseArgs({
      options: { model: { type: 'string' }, effort: { type: 'string' } },
      allowPositionals: true,
    });
    if (/^[A-Za-z0-9][A-Za-z0-9._:/@-]*$/.test(model ?? '') &&
        /^[a-z]+$/.test(effort ?? '') && positionals.length <= 1) {
      return { model, effort, prompt: positionals[0] };
    }
  } catch {
    // Argument errors can include the review prompt.
  }
  throw new Error('Expected a reviewer model, effort and at most one review prompt');
}

// Codex 0.171.0 gives each `.codex` folder from the project root down to the cwd
// its own saved trust, then falls back to the project root and, for a linked
// worktree, the main checkout. It finds them from the filesystem, never from git.
// Pin the cwd, every parent folder and every main checkout a `.git` file names.
function untrustedRoots() {
  const roots = new Set();
  for (let dir = realpathSync('.'); ; dir = path.dirname(dir)) {
    roots.add(dir);
    for (const root of linkedMainCheckout(dir)) roots.add(root);
    if (path.dirname(dir) === dir) return [...roots];
  }
}

// A linked worktree's `.git` file reads `gitdir: <main>/.git/worktrees/<name>`.
// An extra untrusted pin is harmless, so any `gitdir:` file adds its main checkout.
function linkedMainCheckout(dir) {
  let text;
  try {
    const dotGit = path.join(dir, '.git');
    if (!lstatSync(dotGit).isFile()) return [];
    text = readFileSync(dotGit, 'utf8').trim();
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return [];
    throw new Error('Could not read the checkout .git file');
  }
  if (!text.startsWith('gitdir:')) return [];
  const main = path.resolve(dir, text.slice('gitdir:'.length).trim(), '../../..');
  try {
    return [main, realpathSync(main)];
  } catch {
    return [main];
  }
}

function enabledServers(args) {
  let servers;
  try {
    servers = JSON.parse(execFileSync('codex', [...args, 'mcp', 'list', '--json'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10_000,
    }));
  } catch {
    throw new Error('Could not read the Codex MCP configuration for this checkout');
  }
  if (!Array.isArray(servers) || servers.some(server => typeof server?.enabled !== 'boolean')) {
    throw new Error('Invalid Codex MCP listing');
  }
  return servers.filter(server => server.enabled);
}

try {
  // Check before the MCP probes, so an old Node fails with a clear reason.
  if (typeof process.execve !== 'function') throw new Error('Node 24 or newer is required to start the reviewer');
  const { model, effort, prompt } = readLaunchOptions();
  const untrusted = untrustedRoots().map(root => `${JSON.stringify(root)}={trust_level="untrusted"}`);
  const args = [
    '--no-daemon', '--sandbox', 'read-only', '--ask-for-approval', 'never',
    '--disable', 'apps', '--disable', 'plugins', '--disable', 'hooks', '-c', 'web_search=disabled',
    '--disable', 'multi_agent_v2', '-c', 'agents.enabled=false',
    // Pin trust at both discovery and startup so a trust change cannot add project MCP.
    '-c', `projects={${untrusted.join(',')}}`,
    '-m', model, '-c', `model_reasoning_effort=${effort}`,
  ];
  for (const { name } of enabledServers(args)) {
    if (typeof name !== 'string' || !/^[A-Za-z0-9_-]+$/.test(name)) {
      throw new Error('Invalid enabled Codex MCP server name');
    }
    args.push('-c', `mcp_servers.${name}.enabled=false`);
  }
  if (enabledServers(args).length) throw new Error('A Codex MCP server is still enabled');
  if (prompt !== undefined) args.push('--', prompt);

  // Keep the reviewer in the original hc terminal's foreground process.
  process.execve('/usr/bin/env', ['env', 'codex', ...args], process.env);
} catch (error) {
  console.error(`Alternate harness review blocked: ${error.message}`);
  process.exitCode = 1;
}
