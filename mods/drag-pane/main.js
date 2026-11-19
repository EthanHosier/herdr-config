// Derived from Herdr app 0.1.16 (Apache-2.0).
// Modified to add tab/pane dragging and preserve custom names.
// A pane's header, for layouts that frame their panes:
//   { "tab": "active", "pane": { "header": { "content": { "mod": "drag-pane" } } } }
// Shows the program's icon (the app's program table), the agent's name or
// the terminal's title, the folder, and the agent's status; buttons split, zoom and close
// this pane. Props from the app: { pane, terminal }. Click: focus the pane.

import { View, div, svg, image } from "gpui-kit";
import { h_flex, v_flex, Textarea, TextareaState } from "gpui-base";
import { panes, props, run, theme, home, layout, openOverlay, settings, spaces, terminals, shared, setShared, checking } from "herdr";

// Match the first visible tab frame, including the active child of a stack.
function paneFrame(node) {
  if (!node || node.hidden) return null;
  if (node.content?.tab && node.content.pane) return node.content.pane;
  let children = node.children ?? [];
  if (node.type === "stack") {
    const visible = children.filter(child => !child.hidden);
    children = [visible.find(child => child.id === node.active) ?? visible[0]];
  }
  for (const child of children) {
    const frame = paneFrame(child);
    if (frame) return frame;
  }
  return null;
}

function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

export default class Pane extends View {
  init() {
    this.hovered = false; this.dragStart = null;
    const labels = terminals().find(t => t.address === props()?.terminal)?.labels ?? {};
    this.notesId = labels["herdr.notes-id"];
    this.notesKey = this.notesId ? "agent-notes.text." + this.notesId : null;
    this.input = TextareaState.new({ placeholder: "Write notes…", value: (this.notesKey && shared(this.notesKey)) || "", rows: 4 });
    this.notesLoaded = Boolean(this.notesKey);
    this.input.on("change", (_e, cx) => {
      if (this.notesKey && this.notesLoaded) setShared(this.notesKey, this.input.value());
      cx.notify();
    });
  }

  close() {
    if (!checking() && this.notesKey && this.notesLoaded) setShared(this.notesKey, this.input.value());
  }

  startNotesResize(e, cx) {
    cx.stop_propagation();
    this.dragStart = null;
    const viewport = globalThis.window.viewport_size(), zoom = settings().zoom || 1;
    openOverlay({ mod: "notes-resize", kind: "window", frame: "none", at: { x: 0, y: 0 },
      width: viewport.width / zoom, height: viewport.height / zoom,
      props: { startY: e.position.y, startHeight: paneFrame(layout())?.header?.height ?? 190 } });
  }

  startDrag(e, cx) {
    const start = this.dragStart;
    if (!start || Math.hypot(e.position.x - start.x, e.position.y - start.y) < 4) return;
    this.dragStart = null;
    const p = this.me();
    if (!p?.terminal || panes().filter(other => other.tab === p.tab && other.terminal).length < 2) return;
    const viewport = globalThis.window.viewport_size();
    const zoom = settings().zoom || 1;
    openOverlay({ mod: "tab-drop", kind: "window", frame: "none", at: { x: 0, y: 0 },
      width: viewport.width / zoom, height: viewport.height / zoom,
      props: { mode: "detach", source: p.tab, terminal: p.terminal,
        sourceName: spaces().flatMap(s => s.tabs).find(t => t.id === p.tab)?.named
          ? spaces().flatMap(s => s.tabs).find(t => t.id === p.tab).name : null } });
  }

  me() {
    return panes().find((p) => p.pane === props()?.pane);
  }

  button(t, id, icon, command, args) {
    return div()
      .id(id)
      .p(3)
      .rounded(4)
      .text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", (_e, cx) => { this.dragStart = null; cx.stop_propagation(); })
      .on_click((_e, cx) => {
        cx.stop_propagation();
        run(command, args);
      })
      .child(svg(`mods/drag-pane/${icon}.svg`).size(14));
  }

  render(cx) {
    const t = theme();
    const p = this.me();
    if (!p) return div();
    const labels = terminals().find(t => t.address === p.terminal)?.labels ?? {};
    const savedName = labels["herdr.drag-tab-name"];
    if (labels["herdr.notes-id"] && labels["herdr.notes-id"] !== this.notesId) {
      this.notesId = labels["herdr.notes-id"];
      this.notesKey = "agent-notes.text." + this.notesId;
      this.notesLoaded = false;
      const key = this.notesKey;
      cx.spawn(async cx => {
        if (this.notesKey !== key) return;
        this.input.set_value(shared(key) ?? "");
        this.notesLoaded = true;
        cx.notify();
      });
    }
    const notesOpen = labels["herdr.notes-header"] === "1";
    if (notesOpen && !this.notesWasOpen && this.notesKey) {
      const key = this.notesKey;
      this.notesLoaded = false;
      cx.spawn(async cx => {
        if (this.notesKey !== key) return;
        this.input.set_value(shared(key) ?? "");
        this.notesLoaded = true;
        cx.notify();
      });
    }
    this.notesWasOpen = notesOpen;
    const name = p.mod === "agent-notes" ? "Notes" : savedName || ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell";
    const pic = icon(p.program, 14, t.dim);
    const st = p.status;
    const pane = p.pane;
    const bottom = paneFrame(layout())?.header?.position === "bottom";
    const title = h_flex()
      .id(`pane-head-${pane}`)
      .h(30).w_full().flex_none()
      .px(10)
      .gap(8)
      .items_center()
      .bg(t.background)
      .when(bottom, el => el.border_t(1))
      .when(!bottom, el => el.border_b(1))
      .border_color(t.border)
      .text_size(12)
      .on_hover((hovered, cx) => { this.hovered = hovered; cx.notify(); })
      .on_mouse_down("left", (e, cx) => {
        cx.stop_propagation();
        this.dragStart = { x: e.position.x, y: e.position.y };
      })
      .on_mouse_move((e, cx) => this.startDrag(e, cx))
      .on_mouse_up("left", () => { this.dragStart = null; })
      .on_click(() => run("pane.focus", { pane }))
      .when(Boolean(p.terminal), el => el.on_mouse_down("right", (_e, cx) => {
        cx.stop_propagation();
        openOverlay({ mod: "codex-tab-menu", kind: "popup", width: 240,
          props: { tab: "pane", target: { pane, terminal: p.terminal } } });
      }))
      .when(Boolean(pic), (el) => el.child(pic))
      .child(div().flex_none().truncate().max_w(260).font_medium().text_color(t.foreground).when(Boolean(p.terminal) && panes().filter(other => other.tab === p.tab && other.terminal).length > 1, el => el.cursor_grab()).child(name))
      .child(div().flex_1().truncate().text_color(t.dim).child(folder(p.cwd)))
      .when(st === "working", el => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900)))
      .when(st === "blocked", el => el.child(div().flex_none().px(6).h(18).flex().items_center().rounded(5).bg(t.blocked + "26").text_size(10.5).font_semibold().text_color(t.blocked).child("Needs you")))
      .when(st === "done", el => el.child(div().size(7).flex_none().rounded(4).bg(t.done)))
      .when(this.hovered && p.mod !== "agent-notes", el => el
        .child(this.button(t, `ph-r-${pane}`, "split-right", "pane.split", { direction: "right", pane }))
        .child(this.button(t, `ph-d-${pane}`, "split-down", "pane.split", { direction: "down", pane }))
        .child(this.button(t, `ph-z-${pane}`, p.zoomed ? "unzoom" : "zoom", "pane.zoom", { pane }))
        .child(this.button(t, `ph-x-${pane}`, "close", "pane.close", { pane })))
      .when(p.mod === "agent-notes", el => el.child(this.button(t, `notes-close-${pane}`, "close", "pane.close", { pane })));

    return v_flex().size_full().min_h(0).bg(t.background).child(title)
      .when(notesOpen, el => el.child(v_flex().flex_1().min_h(0).px(12).py(6).gap(5).bg(t.surface).border_b(1).border_color(t.border)
        .child(Textarea.new(this.input).flex_1().min_h(0).w_full().text_size(12).text_color(t.foreground)))
        .child(div().id(`resize-notes-${pane}`).h(6).w_full().flex_none().cursor_row_resize()
          .bg(t.surface).border_t(1).border_color(t.border).hover(s => s.bg(t.selected).border_color(t.accent))
          .on_mouse_down("left", (e, cx) => this.startNotesResize(e, cx))));
  }
}
