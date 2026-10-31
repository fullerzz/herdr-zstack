import { View, div } from "gpui-kit";
import { v_flex, h_flex, TextView } from "gpui-base";
import { agents, spaces, theme, readTextFile, run, props } from "herdr";
import { filesFor, taskSpace, taskChoices, recordFiles, taskActivity } from "./model.js";

import { parseRecord, acceptanceStatus } from "./task-record.js";

export default class TaskEvidence extends View {
  init(_props, cx) {
    this.config = props() ?? {};
    this.tasks = taskChoices(this.config);
    this.taskIndex = 0;
    this.record = null;
    this.recordState = null;
    this.files = filesFor(this.config);
    this.selected = 0;
    this.snapshot = null;
    this.loading = false;
    if (this.tasks.length) this.loadTask(cx);
    else this.load(cx);
  }

  loadTask(cx) {
    const choice = this.tasks[this.taskIndex];
    const request = this.request = (this.request ?? 0) + 1;
    this.record = null;
    this.files = [];
    this.snapshot = null;
    this.selected = 0;
    this.recordAt = null;
    this.recordState = "Reading task record…";
    this.loading = false;
    cx.spawn(async cx => {
      let record = null;
      let state;
      try {
        const source = await readTextFile(choice.record, { on: choice.machine ?? null });
        if (source === null) state = "Task record missing.";
        else {
          const parsed = parseRecord(source);
          record = parsed.record;
          state = record ? `Acceptance: ${acceptanceStatus(record)}. Current Git revision is not independently observed.` : `Malformed task record: ${parsed.errors.join("; ")}`;
        }
      } catch (error) { state = `Task record unavailable: ${String(error)}`; }
      if (request !== this.request) return;
      this.record = record;
      this.recordState = state;
      this.recordAt = new Date().toLocaleTimeString();
      this.files = record ? recordFiles(record) : [];
      if (record) this.load(cx);
      cx.notify();
    });
  }

  load(cx) {
    const file = this.files[this.selected];
    const request = this.request = (this.request ?? 0) + 1;
    this.snapshot = null;
    this.loading = Boolean(file);
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
    const space = taskSpace(this.config, spaces());
    const live = space ? agents().filter(a => a.space === space.id) : [];
    const activity = taskActivity(this.record, live);
    const file = this.files[this.selected];
    const heading = text => div().text_size(11).font_semibold().text_color(t.muted).child(text);
    const action = (id, text, onClick, selected = false) => div().id(id).px(8).py(5).rounded(5)
      .bg(selected ? t.selected : t.raised).hover(s => s.bg(t.hover)).on_click(onClick).child(text);
    let body = "Choose explicit notes and artifact paths in this panel's props. No task is inferred from terminal activity.";
    if (file) {
      if (this.loading) body = "Reading file…";
      else if (this.snapshot?.error) body = `Unable to read file: ${this.snapshot.error}`;
      else if (this.snapshot?.text === null) body = "File not found. No evidence is available at this path.";
      else body = this.snapshot?.text || "This file is empty.";
    }
    return v_flex().size_full().min_h(0).bg(t.surface).text_color(t.foreground).text_size(12).p(12).gap(9)
      .child(h_flex().flex_shrink_0().items_center().justify_between()
        .child(div().font_semibold().text_size(15).child("Task & Evidence"))
        .child(action("refresh", "Refresh", (_event, cx) => { this.tasks.length ? this.loadTask(cx) : this.load(cx); cx.notify(); })))
      .child(v_flex().id("metadata").flex_1().min_h(0).overflow_y_scrollbar()
        .child(v_flex().flex_shrink_0().gap(9)
          .child(div().text_color(t.muted).child(this.config.title || this.config.folder || "No task configured"))
          .child(v_flex().gap(3).children(this.tasks.map((task, index) => action(`task-${index}`, task.label || task.record, (_event, cx) => {
            this.taskIndex = index; this.loadTask(cx); cx.notify();
          }, index === this.taskIndex))))
          .when(Boolean(this.recordState), el => el.child(div().text_color(t.muted).child(this.recordState)))
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
