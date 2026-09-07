# Raccourcis clavier

> ⚠️ **Fichier généré.** Ne pas l'éditer à la main — relancer
> `python3 scripts/gen-keybindings.py`, qui relit les configs de la machine.
> Le README n'en garde qu'un pointeur : les tableaux recopiés à la main
> dérivaient à chaque changement de config.

## herdr — multiplexeur

Le multiplexeur au quotidien. Prefix = `ctrl+b`.

> herdr **rejette en silence** tout binding direct qui intercepterait la frappe :
> une lettre seule doit être préfixée. Le fichier de travail des remaps est
> `~/.config/herdr/keymaps-remap.md`.

### Panes

| Bind | Action | Note |
|---|---|---|
| `prefix+h` | focus pane left |  |
| `prefix+j` | focus pane down |  |
| `prefix+k` | focus pane up |  |
| `prefix+l` | focus pane right |  |
| `prefix+ctrl+n` | cycle pane next |  |
| `prefix+ctrl+p` | cycle pane previous | ctrl+b impossible (= le prefix) → p = previous |
| `prefix+$` | last pane |  |
| `prefix+v` | split vertical |  |
| `prefix+s` | split horizontal |  |
| `prefix+x` | close pane |  |
| `prefix+shift+p` | rename pane |  |
| `prefix+z` | zoom |  |
| `prefix+r` | resize mode |  |
| `prefix+e` | edit scrollback |  |

### Onglets

| Bind | Action | Note |
|---|---|---|
| `prefix+c` | new tab |  |
| `prefix+b` | previous tab |  |
| `prefix+n` | next tab |  |
| `prefix+shift+t` | rename tab |  |
| `prefix+shift+x` | close tab |  |
| `prefix+1..9` | switch tab |  |

### Workspaces

| Bind | Action | Note |
|---|---|---|
| `prefix+shift+c` | new workspace |  |
| `prefix+shift+w` | rename workspace |  |
| `prefix+ctrl+x` | close workspace |  |
| `prefix+shift+b` | previous workspace |  |
| `prefix+shift+n` | next workspace |  |
| `prefix+w` | workspace picker |  |
| `prefix+shift+1..9` | switch workspace |  |

### Agents

| Bind | Action | Note |
|---|---|---|
| `prefix+shift+k` | previous agent |  |
| `prefix+shift+j` | next agent |  |
| `prefix+ctrl+1..9` | focus agent | indexé (à valider au clavier) |

### Worktrees

| Bind | Action | Note |
|---|---|---|
| `prefix+shift+g` | new worktree |  |
| `prefix+shift+o` | open worktree | déplacé : ctrl+g pris par Lazygit (task) |

### Navigation directe

| Bind | Action | Note |
|---|---|---|
| `shift+k` | navigate workspace up |  |
| `shift+j` | navigate workspace down |  |
| `h` | navigate pane left |  |
| `j` | navigate pane down |  |
| `k` | navigate pane up |  |
| `l` | navigate pane right |  |

### Divers

| Bind | Action | Note |
|---|---|---|
| `prefix+g` | goto |  |
| `prefix+?` | help |  |
| `prefix+;` | settings |  |
| `prefix+q` | detach |  |
| `prefix+shift+r` | reload config |  |
| `prefix+o` | open notification target |  |
| `prefix+shift+v` | toggle sidebar |  |

## AeroSpace — gestionnaire de fenêtres

### mode `main`

| Touche | Action |
|---|---|
| `f18` | `mode aero` |
| `ctrl-alt-1` | `workspace 1` |
| `ctrl-alt-2` | `workspace 2` |
| `ctrl-alt-3` | `workspace 3` |
| `ctrl-alt-q` | `workspace 4` |
| `ctrl-alt-w` | `workspace 5` |
| `ctrl-alt-e` | `workspace 6` |
| `ctrl-alt-n` | `workspace 7` |
| `ctrl-alt-c` | `workspace 8` |
| `ctrl-alt-tab` | `workspace-back-and-forth` |
| `ctrl-alt-shift-1` | `move-node-to-workspace 1` |
| `ctrl-alt-shift-2` | `move-node-to-workspace 2` |
| `ctrl-alt-shift-3` | `move-node-to-workspace 3` |
| `ctrl-alt-shift-q` | `move-node-to-workspace 4` |
| `ctrl-alt-shift-w` | `move-node-to-workspace 5` |
| `ctrl-alt-shift-e` | `move-node-to-workspace 6` |
| `ctrl-alt-shift-n` | `move-node-to-workspace 7` |
| `ctrl-alt-shift-c` | `move-node-to-workspace 8` |
| `ctrl-alt-h` | `focus left` |
| `ctrl-alt-j` | `focus down` |
| `ctrl-alt-k` | `focus up` |
| `ctrl-alt-l` | `focus right` |
| `ctrl-alt-left` | `focus left` |
| `ctrl-alt-down` | `focus down` |
| `ctrl-alt-up` | `focus up` |
| `ctrl-alt-right` | `focus right` |
| `ctrl-alt-shift-h` | `move left` |
| `ctrl-alt-shift-j` | `move down` |
| `ctrl-alt-shift-k` | `move up` |
| `ctrl-alt-shift-l` | `move right` |
| `ctrl-alt-shift-left` | `move left` |
| `ctrl-alt-shift-down` | `move down` |
| `ctrl-alt-shift-up` | `move up` |
| `ctrl-alt-shift-right` | `move right` |
| `ctrl-alt-slash` | `layout tiles horizontal vertical` |
| `ctrl-alt-comma` | `layout accordion horizontal vertical` |
| `ctrl-alt-shift-space` | `layout floating tiling` |
| `ctrl-alt-f` | `fullscreen` |
| `ctrl-alt-minus` | `resize smart -50` |
| `ctrl-alt-equal` | `resize smart +50` |
| `ctrl-alt-r` | `mode resize` |
| `ctrl-alt-shift-semicolon` | `mode service` |
| `ctrl-alt-shift-r` | `reload-config` |
| `ctrl-alt-shift-x` | `close` |
| `ctrl-alt-shift-equal` | `balance-sizes` |
| `ctrl-alt-enter` | `exec-and-forget open -a Ghostty` |

### mode `aero`

| Touche | Action |
|---|---|
| `esc` | `mode main` |
| `1` | `workspace 1` |
| `2` | `workspace 2` |
| `3` | `workspace 3` |
| `q` | `workspace 4` |
| `w` | `workspace 5` |
| `e` | `workspace 6` |
| `n` | `workspace 7` |
| `c` | `workspace 8` |
| `tab` | `workspace-back-and-forth` |
| `shift-1` | `move-node-to-workspace 1` |
| `shift-2` | `move-node-to-workspace 2` |
| `shift-3` | `move-node-to-workspace 3` |
| `shift-q` | `move-node-to-workspace 4` |
| `shift-w` | `move-node-to-workspace 5` |
| `shift-e` | `move-node-to-workspace 6` |
| `shift-n` | `move-node-to-workspace 7` |
| `shift-c` | `move-node-to-workspace 8` |
| `h` | `focus left` |
| `j` | `focus down` |
| `k` | `focus up` |
| `l` | `focus right` |
| `left` | `focus left` |
| `down` | `focus down` |
| `up` | `focus up` |
| `right` | `focus right` |
| `shift-h` | `move left` |
| `shift-j` | `move down` |
| `shift-k` | `move up` |
| `shift-l` | `move right` |
| `shift-left` | `move left` |
| `shift-down` | `move down` |
| `shift-up` | `move up` |
| `shift-right` | `move right` |
| `slash` | `layout tiles horizontal vertical` |
| `comma` | `layout accordion horizontal vertical` |
| `shift-space` | `layout floating tiling` |
| `f` | `fullscreen` |
| `minus` | `resize smart -50` |
| `equal` | `resize smart +50` |
| `r` | `mode resize` |
| `shift-semicolon` | `mode service` |
| `shift-r` | `reload-config` |
| `shift-x` | `close` |
| `shift-equal` | `balance-sizes` |
| `enter` | `mode main` |

### mode `service`

| Touche | Action |
|---|---|
| `esc` | `reload-config` |
| `r` | `flatten-workspace-tree` |
| `f` | `layout floating tiling` |
| `backspace` | `close-all-windows-but-current` |
| `h` | `layout tiles horizontal` |
| `v` | `layout tiles vertical` |
| `s` | `layout accordion vertical` |
| `w` | `layout accordion horizontal` |
| `t` | `layout tiles` |
| `ctrl-alt-shift-h` | `join-with left` |
| `ctrl-alt-shift-j` | `join-with down` |
| `ctrl-alt-shift-k` | `join-with up` |
| `ctrl-alt-shift-l` | `join-with right` |
| `down` | `volume down` |
| `up` | `volume up` |
| `shift-down` | `volume set 0` |

### mode `resize`

| Touche | Action |
|---|---|
| `h` | `resize width +50` |
| `j` | `resize height -50` |
| `k` | `resize height +50` |
| `l` | `resize width -50` |
| `shift-h` | `resize width -50` |
| `shift-j` | `resize height +50` |
| `shift-k` | `resize height -50` |
| `shift-l` | `resize width +50` |
| `minus` | `resize smart -50` |
| `equal` | `resize smart +50` |
| `shift-minus` | `resize smart -10` |
| `shift-equal` | `resize smart +10` |
| `enter` | `mode main` |
| `esc` | `mode main` |

## Neovim

Base LazyVim ; seuls les ajouts et surcharges de cette config sont listés (leader = `<space>`). Les défauts LazyVim ne sont pas repris.

| Touche | Action | Source |
|---|---|---|
| `<leader><tab>b` | Previous tab | config/keymaps.lua |
| `<leader><tab>n` | Next tab | config/keymaps.lua |
| `<leader>Tf` | Terminal (float) | config/keymaps.lua |
| `<leader>Ts` | Terminal (split) | config/keymaps.lua |
| `<leader>Tv` | Terminal (vertical) | config/keymaps.lua |
| `<leader>aO` | OpenCode (continue) | config/keymaps.lua |
| `<leader>ao` | OpenCode | config/keymaps.lua |
| `<leader>bb` | Previous buffer | config/keymaps.lua |
| `<leader>bn` | Next buffer | config/keymaps.lua |
| `<C-h>` | Nav Left (vim/herdr) | tmux |
| `<C-j>` | Nav Down (vim/herdr) | tmux |
| `<C-k>` | Nav Up (vim/herdr) | tmux |
| `<C-l>` | Nav Right (vim/herdr) | tmux |

## Zed

355 bindings, groupés par contexte tels que Zed les évalue.

<details><summary><code>(global)</code> — 6 bindings</summary>

| Touche | Action |
|---|---|
| `ctrl-h` | `workspace::ActivatePaneLeft` |
| `ctrl-l` | `workspace::ActivatePaneRight` |
| `ctrl-j` | `workspace::ActivatePaneDown` |
| `ctrl-k` | `workspace::ActivatePaneUp` |
| `cmd-@` | `editor::RestartLanguageServer` |
| `cmd-ù` | `git_panel::ToggleFocus` |

</details>

<details><summary><code>Workspace</code> — 15 bindings</summary>

| Touche | Action |
|---|---|
| `cmd-shift-t` | `task::Spawn` |
| `alt-C` | `["task::Spawn", {"task_name": "Claude Code (Dangerous Skip Permissions)"}]` |
| `alt-f` | `["task::Spawn", {"task_name": "Files: FZF"}]` |
| `alt-y` | `["task::Spawn", {"task_name": "Files: Yazi"}]` |
| `alt-R` | `["task::Spawn", {"task_name": "Files: Rename Files (FZF)"}]` |
| `alt-g` | `["task::Spawn", {"task_name": "Git: Lazygit"}]` |
| `alt-w` | `["task::Spawn", {"task_name": "Git: gwm-cli"}]` |
| `alt-r` | `["task::Spawn", {"task_name": "Database: Redis CLI"}]` |
| `alt-s` | `["task::Spawn", {"task_name": "LazySQL"}]` |
| `alt-c` | `["task::Spawn", {"task_name": "LazyCurl"}]` |
| `alt-S` | `["task::Spawn", {"task_name": "LazySSH"}]` |
| `alt-d` | `["task::Spawn", {"task_name": "Docker: Lazydocker"}]` |
| `alt-k` | `["task::Spawn", {"task_name": "Kubernetes: Lazykube"}]` |
| `alt-p` | `["task::Spawn", {"task_name": "Files: Generate Project Structure file"}]` |
| `alt-m` | `["task::Spawn", {"task_name": "Lazymake"}]` |

</details>

<details><summary><code>(ProjectPanel && not_editing)</code> — 37 bindings</summary>

| Touche | Action |
|---|---|
| `/` | `file_finder::Toggle` |
| `f g` | `workspace::NewSearch` |
| `a` | `project_panel::NewFile` |
| `A` | `project_panel::NewDirectory` |
| `d` | `project_panel::Delete` |
| `D` | `project_panel::Duplicate` |
| `R` | `project_panel::Rename` |
| `y` | `project_panel::Copy` |
| `Y` | `project_panel::Cut` |
| `p` | `project_panel::Paste` |
| `c` | `workspace::CopyRelativePath` |
| `C` | `workspace::CopyPath` |
| `n` | `project_panel::SelectNextDirectory` |
| `b` | `project_panel::SelectPrevDirectory` |
| `T` | `workspace::OpenInTerminal` |
| `ctrl-v` | `project_panel::OpenSplitVertical` |
| `ctrl-s` | `project_panel::OpenSplitHorizontal` |
| `space /` | `file_finder::Toggle` |
| `space space` | `file_finder::Toggle` |
| `space f f` | `file_finder::Toggle` |
| `space f g` | `workspace::NewSearch` |
| `space g g` | `git_panel::ToggleFocus` |
| `space a` | `project_panel::NewFile` |
| `space A` | `project_panel::NewDirectory` |
| `space d` | `project_panel::Delete` |
| `space D` | `project_panel::Duplicate` |
| `space R` | `project_panel::Rename` |
| `space y` | `project_panel::Copy` |
| `space Y` | `project_panel::Cut` |
| `space p` | `project_panel::Paste` |
| `space c` | `workspace::CopyRelativePath` |
| `space C` | `workspace::CopyPath` |
| `space n` | `project_panel::SelectNextDirectory` |
| `space b` | `project_panel::SelectPrevDirectory` |
| `space T` | `workspace::OpenInTerminal` |
| `space ctrl-v` | `project_panel::OpenSplitVertical` |
| `space ctrl-s` | `project_panel::OpenSplitHorizontal` |

</details>

<details><summary><code>Terminal</code> — 14 bindings</summary>

| Touche | Action |
|---|---|
| `ctrl-escape` | `terminal::ToggleViMode` |
| `cmd-i` | `assistant::InlineAssist` |
| `alt-C` | `["task::Spawn", {"task_name": "Claude Code (Dangerous Skip Permissions)"}]` |
| `alt-f` | `["task::Spawn", {"task_name": "Files: FZF"}]` |
| `alt-y` | `["task::Spawn", {"task_name": "Files: Yazi"}]` |
| `alt-R` | `["task::Spawn", {"task_name": "Files: Rename Files (FZF)"}]` |
| `alt-g` | `["task::Spawn", {"task_name": "Git: Lazygit"}]` |
| `alt-r` | `["task::Spawn", {"task_name": "Database: Redis CLI"}]` |
| `alt-s` | `["task::Spawn", {"task_name": "LazySQL"}]` |
| `alt-c` | `["task::Spawn", {"task_name": "LazyCurl"}]` |
| `alt-S` | `["task::Spawn", {"task_name": "LazySSH"}]` |
| `alt-d` | `["task::Spawn", {"task_name": "Docker: Lazydocker"}]` |
| `alt-k` | `["task::Spawn", {"task_name": "Kubernetes: Lazykube"}]` |
| `alt-p` | `["task::Spawn", {"task_name": "Files: Generate Project Structure file"}]` |

</details>

<details><summary><code>Terminal && !menu</code> — 62 bindings</summary>

| Touche | Action |
|---|---|
| `ctrl-a h` | `workspace::ActivatePaneLeft` |
| `ctrl-a j` | `workspace::ActivatePaneDown` |
| `ctrl-a k` | `workspace::ActivatePaneUp` |
| `ctrl-a l` | `workspace::ActivatePaneRight` |
| `ctrl-a H` | `workspace::SwapPaneLeft` |
| `ctrl-a J` | `workspace::SwapPaneDown` |
| `ctrl-a K` | `workspace::SwapPaneUp` |
| `ctrl-a L` | `workspace::SwapPaneRight` |
| `ctrl-a z` | `workspace::ToggleZoom` |
| `ctrl-a =` | `workspace::IncreaseActiveDockSize` |
| `ctrl-a -` | `workspace::DecreaseActiveDockSize` |
| `ctrl-a +` | `workspace::ResetActiveDockSize` |
| `ctrl-a n` | `pane::ActivateNextItem` |
| `ctrl-a b` | `pane::ActivatePreviousItem` |
| `ctrl-a x` | `pane::CloseActiveItem` |
| `ctrl-a tab` | `pane::ActivateNextItem` |
| `ctrl-a shift-tab` | `pane::ActivatePreviousItem` |
| `ctrl-a b n` | `pane::ActivateNextItem` |
| `ctrl-a b b` | `pane::ActivatePreviousItem` |
| `ctrl-a b d` | `pane::CloseActiveItem` |
| `ctrl-a b o` | `pane::CloseOtherItems` |
| `ctrl-a v` | `pane::SplitRight` |
| `ctrl-a s` | `pane::SplitDown` |
| `ctrl-a e` | `project_panel::ToggleFocus` |
| `ctrl-a space` | `file_finder::Toggle` |
| `ctrl-a f f` | `file_finder::Toggle` |
| `ctrl-a f g` | `pane::DeploySearch` |
| `ctrl-a f p` | `projects::OpenRecent` |
| `ctrl-a f s` | `outline::Toggle` |
| `ctrl-a f t` | `terminal_panel::ToggleFocus` |
| `ctrl-a f T` | `workspace::NewCenterTerminal` |
| `ctrl-a e ;` | `go_to_line::Toggle` |
| `ctrl-a a i` | `assistant::InlineAssist` |
| `ctrl-a a f` | `agent::ToggleFocus` |
| `ctrl-a a p` | `agent::AddSelectionToThread` |
| `ctrl-a a c` | `["task::Spawn", {"task_name": "Claude Code (Dangerous Skip Permissions)"}]` |
| `ctrl-a a C` | `["task::Spawn", {"task_name": "Claude Code (Continue + Dangerous Skip Permissions)"}]` |
| `ctrl-a g g` | `git_panel::ToggleFocus` |
| `ctrl-a G G` | `["task::Spawn", {"task_name": "Git: Lazygit"}]` |
| `ctrl-a t t` | `task::Spawn` |
| `ctrl-a t T` | `terminal::RerunTask` |
| `ctrl-a t n` | `["task::Spawn", {"task_name": "IDE: Neovim"}]` |
| `ctrl-a t f` | `["task::Spawn", {"task_name": "Files: FZF"}]` |
| `ctrl-a t y` | `["task::Spawn", {"task_name": "Files: Yazi"}]` |
| `ctrl-a t r` | `["task::Spawn", {"task_name": "Files: Rename Files (FZF)"}]` |
| `ctrl-a t d` | `["task::Spawn", {"task_name": "Docker: Lazydocker"}]` |
| `ctrl-a t k` | `["task::Spawn", {"task_name": "Kubernetes: Lazykube"}]` |
| `ctrl-a t p` | `["task::Spawn", {"task_name": "Files: Generate Project Structure file"}]` |
| `ctrl-a t l` | `["task::Spawn", {"task_name": "Git: Generate Git Logs file"}]` |
| `ctrl-a t L` | `["task::Spawn", {"task_name": "Git: Generate Git Logs file (All)"}]` |
| `ctrl-a t s` | `["task::Spawn", {"task_name": "LazySQL"}]` |
| `ctrl-a t S` | `["task::Spawn", {"task_name": "LazySSH"}]` |
| `ctrl-a t c` | `["task::Spawn", {"task_name": "LazyCurl"}]` |
| `ctrl-a t m` | `["task::Spawn", {"task_name": "Lazymake"}]` |
| `ctrl-a , k` | `zed::OpenKeymapFile` |
| `ctrl-a , K` | `zed::OpenKeymap` |
| `ctrl-a , s` | `zed::OpenSettingsFile` |
| `ctrl-a , S` | `zed::OpenSettings` |
| `ctrl-a , t` | `zed::OpenTasks` |
| `ctrl-a , c` | `theme_selector::Toggle` |
| `ctrl-a , C` | `icon_theme_selector::Toggle` |
| `ctrl-a , e` | `zed::Extensions` |

</details>

<details><summary><code>Editor</code> — 18 bindings</summary>

| Touche | Action |
|---|---|
| `ctrl-space` | `editor::ShowCompletions` |
| `alt-shift-f` | `editor::Format` |
| `cmd-shift-r` | `editor::Rename` |
| `cmd-shift-k` | `editor::DeleteLine` |
| `cmd-g` | `editor::SelectLargerSyntaxNode` |
| `cmd-shift-g` | `editor::SelectSmallerSyntaxNode` |
| `alt-k` | `editor::MoveLineUp` |
| `alt-j` | `editor::MoveLineDown` |
| `alt-up` | `editor::MoveLineUp` |
| `alt-down` | `editor::MoveLineDown` |
| `cmd-<` | `editor::ToggleInlayHints` |
| `alt-shift-p` | `markdown::OpenPreview` |
| `cmd-i` | `assistant::InlineAssist` |
| `cmd-;` | `go_to_line::Toggle` |
| `ctrl-shift-h` | `pane::SplitAndMoveLeft` |
| `ctrl-shift-l` | `pane::SplitAndMoveRight` |
| `ctrl-shift-k` | `pane::SplitAndMoveUp` |
| `ctrl-shift-j` | `pane::SplitAndMoveDown` |

</details>

<details><summary><code>Editor && VimControl && !VimWaiting && !menu</code> — 172 bindings</summary>

| Touche | Action |
|---|---|
| `alt-k` | `editor::MoveLineUp` |
| `alt-j` | `editor::MoveLineDown` |
| `z a` | `editor::ToggleFold` |
| `z h` | `editor::Fold` |
| `z H` | `editor::FoldAll` |
| `z l` | `editor::UnfoldLines` |
| `z L` | `editor::UnfoldAll` |
| `ctrl-n` | `pane::ActivateNextItem` |
| `ctrl-b` | `pane::ActivatePreviousItem` |
| `ctrl-x` | `pane::CloseActiveItem` |
| `ctrl-v` | `pane::SplitRight` |
| `ctrl-s` | `pane::SplitDown` |
| `ctrl-a h` | `workspace::ActivatePaneLeft` |
| `ctrl-a j` | `workspace::ActivatePaneDown` |
| `ctrl-a k` | `workspace::ActivatePaneUp` |
| `ctrl-a l` | `workspace::ActivatePaneRight` |
| `ctrl-a H` | `workspace::SwapPaneLeft` |
| `ctrl-a J` | `workspace::SwapPaneDown` |
| `ctrl-a K` | `workspace::SwapPaneUp` |
| `ctrl-a L` | `workspace::SwapPaneRight` |
| `ctrl-a z` | `workspace::ToggleZoom` |
| `ctrl-a =` | `workspace::IncreaseActiveDockSize` |
| `ctrl-a -` | `workspace::DecreaseActiveDockSize` |
| `ctrl-a +` | `workspace::ResetActiveDockSize` |
| `ctrl-a n` | `pane::ActivateNextItem` |
| `ctrl-a b` | `pane::ActivatePreviousItem` |
| `ctrl-a x` | `pane::CloseActiveItem` |
| `ctrl-a tab` | `pane::ActivateNextItem` |
| `ctrl-a shift-tab` | `pane::ActivatePreviousItem` |
| `ctrl-a b n` | `pane::ActivateNextItem` |
| `ctrl-a b b` | `pane::ActivatePreviousItem` |
| `ctrl-a b d` | `pane::CloseActiveItem` |
| `ctrl-a b o` | `pane::CloseOtherItems` |
| `ctrl-a v` | `pane::SplitRight` |
| `ctrl-a s` | `pane::SplitDown` |
| `ctrl-a e` | `project_panel::ToggleFocus` |
| `ctrl-a space` | `file_finder::Toggle` |
| `ctrl-a f f` | `file_finder::Toggle` |
| `ctrl-a f g` | `pane::DeploySearch` |
| `ctrl-a f p` | `projects::OpenRecent` |
| `ctrl-a f s` | `outline::Toggle` |
| `ctrl-a f t` | `terminal_panel::ToggleFocus` |
| `ctrl-a f T` | `workspace::NewCenterTerminal` |
| `ctrl-a a i` | `assistant::InlineAssist` |
| `ctrl-a a f` | `agent::ToggleFocus` |
| `ctrl-a a p` | `agent::AddSelectionToThread` |
| `ctrl-a a c` | `["task::Spawn", {"task_name": "Claude Code (Dangerous Skip Permissions)"}]` |
| `ctrl-a a C` | `["task::Spawn", {"task_name": "Claude Code (Continue + Dangerous Skip Permissions)"}]` |
| `ctrl-a g g` | `git_panel::ToggleFocus` |
| `ctrl-a G G` | `["task::Spawn", {"task_name": "Git: Lazygit"}]` |
| `ctrl-a t t` | `task::Spawn` |
| `ctrl-a t T` | `terminal::RerunTask` |
| `ctrl-a t n` | `["task::Spawn", {"task_name": "IDE: Neovim"}]` |
| `ctrl-a t f` | `["task::Spawn", {"task_name": "Files: FZF"}]` |
| `ctrl-a t y` | `["task::Spawn", {"task_name": "Files: Yazi"}]` |
| `ctrl-a t r` | `["task::Spawn", {"task_name": "Files: Rename Files (FZF)"}]` |
| `ctrl-a t d` | `["task::Spawn", {"task_name": "Docker: Lazydocker"}]` |
| `ctrl-a t k` | `["task::Spawn", {"task_name": "Kubernetes: Lazykube"}]` |
| `ctrl-a t p` | `["task::Spawn", {"task_name": "Files: Generate Project Structure file"}]` |
| `ctrl-a t l` | `["task::Spawn", {"task_name": "Git: Generate Git Logs file"}]` |
| `ctrl-a t L` | `["task::Spawn", {"task_name": "Git: Generate Git Logs file (All)"}]` |
| `ctrl-a t s` | `["task::Spawn", {"task_name": "LazySQL"}]` |
| `ctrl-a t S` | `["task::Spawn", {"task_name": "LazySSH"}]` |
| `ctrl-a t c` | `["task::Spawn", {"task_name": "LazyCurl"}]` |
| `ctrl-a t m` | `["task::Spawn", {"task_name": "Lazymake"}]` |
| `ctrl-a , k` | `zed::OpenKeymapFile` |
| `ctrl-a , K` | `zed::OpenKeymap` |
| `ctrl-a , s` | `zed::OpenSettingsFile` |
| `ctrl-a , S` | `zed::OpenSettings` |
| `ctrl-a , t` | `zed::OpenTasks` |
| `ctrl-a , c` | `theme_selector::Toggle` |
| `ctrl-a , C` | `icon_theme_selector::Toggle` |
| `ctrl-a , e` | `zed::Extensions` |
| `space b n` | `pane::ActivateNextItem` |
| `space b b` | `pane::ActivatePreviousItem` |
| `space b d` | `pane::CloseActiveItem` |
| `space b o` | `pane::CloseOtherItems` |
| `space b f` | `editor::Format` |
| `space b D` | `editor::DiffClipboardWithSelection` |
| `space tab` | `pane::ActivateNextItem` |
| `space shift-tab` | `pane::ActivatePreviousItem` |
| `space v` | `pane::SplitRight` |
| `space s` | `pane::SplitDown` |
| `space x` | `pane::CloseActiveItem` |
| `space m` | `markdown::OpenPreview` |
| `space M` | `markdown::OpenPreviewToTheSide` |
| `space w v` | `pane::SplitRight` |
| `space w s` | `pane::SplitDown` |
| `space w d` | `pane::CloseActiveItem` |
| `space w h` | `workspace::ActivatePaneLeft` |
| `space w j` | `workspace::ActivatePaneDown` |
| `space w k` | `workspace::ActivatePaneUp` |
| `space w l` | `workspace::ActivatePaneRight` |
| `space w n` | `workspace::ActivateNextPane` |
| `space w b` | `workspace::ActivatePreviousPane` |
| `space w H` | `workspace::SwapPaneLeft` |
| `space w J` | `workspace::SwapPaneDown` |
| `space w K` | `workspace::SwapPaneUp` |
| `space w L` | `workspace::SwapPaneRight` |
| `space w z` | `workspace::ToggleZoom` |
| `space w =` | `workspace::IncreaseActiveDockSize` |
| `space w -` | `workspace::DecreaseActiveDockSize` |
| `space w +` | `workspace::ResetActiveDockSize` |
| `space e` | `project_panel::ToggleFocus` |
| `space space` | `file_finder::Toggle` |
| `space f f` | `file_finder::Toggle` |
| `space f g` | `pane::DeploySearch` |
| `space f p` | `projects::OpenRecent` |
| `space f b` | `vim::Search` |
| `space f s` | `outline::Toggle` |
| `space f r` | `search::ToggleReplace` |
| `space f l` | `go_to_line::Toggle` |
| `space f t` | `terminal_panel::ToggleFocus` |
| `space f T` | `workspace::NewCenterTerminal` |
| `space ;` | `go_to_line::Toggle` |
| `space c r` | `editor::Rename` |
| `space c a` | `editor::ToggleCodeActions` |
| `space c d` | `editor::GoToDefinition` |
| `space c D` | `editor::GoToTypeDefinition` |
| `space c i` | `editor::GoToImplementation` |
| `space R` | `editor::Rename` |
| `space o` | `editor::Hover` |
| `space .` | `editor::ToggleCodeActions` |
| `space A` | `editor::FindAllReferences` |
| `space @` | `editor::RestartLanguageServer` |
| `space g g` | `git_panel::ToggleFocus` |
| `space G G` | `["task::Spawn", {"task_name": "Git: Lazygit"}]` |
| `space g b` | `git::Blame` |
| `space g D` | `["task::Spawn", {"task_name": "Git: Lumen diff"}]` |
| `space g d` | `git::Diff` |
| `space g t` | `git_panel::ToggleTreeView` |
| `space g w` | `git::Worktree` |
| `space g v` | `editor::ToggleSplitDiff` |
| `space t t` | `task::Spawn` |
| `space t T` | `terminal::RerunTask` |
| `space t n` | `["task::Spawn", {"task_name": "IDE: Neovim"}]` |
| `space t f` | `["task::Spawn", {"task_name": "Files: FZF"}]` |
| `space t y` | `["task::Spawn", {"task_name": "Files: Yazi"}]` |
| `space t r` | `["task::Spawn", {"task_name": "Files: Rename Files (FZF)"}]` |
| `space t d` | `["task::Spawn", {"task_name": "Docker: Lazydocker"}]` |
| `space t k` | `["task::Spawn", {"task_name": "Kubernetes: Lazykube"}]` |
| `space t p` | `["task::Spawn", {"task_name": "Files: Generate Project Structure file"}]` |
| `space t l` | `["task::Spawn", {"task_name": "Git: Generate Git Logs file"}]` |
| `space t L` | `["task::Spawn", {"task_name": "Git: Generate Git Logs file (All)"}]` |
| `space t s` | `["task::Spawn", {"task_name": "LazySQL"}]` |
| `space t S` | `["task::Spawn", {"task_name": "LazySSH"}]` |
| `space t c` | `["task::Spawn", {"task_name": "LazyCurl"}]` |
| `space t e` | `["task::Spawn", {"task_name": "Documentaion: Ekphos"}]` |
| `space t E` | `["task::Spawn", {"task_name": "Documentaion: Ekphos file (FZF)"}]` |
| `space t m` | `["task::Spawn", {"task_name": "Lazymake"}]` |
| `space a c` | `["task::Spawn", {"task_name": "Claude Code (Dangerous Skip Permissions)"}]` |
| `space a C` | `["task::Spawn", {"task_name": "Claude Code (Continue + Dangerous Skip Permissions)"}]` |
| `space a i` | `assistant::InlineAssist` |
| `space a f` | `agent::ToggleFocus` |
| `space a p` | `agent::AddSelectionToThread` |
| `space i` | `assistant::InlineAssist` |
| `space S` | `project_symbols::Toggle` |
| `space G` | `editor::SelectAllMatches` |
| `space s d` | `diagnostics::Deploy` |
| `space d` | `editor::GoToDiagnostic` |
| `space D` | `editor::GoToPreviousDiagnostic` |
| `space , k` | `zed::OpenKeymapFile` |
| `space , K` | `zed::OpenKeymap` |
| `space , s` | `zed::OpenSettingsFile` |
| `space , S` | `zed::OpenSettings` |
| `space , t` | `zed::OpenTasks` |
| `space , c` | `theme_selector::Toggle` |
| `space , C` | `icon_theme_selector::Toggle` |
| `space , e` | `zed::Extensions` |
| `space 0` | `vim::StartOfDocument` |
| `space *` | `["vim::MoveToNext", {"partial_word": true}]` |
| `space ¨` | `["vim::MoveToPrevious", {"partial_word": true}]` |

</details>

<details><summary><code>Editor && VimControl && vim_mode == visual</code> — 2 bindings</summary>

| Touche | Action |
|---|---|
| `space i` | `assistant::InlineAssist` |
| `space a i` | `assistant::InlineAssist` |

</details>

<details><summary><code>(GitPanel && ChangesList)</code> — 23 bindings</summary>

| Touche | Action |
|---|---|
| `space` | `git::ToggleStaged` |
| `a` | `git::StageAll` |
| `u` | `git::UnstageAll` |
| `c` | `git::Commit` |
| `ctrl-i` | `git::GenerateCommitMessage` |
| `P` | `git::Push` |
| `p` | `git::Pull` |
| `f` | `git::Fetch` |
| `b` | `git::Branch` |
| `B` | `git::CheckoutBranch` |
| `w` | `git::Worktree` |
| `s` | `git::StashAll` |
| `S` | `git::ViewStash` |
| `A` | `git::StashPop` |
| `d` | `git::RestoreFile` |
| `D` | `git::Diff` |
| `C` | `git::CreatePullRequest` |
| `i` | `git::AddToGitignore` |
| `I` | `git::Init` |
| ``` | `git_panel::ToggleTreeView` |
| `t` | `git_panel::ToggleTreeView` |
| `q` | `git_panel::Close` |
| `/` | `pane::DeploySearch` |

</details>

<details><summary><code>GitPanel</code> — 3 bindings</summary>

| Touche | Action |
|---|---|
| `ctrl-i` | `git::GenerateCommitMessage` |
| `ctrl-q` | `git_panel::Close` |
| `ctrl-x` | `git_panel::Close` |

</details>

<details><summary><code>CommitEditor > Editor</code> — 3 bindings</summary>

| Touche | Action |
|---|---|
| `ctrl-i` | `git::GenerateCommitMessage` |
| `ctrl-q` | `git_panel::Close` |
| `ctrl-x` | `git_panel::Close` |

</details>

## tmux — multiplexeur historique

Remplacé par herdr au quotidien, gardé pour les sessions existantes. Prefix = `C-a`. Config générée par home-manager (`nix-config/home.nix`), pas par chezmoi.

| Touche | Table | Commande |
|---|---|---|
| `Send` | prefix | `the prefix key through to the application" \` |
| `r` | prefix | `source-file ~/.tmux.conf \; display "Config reloaded!"` |
| `b` | prefix | `previous-window` |
| `n` | prefix | `next-window` |
| `h` | prefix | `select-pane -L` |
| `j` | prefix | `select-pane -D` |
| `k` | prefix | `select-pane -U` |
| `l` | prefix | `select-pane -R` |
| `x` | prefix | `kill-pane` |
| `v` | prefix | `split-window -h -c "#{pane_current_path}"` |
| `s` | prefix | `split-window -v -c "#{pane_current_path}"` |
| `c` | prefix | `new-window -c "#{pane_current_path}"` |
| `X` | prefix | `kill-window` |
| `C-h` | prefix | `if-shell "$is_vim" 'send-keys C-h' 'select-pane -L'` |
| `C-j` | prefix | `if-shell "$is_vim" 'send-keys C-j' 'select-pane -D'` |
| `C-k` | prefix | `if-shell "$is_vim" 'send-keys C-k' 'select-pane -U'` |
| `C-l` | prefix | `if-shell "$is_vim" 'send-keys C-l' 'select-pane -R'` |
| `H` | prefix | `resize-pane -L 5` |
| `J` | prefix | `resize-pane -D 5` |
| `K` | prefix | `resize-pane -U 5` |
| `L` | prefix | `resize-pane -R 5` |
| `V` | prefix | `copy-mode` |
| `copy-mode-vi` | prefix | `Escape send-keys -X cancel` |
| `copy-mode-vi` | prefix | `Enter send-keys -X copy-selection-and-cancel` |
| `copy-mode-vi` | prefix | `'C-h' select-pane -L` |
| `copy-mode-vi` | prefix | `'C-j' select-pane -D` |
| `copy-mode-vi` | prefix | `'C-k' select-pane -U` |
| `copy-mode-vi` | prefix | `'C-l' select-pane -R` |
| `T` | prefix | `run-shell "sesh connect \"$(` |
| `L` | prefix | `run-shell "sesh last"` |

## Ghostty

| Touche | Action |
|---|---|
| `super+enter` | `unbind` |
