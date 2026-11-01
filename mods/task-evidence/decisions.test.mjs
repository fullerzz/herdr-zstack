import { test } from "node:test";
import assert from "node:assert/strict";
import { DECISION_HEADER, decisionCell, parseDecisions, evidencePointers } from "./decisions.js";

test("cells stay on one line and never start as a spreadsheet formula", () => {
  assert.equal(decisionCell("  two\tcells\nhere "), "  two cells here ");
  for (const lead of ["=", "+", "-", "@"]) assert.equal(decisionCell(`${lead}SUM(A1)`), `'${lead}SUM(A1)`);
  assert.equal(decisionCell("tests green"), "tests green");
});

test("cells preserve filename spaces and guard formulas after leading whitespace", () => {
  assert.equal(decisionCell("a  b.txt"), "a  b.txt");
  assert.equal(decisionCell("why\r\n  now"), "why    now");
  for (const lead of ["=", "+", "-", "@"]) {
    const value = `  ${lead}SUM(A1)  `;
    assert.equal(decisionCell(value), `'${value}`);
    const [row] = parseDecisions(`${DECISION_HEADER}\n${["time", "fix", value, "why", "a  b.txt", "ok"].map(decisionCell).join("\t")}\n`);
    assert.equal(row.decision, value);
    assert.equal(row.evidence, "a  b.txt");
  }
});

test("literal apostrophes round-trip without changing evidence identity", () => {
  for (const value of ["'=evidence.txt", "''=evidence.txt", "'''=evidence.txt", "'-1", "'+1", "'@team", "'  =cell", "'ordinary", "''ordinary", "'", "  '=cell"]) {
    const [row] = parseDecisions(`${DECISION_HEADER}\n${["time", "fix", value, value, value, value].map(decisionCell).join("\t")}\n`);
    for (const column of ["decision", "why", "evidence", "result"]) assert.equal(row[column], value);
    const files = [value, value.slice(1)].map(path => ({ label: path, path }));
    assert.deepEqual(evidencePointers(row.evidence, files), [{ pointer: value, file: 0 }]);
  }
});

test("parsing needs the exact header and keeps malformed rows visible", () => {
  assert.equal(parseDecisions("# Status\n\nnot a log"), null);
  assert.equal(parseDecisions(`ts\tphase\n`), null);
  assert.deepEqual(parseDecisions(`${DECISION_HEADER}\n`), []);
  const rows = parseDecisions(`${DECISION_HEADER}\r\n2026-11-01T00:00:00Z\tfix\tdropped props\tstale\t'-panel.png\ttests green\r\nonly\ttwo\n\n`);
  assert.deepEqual(rows, [
    { ts: "2026-11-01T00:00:00Z", phase: "fix", decision: "dropped props", why: "stale", evidence: "-panel.png", result: "tests green" },
    { malformed: true, raw: "only\ttwo" },
  ]);
});

test("evidence links only to files the panel already lists", () => {
  const files = [{ label: "Task notes", path: "/repo/brief.md" }, { label: "shots/a.png", path: "/repo/shots/a.png" }];
  assert.deepEqual(evidencePointers("shots/a.png, /repo/brief.md, commit 3a9f1c2, /etc/passwd", files), [
    { pointer: "shots/a.png", file: 1 }, { pointer: "/repo/brief.md", file: 0 },
    { pointer: "commit 3a9f1c2", file: -1 }, { pointer: "/etc/passwd", file: -1 },
  ]);
});

test("evidence prefers longest whole listed tokens before comma splitting", () => {
  const files = [
    { label: "short", path: "/tmp/a" },
    { label: "comma,label", path: "/tmp/a,b.txt" },
    { label: "a  b.txt", path: "/tmp/a  b.txt" },
    { label: "longer", path: "/tmp/a,b.txt,c.txt" },
    { label: "single space", path: "/tmp/a b.txt" },
  ];
  assert.deepEqual(evidencePointers("/tmp/a,b.txt", files), [{ pointer: "/tmp/a,b.txt", file: 1 }]);
  assert.deepEqual(evidencePointers("/tmp/a,b.txt,c.txt, comma,label, /tmp/a  b.txt, a  b.txt, /tmp/a,b.txt, /tmp/a,b.txt, /tmp/abc, /tmp/a,b.txt.bak, /unlisted", files), [
    { pointer: "/tmp/a,b.txt,c.txt", file: 3 },
    { pointer: "comma,label", file: 1 },
    { pointer: "/tmp/a  b.txt", file: 2 },
    { pointer: "a  b.txt", file: 2 },
    { pointer: "/tmp/a,b.txt", file: 1 },
    { pointer: "/tmp/a,b.txt", file: 1 },
    { pointer: "/tmp/abc", file: -1 },
    { pointer: "/tmp/a", file: 0 },
    { pointer: "b.txt.bak", file: -1 },
    { pointer: "/unlisted", file: -1 },
  ]);
  assert.deepEqual(evidencePointers("/tmp/a  b.txt.bak", files), [{ pointer: "/tmp/a  b.txt.bak", file: -1 }]);
  assert.deepEqual(evidencePointers("", files), []);
});
