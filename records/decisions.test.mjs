import { test } from "node:test";
import assert from "node:assert/strict";
import { DECISION_HEADER, decisionCell, parseDecisions } from "./decisions.js";

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

test("literal apostrophes round-trip unchanged", () => {
  for (const value of ["'=evidence.txt", "''=evidence.txt", "'''=evidence.txt", "'-1", "'+1", "'@team", "'  =cell", "'ordinary", "''ordinary", "'", "  '=cell"]) {
    const [row] = parseDecisions(`${DECISION_HEADER}\n${["time", "fix", value, value, value, value].map(decisionCell).join("\t")}\n`);
    for (const column of ["decision", "why", "evidence", "result"]) assert.equal(row[column], value);
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
