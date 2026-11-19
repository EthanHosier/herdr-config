// Derived from Herdr app 0.1.16 (Apache-2.0). Modified to rename an agent and its own tab together.
// A text prompt. Enter saves, Esc cancels.
import { runPython } from "./python.js";
import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { run, props, closeOverlay, theme, exec, appHome, window, notify } from "herdr";

export default class Prompt extends View {
  init(_props, cx) {
    this.text = props()?.value ?? "";
    this.input = InputState.new({ value: this.text });
    if (this.text) this.input.set_selected_range({ start: 0, end: this.text.length });
    this.input.on("change", (_e, cx) => { this.text = this.input.value(); cx.notify(); });
    this.input.on("submit", (_e, cx) => this.submit(cx));
    this.inputFocused = true;
    this.input.on("focus", (_e, cx) => { this.inputFocused = true; cx.notify(); });
    this.input.on("blur", (_e, cx) => { this.inputFocused = false; cx.notify(); });
    this.input.focus();
    cx.timer.after(600, () => this.input.focus());
    this.handle = cx.focus_handle();
  }

  submit(cx) {
    if (this.saving) return;
    this.saving = true;
    const p = props();
    cx.spawn(async cx => {
      try {
        const result = await runPython(exec, [appHome() + "/mods/tab-drop/move.py", JSON.stringify({
          mode: "rename-agent", terminal: p.terminal, tab: p.tab, name: this.text,
        })], { platform: window().platform, timeout: 20000 });
        if (result.code !== 0) throw new Error(result.stderr || result.stdout);
        closeOverlay(p.overlay);
      } catch (error) {
        this.saving = false;
        notify({ title: "Could not rename agent", body: String(error), level: "error" });
        cx.notify();
      }
    });
  }

  key(e, cx) {
    if (e.key === "escape") { closeOverlay(props().overlay); cx.stop_propagation(); }
  }

  render() {
    const t = theme();
    const p = props() ?? {};
    const label = (text) => div().pt(16).pb(7).text_size(11.5).text_color(t.dim).child(text);
    const button = (id, text, primary, action) => h_flex().id(id).h(32).px(14).items_center().rounded(8)
      .border_1().border_color(primary ? t.solid : t.input).bg(primary ? t.solid : t.raised)
      .text_color(primary ? t.solid_foreground : t.foreground).text_size(12.5).font_medium().cursor_pointer()
      .hover(s => s.opacity(0.88)).on_click(action).child(text);
    return v_flex().id("prompt").track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .w_full().min_h(0).p(18).bg(t.popover).text_color(t.foreground)
      .child(h_flex().items_center().child(div().flex_1().text_size(15).font_semibold().child((p.title ?? "").replace(/^./, (c) => c.toUpperCase())))
        .child(div().text_size(11).text_color(t.dim).child("Esc")))
      .child(label("Name"))
      .child(Input.new(this.input).h(36).px(10).rounded(9).border_1().border_color(this.inputFocused ? t.accent : t.input).bg(t.background).text_size(12.8).text_color(t.foreground))
      .when(Boolean(p.hint), el => el.child(div().pt(6).text_size(11.5).text_color(t.dim).child(p.hint)))
      .child(h_flex().pt(20).gap(8).justify_end()
        .child(button("pm-cancel", "Cancel", false, () => closeOverlay(p.overlay)))
        .child(button("pm-save", "Save", true, (_e, cx) => this.submit(cx))));
  }
}
