import { View, div } from "gpui-kit";
import { v_flex, h_flex, TextView } from "gpui-base";
import { agents, spaces, terminals, theme, readTextFile, writeTextFile, run, props, watchFolder } from "herdr";
import { filesFor, taskSpace, taskChoices, recordFiles, taskActivity } from "./model.js";

import { readMember, readRoster, rosterFacts, factKey } from "./roster.js";
import { readBoard, boardKey, completedTask, evidenceFolder, parentFolder, removeEntry } from "./board.js";
import { parseDecisions, evidencePointers } from "./decisions.js";
/** @import { AsyncContext, ClickEvent, Color, Context } from "gpui-kit" */
/** @import { EvidenceFile, PanelConfig, TaskChoice } from "./model.js" */
/** @import { RosterMember, RunIndex, TerminalFact } from "./roster.js" */
/** @import { TaskRecord } from "./task-record.js" */
/** @import { DecisionRow, MalformedRow } from "./decisions.js" */

/** @typedef {{ text?: string | null, at?: string, error?: string }} Snapshot */

export default class TaskEvidence extends View {
  /** @param {unknown} _props @param {AsyncContext} cx */
  init(_props, cx) {
    /** @type {PanelConfig} */
    this.config = props() ?? {};
    /** @type {TaskChoice[]} */
    this.configured = taskChoices(this.config);
    /** @type {TaskChoice[]} */
    this.tasks = this.configured;
    /** @type {TaskChoice[] | null} */
    this.boardTasks = [];
    /** @type {Set<string>} */
    this.cleared = new Set();
    this.clearing = false;
    /** The board key awaiting removal confirmation. @type {string | null} */
    this.confirmRemove = null;
    this.removing = false;
    /** @type {string | null} */
    this.removeState = null;
    /** @type {number} */
    this.taskIndex = 0;
    /** @type {RunIndex | null} */
    this.roster = null;
    /** @type {RosterMember[]} */
    this.members = [];
    this.memberIndex = 0;
    /** @type {TaskRecord | null} */
    this.record = null;
    /** @type {string | null} */
    this.recordState = null;
    /** @type {EvidenceFile[]} */
    this.files = filesFor(this.config);
    this.selected = 0;
    /** @type {Snapshot | null} */
    this.snapshot = null;
    this.loading = false;
    if (typeof this.config.board === "string" && this.config.board.startsWith("/")) this.watchBoard(cx);
    if (this.tasks.length) this.loadTask(cx);
    else this.load(cx);
  }

  close() { this.closed = true; this.boardWatch = this.taskWatch = null; }

  // Reread the board whenever its folder changes. Board entries follow the
  // layout's own tasks; a selection survives while its entry remains.
  /** @param {Context} cx */
  watchBoard(cx) {
    const token = this.boardWatch = {};
    const folder = parentFolder(this.config.board);
    cx.spawn(async cx => {
      for (;;) {
        // Watch before reading, so a board write during the read or a dismissal
        // recheck starts another pass. Before the first task creates the board
        // folder, watch its parent so that first task still appears without a Refresh.
        const changed = watchFolder(folder).catch(() => watchFolder(parentFolder(folder))).then(() => /** @type {const} */ (false), (/** @type {unknown} */ error) => ({ error }));
        await this.readBoardNow(cx);
        if (this.closed || this.boardWatch !== token) return;
        cx.notify();
        const failed = await changed;
        if (failed) {
          if (this.boardWatch !== token) return;
          this.boardWatch = null;
          this.boardState = `${this.boardState ?? ""} Not watching the board (${String(failed.error)}); Refresh rereads it.`;
          cx.notify();
          return;
        }
        if (this.closed || this.boardWatch !== token) return;
      }
    });
  }

  // Null board tasks mean an unreadable board: it lists nothing, but removes
  // no dismissal, so completed entries stay hidden once it reads again.
  /** @param {Context} cx @param {TaskChoice[] | null} boardTasks */
  async applyBoard(cx, boardTasks) {
    const request = this.boardRequest = (this.boardRequest ?? 0) + 1;
    this.boardTasks = boardTasks;
    const listed = boardTasks ?? [];
    if (boardTasks) {
      const keys = new Set(boardTasks.map(boardKey));
      for (const key of this.cleared) if (!keys.has(key)) this.cleared.delete(key);
    }
    // A rolling run reuses its path for new work; a dismissal is not permanent.
    for (const task of listed.filter(task => this.cleared.has(boardKey(task)))) {
      const completed = await completedTask(readTextFile, task);
      if (this.closed || request !== this.boardRequest) return;
      if (!completed) this.cleared.delete(boardKey(task));
    }
    const next = [...this.configured, ...listed.filter(task => !this.cleared.has(boardKey(task)))];
    if (JSON.stringify(next) === JSON.stringify(this.tasks)) return;
    const current = this.tasks[this.taskIndex];
    this.tasks = next;
    // A layout entry and a board entry may point to the same record. Keep the
    // chosen source: board entries own evidence watching and open on status.
    const index = current ? next.findIndex(task => Boolean(task.board) === Boolean(current.board) && boardKey(task) === boardKey(current)) : -1;
    if (index >= 0) { this.taskIndex = index; return; }
    this.taskIndex = 0;
    if (next.length) this.loadTask(cx);
    else {
      // Back to manual mode: discard any task read still in flight.
      this.taskRequest = (this.taskRequest ?? 0) + 1;
      Object.assign(this, { taskWatch: null, watchKey: undefined, reading: false, factKey: undefined, roster: null, members: [],
        memberIndex: 0, record: null, recordState: null, recordAt: null, files: filesFor(this.config), selected: 0 });
      this.load(cx);
    }
  }

  /** @param {Context} cx */
  clearCompleted(cx) {
    if (this.clearing) return;
    this.clearing = true;
    const candidates = this.tasks.filter(task => task.board);
    cx.spawn(async cx => {
      try {
        for (const task of candidates) {
          if (await completedTask(readTextFile, task)) this.cleared.add(boardKey(task));
        }
        if (this.closed) return;
        await this.applyBoard(cx, this.boardTasks);
      } finally {
        this.clearing = false;
        if (!this.closed) cx.notify();
      }
    });
    cx.notify();
  }

  // Board reads can finish out of order; only the newest read is applied.
  /** @param {Context} cx */
  async readBoardNow(cx) {
    const read = this.boardRead = (this.boardRead ?? 0) + 1;
    const { tasks, state } = await readBoard(readTextFile, this.config.board);
    if (this.closed || read !== this.boardRead) return;
    this.boardState = state;
    await this.applyBoard(cx, tasks);
  }

  // Hides a confirmed board entry through the panel's removal list. The board
  // file, record and evidence stay unchanged.
  /** @param {Context} cx @param {TaskChoice} task */
  removeTask(cx, task) {
    if (this.removing) return;
    this.removing = true;
    cx.spawn(async cx => {
      try {
        this.removeState = await removeEntry(readTextFile, writeTextFile, this.config.board, task);
        if (this.closed) return;
        this.confirmRemove = null;
        // The board watch rereads too; this covers a board that cannot be watched.
        await this.readBoardNow(cx);
      } finally {
        this.removing = false;
        if (!this.closed) cx.notify();
      }
    });
    cx.notify();
  }

  // A local board roster may keep its members in separate checkouts. Retain
  // unchanged subscriptions; removed folders and old selections lose authority.
  /** @param {Context} cx @param {TaskChoice} choice @param {{ path: string }[]} [members] */
  watchTask(cx, choice, members = []) {
    const local = choice.board && !choice.machine;
    const key = local ? boardKey(choice) : null;
    if (key !== this.watchKey) {
      /** @type {string | null | undefined} */
      this.watchKey = key;
      /** @type {Map<string, object> | null} */
      this.taskWatch = null;
    }
    const watches = this.taskWatch ?? new Map();
    this.taskWatch = watches;
    const folders = new Set(local ? [evidenceFolder(choice), ...members.map(member => evidenceFolder({ record: member.path }))].filter(Boolean) : []);
    for (const folder of watches.keys()) if (!folders.has(folder)) watches.delete(folder);
    for (const folder of folders) {
      if (watches.has(folder)) continue;
      const token = {};
      watches.set(folder, token);
      const current = () => !this.closed && this.taskWatch === watches && watches.get(folder) === token;
      cx.spawn(async cx => {
        while (current()) {
          try { await watchFolder(folder); }
          catch { if (current()) watches.delete(folder); return; }
          if (!current()) return;
          this.loadTask(cx, { keep: true });
          cx.notify();
        }
      });
    }
  }

  // Manual refresh and task selection clear evidence first. A fact-driven
  // refresh (`keep`) leaves it visible and preserves the member and file.
  /** @param {Context} cx @param {{ keep?: boolean }} [options] */
  loadTask(cx, { keep = false } = {}) {
    const choice = this.tasks[this.taskIndex];
    const machine = choice.machine ?? null;
    this.watchTask(cx, choice, this.watchKey === boardKey(choice) ? this.members : []);
    const request = this.taskRequest = (this.taskRequest ?? 0) + 1;
    this.reading = true;
    if (!keep) {
      this.request = (this.request ?? 0) + 1;
      Object.assign(this, { roster: null, members: [], memberIndex: 0, record: null, files: [], snapshot: null,
        selected: 0, recordAt: null, loading: false, factKey: undefined,
        recordState: choice.run ? "Reading run index…" : "Reading task record…" });
    }
    cx.spawn(async cx => {
      // Facts seen before the read: a change during it differs and rereads again.
      const before = terminals();
      /** @type {RunIndex | null} */
      let roster = null;
      /** @type {RosterMember[]} */
      let members;
      /** @type {string} */
      let state;
      if (choice.run) ({ run: roster, members, state } = await readRoster(readTextFile, choice.run, machine));
      else {
        const member = await readMember(readTextFile, choice.record, machine);
        members = [{ taskId: member.record?.taskId ?? null, ...member }];
        state = member.state;
      }
      if (this.closed || request !== this.taskRequest) return;
      const shown = { taskId: this.members[this.memberIndex]?.taskId, file: this.files[this.selected] };
      this.reading = false;
      this.roster = roster;
      this.members = members;
      this.watchTask(cx, choice, members);
      this.recordState = state;
      this.recordAt = new Date().toLocaleTimeString();
      /** @type {string | undefined} */
      this.factKey = factKey(rosterFacts({ runId: roster?.runId ?? null, members }, before, machine));
      this.selectMember(cx, keep ? Math.max(0, members.findIndex(m => m.taskId === shown.taskId)) : 0, keep ? shown.file : null);
      cx.notify();
    });
  }

  /** @param {Context} cx @param {number} index @param {EvidenceFile | null} [selectedFile] File to keep selected. */
  selectMember(cx, index, selectedFile = null) {
    this.memberIndex = index;
    this.record = this.members[index]?.record ?? null;
    const files = this.record ? recordFiles(this.record) : [];
    const selected = selectedFile ? files.findIndex(f => f.path === selectedFile.path && f.label === selectedFile.label) : -1;
    const keep = selected >= 0;
    this.files = files;
    // A tracked board task opens on its status file, which its coordinator updates.
    const status = this.tasks[this.taskIndex]?.board ? files.findIndex(f => f.label === "Handoff") : -1;
    this.selected = keep ? selected : Math.max(0, status);
    if (!keep) this.snapshot = null;
    if (this.record) this.load(cx, { keep });
  }

  /** @param {Context} cx @param {{ keep?: boolean }} [options] */
  load(cx, { keep = false } = {}) {
    const file = this.files[this.selected];
    const request = this.request = (this.request ?? 0) + 1;
    if (!keep) this.snapshot = null;
    this.loading = Boolean(file) && !keep;
    if (!file) return;
    const taskMachine = this.tasks.length ? this.tasks[this.taskIndex].machine ?? null : null;
    cx.spawn(async cx => {
      let snapshot;
      try {
        const linked = taskSpace(this.config, spaces());
        if (!this.tasks.length && this.config.machine === undefined && this.config.space && !linked) {
          throw new Error("Space unavailable; configure machine explicitly before reading its files.");
        }
        const text = await readTextFile(file.path, { on: this.tasks.length ? taskMachine : this.config.machine !== undefined ? this.config.machine : linked?.machine ?? null });
        snapshot = { text, at: new Date().toLocaleTimeString() };
      } catch (error) {
        snapshot = { error: String(error) };
      }
      // A slow read must not replace a newer file selection or refresh.
      if (request !== this.request) return;
      this.snapshot = snapshot;
      this.loading = false;
      cx.notify();
    });
  }

  /** @param {Context} cx */
  render(cx) {
    // The host declares theme() as plain strings; its colors are hex values.
    const t = /** @type {Record<string, Color>} */ (theme());
    const choice = this.tasks[this.taskIndex];
    const facts = this.members.length ? rosterFacts({ runId: this.roster?.runId ?? null, members: this.members }, terminals(), choice?.machine ?? null) : null;
    if (facts && !this.reading && this.factKey !== undefined) {
      const key = factKey(facts);
      // Core facts changed for this roster: reread durable records. Status is
      // activity only, so nothing here is promoted to acceptance.
      if (key !== this.factKey) { this.factKey = key; this.loadTask(cx, { keep: true }); }
    }
    const space = taskSpace(this.config, spaces());
    const live = space ? agents().filter(a => a.space === space.id) : [];
    const activity = taskActivity(this.record, live);
    const file = this.files[this.selected];
    /** @param {string} text */
    const heading = text => div().text_size(11).font_semibold().text_color(t.muted).child(text);
    /** @param {string} id @param {string} text @param {(event: ClickEvent, cx: Context) => void} onClick */
    const action = (id, text, onClick, selected = false) => div().id(id).px(8).py(5).rounded(5)
      .bg(selected ? t.selected : t.raised).hover(s => s.bg(t.hover)).on_click(onClick).child(text);
    // Board entries get a remove control; layout tasks are not on the board.
    /** @param {TaskChoice} task @param {number} index */
    const taskRow = (task, index) => {
      const label = task.label || task.record || task.run;
      const row = action(`task-${index}`, label, (_event, cx) => {
        this.taskIndex = index; this.loadTask(cx); cx.notify();
      }, index === this.taskIndex);
      if (!task.board) return row;
      const key = boardKey(task);
      if (this.confirmRemove !== key) return h_flex().gap(4).child(row.flex_1())
        .child(action(`remove-${index}`, "✕", (_event, cx) => { this.confirmRemove = key; this.removeState = null; cx.notify(); })
          .tooltip("Remove from board").accessibility_label(`Remove ${label} from board`));
      return v_flex().gap(4).px(8).py(5).rounded(5).bg(t.raised)
        .child(div().child(`Remove “${label}” from the board? Its record and evidence files stay.`))
        .child(h_flex().gap(4)
          .child(action(`remove-confirm-${index}`, this.removing ? "Removing…" : "Remove", (_event, cx) => this.removeTask(cx, task)))
          .child(action(`remove-cancel-${index}`, "Cancel", (_event, cx) => { this.confirmRemove = null; cx.notify(); })));
    };
    /** @param {TerminalFact} term */
    const terminalLine = term => `${term.address}${term.role ? ` · role=${term.role}` : ""}${term.task && !this.members.some(m => m.taskId === term.task) ? ` · task=${term.task}` : ""} · ${term.state ?? "unknown"}${term.status ? ` · ${term.status}` : ""}`;
    /** @param {RosterMember} member @param {number} index */
    const memberRow = (member, index) => {
      const record = member.record;
      const fact = facts?.members[index];
      const receipt = record?.receipt ? `RECEIPT SNAPSHOT: ${record.receipt.decision} · ${record.receipt.revision.commit.slice(0, 12)}` : record ? "No receipt recorded." : null;
      return div().id(`member-${index}`).px(8).py(5).rounded(5).bg(index === this.memberIndex ? t.selected : t.raised)
        .hover(s => s.bg(t.hover)).on_click((_event, cx) => { this.selectMember(cx, index); cx.notify(); })
        .child(v_flex().gap(2)
          .child(div().font_semibold().child(record ? `${member.taskId} · ${record.owner} · ${record.activity} (reported)` : member.taskId))
          .child(div().text_color(t.dim).child(member.state))
          .child(div().text_color(t.dim).child(fact?.binding ?? ""))
          .when(Boolean(receipt), el => el.child(div().text_color(t.dim).child(receipt ?? "")))
          .children((fact?.terminals ?? []).map(term => div().text_size(11).text_color(t.muted).child(terminalLine(term)))));
    };
    let body = "Choose explicit notes and artifact paths in this panel's props. No task is inferred from terminal activity.";
    if (file) {
      if (this.loading) body = "Reading file…";
      else if (this.snapshot?.error) body = `Unable to read file: ${this.snapshot.error}`;
      else if (this.snapshot?.text === null) body = "File not found. No evidence is available at this path.";
      else body = this.snapshot?.text || "This file is empty.";
    } else if (this.roster && !this.record) body = "The selected member has no readable record, so it has no evidence files.";
    // A decision log renders as rows; text without the exact header stays raw.
    const decisions = file?.label === "Decisions" && !this.loading && typeof this.snapshot?.text === "string" ? parseDecisions(this.snapshot.text) : null;
    /** @param {number} index @returns {(event: ClickEvent, cx: Context) => void} */
    const select = index => (_event, cx) => { this.selected = index; this.load(cx); cx.notify(); };
    /** @param {DecisionRow | MalformedRow} row @param {number} index */
    const decisionRow = (row, index) => {
      if ("malformed" in row) return div().text_color(t.dim).child(`Malformed row: ${row.raw}`);
      return v_flex().id(`decision-${index}`).gap(2).px(8).py(5).rounded(5).bg(t.raised)
        .child(div().text_size(10).text_color(t.dim).child(row.phase === "start" ? `── start · ${row.decision} · ${row.ts}` : `${row.ts} · ${row.phase}`))
        .when(row.phase !== "start", el => el.child(div().font_semibold().child(row.decision)))
        .child(div().text_color(t.muted).child(`Why: ${row.why}`))
        .child(h_flex().flex_wrap().gap(4).child(div().text_color(t.dim).child("Evidence:"))
          .children(evidencePointers(row.evidence, this.files).map(({ pointer, file: linked }, j) => linked >= 0 ?
            action(`decision-${index}-evidence-${j}`, `${pointer} ↗`, select(linked)) : div().text_color(t.dim).child(pointer))))
        .child(div().text_color(t.dim).child(`Result (reported): ${row.result}`));
    };
    return v_flex().size_full().min_h(0).bg(t.surface).text_color(t.foreground).text_size(12).p(12).gap(9)
      .child(h_flex().flex_shrink_0().items_center().justify_between()
        .child(div().font_semibold().text_size(15).child("Task & Evidence"))
        .child(h_flex().gap(4)
          .child(action("clear", this.clearing ? "Clearing…" : "Clear", (_event, cx) => this.clearCompleted(cx)))
          .child(action("refresh", "Refresh", (_event, cx) => {
            if (this.config.board?.startsWith?.("/") && !this.boardWatch) this.watchBoard(cx);
            if (this.cleared.size) {
              cx.spawn(async cx => {
                await this.applyBoard(cx, this.boardTasks);
                if (this.closed) return;
                this.tasks.length ? this.loadTask(cx) : this.load(cx);
                cx.notify();
              });
              return;
            }
            this.tasks.length ? this.loadTask(cx) : this.load(cx); cx.notify();
          }))))
      .child(v_flex().id("metadata").flex_1().min_h(0).overflow_y_scrollbar()
        .child(v_flex().flex_shrink_0().gap(9)
          .child(div().text_color(t.muted).child(this.config.title || this.config.folder || "No task configured"))
          .when(Boolean(this.boardState), el => el.child(div().text_color(t.dim).child(this.boardState)))
          .when(this.cleared.size > 0, el => el.child(div().text_color(t.dim).child(`${this.cleared.size} completed entries hidden until panel reload.`)))
          .when(Boolean(this.removeState), el => el.child(div().text_color(t.dim).child(this.removeState ?? "")))
          .child(v_flex().gap(3).children(this.tasks.map(taskRow)))
          .when(Boolean(this.recordState), el => el.child(div().text_color(t.muted).child(this.recordState)))
          .when(Boolean(this.roster), el => el
            .child(heading("ROSTER — EACH RECEIPT IS ITS OWN SNAPSHOT"))
            .child(div().text_color(t.dim).child("Refreshes when core facts for these terminals change; Refresh rereads on demand. Labels locate terminals; they never prove ownership."))
            .child(v_flex().gap(4).children(this.members.map(memberRow)))
            .when(Boolean(facts?.unlisted.length), el => el
              .child(heading("RUN-LABELLED, NOT IN THE INDEX"))
              .child(v_flex().gap(2).children((facts?.unlisted ?? []).map(term => div().text_size(11).text_color(t.muted).child(terminalLine(term))))))
            .child(heading(`SELECTED MEMBER — ${this.members[this.memberIndex]?.taskId ?? "none"}`)))
          .when(Boolean(this.record), el => el.child(div().text_color(t.dim).child(this.record ? `${this.record.taskId} · ${this.record.machine} · ${this.record.activity} (reported)` : "")))
          .when(Boolean(this.record?.receipt), el => el.child(div().text_color(t.dim).child(this.record?.receipt ? `RECEIPT SNAPSHOT: ${this.record.receipt.decision} · ${this.record.receipt.revision.commit} · ${this.record.receipt.revision.worktreeDigest}` : "")))
          .when(Boolean(this.recordAt), el => el.child(div().text_size(10).text_color(t.dim).child(`Record read at ${this.recordAt}`)))
          .when(!this.roster && Boolean(facts?.members[0]?.terminals.length), el => el
            .child(heading("TERMINALS LABELLED FOR THIS TASK — OWNERSHIP UNVERIFIED"))
            .child(v_flex().gap(2).children((facts?.members[0]?.terminals ?? []).map(term => div().text_size(11).text_color(t.muted).child(terminalLine(term))))))
          .when(Boolean(this.record?.worker), el => el.child(TextView.markdown("worker-binding", this.record?.worker ? `Saved worker binding (unconfirmed):\n\n- Core: ${this.record.worker.core}\n- Terminal: ${this.record.worker.terminal}\n- Occupant: ${this.record.worker.occupant}` : "")))
          .child(heading("LIVE ACTIVITY — OWNERSHIP UNVERIFIED"))
          .child(div().text_color(t.dim).child(activity.reason))
          .child(div().text_color(t.dim).child("Agent status reports activity, not acceptance."))
          .child(v_flex().gap(4).children(activity.unverified.length ? activity.unverified.map(a =>
            action(`agent-${a.address}`, `${a.program?.name || a.app || a.address} · ${a.status}`, () => run("agent.focus", { terminal: a.address }))) :
            [div().text_color(t.muted).child(space ? "No agents reporting in this space." : "No unique linked space. Set a space ID to link activity.")]))
          .child(heading("DURABLE RECORD"))
          .child(div().text_color(t.dim).child("File contents are the record. Refresh to read changes."))
          .child(v_flex().gap(3).children(this.files.map((f, index) => action(`file-${index}`, f.label, select(index), index === this.selected))))
          .when(!this.tasks.length && !this.config.acceptance, el => el.child(div().text_color(t.dim).child("No separate acceptance file configured; consult the task notes.")))
          .when(!this.tasks.length && !this.config.artifacts?.length, el => el.child(div().text_color(t.dim).child("No verification artifacts configured.")))
          .when(!this.tasks.length && !this.config.handoff, el => el.child(div().text_color(t.dim).child("No handoff file configured.")))
          .when(Boolean(file), el => el.child(div().text_size(10).text_color(t.muted).child(file.path)))
          .when(Boolean(this.snapshot?.at), el => el.child(div().text_size(10).text_color(t.dim).child(`Read at ${this.snapshot.at}`)))))
      .child(v_flex().id("record").flex_1().min_h(0).overflow_y_scrollbar()
        .when(Boolean(decisions), el => el.child(v_flex().gap(6)
          .child(heading("DECISIONS — REPORTED BY THE COORDINATOR, NOT VERIFIED"))
          .children(decisions?.length ? decisions.map(decisionRow) : [div().text_color(t.dim).child("No decisions logged yet.")])))
        .when(!decisions, el => el.child(TextView.markdown(`record-${this.request}`, body))));
  }
}
