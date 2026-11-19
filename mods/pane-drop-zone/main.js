import { View, div } from "gpui-kit";
import { props, closeOverlay, exec, appHome, notify, window, checking, run } from "herdr";
import { runPython } from "./python.js";

export default class PaneDropZone extends View {
  init(_props, cx) {
    this.edge = null;
    this.focus = cx.focus_handle();
    if (!checking() && props()?.kind === "tab") this.focus.focus();
  }

  choose(e, cx) {
    const p = props();
    let edge = null;
    if (p?.kind === "tab") edge = "tab";
    else if (p?.kind === "pane" && p.targetPane !== p.sourcePane && e.bounds && e.local_position) {
      const x = e.local_position.x / Math.max(1, e.bounds.width), y = e.local_position.y / Math.max(1, e.bounds.height);
      if (x < 0 || x > 1 || y < 0 || y > 1) edge = null;
      else if (x < 0.25) edge = "left";
      else if (x > 0.75) edge = "right";
      else if (y < 0.25) edge = "up";
      else if (y > 0.75) edge = "down";
      else edge = "swap";
    }
    if (edge !== this.edge) { this.edge = edge; cx.notify(); }
  }

  drop(e, cx) {
    if (this.busy) return;
    this.choose(e, cx);
    const p = props();
    if (!this.edge) { closeOverlay(p?.overlay); return; }
    this.busy = true;
    const args = { ...p, edge: this.edge, mode: this.edge === "tab" ? "detach" : "rearrange" };
    if (this.edge === "swap") {
      run("pane.swap", { pane: p.sourcePane, target: p.targetPane });
      closeOverlay(p.overlay);
      return;
    }
    cx.spawn(async cx => {
      try {
        const result = await runPython(exec, [appHome() + "/mods/tab-drop/move.py", JSON.stringify(args)], { platform: window().platform, timeout: 20000 });
        if (result.code !== 0) throw new Error(result.stderr || result.stdout);
      } catch (error) {
        notify({ title: "Could not move pane", body: String(error), level: "error" });
      }
      closeOverlay(p.overlay);
    });
  }

  render() {
    return div().id("pane-drop-zone").relative().size_full().track_focus(this.focus)
      .bg(this.edge ? "#d9dde52e" : "#00000000")
      .on_hover((hovered, cx) => { if (!hovered && this.edge) { this.edge = null; cx.notify(); } })
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_mouse_move((e, cx) => this.choose(e, cx))
      .on_mouse_up("left", (e, cx) => { cx.stop_propagation(); this.drop(e, cx); })
      .on_key_down((e, cx) => { if (e.key === "escape" && !this.busy) { cx.stop_propagation(); closeOverlay(props()?.overlay); } });
  }
}
