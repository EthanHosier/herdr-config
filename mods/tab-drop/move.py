"""Move one live terminal using public Herdr commands, waiting for core acknowledgements."""
import json
import shutil
import subprocess
import sys
import time
import uuid

app = shutil.which("herdr-app") or str(__import__("pathlib").Path.home() / ".local/bin/herdr-app")
core = shutil.which("hc") or str(__import__("pathlib").Path.home() / ".local/bin/hc")
NAME_LABEL = "herdr.drag-tab-name"
NOTES_ID = "herdr.notes-id"
NOTES_PANE = "herdr.notes-pane"
NOTES_HEADER = "herdr.notes-header"


def core_labels(terminal):
    result = subprocess.run([core, "get", terminal], capture_output=True, text=True, timeout=8, check=True)
    return json.loads(result.stdout).get("labels", {})


def set_label(terminal, key, value):
    subprocess.run([core, "label", terminal, key + "=" + value], capture_output=True, text=True, timeout=8, check=True)


def close_notes(terminal):
    pane = core_labels(terminal).get(NOTES_PANE)
    if not pane:
        return False
    if any(x["pane"] == pane for _, tab in tabs() for x in tab["terminals"]):
        raise RuntimeError("Refusing to close a terminal as a notes pane.")
    try:
        call("pane.close", {"pane": pane})
    except RuntimeError as error:
        message = str(error).lower()
        if not any(text in message for text in ("no pane", "unknown pane", "not found")):
            raise
        set_label(terminal, NOTES_PANE, "")
        return False
    set_label(terminal, NOTES_PANE, "")
    return True


def open_notes(terminal, pane, focus=False):
    notes_id = core_labels(terminal).get(NOTES_ID)
    if not notes_id:
        notes_id = str(uuid.uuid4())
        set_label(terminal, NOTES_ID, notes_id)
    set_label(terminal, NOTES_HEADER, "1")
    return pane


def terminal_pane(terminal):
    return next((x for _, tab in tabs() for x in tab["terminals"] if x["terminal"] == terminal), None)


def toggle_notes(p):
    pane = terminal_pane(p["terminal"])
    if not pane:
        raise RuntimeError("This terminal no longer has a pane.")
    labels = core_labels(p["terminal"])
    # Closing an old companion flushes its editor without deleting note text.
    close_notes(p["terminal"])
    if labels.get(NOTES_HEADER) == "1":
        set_label(p["terminal"], NOTES_HEADER, "")
        return {"ok": True, "open": False}
    open_notes(p["terminal"], pane["pane"])
    return {"ok": True, "open": True, "pane": pane["pane"]}


def terminal_name(terminal):
    result = subprocess.run([core, "get", terminal], capture_output=True, text=True, timeout=8, check=True)
    return json.loads(result.stdout).get("labels", {}).get(NAME_LABEL)


def remember_name(terminal, name):
    subprocess.run([core, "label", terminal, NAME_LABEL + "=" + (name or "")], capture_output=True, text=True, timeout=8, check=True)


def call(command, args=None):
    argv = [app, "do", command, json.dumps(args or {})] if args is not None else [app, command]
    result = subprocess.run(argv, capture_output=True, text=True, timeout=8)
    if result.returncode:
        raise RuntimeError(result.stderr or result.stdout)
    value = json.loads(result.stdout)
    if "error" in value:
        raise RuntimeError(value["error"])
    return value


def tabs():
    return [(s, t) for s in call("ls")["spaces"] for t in s["tabs"]]


def wait_for(predicate):
    until = time.monotonic() + 5
    while time.monotonic() < until:
        snapshot = tabs()
        value = predicate(snapshot)
        if value:
            return value
        time.sleep(0.05)
    raise RuntimeError("Herdr did not acknowledge the terminal move in time.")


def keep(terminal, place):
    # The layout acknowledgement can precede the refreshed core terminal list.
    until = time.monotonic() + 5
    while True:
        try:
            return call("terminal.keep", {"terminal": terminal, "place": place})
        except RuntimeError as error:
            if "no running terminal" not in str(error) or time.monotonic() >= until:
                raise
            time.sleep(0.1)


def move(p):
    if p.get("mode") == "toggle-notes":
        return toggle_notes(p)
    snapshot = tabs()
    source = next(((s, t) for s, t in snapshot if t["id"] == p["source"]), None)
    if p.get("mode") == "detach":
        if not source or len(source[1]["terminals"]) < 2 or not any(x["terminal"] == p["terminal"] for x in source[1]["terminals"]):
            raise RuntimeError("The terminal must belong to a split tab.")
        name = terminal_name(p["terminal"]) or p.get("sourceName")
        had_notes = close_notes(p["terminal"])
        call("tab.select", {"id": p["source"]})
        call("terminal.park", {"terminal": p["terminal"]})
        wait_for(lambda snapshot: not any(x["terminal"] == p["terminal"] for _, t in snapshot for x in t["terminals"]))
        call("tab.select", {"id": p["source"]})
        result = keep(p["terminal"], "tab")
        added = wait_for(lambda snapshot: next((t for _, t in snapshot if t["id"] != p["source"] and any(x["terminal"] == p["terminal"] for x in t["terminals"])), None))
        if name:
            call("tab.rename", {"id": added["id"], "name": name})
        if had_notes:
            open_notes(p["terminal"], next(x["pane"] for x in added["terminals"] if x["terminal"] == p["terminal"]))
        call("tab.select", {"id": added["id"]})
        return {"ok": True, "tab": added["id"]}
    target = next(((s, t) for s, t in snapshot if t["id"] == p["target"]), None)
    if not source or not target or source[0]["id"] != target[0]["id"] or source[1]["id"] == target[1]["id"]:
        raise RuntimeError("Source and destination must be different tabs in the same space.")
    terminals = source[1]["terminals"]
    if len(terminals) != 1 or terminals[0]["terminal"] != p["terminal"]:
        raise RuntimeError("The source tab changed. Only single-terminal tabs can be moved.")
    if not any(t["pane"] == p["targetPane"] for t in target[1]["terminals"]):
        raise RuntimeError("The destination pane no longer exists.")
    target_terminal = next(t["terminal"] for t in target[1]["terminals"] if t["pane"] == p["targetPane"])
    if "sourceName" in p:
        remember_name(p["terminal"], p["sourceName"])
    had_notes = close_notes(p["terminal"])
    target_had_notes = close_notes(target_terminal)
    call("tab.select", {"id": p["target"]})
    call("pane.focus", {"pane": p["targetPane"]})
    if target[1].get("zoomed"):
        call("pane.zoom", {"pane": p["targetPane"]})
    call("terminal.park", {"terminal": p["terminal"]})
    wait_for(lambda snapshot: not any(x["terminal"] == p["terminal"] for _, t in snapshot for x in t["terminals"]))
    try:
        call("tab.select", {"id": p["target"]})
        call("pane.focus", {"pane": p["targetPane"]})
        keep(p["terminal"], "down" if p["edge"] in ("up", "down") else "right")
        added = wait_for(lambda snapshot: next((x for _, t in snapshot if t["id"] == p["target"] for x in t["terminals"] if x["terminal"] == p["terminal"]), None))
        if p["edge"] in ("left", "up"):
            call("pane.swap", {"pane": added["pane"], "target": p["targetPane"]})
        if target_had_notes:
            open_notes(target_terminal, p["targetPane"])
        if had_notes:
            open_notes(p["terminal"], added["pane"])
        call("pane.focus", {"pane": added["pane"]})
    except Exception:
        # Recover as a tab if adoption failed, leaving the process running.
        if not any(x["terminal"] == p["terminal"] for _, t in tabs() for x in t["terminals"]):
            keep(p["terminal"], "tab")
        if had_notes and not core_labels(p["terminal"]).get(NOTES_PANE):
            recovered = terminal_pane(p["terminal"])
            if recovered:
                open_notes(p["terminal"], recovered["pane"])
        if target_had_notes and not core_labels(target_terminal).get(NOTES_PANE):
            recovered = terminal_pane(target_terminal)
            if recovered:
                open_notes(target_terminal, recovered["pane"])
        raise
    return {"ok": True, "pane": added["pane"]}


if __name__ == "__main__":
    try:
        print(json.dumps(move(json.loads(sys.argv[1]))))
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
