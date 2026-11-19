# My Herdr config

This repository **is the live `~/.config/herdr-app` folder**. Herdr reads the tracked files directly, so edits to the UI happen in this Git checkout. Commit and push those changes to sync them to GitHub; pull on another machine to bring them across. There is no separate install or copy step after setup.

The custom **drag-splits** layout adds tab-to-split dragging, pane-to-tab dragging and custom-name preservation. A full-window translucent overlay highlights the destination in light grey, without arrows or circles. Side drop zones cover the full height.

![Drag Splits](preview.png)

## Set up on another machine

Requires Git, Python 3.8+ available through a standard Python command, [Herdr](https://herdr.dev) and Herdr Core (`hc`). Tested on macOS with Herdr **0.1.16**. The same config path is used on Linux, but Linux has not been tested. This setup is intended for macOS and Linux.

1. Install Herdr and open it once to finish setting up its core. Install Python 3 if necessary (`brew install python` on macOS).
2. **Quit the Herdr window** before replacing its config folder. Run the following from another terminal. Existing configuration is preserved in a timestamped backup.

   ```sh
   git clone https://github.com/EthanHosier/herdr-config.git "$HOME/.config/herdr-app-checkout"
   backup="$HOME/.config/herdr-app.backup-$(date +%Y%m%d-%H%M%S)"
   mv "$HOME/.config/herdr-app" "$backup"
   mv "$HOME/.config/herdr-app-checkout" "$HOME/.config/herdr-app"
   ```

3. Open Herdr again. It will regenerate its built-in mods, icons and runtime files; Git ignores these. Then activate the custom layout:

   ```sh
   ~/.local/bin/herdr-app do layout.switch '{"name":"drag-splits"}'
   ```

   If installed elsewhere, run `herdr-app` from PATH instead. You can also select **drag-splits** in Herdr's layout settings.

The repo includes `settings.json` and `keys.json`, so it carries the current preferences and shortcuts too, including 12px terminal text. The custom mods require Python 3.8+ available as `py -3` on Windows or `python3` on macOS/Linux, `herdr-app` and `hc`; the move helper also looks for Herdr CLIs under `~/.local/bin`.

For a second computer that should also push changes, use your own GitHub account's repository access, or fork the repo and clone your fork.

## Save future changes

Edits made by an agent or through Herdr settings land directly in this checkout. To publish them:

```sh
cd ~/.config/herdr-app
git status --short
git diff
git add -A
git commit -m "Update Herdr UI"
git push
```

On another configured machine:

```sh
cd ~/.config/herdr-app
git pull --ff-only
```

Most UI changes reload live. Commit local changes before pulling; if both machines changed the same files, resolve the conflict before continuing. Git does **not** commit, push or pull automatically.

New custom mods, layouts and themes are tracked by default. The `.gitignore` excludes Herdr's current shipped files, generated types, session state, window positions, telemetry and caches. New built-in mods introduced by a Herdr update may need an ignore entry. Review `git status` before publishing, particularly if you add credentials, private URLs or machine-specific paths to your own mods or settings.

## Use the layout

**Rename an agent:** right-click its terminal or title bar and choose **Rename**. The pane name is also used when that agent is in its own tab, and survives moves. Right-click a tab → **Rename** updates the matching agent too. In a split tab, pane names remain independent; renaming one pane does not rename the others or their shared tab.

**New tabs:** only the tab right-click menu’s **New tab** action opens Codex in YOLO mode (approvals and sandboxing disabled) in this layout. The top-bar **+** opens the tab-type selector. **Cmd+T** retains its original plain-terminal behavior. The launcher uses the configured Codex command from Herdr’s program table, defaulting to `codex` resolved by the target machine’s shell. It does not select a ChatGPT-bundled binary automatically. The launcher removes `--no-daemon` from Herdr’s suggested command, keeping Codex’s normal daemon behavior.

- **Tab → split:** select the destination tab, then drag another tab downward into the workspace. Release in the left, right, upper or lower highlighted section. If dragging the active tab, another tab in the same space becomes the destination.
- **Split → tab:** drag a pane's bottom title bar or bottom-center grip into the top tab strip.
- **Agent notes:** plain-text notes are always visible beneath each terminal, above its bottom title bar. They start at the minimum height (70px including the title strip), with no Show/Hide menu option. Type directly in the notes; text saves automatically. Drag the divider upward to make the notes taller or downward to shrink them; Escape cancels a resize. There is no separate notes pane to move.
- **Cancel:** press Escape or release in an unhighlighted section.

Custom names follow the terminal through repeated moves and appear in pane headers. Metadata is stored on the live terminal as `herdr.drag-tab-name`, outside this repo.

Tab-to-split moves support **single-terminal tabs in the same space**, including their optional header notes. Detaching currently requires at least two terminal panes. Notes are part of the terminal’s header, so native pane dragging, swaps, and tab/split transfers keep them with the agent automatically. Moving whole split trees, cross-space transfers and unrelated mod-panel transfers are not supported. These are personal clones, so Herdr updates do not overwrite them, but future app releases may require compatibility updates.

### Notes persistence

Notes belong to the live terminal, rather than a tab ID or split-pane ID. Existing notes retain their UUID from `herdr.notes-id` and the `agent-notes.text.<UUID>` key. New terminals save directly under `agent-notes.text.terminal:<address>` without launching Python just to initialize notes. If a UUID is assigned later, the saved text migrates to that key. All note text is autosaved in this Herdr window’s local `shared.json` and follows the terminal through tab/split moves and app restarts while its identity is retained. New terminals do not automatically inherit another terminal’s notes.

**Header sizing:** Herdr shares header height across panes in a layout. The minimum and initial height is 70px, including the 30px title strip. Dragging adjusts the height up to 600px. The resized value is saved locally as `agent-notes.notes-height`; older header-height preferences are not used for this new minimum-height default.

**Note contents are private local state and are excluded from Git.** Cloning this repo on another computer transfers the notes UI, not note contents. Remote terminals use the same UI feature, but the text is saved on the computer running the Herdr window; cross-computer note synchronization is not implemented.

The bottom-center grip replaces Herdr’s fixed top grip. Drag onto another pane’s center to swap, or its edge to place the pane beside it. Escape cancels.

## Python command on Windows, macOS and Linux

All Python-backed mods choose the command directly from Herdr’s OS information:

- **Windows:** `py -3`
- **macOS/Linux:** `python3`

Each action launches the helper once. There are no version probes, command scans, discovery subprocesses or retries. Install Python 3.8+ with the corresponding command available on PATH. Paths and arguments are passed separately, including paths with spaces. Helpers run on the computer hosting the Herdr UI and control remote terminals through the local Herdr CLIs.

Herdr restricts imports to each mod folder, so `lib/python.js` is the maintained source and each consuming mod ships a generated local `python.js`. No build step is needed after pulling this repo. For future Python-backed mods, import `runPython` from `./python.js` and use `runPython(exec, args, { platform: window().platform, timeout: 20000 })`. Regenerate and test copies with:

```sh
node scripts/sync-python.mjs
node --test tests/python-discovery.test.mjs
```

Node is needed only for development/testing, not for running these mods. Windows command selection is covered by simulated tests; end-to-end Herdr operation has been tested on macOS, not Windows.

## If a new tab launches a different Codex

On the machine where you expect Codex to run, compare `type -a codex` and `codex --version` in a plain terminal. Herdr loads the target machine’s shell configuration, but its agent launcher does not expand shell aliases. Use a shell function or executable wrapper if your normal `codex` command is an alias. Alternatively, add a `run` array to the existing `programs.codex` entry in `programs.json`, for example `"run": ["/path/to/preferred/codex"]`. Preserve the icon fields. That path must exist on every machine where the launcher is used, so a wrapper named on PATH is usually easier to share between machines.

A Herdr remote space created through **Settings → Machines** launches new tabs on that remote machine. Typing `ssh` inside a local terminal does not make its Herdr space remote: new tabs still start locally. In that case, add the host through Herdr Machines and create/select a space on it.

The context-menu launcher adds only the YOLO mode flag, `--dangerously-bypass-approvals-and-sandbox`, and removes `--no-daemon` if Herdr suggests it. This keeps the usual Codex daemon behavior with YOLO permissions.

## Files

| Path | Purpose |
| --- | --- |
| `layouts/drag-splits.json` | Custom layout based on Herdr's main layout |
| `layouts/drag-splits.svg` | Layout settings preview |
| `mods/drag-tabs/` | Tab bar and tab-to-split dragging |
| `mods/rename-agent/` | Rename dialog that keeps a pane and its own tab in sync |
| `mods/codex-tab-menu/` | Tab context menu with Codex as the New tab action |
| `mods/drag-pane/` | Bottom pane headers, notes and pane dragging |
| `mods/pane-drop-zone/` | Transparent targets for swapping, splitting and detaching panes |
| `mods/tab-drop/` | Drop overlay and Python helper for terminal moves, header visibility and legacy-note migration |
| `mods/notes-resize/` | Drag capture for the notes height divider |
| `mods/agent-notes/` | Legacy editor retained to safely migrate older saved notes panes |
| `settings.json`, `keys.json` | Personal preferences and shortcuts |
| `programs.json`, `my-icons/` | Codex icon override using the OpenAI logo |
| `.gitignore` | Keeps generated files and runtime state local |

Validate after editing mods:

```sh
herdr-app check ~/.config/herdr-app/mods/drag-tabs
herdr-app check ~/.config/herdr-app/mods/drag-pane
herdr-app check ~/.config/herdr-app/mods/pane-drop-zone
herdr-app check ~/.config/herdr-app/mods/tab-drop
herdr-app check ~/.config/herdr-app/mods/codex-tab-menu
herdr-app check ~/.config/herdr-app/mods/agent-notes
herdr-app check ~/.config/herdr-app/mods/notes-resize
herdr-app check ~/.config/herdr-app/mods/rename-agent
```

## Return to the default UI

```sh
herdr-app do layout.switch '{"name":"main"}'
```

Switching layouts leaves terminals running. The emergency reset shortcut is **Ctrl+Alt+Shift+Escape**. To restore the pre-clone config, quit Herdr and move your backup folder back into place, preserving the checkout separately if needed.

## Access and license

The custom mods run the OS-specific Python 3 command, `herdr-app` and `hc` to move terminals and retain names. They make no network requests. The tab bar also opens Herdr's built-in menus and panels.

The custom layout and cloned mods derive from [Herdr app](https://github.com/herdrdev/herdr-app) 0.1.16, under [Apache-2.0](LICENSE). See [NOTICE](NOTICE) and [RECIPE.md](RECIPE.md).
