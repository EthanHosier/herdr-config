# My Herdr config

This repository **is the live `~/.config/herdr-app` folder**. Herdr reads the tracked files directly, so edits to the UI happen in this Git checkout. Commit and push those changes to sync them to GitHub; pull on another machine to bring them across. There is no separate install or copy step after setup.

The custom **drag-splits** layout adds tab-to-split dragging, pane-to-tab dragging and custom-name preservation. A full-window translucent overlay highlights the destination in light grey, without arrows or circles. Side drop zones cover the full height.

![Drag Splits](preview.png)

## Set up on another machine

Requires Git, Python 3 on PATH, [Herdr](https://herdr.dev) and Herdr Core (`hc`). Tested on macOS with Herdr **0.1.16**. The same config path is used on Linux, but Linux has not been tested. This setup is intended for macOS and Linux.

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

The repo includes `settings.json` and `keys.json`, so it carries the current preferences and shortcuts too, including 12px terminal text. The custom mods require `python3`, `herdr-app` and `hc`; the move helper also looks for Herdr CLIs under `~/.local/bin`.

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

**New tabs:** the top-bar **+** button and **Cmd+T** open Codex in YOLO mode (approvals and sandboxing disabled) in this layout. The adjacent **⌄** menu still offers a plain terminal and other agents. On local macOS, the launcher prefers ChatGPT's bundled Codex when available, because it includes the required code-mode helper; otherwise it uses the configured Codex launcher or `codex` from the shell. Remote spaces use that machine's configured launcher. Each Codex session runs with `--no-daemon`.

- **Tab → split:** select the destination tab, then drag another tab downward into the workspace. Release in the left, right, upper or lower highlighted section. If dragging the active tab, another tab in the same space becomes the destination.
- **Split → tab:** drag a pane's title upward and release in the overlay's top strip. Use the title rather than Herdr's native top-center grip, which rearranges existing panes.
- **Cancel:** press Escape or release in an unhighlighted section.

Custom names follow the terminal through repeated moves and appear in pane headers. Metadata is stored on the live terminal as `herdr.drag-tab-name`, outside this repo.

Tab-to-split moves support **single-terminal tabs in the same space**. Detaching currently requires at least two terminal panes. Moving whole split trees, cross-space transfers and mod-panel transfers are not supported. These are personal clones, so Herdr updates do not overwrite them, but future app releases may require compatibility updates.

## Files

| Path | Purpose |
| --- | --- |
| `layouts/drag-splits.json` | Custom layout based on Herdr's main layout |
| `layouts/drag-splits.svg` | Layout settings preview |
| `mods/drag-tabs/` | Tab bar and tab-to-split dragging |
| `mods/drag-pane/` | Pane headers and pane-to-tab dragging |
| `mods/tab-drop/` | Drop overlay and Python helper for terminal moves |
| `settings.json`, `keys.json` | Personal preferences and shortcuts |
| `.gitignore` | Keeps generated files and runtime state local |

Validate after editing mods:

```sh
herdr-app check ~/.config/herdr-app/mods/drag-tabs
herdr-app check ~/.config/herdr-app/mods/drag-pane
herdr-app check ~/.config/herdr-app/mods/tab-drop
```

## Return to the default UI

```sh
herdr-app do layout.switch '{"name":"main"}'
```

Switching layouts leaves terminals running. The emergency reset shortcut is **Ctrl+Alt+Shift+Escape**. To restore the pre-clone config, quit Herdr and move your backup folder back into place, preserving the checkout separately if needed.

## Access and license

The custom mods run `python3`, `herdr-app` and `hc` to move terminals and retain names. They make no network requests. The tab bar also opens Herdr's built-in menus and panels.

The custom layout and cloned mods derive from [Herdr app](https://github.com/herdrdev/herdr-app) 0.1.16, under [Apache-2.0](LICENSE). See [NOTICE](NOTICE) and [RECIPE.md](RECIPE.md).
