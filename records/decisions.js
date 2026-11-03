// Pure helpers for decision logs in zstack's show-me-your-work TSV format:
// one row per decision.
export const DECISION_COLUMNS = ["ts", "phase", "decision", "why", "evidence", "result"];
export const DECISION_HEADER = DECISION_COLUMNS.join("\t");

/**
 * One well-formed log row; every cell is text. Tell it apart from a
 * {@link MalformedRow} with `"malformed" in row`.
 * @typedef {{ ts: string, phase: string, decision: string, why: string, evidence: string, result: string }} DecisionRow
 */

/** @typedef {{ malformed: true, raw: string }} MalformedRow */

// Guard formulas and escape literal leading quotes so decoding removes only our quote.
/**
 * @param {unknown} value
 * @returns {string}
 */
export function decisionCell(value) {
  const cell = String(value).replace(/[\t\r\n]/g, " ");
  return /^'|^\s*[=+\-@]/.test(cell) ? `'${cell}` : cell;
}

// Returns null unless the text starts with the exact header. A row with the
// wrong number of cells stays visible, marked malformed, with its raw text.
/**
 * @param {string} text
 * @returns {(DecisionRow | MalformedRow)[] | null}
 */
export function parseDecisions(text) {
  const [header, ...lines] = text.replace(/\r\n/g, "\n").split("\n");
  if (header !== DECISION_HEADER) return null;
  return lines.filter(raw => raw.trim()).map(raw => {
    const cells = raw.split("\t");
    if (cells.length !== DECISION_COLUMNS.length) return { malformed: true, raw };
    return /** @type {DecisionRow} */ (Object.fromEntries(DECISION_COLUMNS.map((column, index) => [column, cells[index].replace(/^'(?='|\s*[=+\-@])/, "")])));
  });
}
