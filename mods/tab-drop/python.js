// Generated from lib/python.js; update with node scripts/sync-python.mjs.
// Shared by every custom mod that runs a Python helper. No persistent cache:
// discover on every action so PATH/interpreter changes are picked up.
const PROBE = "import json,sys; print(json.dumps({'version':list(sys.version_info[:3]),'executable':sys.executable}))";

export async function discoverPython(exec, { platform, ...options } = {}) {
  const standard = [["python3", []], ["python", []]];
  const launcher = ["py", ["-3"]];
  const candidates = platform === "windows" ? [launcher, ...standard] : [...standard, launcher];
  for (const version of ["3.14", "3.13", "3.12", "3.11", "3.10", "3.9", "3.8"]) {
    candidates.push(["python" + version, []]);
  }
  for (const [command, prefix] of candidates) {
    try {
      const result = await exec(command, [...prefix, "-c", PROBE], { ...options, timeout: 2000 });
      if (result.code !== 0) continue;
      // Tolerate launcher banners, but require a valid report from Python itself.
      for (const line of result.stdout.trim().split(/\r?\n/).reverse()) {
        let report;
        try { report = JSON.parse(line); } catch { continue; }
        const version = report?.version;
        if (Array.isArray(version) && version[0] === 3 && Number.isInteger(version[1]) && version[1] >= 8
            && typeof report.executable === "string" && report.executable.trim()) {
          return report.executable;
        }
      }
    } catch {
      // Missing commands, Microsoft Store aliases and failed launchers are not interpreters.
    }
  }
  throw new Error("Could not find a working Python 3.8+ interpreter. Tried py -3, python3, python and versioned Python commands. Install Python 3 or add it to PATH, then restart Herdr.");
}

export async function runPython(exec, args, options = {}) {
  const executable = await discoverPython(exec, options);
  const { platform, ...runOptions } = options;
  // Run the helper exactly once. A failed helper may already have changed a pane;
  // retrying it under another interpreter could repeat that operation.
  return exec(executable, args, runOptions);
}
