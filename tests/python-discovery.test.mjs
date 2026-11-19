import test from "node:test";
import assert from "node:assert/strict";
import { discoverPython, runPython } from "../lib/python.js";
import { readFile } from "node:fs/promises";

const report = (executable, version = [3, 12, 0]) => ({ code: 0, stdout: JSON.stringify({ executable, version }), stderr: "" });

test("Windows launcher selects its actual executable and preserves helper arguments", async () => {
  const calls = [];
  const python = "C:\\Program Files\\Python312\\python.exe";
  const args = ["C:\\My Config\\move.py", JSON.stringify({ name: "a'b $value" })];
  const exec = async (command, argv, options) => {
    calls.push({ command, argv, options });
    return command === "py" ? report(python) : { code: 0, stdout: "done" };
  };
  await runPython(exec, args, { platform: "windows", timeout: 20000 });
  assert.equal(calls[0].command, "py");
  assert.deepEqual(calls[0].argv.slice(0, 2), ["-3", "-c"]);
  assert.equal(calls[1].command, python);
  assert.deepEqual(calls[1].argv, args);
  assert.deepEqual(calls[1].options, { timeout: 20000 });
});

test("Falls back to python when python3 is missing", async () => {
  const calls = [];
  const executable = await discoverPython(async command => {
    calls.push(command);
    if (command === "python3") throw new Error("not found");
    return report("/usr/local/bin/python");
  });
  assert.equal(executable, "/usr/local/bin/python");
  assert.deepEqual(calls, ["python3", "python"]);
});

test("Rejects Python 2, Store stubs and malformed reports; supports versioned commands", async () => {
  assert.equal(await discoverPython(async command => {
    if (command === "python3") return { code: 0, stdout: "Microsoft Store alias" };
    if (command === "python") return report("/old/python", [2, 7, 18]);
    if (command === "python3.14") return report("/usr/bin/python3.14", [3, 14, 0]);
    return { code: 1, stdout: "" };
  }), "/usr/bin/python3.14");
});

test("Discovers again for every action rather than retaining another machine's path", async () => {
  let count = 0;
  const used = [];
  const exec = async (command, args) => {
    if (args[0] === "-c") return report("/python/" + ++count);
    used.push(command);
    return { code: 0, stdout: "" };
  };
  await runPython(exec, ["move.py"]);
  await runPython(exec, ["move.py"]);
  assert.deepEqual(used, ["/python/1", "/python/2"]);
});

test("Never retries a failed helper under a different interpreter", async () => {
  let runs = 0;
  const result = await runPython(async (_command, args) => {
    if (args[0] === "-c") return report("/python");
    runs++;
    return { code: 1, stdout: "", stderr: "operation failed" };
  }, ["move.py"]);
  assert.equal(result.code, 1);
  assert.equal(runs, 1);
});

test("Reports a clear error when no usable interpreter exists", async () => {
  await assert.rejects(discoverPython(async () => ({ code: 1, stdout: "" })), /Python 3\.8\+ interpreter/);
});

test("Every Python-consuming mod packages the same discovery implementation", async () => {
  const source = await readFile(new URL("../lib/python.js", import.meta.url), "utf8");
  const banner = "// Generated from lib/python.js; update with node scripts/sync-python.mjs.\n";
  for (const mod of ["tab-drop", "codex-tab-menu"]) {
    assert.equal(await readFile(new URL("../mods/" + mod + "/python.js", import.meta.url), "utf8"), banner + source);
  }
});
