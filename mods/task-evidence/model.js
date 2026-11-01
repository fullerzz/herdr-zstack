/** @import { AgentInfo, SpaceInfo } from "herdr" */
/** @import { TaskRecord } from "./task-record.js" */

/**
 * The layout's Task & Evidence block props. Every field is optional and untrusted.
 * @typedef {object} PanelConfig
 * @property {string} [title]
 * @property {string} [folder] Absolute; relative file props resolve against it.
 * @property {string} [space] Space ID that links live activity.
 * @property {string | null} [machine] Null is this computer.
 * @property {string} [notes]
 * @property {string} [acceptance]
 * @property {string} [handoff]
 * @property {string} [decisions] Decision log in show-me-your-work TSV.
 * @property {{ label?: string, path: string }[]} [artifacts]
 * @property {string} [record] Shorthand for one task record.
 * @property {string} [run] Shorthand for one run index.
 * @property {any[]} [tasks] Candidate {@link TaskChoice} entries; `taskChoices` drops invalid ones.
 * @property {string} [board] Absolute path to the coordinator board.
 */

/**
 * One selectable task. Names exactly one absolute `record` or `run`.
 * @typedef {object} TaskChoice
 * @property {string} label
 * @property {string} [record]
 * @property {string} [run]
 * @property {string | null} [machine]
 * @property {boolean} [board] Listed by the board rather than the layout.
 */

/** @typedef {{ label: string, path: string }} EvidenceFile */

/**
 * @typedef {object} TaskActivity
 * @property {AgentInfo[]} owned Always empty: the host exposes no ownership proof.
 * @property {AgentInfo[]} unverified
 * @property {string} reason
 */

/**
 * @param {Pick<PanelConfig, "folder" | "notes" | "acceptance" | "handoff" | "decisions" | "artifacts">} props
 * @returns {EvidenceFile[]} Only files with an absolute or folder-resolved path.
 */
export function filesFor(props) {
  /** @param {string} label @param {unknown} path @returns {EvidenceFile | null} */
  const file = (label, path) => {
    if (typeof path !== "string" || !path) return null;
    const resolved = path.startsWith("/") ? path : props.folder?.startsWith("/") ? `${props.folder.replace(/\/$/, "")}/${path}` : null;
    return resolved ? { label, path: resolved } : null;
  };
  return [file("Task notes", props.notes), file("Acceptance", props.acceptance),
    ...(Array.isArray(props.artifacts) ? props.artifacts.map(a => file(a.label || "Artifact", a.path)) : []),
    file("Handoff", props.handoff), file("Decisions", props.decisions)].filter(Boolean);
}

/**
 * @param {Pick<PanelConfig, "space" | "folder" | "machine">} props
 * @param {SpaceInfo[]} spaces
 * @returns {SpaceInfo | null} Null unless exactly one space matches.
 */
export function taskSpace(props, spaces) {
  const matches = spaces.filter(s => props.space ? s.id === props.space :
    Boolean(props.folder) && s.folder.replace(/\/$/, "") === props.folder.replace(/\/$/, "") && s.machine === (props.machine ?? null));
  return matches.length === 1 ? matches[0] : null;
}

// Each choice names exactly one absolute task record or run index.
/**
 * @param {PanelConfig} config
 * @returns {TaskChoice[]}
 */
export function taskChoices(config) {
  const shorthand = config.record ? [{ label: config.title || "Task", record: config.record, machine: config.machine }] :
    config.run ? [{ label: config.title || "Roster", run: config.run, machine: config.machine }] : [];
  /** @param {unknown} value */
  const absolute = value => typeof value === "string" && value.startsWith("/");
  return (Array.isArray(config.tasks) ? config.tasks : shorthand)
    .filter(task => task && typeof task === "object" && absolute(task.record) !== absolute(task.run) &&
      [task.record, task.run].every(value => value === undefined || absolute(value)));
}

/**
 * @param {TaskRecord} record
 * @returns {EvidenceFile[]}
 */
export function recordFiles(record) {
  return filesFor({ folder: record.checkout, notes: record.brief, handoff: record.handoff, decisions: record.decisions,
    artifacts: [...record.artifacts, ...(record.receipt?.evidence ?? [])].map(path => ({ label: path, path })) });
}

// The installed AgentInfo exposes neither core nor occupant: address alone cannot prove ownership.
/**
 * @param {TaskRecord | null} record
 * @param {AgentInfo[]} live Agents in the task's linked space.
 * @returns {TaskActivity}
 */
export function taskActivity(record, live) {
  return { owned: [], unverified: live, reason: record?.worker ? "Worker binding recorded; live core and occupant identity unavailable." : "No worker binding recorded." };
}
