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
    // Read literally, "two directories above" a SKILL.md lands in skills/, not the plugin root.
    assert.doesNotMatch(text, /two directories above/, `${file}: ambiguous root path`);
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
