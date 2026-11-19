// Mirror the live split geometry with transparent, interactive drop targets.
// Actual terminals remain in the real layout; the overlay never renders copies.
export function buildDropLayout(layout, tree, args, machine = null, gap = 8) {
  const qualify = id => machine ? machine + "/" + id : id;
  const target = (id, extra, size) => ({ id: "drop-" + id, type: "block", size,
    content: { mod: "pane-drop-zone", props: { ...args, ...extra } } });
  const model = node => {
    if (node.content?.terminal) return target(node.id, {
      kind: "pane", target: args.source, targetPane: qualify(node.id), targetTerminal: qualify(node.content.terminal),
    }, node.size);
    if (node.content) return target(node.id, { kind: "inactive" }, node.size);
    return { id: "drop-split-" + node.id, type: node.type === "row" ? "row" : "column",
      size: node.size, gap, resizable: false, children: (node.children ?? []).map(model) };
  };
  const visit = node => {
    if (node.id === "main") return { id: "drop-main", type: "column", size: node.size, children: [model(tree)] };
    if (node.content) return { ...target(node.id, { kind: node.id === "tabs" ? "tab" : "inactive" }, node.size), hidden: node.hidden };
    const copy = { id: "drop-" + node.id, type: node.type, size: node.size, min: node.min, max: node.max,
      hidden: node.hidden, padding: node.padding, gap: node.gap, resizable: false,
      children: (node.children ?? []).map(visit) };
    if (node.type === "stack") copy.active = "drop-" + node.active;
    return copy;
  };
  return JSON.parse(JSON.stringify(visit(layout)));
}
