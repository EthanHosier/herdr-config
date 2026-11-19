import { View, div } from "gpui-kit";
import { props, shared, setShared, settings, closeOverlay, checking } from "herdr";

export default class NotesResize extends View {
  init(_props, cx) {
    this.initial = props()?.startHeight ?? 70;
    this.original = shared("agent-notes.notes-height") ?? this.initial;
    this.startY = props()?.startY ?? 0;
    this.last = 0;
    this.focus = cx.focus_handle();
    if (!checking()) this.focus.focus();
  }

  resize(e, force = false) {
    const now = Date.now();
    if (!force && now - this.last < 50) return;
    this.last = now;
    const height = Math.max(70, Math.min(600, Math.round(this.initial + (props()?.direction ?? 1) * (e.position.y - this.startY) / (settings().zoom || 1))));
    if (shared("agent-notes.notes-height") !== height) setShared("agent-notes.notes-height", height);
  }

  render() {
    const viewport = globalThis.window.viewport_size(), zoom = settings().zoom || 1;
    return div().id("notes-resize-capture").w(viewport.width / zoom).h(viewport.height / zoom)
      .bg("#00000000").cursor_row_resize().track_focus(this.focus)
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_mouse_move(e => this.resize(e))
      .on_mouse_up("left", (e, cx) => {
        cx.stop_propagation();
        this.resize(e, true);
        closeOverlay(props()?.overlay);
      })
      .on_key_down((e, cx) => {
        if (e.key === "escape") {
          cx.stop_propagation();
          setShared("agent-notes.notes-height", this.original);
          closeOverlay(props()?.overlay);
        }
      });
  }
}
