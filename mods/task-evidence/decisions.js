// Pure helpers for decision logs in zstack's show-me-your-work TSV format:
// one row per decision. Safe to import in the read-only GPUI runtime.
export const DECISION_COLUMNS = ["ts", "phase", "decision", "why", "evidence", "result"];
export const DECISION_HEADER = DECISION_COLUMNS.join("\t");

// Guard formulas and escape literal leading quotes so decoding removes only our quote.
export function decisionCell(value) {
  const cell = String(value).replace(/[\t\r\n]/g, " ");
  return /^'|^\s*[=+\-@]/.test(cell) ? `'${cell}` : cell;
}

// Returns null unless the text starts with the exact header. A row with the
// wrong number of cells stays visible, marked malformed, with its raw text.
export function parseDecisions(text) {
  const [header, ...lines] = text.replace(/\r\n/g, "\n").split("\n");
  if (header !== DECISION_HEADER) return null;
  return lines.filter(raw => raw.trim()).map(raw => {
    const cells = raw.split("\t");
    if (cells.length !== DECISION_COLUMNS.length) return { malformed: true, raw };
    return Object.fromEntries(DECISION_COLUMNS.map((column, index) => [column, cells[index].replace(/^'(?='|\s*[=+\-@])/, "")]));
  });
}

// Prefer the longest listed label/path ending at a comma or end of cell.
// Only unmatched text is split at its next comma; nothing else is read.
export function evidencePointers(evidence, files) {
  const listed = files.flatMap((file, index) => [file.label, file.path]
    .filter(Boolean).map(pointer => ({ pointer, file: index })))
    .sort((a, b) => b.pointer.length - a.pointer.length);
  const pointers = [];
  while (evidence) {
    const match = listed.find(({ pointer }) => evidence.startsWith(pointer) &&
      (evidence.length === pointer.length || evidence[pointer.length] === ","));
    const pointer = match?.pointer ?? evidence.split(",", 1)[0];
    if (pointer) pointers.push(match ?? { pointer, file: -1 });
    evidence = evidence.slice(pointer.length).replace(/^,\s*/, "");
  }
  return pointers;
}
