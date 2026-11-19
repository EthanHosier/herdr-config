// Herdr confines JS imports to each mod. Keep distributable local helpers in
// sync with the one maintained source, without requiring Node at runtime.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = await readFile(path.join(root, "lib/python.js"), "utf8");
const banner = "// Generated from lib/python.js; update with node scripts/sync-python.mjs.\n";
for (const entry of await readdir(path.join(root, "mods"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const directory = path.join(root, "mods", entry.name);
  let usesPython = false;
  for (const filename of await readdir(directory)) {
    if (!filename.endsWith(".js") || filename === "python.js") continue;
    if ((await readFile(path.join(directory, filename), "utf8")).includes('from "./python.js"')) usesPython = true;
  }
  if (usesPython) {
    await writeFile(path.join(directory, "python.js"), banner + source);
    process.stdout.write("Updated mods/" + entry.name + "/python.js\n");
  }
}
