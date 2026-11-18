import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.join(import.meta.dirname, '..');
const files = dir => fs.readdirSync(path.join(root, dir), { recursive: true })
  .filter(name => name.endsWith('.md')).map(name => path.join(dir, name));
const shipped = [...files('skills'), ...files('templates')];
// validation.md keeps historical output, so only the lifecycle procedure joins the shipped guidance.
const guided = [...shipped, 'docs/worker-lifecycle.md'];
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// Code a reader may paste into one tool call: each fenced line and each inline code span.
const codeUnits = text => [
  ...[...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].flatMap(([, body]) => body.split('\n')),
  ...[...text.replace(/```[\s\S]*?```/g, '').matchAll(/`([^`\n]+)`/g)].map(([, span]) => span),
];

// A coordinator stays reachable only with one wait of at most 90 s per host-tool call.
function supervisionProblems(text) {
  const problems = [];
  for (const [, token] of text.matchAll(/--timeout[ =]([^\s`)'",;]+)/g))
    if (!/^\d+$/.test(token) || Number(token) > 90) problems.push(`wait timeout ${token} is unbounded or over 90 s`);
  // A fenced block is pasted whole, so it may hold only one wait.
  for (const [block] of text.matchAll(/```[^\n]*\n[\s\S]*?```/g))
    if ((block.match(/\bhc wait\b/g) ?? []).length > 1) problems.push(`several waits in one block: ${block}`);
  for (const code of codeUnits(text)) {
    if (/\bhc wait\b.*(?:;|&&|\|\|)\s*hc wait\b/.test(code)) problems.push(`chained waits: ${code}`);
    if (/\b(?:while|until|for)\b.*\bhc wait\b/.test(code)) problems.push(`looped wait: ${code}`);
    if (/\bhc run\b(?:(?! -- ).)* --timeout\b/.test(code)) problems.push(`foreground hc run: ${code}`);
    if (/\|\s*tee\b/.test(code) && !/pipefail/.test(code)) problems.push(`pipe into tee hides failures: ${code}`);
  }
  return problems;
}

test('supervision guard rejects each reproduced bypass', () => {
  for (const bad of ['`hc wait t1 --timeout 91`', '`hc wait t1 --timeout 119`', '`hc wait t1 --timeout=600`',
    '`hc wait t1 --timeout <s>`', '`hc wait a --timeout 90; hc wait b --timeout 90`',
    '`hc wait a --timeout 90 && hc wait b --timeout 90`', '```sh\nwhile true; do hc wait t1 --timeout 90; done\n```',
    '```sh\nhc wait a --timeout 90\nhc wait b --timeout 90\n```',
    '`hc run --timeout 60 --cwd x -- node --test`', '`hc run --bg --name n -- sh -c \'node --test | tee log\'`'])
    assert.notDeepEqual(supervisionProblems(bad), [], bad);
  for (const good of ['`hc wait t1 --timeout 90`', '`hc wait t1 --output "ready" --timeout 30`',
    '`hc run --bg --name n -- bash -o pipefail -c \'a | tee log\'`', 'Wait for exit, `hc wait <t> --timeout 90`'])
    assert.deepEqual(supervisionProblems(good), [], good);
});

// Each rule below comes from a defect an interrogation reproduced live.
test('shipped instructions avoid reproduced hc pitfalls', () => {
  for (const file of guided) assert.deepEqual(supervisionProblems(read(file)), [], file);
  for (const file of shipped) {
    const text = read(file);
    // Terminal names are unique across the core; a fixed name collides between agents.
    assert.doesNotMatch(text, /--name ci\b|hc wait ci\b/, `${file}: fixed terminal name`);
    // A --rm terminal that exits before anyone waits is removed with its exit code.
    assert.doesNotMatch(text, /hc run [^\n`]*--bg[^\n`]*--rm|hc run [^\n`]*--rm[^\n`]*--bg|Add `--rm`/, `${file}: background --rm loses results`);
    // Read literally, "two directories above" a SKILL.md lands in skills/, not the plugin root.
    assert.doesNotMatch(text, /two directories above/, `${file}: ambiguous root path`);
    // A bare `<command>` hides that one argument with a space or shell syntax runs under `sh -c` and other argv runs with no shell.
    assert.doesNotMatch(text, /--cwd <checkout> <command>/, `${file}: launch recipe without an explicit command form`);
    // 120 s is Claude Code's Bash limit; Codex and other hosts have their own.
    for (const line of text.split('\n').filter(line => /\b120[- ]second/.test(line)))
      assert.ok(/Claude/.test(line) || file.includes('claude'), `${file}: 120 s stated without naming Claude: ${line}`);
  }
});

test('coordinator guidance states the supervision bound, check-in and evidence rules', () => {
  for (const file of ['skills/hc-first/SKILL.md', 'skills/hc-workflow/SKILL.md', 'skills/hc-workflow/references/processes.md',
    'skills/hc-workflow/references/operations.md']) {
    const text = read(file);
    assert.match(text, /per tool call/, `${file}: one wait per tool call`);
    assert.match(text, /chain/, `${file}: chained waits prohibited`);
    assert.match(text, /raise the host tool's timeout/, `${file}: raised host timeout prohibited`);
    assert.match(text, /host background job/, `${file}: host background prohibited`);
    assert.match(text, /permission to relaunch/, `${file}: a timeout never permits a relaunch`);
  }
  assert.match(read('docs/worker-lifecycle.md'), /permission to relaunch/);
  for (const file of ['skills/hc-workflow/SKILL.md', 'skills/hc-workflow/references/processes.md'])
    assert.match(read(file), /children\[\]\.exit_code/, `${file}: aggregate waits need per-child results`);
});

test('worker outcomes are distinct and only verification accepts', () => {
  const outcomes = ['Startup failure', 'Delivery missing', 'Blocked or error', 'Report missing', 'Report complete', 'Verified'];
  const operations = read('skills/hc-workflow/references/operations.md');
  for (const outcome of outcomes) assert.match(operations, new RegExp(`^\\| ${outcome} \\|`, 'm'), outcome);
  assert.match(operations, /Only a verified member can be accepted/);
  const lifecycle = read('docs/worker-lifecycle.md');
  for (const outcome of outcomes) assert.match(lifecycle, new RegExp(outcome, 'i'), `lifecycle: ${outcome}`);
});

test('cleanup and retry act on one owned address at a time', () => {
  const operations = read('skills/hc-workflow/references/operations.md');
  assert.match(operations, /Run each command on one address/);
  assert.match(operations, /Before any retry or control, reconcile the member/);
  assert.match(operations, /Reuse a name only after its terminal is removed/);
  assert.match(read('skills/hc-workflow/references/processes.md'), /one address per command/);
  assert.match(read('docs/worker-lifecycle.md'), /one address per command/);
});

test('the recommended compound forms keep a failure visible', () => {
  const status = (shell, ...args) => spawnSync(shell, [...args], { stdio: 'ignore' }).status;
  // Masking forms: the shell reports only the last command.
  assert.equal(status('sh', '-c', 'false | tee /dev/null'), 0);
  assert.equal(status('sh', '-c', 'false; true'), 0);
  // Recommended forms report the failure.
  assert.equal(status('sh', '-c', 'false && true'), 1);
  assert.equal(status('bash', '-o', 'pipefail', '-c', 'false | tee /dev/null'), 1);
});

test('Claude templates allow only end-of-options sends', () => {
  for (const file of files('templates').filter(name => name.includes('claude'))) {
    const command = /^command: (.*)$/m.exec(read(file))[1];
    // Quoting can hide `--force` from any deny pattern; after `--`, hc parses it as text.
    assert.match(command, /--allowedTools 'Bash\(hc send -- \*\)'$/, file);
    assert.doesNotMatch(command, /hc send:\*|hc send \*\)/, file);
  }
});

test('hc-first yields to worker templates and names its root explicitly', () => {
  const text = read('skills/hc-first/SKILL.md');
  assert.match(text, /this file's real path is `<root>\/skills\/hc-first\/SKILL\.md`/);
  assert.match(text, /If you are a worker that a coordinator started, stop unless/);
  assert.match(text, /after `reason: timeout` run `hc read <name>` before waiting again/);
  assert.match(text, /not a routing defect/);
});
