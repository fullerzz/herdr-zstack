import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dirname, '..');
const files = dir => fs.readdirSync(path.join(root, dir), { recursive: true })
  .filter(name => name.endsWith('.md')).map(name => path.join(dir, name));
const shipped = [...files('skills'), ...files('templates')];
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// Each rule below comes from a defect an interrogation reproduced live.
test('shipped instructions avoid reproduced hc pitfalls', () => {
  for (const file of shipped) {
    const text = read(file);
    // Claude Code's Bash tool backgrounds commands after 120 s, hc's default wait is 180 s.
    assert.doesNotMatch(text, /--timeout 1[2-9]\d\b|--timeout [2-9]\d\d\b/, `${file}: wait timeout at or over the host limit`);
    // Terminal names are unique across the core; a fixed name collides between agents.
    assert.doesNotMatch(text, /--name ci\b|hc wait ci\b/, `${file}: fixed terminal name`);
    // A --rm terminal that exits before anyone waits is removed with its exit code.
    assert.doesNotMatch(text, /hc run [^\n`]*--bg[^\n`]*--rm|hc run [^\n`]*--rm[^\n`]*--bg|Add `--rm`/, `${file}: background --rm loses results`);
    // Read literally, "two directories above" a SKILL.md lands in skills/, not the plugin root.
    assert.doesNotMatch(text, /two directories above/, `${file}: ambiguous root path`);
    // A bare `<command>` hides that one argument with a space or shell syntax runs under `sh -c` and other argv runs with no shell.
    assert.doesNotMatch(text, /--cwd <checkout> <command>/, `${file}: launch recipe without an explicit command form`);
  }
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
});

const section = (text, start, end) => text.slice(text.indexOf(start), text.indexOf(end, text.indexOf(start)));
const operations = read('skills/hc-workflow/references/operations.md');
const launch = section(operations, '## 3. Launch', '## 4. Collect');
// Fenced sh blocks with backslash continuations joined, so one entry is one command.
const commands = text => [...text.matchAll(/```sh\n([\s\S]*?)```/g)]
  .flatMap(([, block]) => block.replace(/\s*\\\n\s*/g, ' ').split('\n'));
const templateNames = ['z-agent-claude', 'z-agent-codex', 'comment-sicko-claude', 'comment-sicko-codex'];

test('ordinary launches start from an installed role template with explicit routing', () => {
  assert.doesNotMatch(operations, /<cli and flags>/);
  const [first] = commands(launch).filter(line => line.startsWith('hc run'));
  assert.match(first, /--label role=<role> <template> "Task <task>\. Read your brief at <brief path> and follow it\. Read z-mode first: <absolute z-mode SKILL\.md path>\. Coordinator address: <coord>\. Report path: <report path>\."$/);
  for (const name of templateNames) assert.match(launch, new RegExp('`' + name + '`'));
  assert.match(launch, /### Direct launches\n\nLaunch a CLI directly only in these cases:/);
  assert.match(launch, /\[seats\]\(seats\.md\), never a template/);
  assert.match(launch, /\[explorers\]\(explorers\.md\)\. The templates do not enforce read-only behavior/);
  assert.match(read('skills/hc-workflow/references/explorers.md'), /installed role templates do not apply these restrictions\. Do not use them for read-only members/);
  const lifecycle = read('docs/worker-lifecycle.md');
  assert.match(lifecycle, /from the matching installed role template: `hc run --bg --json --name <task> --cwd <checkout> <template> "<task>"`/);
  assert.match(lifecycle, /The task names the task ID, the absolute z-mode `SKILL\.md` path, the coordinator's literal address and the report path/);
  assert.match(read('docs/installation.md'), /Coordinators\nlaunch ordinary workers from these templates by default/);
});

test('readiness follows the launch recipe, so restricted seats keep their modes', () => {
  const readiness = launch.slice(launch.indexOf('**Readiness.**'), launch.indexOf('3. **First-message delivery.**'));
  assert.match(readiness, /in the mode its launch recipe sets/);
  for (const mode of ['`dontAsk`', '`acceptEdits`', '`--ask-for-approval never`']) assert.ok(readiness.includes(mode), mode);
  assert.match(readiness, /Never add auto mode or `--approve-for-me` to a restricted launch/);
  assert.match(launch, /Seats and read-only members use their own recipes instead/);
  // These are the modes readiness must accept; they must stay in the recipes it names.
  const seats = read('skills/hc-workflow/references/seats.md');
  for (const flag of ['--permission-mode dontAsk', '--permission-mode acceptEdits', '--ask-for-approval never']) assert.ok(seats.includes(flag), flag);
});

test('a per-run model override replaces an installed model option', () => {
  assert.match(launch, /If it already has a model option from an installed override .*, replace that option's value\. Otherwise add the option at the end/);
  assert.match(launch, /Never pass the option twice/);
});

test('Codex launches keep daemon isolation and compatible approval flags', () => {
  const docs = [...shipped, 'docs/installation.md', 'docs/worker-lifecycle.md'];
  const launches = docs.flatMap(file => [
    ...commands(read(file)).filter(line => /^hc run .* codex /.test(line)),
    ...[...read(file).matchAll(/^command: (codex .*)$/gm)].map(match => match[1]),
    ...[...read(file).matchAll(/^\| `[\w-]+` \| `(codex [^`]*)` \|$/gm)].map(match => match[1]),
  ].map(command => [file, command]));
  assert.ok(launches.length >= 5, 'expected the template, table and seat launches');
  for (const [file, command] of launches) {
    assert.match(command, /\bcodex --no-daemon\b/, `${file}: ${command}`);
    // Codex rejects --approve-for-me together with either flag.
    if (command.includes('--approve-for-me')) assert.doesNotMatch(command, /--sandbox|--ask-for-approval/, `${file}: ${command}`);
  }
  assert.match(launch, /Launch a Codex worker with `--no-daemon --approve-for-me`/);
  assert.match(launch, /Never combine it with `--sandbox` or `--ask-for-approval`/);
});

test('restricted seats keep their own launches, distinct from template workers', () => {
  const seats = commands(read('skills/hc-workflow/references/seats.md')).filter(line => line.startsWith('hc run'));
  assert.equal(seats.length, 2);
  for (const command of seats) {
    assert.match(command, /--label role=seat /);
    for (const name of templateNames) assert.ok(!command.includes(name), command);
    assert.doesNotMatch(command, /--approve-for-me|--permission-mode auto/);
  }
  assert.match(seats.find(command => command.includes(' codex ')), /--sandbox workspace-write --ask-for-approval never/);
  assert.match(seats.find(command => command.includes(' claude ')), /--permission-mode dontAsk/);
});

test('comment-sicko reports on screen while z-agent writes its assigned report', () => {
  for (const name of templateNames) {
    const text = read(`templates/${name}.md`);
    if (name.startsWith('comment-sicko')) {
      assert.match(text, /^Do not write a report file\./m, name);
      assert.match(text, /done\|blocked>: report on screen"$/m, name);
    } else assert.match(text, /^Write the full report to the report path in the task\./m, name);
  }
  assert.match(operations, /A `comment-sicko` member gets no report path: its templates forbid file writes/);
  assert.match(operations, /saves that screen with `hc read <t>` into its own `\.herdr-tasks\/<task>\/report\.md`/);
});

test('launch stages are checked separately and startup blockers go to the user', () => {
  for (const stage of ['Launch admission', 'Readiness', 'First-message delivery']) assert.match(launch, new RegExp(`\\*\\*${stage}\\.\\*\\*`));
  assert.match(launch, /An absent receipt, a timeout or a transport error means delivery is unknown\. In every case, read the screen before any input/);
  assert.match(launch, /Never answer the dialog, log in, grant trust or widen permissions yourself/);
  // The earlier text told the coordinator to answer the hook-trust dialog itself.
  assert.doesNotMatch(operations, /Answer hook trust with/);
  assert.match(launch, /A provider or model other than the one requested is a coverage change/);
  assert.match(launch, /Never change the model by editing personal configuration/);
});
