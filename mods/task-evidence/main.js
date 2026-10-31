import { View, div } from "gpui-kit";
import { v_flex, h_flex, TextView } from "gpui-base";
import { agents, spaces, theme, readTextFile, run, props } from "herdr";
import { filesFor, taskSpace } from "./model.js";

export default class TaskEvidence extends View {
  init(_props, cx) {
    this.config = props() ?? {};
    this.files = filesFor(this.config);
    this.selected = 0;
    this.snapshot = null;
    this.loading = false;
    this.load(cx);
  }

  load(cx) {
    const file = this.files[this.selected];
    const request = this.request = (this.request ?? 0) + 1;
    this.snapshot = null;
    this.loading = Boolean(file);
    if (!file) return;
    cx.spawn(async cx => {
      let snapshot;
      try {
        const linked = taskSpace(this.config, spaces());
        if (this.config.machine === undefined && this.config.space && !linked) {
          throw new Error("Space unavailable; configure machine explicitly before reading its files.");
        }
        const text = await readTextFile(file.path, { on: this.config.machine !== undefined ? this.config.machine : linked?.machine ?? null });
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
      .child(h_flex().items_center().justify_between()
        .child(div().font_semibold().text_size(15).child("Task & Evidence"))
        .child(action("refresh", "Refresh", (_event, cx) => { this.load(cx); cx.notify(); })))
      .child(div().text_color(t.muted).child(this.config.title || this.config.folder || "No task configured"))
      .child(heading("LIVE ACTIVITY"))
      .child(div().text_color(t.dim).child("Agent status reports activity, not acceptance."))
      .child(v_flex().gap(4).children(live.length ? live.map(a =>
        action(`agent-${a.address}`, `${a.program?.name || a.app || a.address} · ${a.status}`, () => run("agent.focus", { terminal: a.address }))) :
        [div().text_color(t.muted).child(space ? "No agents reporting in this space." : "No unique linked space. Set a space ID to link activity.")]))
      .child(heading("DURABLE RECORD"))
      .child(div().text_color(t.dim).child("File contents are the record. Refresh to read changes."))
      .child(v_flex().gap(3).children(this.files.map((f, index) => action(`file-${index}`, f.label, (_event, cx) => {
        this.selected = index; this.load(cx); cx.notify();
      }, index === this.selected))))
      .when(!this.config.acceptance, el => el.child(div().text_color(t.dim).child("No separate acceptance file configured; consult the task notes.")))
      .when(!this.config.artifacts?.length, el => el.child(div().text_color(t.dim).child("No verification artifacts configured.")))
      .when(!this.config.handoff, el => el.child(div().text_color(t.dim).child("No handoff file configured.")))
      .when(Boolean(file), el => el.child(div().text_size(10).text_color(t.muted).child(file.path)))
      .when(Boolean(this.snapshot?.at), el => el.child(div().text_size(10).text_color(t.dim).child(`Read at ${this.snapshot.at}`)))
      .child(v_flex().id("record").flex_1().min_h(0).overflow_y_scrollbar()
        .child(TextView.markdown(`record-${this.request}`, body)));
  }
}
