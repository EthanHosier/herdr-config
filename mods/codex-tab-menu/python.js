// Generated from lib/python.js; update with node scripts/sync-python.mjs.
// Shared OS-based Python launch policy. No discovery subprocesses or probes.
export function runPython(exec, args, { platform, ...options } = {}) {
  const windows = platform === "windows" || platform === "win32";
  return exec(windows ? "py" : "python3", windows ? ["-3", ...args] : args, options);
}
