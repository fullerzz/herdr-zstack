import { View, div } from "gpui-kit";
import { v_flex, h_flex, TextView } from "gpui-base";
import { agents, spaces, terminals, theme, readTextFile, run, props } from "herdr";
import { filesFor, taskSpace, taskChoices, recordFiles, taskActivity } from "./model.js";

import { readMember, readRoster, rosterFacts, factKey } from "./roster.js";

export default class TaskEvidence extends View {
  init(_props, cx) {
    this.config = props() ?? {};
    this.tasks = taskChoices(this.config);
    this.taskIndex = 0;
    this.roster = null;
    this.members = [];
    this.memberIndex = 0;
    this.record = null;
    this.recordState = null;
    this.files = filesFor(this.config);
    this.selected = 0;
    this.snapshot = null;
    this.loading = false;
    if (this.tasks.length) this.loadTask(cx);
    else this.load(cx);
  }

  // Manual refresh and task selection clear evidence first. A fact-driven
  // refresh (`keep`) leaves it visible and preserves the member and file.
  loadTask(cx, { keep = false } = {}) {
    const choice = this.tasks[this.taskIndex];
    const machine = choice.machine ?? null;
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
      let roster = null, members, state;
      if (choice.run) ({ run: roster, members, state } = await readRoster(readTextFile, choice.run, machine));
      else {
        const member = await readMember(readTextFile, choice.record, machine);
        members = [{ taskId: member.record?.taskId ?? null, ...member }];
        state = member.state;
      }
      if (request !== this.taskRequest) return;
      const shown = { taskId: this.members[this.memberIndex]?.taskId, path: this.files[this.selected]?.path };
      this.reading = false;
      this.roster = roster;
      this.members = members;
      this.recordState = state;
      this.recordAt = new Date().toLocaleTimeString();
      this.factKey = factKey(rosterFacts({ runId: roster?.runId ?? null, members }, before, machine));
      this.selectMember(cx, keep ? Math.max(0, members.findIndex(m => m.taskId === shown.taskId)) : 0, keep ? shown.path : null);
      cx.notify();
    });
  }

  selectMember(cx, index, path = null) {
    this.memberIndex = index;
    this.record = this.members[index]?.record ?? null;
    const files = this.record ? recordFiles(this.record) : [];
    const keep = path !== null && files.some(f => f.path === path);
    this.files = files;
    this.selected = keep ? files.findIndex(f => f.path === path) : 0;
    if (!keep) this.snapshot = null;
    if (this.record) this.load(cx, { keep });
  }

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

  render(cx) {
    const t = theme();
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
    const heading = text => div().text_size(11).font_semibold().text_color(t.muted).child(text);
    const action = (id, text, onClick, selected = false) => div().id(id).px(8).py(5).rounded(5)
      .bg(selected ? t.selected : t.raised).hover(s => s.bg(t.hover)).on_click(onClick).child(text);
    const terminalLine = term => `${term.address}${term.role ? ` · role=${term.role}` : ""}${term.task && !this.members.some(m => m.taskId === term.task) ? ` · task=${term.task}` : ""} · ${term.state ?? "unknown"}${term.status ? ` · ${term.status}` : ""}`;
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
    return v_flex().size_full().min_h(0).bg(t.surface).text_color(t.foreground).text_size(12).p(12).gap(9)
      .child(h_flex().flex_shrink_0().items_center().justify_between()
        .child(div().font_semibold().text_size(15).child("Task & Evidence"))
        .child(action("refresh", "Refresh", (_event, cx) => { this.tasks.length ? this.loadTask(cx) : this.load(cx); cx.notify(); })))
      .child(v_flex().id("metadata").flex_1().min_h(0).overflow_y_scrollbar()
        .child(v_flex().flex_shrink_0().gap(9)
          .child(div().text_color(t.muted).child(this.config.title || this.config.folder || "No task configured"))
          .child(v_flex().gap(3).children(this.tasks.map((task, index) => action(`task-${index}`, task.label || task.record || task.run, (_event, cx) => {
            this.taskIndex = index; this.loadTask(cx); cx.notify();
          }, index === this.taskIndex))))
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
          .when(Boolean(this.record?.worker), el => el.child(TextView.markdown("worker-binding", this.record?.worker ? `Saved worker binding (unconfirmed):\n\n- Core: ${this.record.worker.core}\n- Terminal: ${this.record.worker.terminal}\n- Occupant: ${this.record.worker.occupant}` : "")))
          .child(heading("LIVE ACTIVITY — OWNERSHIP UNVERIFIED"))
          .child(div().text_color(t.dim).child(activity.reason))
          .child(div().text_color(t.dim).child("Agent status reports activity, not acceptance."))
          .child(v_flex().gap(4).children(activity.unverified.length ? activity.unverified.map(a =>
            action(`agent-${a.address}`, `${a.program?.name || a.app || a.address} · ${a.status}`, () => run("agent.focus", { terminal: a.address }))) :
            [div().text_color(t.muted).child(space ? "No agents reporting in this space." : "No unique linked space. Set a space ID to link activity.")]))
          .child(heading("DURABLE RECORD"))
          .child(div().text_color(t.dim).child("File contents are the record. Refresh to read changes."))
          .child(v_flex().gap(3).children(this.files.map((f, index) => action(`file-${index}`, f.label, (_event, cx) => {
            this.selected = index; this.load(cx); cx.notify();
          }, index === this.selected))))
          .when(!this.tasks.length && !this.config.acceptance, el => el.child(div().text_color(t.dim).child("No separate acceptance file configured; consult the task notes.")))
          .when(!this.tasks.length && !this.config.artifacts?.length, el => el.child(div().text_color(t.dim).child("No verification artifacts configured.")))
          .when(!this.tasks.length && !this.config.handoff, el => el.child(div().text_color(t.dim).child("No handoff file configured.")))
          .when(Boolean(file), el => el.child(div().text_size(10).text_color(t.muted).child(file.path)))
          .when(Boolean(this.snapshot?.at), el => el.child(div().text_size(10).text_color(t.dim).child(`Read at ${this.snapshot.at}`)))))
      .child(v_flex().id("record").flex_1().min_h(0).overflow_y_scrollbar()
        .child(TextView.markdown(`record-${this.request}`, body)));
  }
}
