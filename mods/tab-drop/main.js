import { runPython } from "./python.js";
import { View, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { props, closeOverlay, exec, appHome, notify, settings, checking, window } from "herdr";

export default class TabDrop extends View {
  init(_props, cx) {
    this.edge = null; this.busy = false;
    this.focus = cx.focus_handle();
    if (!checking()) this.focus.focus();
  }

  choose(e, cx) {
    if (this.busy) return;
    const p = e.local_position, b = e.bounds;
    if (!p || !b) return;
    const x = p.x / Math.max(1, b.width);
    const y = p.y / Math.max(1, b.height);
    let edge = null;
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
      if (props()?.mode === "detach") {
        edge = p.y <= Math.max(72, b.height * 0.12) ? "tab" : null;
      } else {
        if (x < 1 / 3) edge = "left";
        else if (x > 2 / 3) edge = "right";
        else if (y < 1 / 3) edge = "up";
        else if (y > 2 / 3) edge = "down";
      }
    }
    if (edge !== this.edge) { this.edge = edge; cx.notify(); }
  }

  drop(e, cx) {
    if (this.busy) return;
    this.choose(e, cx);
    if (!this.edge || !props()?.terminal) { closeOverlay(props()?.overlay); return; }
    this.busy = true;
    const args = { ...props(), edge: this.edge };
    cx.notify();
    cx.spawn(async cx => {
      try {
        const r = await runPython(exec, [appHome() + "/mods/tab-drop/move.py", JSON.stringify(args)], { timeout: 20000, platform: window().platform });
        if (r.code !== 0) throw new Error(r.stderr || r.stdout || "Move failed");
      } catch (e) {
        notify({ title: "Could not move tab", body: String(e), level: "error" });
      }
      closeOverlay(args.overlay);
    });
  }

  render() {
    const zone = edge => div().flex_1().min_h(0)
      .bg(this.edge === edge && (edge === "up" || edge === "down") ? "#d9dde52e" : "#00000000");
    const viewport = globalThis.window.viewport_size();
    const zoom = settings().zoom || 1;
    const detach = props()?.mode === "detach";
    return v_flex().id("tab-drop-surface").relative().w(viewport.width / zoom).h(viewport.height / zoom).bg("#0b101c33")
      .track_focus(this.focus)
      .on_key_down((e, cx) => {
        if (e.key === "escape" && !this.busy) { cx.stop_propagation(); closeOverlay(props()?.overlay); }
      })
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_mouse_move((e, cx) => this.choose(e, cx))
      .on_mouse_up("left", (e, cx) => { cx.stop_propagation(); this.drop(e, cx); })
      .when(!detach && (this.edge === "left" || this.edge === "right"), el => el
        .child(div().absolute().top(0).left(this.edge === "left" ? 0 : viewport.width / zoom * 2 / 3)
          .w(viewport.width / zoom / 3).h(viewport.height / zoom).bg("#d9dde52e")))
      .when(detach, el => el
        .child(div().h(Math.max(72, viewport.height / zoom * 0.12)).flex_none().flex().items_center().justify_center()
          .bg(this.edge === "tab" ? "#d9dde52e" : "#00000000"))
        .child(div().flex_1()))
      .when(!detach, el => el.child(zone("up"))
      .child(h_flex().flex_1().min_h(0)
        .child(zone("left"))
        .child(div().flex_1())
        .child(zone("right")))
      .child(zone("down")));
  }
}
