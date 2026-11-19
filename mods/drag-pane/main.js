// Derived from Herdr app 0.1.16 (Apache-2.0).
// Modified to add tab/pane dragging and preserve custom names.
// A pane's header, for layouts that frame their panes:
//   { "tab": "active", "pane": { "header": { "content": { "mod": "drag-pane" } } } }
// Shows the program's icon (the app's program table), the agent's name or
// the terminal's title, the folder, and the agent's status; buttons split, zoom and close
// this pane. Props from the app: { pane, terminal }. Click: focus the pane.

import { runPython } from "./python.js";
import { buildDropLayout } from "./drop-layout.js";
import { View, div, svg, image } from "gpui-kit";
import { h_flex, v_flex, Textarea, TextareaState } from "gpui-base";
import { panes, props, run, theme, home, layout, openOverlay, settings, spaces, terminals, shared, setShared, checking, exec, appHome, window, notify } from "herdr";

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
    this.notesKey = this.notesId ? "agent-notes.text." + this.notesId
      : props()?.terminal ? "agent-notes.text.terminal:" + props().terminal : null;
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
      props: { startY: e.position.y, startHeight: paneFrame(layout())?.header?.height ?? 70,
        direction: paneFrame(layout())?.header?.position === "bottom" ? -1 : 1 } });
  }

  startDrag(e, cx) {
    const start = this.dragStart;
    if (!start || Math.hypot(e.position.x - start.x, e.position.y - start.y) < 4) return;
    this.dragStart = null;
    const p = this.me();
    if (!p?.terminal || p.zoomed || panes().filter(other => other.tab === p.tab && other.terminal).length < 2) return;
    if (this.openingDrag) return;
    this.openingDrag = true;
    const machine = spaces().find(s => s.tabs.some(tab => tab.id === p.tab))?.machine;
    const tab = spaces().flatMap(s => s.tabs).find(tab => tab.id === p.tab);
    const args = { source: p.tab, sourcePane: p.pane, terminal: p.terminal,
      sourceName: terminals().find(t => t.address === p.terminal)?.labels?.["herdr.drag-tab-name"] ?? (tab?.named ? tab.name : null) };
    cx.spawn(async cx => {
      try {
        const result = await runPython(exec, [appHome() + "/mods/tab-drop/move.py", JSON.stringify({ mode: "tab-tree", source: p.tab, machine })], { platform: window().platform, timeout: 10000 });
        if (result.code !== 0) throw new Error(result.stderr || result.stdout);
        if (!panes().some(other => other.pane === p.pane)) return;
        const viewport = globalThis.window.viewport_size(), zoom = settings().zoom || 1;
        const overlay = buildDropLayout(layout(), JSON.parse(result.stdout).root, args, machine, paneFrame(layout())?.gap ?? 8);
        openOverlay({ kind: "window", frame: "none", at: { x: 0, y: 0 },
          width: viewport.width / zoom, height: viewport.height / zoom, layout: overlay });
      } catch (error) {
        notify({ title: "Could not start pane move", body: String(error), level: "error" });
      } finally {
        this.openingDrag = false;
      }
    });
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
    const ownTab = spaces().flatMap(space => space.tabs).find(tab => tab.id === p.tab);
    const alone = panes().filter(other => other.tab === p.tab && other.terminal).length === 1;
    const savedName = alone && ownTab?.named ? ownTab.name : labels["herdr.drag-tab-name"];
    if (labels["herdr.notes-id"] && labels["herdr.notes-id"] !== this.notesId) {
      const previousKey = this.notesKey;
      const previousText = this.input.value();
      this.notesId = labels["herdr.notes-id"];
      this.notesKey = "agent-notes.text." + this.notesId;
      this.notesLoaded = false;
      const key = this.notesKey;
      cx.spawn(async cx => {
        if (this.notesKey !== key) return;
        this.input.set_value(shared(key) ?? shared(previousKey) ?? previousText);
        setShared(key, this.input.value());
        this.notesLoaded = true;
        cx.notify();
      });
    }
    const notesOpen = Boolean(p.terminal);
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
      .h(30).w_full().flex_none().relative()
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
      .child(div().flex_none().truncate().max_w(260).font_medium().text_color(t.foreground).when(Boolean(p.terminal) && !p.zoomed && panes().filter(other => other.tab === p.tab && other.terminal).length > 1, el => el.cursor_grab()).child(name))
      .child(div().flex_1().truncate().text_color(t.dim).child(folder(p.cwd)))
      .when(st === "working", el => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900)))
      .when(st === "blocked", el => el.child(div().flex_none().px(6).h(18).flex().items_center().rounded(5).bg(t.blocked + "26").text_size(10.5).font_semibold().text_color(t.blocked).child("Needs you")))
      .when(st === "done", el => el.child(div().size(7).flex_none().rounded(4).bg(t.done)))
      .when(this.hovered && p.mod !== "agent-notes", el => el
        .child(this.button(t, `ph-r-${pane}`, "split-right", "pane.split", { direction: "right", pane }))
        .child(this.button(t, `ph-d-${pane}`, "split-down", "pane.split", { direction: "down", pane }))
        .child(this.button(t, `ph-z-${pane}`, p.zoomed ? "unzoom" : "zoom", "pane.zoom", { pane }))
        .child(this.button(t, `ph-x-${pane}`, "close", "pane.close", { pane })))
      .when(Boolean(p.terminal) && !p.zoomed && panes().filter(other => other.tab === p.tab && other.terminal).length > 1, el => el
        .child(h_flex().absolute().left(0).right(0).bottom(0).h(30).items_center().justify_center()
          .child(div().id(`bottom-grip-${pane}`).w(60).h(30).flex().items_center().justify_center().cursor_grab()
            .on_mouse_down("left", (e, cx) => { cx.stop_propagation(); this.dragStart = { x: e.position.x, y: e.position.y }; })
            .on_mouse_move((e, cx) => this.startDrag(e, cx))
            .on_mouse_up("left", () => { this.dragStart = null; })
            .when(this.hovered, el => el.child(v_flex().w(28).h(18).rounded(4).bg(t.background).hover(s => s.bg(t.hover))
              .gap(3).items_center().justify_center()
              .children([0, 1].map(() => h_flex().gap(3).children([0, 1, 2].map(() => div().size(2).rounded(1).bg(t.dim))))))))))
      .when(p.mod === "agent-notes", el => el.child(this.button(t, `notes-close-${pane}`, "close", "pane.close", { pane })));

    const resizeHandle = div().id(`resize-notes-${pane}`).h(6).w_full().flex_none().cursor_row_resize()
      .bg(t.surface).border_t(1).border_color(t.border).hover(s => s.bg(t.selected).border_color(t.accent))
      .on_mouse_down("left", (e, cx) => this.startNotesResize(e, cx));
    const notes = v_flex().flex_1().min_h(0).px(12).py(6).bg(t.surface)
      .child(Textarea.new(this.input).flex_1().min_h(0).w_full().text_size(12).text_color(t.foreground));
    return v_flex().size_full().min_h(0).bg(t.background)
      .when(!bottom, el => el.child(title))
      .when(notesOpen && bottom, el => el.child(resizeHandle).child(notes))
      .when(notesOpen && !bottom, el => el.child(notes).child(resizeHandle))
      .when(bottom, el => el.child(title));
  }
}
