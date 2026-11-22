import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
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
  const { model, effort, prompt } = readLaunchOptions();
  const checkout = realpathSync('.');
  const args = [
    '--no-daemon', '--sandbox', 'read-only', '--ask-for-approval', 'never',
    '--disable', 'apps', '--disable', 'plugins', '--disable', 'hooks', '-c', 'web_search=disabled',
    '--disable', 'multi_agent_v2', '-c', 'agents.enabled=false',
    // Pin trust at both discovery and startup so a trust change cannot add project MCP.
    '-c', `projects={${JSON.stringify(checkout)}={trust_level="untrusted"}}`,
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
