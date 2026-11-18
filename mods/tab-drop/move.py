"""Move one live terminal using public Herdr commands, waiting for core acknowledgements."""
import json
import shutil
import subprocess
import sys
import time

app = shutil.which("herdr-app") or str(__import__("pathlib").Path.home() / ".local/bin/herdr-app")
core = shutil.which("hc") or str(__import__("pathlib").Path.home() / ".local/bin/hc")
NAME_LABEL = "herdr.drag-tab-name"


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
    snapshot = tabs()
    source = next(((s, t) for s, t in snapshot if t["id"] == p["source"]), None)
    if p.get("mode") == "detach":
        if not source or len(source[1]["terminals"]) < 2 or not any(x["terminal"] == p["terminal"] for x in source[1]["terminals"]):
            raise RuntimeError("The terminal must belong to a split tab.")
        name = terminal_name(p["terminal"]) or p.get("sourceName")
        call("tab.select", {"id": p["source"]})
        call("terminal.park", {"terminal": p["terminal"]})
        wait_for(lambda snapshot: not any(x["terminal"] == p["terminal"] for _, t in snapshot for x in t["terminals"]))
        call("tab.select", {"id": p["source"]})
        result = keep(p["terminal"], "tab")
        added = wait_for(lambda snapshot: next((t for _, t in snapshot if t["id"] != p["source"] and any(x["terminal"] == p["terminal"] for x in t["terminals"])), None))
        if name:
            call("tab.rename", {"id": added["id"], "name": name})
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
    if "sourceName" in p:
        remember_name(p["terminal"], p["sourceName"])
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
        call("pane.focus", {"pane": added["pane"]})
    except Exception:
        # Recover as a tab if adoption failed, leaving the process running.
        if not any(x["terminal"] == p["terminal"] for _, t in tabs() for x in t["terminals"]):
            keep(p["terminal"], "tab")
        raise
    return {"ok": True, "pane": added["pane"]}


if __name__ == "__main__":
    try:
        print(json.dumps(move(json.loads(sys.argv[1]))))
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
