import test from "node:test";
import assert from "node:assert/strict";
import { runPython } from "../lib/python.js";
import { readFile } from "node:fs/promises";

test("Windows launches py -3 once, without probing, preserving paths and arguments", async () => {
  const calls = [];
  const args = ["C:\\My Config\\move.py", JSON.stringify({ name: "a'b $value" })];
  const result = await runPython(async (...call) => { calls.push(call); return { code: 0 }; }, args, { platform: "windows", timeout: 20000 });
  assert.equal(result.code, 0);
  assert.deepEqual(calls, [["py", ["-3", ...args], { timeout: 20000 }]]);
});

test("macOS and Linux launch python3 directly without extra subprocesses", async () => {
  for (const platform of ["macos", "linux"]) {
    const calls = [];
    await runPython(async (...call) => { calls.push(call); return { code: 0 }; }, ["move.py"], { platform });
    assert.deepEqual(calls, [["python3", ["move.py"], {}]]);
  }
});

test("Failed helpers are returned without retries", async () => {
  let runs = 0;
  const result = await runPython(async () => { runs++; return { code: 1, stderr: "failed" }; }, ["move.py"], { platform: "windows" });
  assert.equal(result.code, 1);
  assert.equal(runs, 1);
});

test("Every Python-consuming mod packages the same OS-based launcher", async () => {
  const source = await readFile(new URL("../lib/python.js", import.meta.url), "utf8");
  const banner = "// Generated from lib/python.js; update with node scripts/sync-python.mjs.\n";
  for (const mod of ["tab-drop", "codex-tab-menu", "rename-agent"]) {
    assert.equal(await readFile(new URL("../mods/" + mod + "/python.js", import.meta.url), "utf8"), banner + source);
  }
});
