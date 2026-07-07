# Dotfiles

Welcome to my dotfiles repository! This repository is managed using [chezmoi](https://www.chezmoi.io/), a tool designed to manage your dotfiles across multiple machines.

<img width="1512" alt="Preview" src="https://github.com/kbrdn1/dotfiles/blob/main/preview.png">

## Table of Contents 📚

- [CLI Tools 🛠️](#cli-tools-)
- [GUI Tools 🖥️](#gui-tools-)
- [Applications 📦](#applications-)
- [SetApp Applications 🎯](#setapp-applications-)
- [Aliases & Functions 🔧](#aliases--functions-)
  - [System Aliases 🖥️](#system-aliases)
  - [Nix Aliases ❄️](#nix-aliases)
  - [Development Aliases 👨‍💻](#development-aliases)
  - [GitHub Copilot Aliases 🤖](#github-copilot-aliases)
  - [Claude Code Aliases 🤖](#claude-code-aliases)
  - [Window Manager Service Aliases 🪟](#window-manager-service-aliases)
  - [Tmux Aliases 📟](#tmux-aliases)
  - [Custom Functions ⚙️](#custom-functions)
- [Shortcuts & Keybindings ⌨️](#shortcuts--keybindings-)
  - [Workspace & Window Focus 🔍](#workspace--window-focus)
  - [Move Windows 🪟](#move-windows)
  - [Layout & Resize 📐](#layout--resize)
  - [Service Mode & Reload 🎛️](#service-mode--reload)
  - [Tmux Keybindings 🖥️](#tmux-keybindings-)
- [Zed Configuration ⚡](#zed-configuration-)
  - [Keybindings 🎹](#keybindings-)
  - [Vim-Mode Keybindings 🧙‍♂️](#vim-mode-keybindings-)
  - [Tasks 🔄](#tasks-)
- [Installation 📥](#installation-)
- [Acknowledgments 🙏](#acknowledgments-)
- [License 📄](#license-)

### CLI Tools 🛠

Command-line tools are installed **declaratively via [Nix](https://nixos.org/) +
[Home Manager](https://github.com/nix-community/home-manager)** (see
[`nix-config/home.nix`](nix-config/home.nix)). Homebrew is kept only for GUI
casks and a few system/exclusive packages. This replaces the previous
ASDF + Homebrew setup (see [MIGRATION_NIX.md](MIGRATION_NIX.md)).

- **Package Management**
  - [Nix](https://nixos.org/) + [Home Manager](https://github.com/nix-community/home-manager): Declarative package & dotfile management
  - [Chezmoi](https://www.chezmoi.io/): Dotfiles manager
  - [Homebrew](https://brew.sh/): GUI casks + system tools (managed outside this repo)

- **Core Utilities**
  - [Coreutils](https://www.gnu.org/software/coreutils/) / [findutils](https://www.gnu.org/software/findutils/) / [gnused](https://www.gnu.org/software/sed/) / [gnugrep](https://www.gnu.org/software/grep/): GNU core utilities
  - [fd](https://github.com/sharkdp/fd): Fast `find` replacement
  - [ripgrep](https://github.com/BurntSushi/ripgrep): Fast recursive grep
  - [tree](http://mama.indstate.edu/users/ice/tree/): Directory tree view
  - [jq](https://jqlang.github.io/jq/) / [yq](https://github.com/mikefarah/yq): JSON / YAML processors
  - [curl](https://curl.se/) / [wget](https://www.gnu.org/software/wget/) / [httpie](https://httpie.io/): HTTP clients

- **Shell & Terminal**
  - [Oh My Zsh](https://ohmyz.sh/): Zsh configuration framework
  - [Powerlevel10k](https://github.com/romkatv/powerlevel10k): Zsh theme
  - [bat](https://github.com/sharkdp/bat): Enhanced `cat` (Claude Dark theme)
  - [eza](https://eza.rocks/): Modern `ls` replacement
  - [Yazi](https://github.com/sxyazi/yazi): Terminal file manager
  - [fzf](https://github.com/junegunn/fzf): Fuzzy finder
  - [zoxide](https://github.com/ajeetdsouza/zoxide): Smarter `cd`
  - [sesh](https://github.com/joshmedeski/sesh): Smart tmux session manager
  - [Tmux](https://github.com/tmux/tmux): Terminal multiplexer
  - [htop](https://htop.dev/) / [bottom](https://github.com/ClementTsang/bottom) / [duf](https://github.com/muesli/duf): System & disk monitors

- **Languages & Runtimes**
  - [Node.js 24](https://nodejs.org/) + [Bun](https://bun.sh/) + [Deno](https://deno.land/) + [pnpm](https://pnpm.io/): JavaScript/TypeScript
  - [Go](https://golang.org/): Programming language
  - [Rust](https://www.rust-lang.org/): `rustc`, `cargo`, `rust-analyzer`, `clippy`, `rustfmt`
  - [Python 3.13](https://www.python.org/): Programming language
  - [PHP 8.4](https://www.php.net/) + [Symfony CLI](https://symfony.com/download): PHP ecosystem (pcov + redis extensions)
  - [Neovim](https://neovim.io/): Hyperextensible Vim-based editor

- **Development Tools**
  - [git](https://git-scm.com/) + [GH](https://cli.github.com/): Version control & GitHub CLI
  - [Lazygit](https://github.com/jesseduffield/lazygit): Git TUI
  - [Lazydocker](https://github.com/jesseduffield/lazydocker): Docker TUI
  - [Lazysql](https://github.com/jorgerojas26/lazysql): Database TUI
  - [gwm](https://github.com/kbrdn1/gwm-cli): Git worktree manager (TUI + CLI)
  - [Tuicr](https://github.com/agavra/tuicr): Terminal code review TUI (vim keybindings, `claude-dark` theme)
  - [tokei](https://github.com/XAMPPRocky/tokei) / [hyperfine](https://github.com/sharkdp/hyperfine): Code stats & benchmarking
  - [pandoc](https://pandoc.org/): Document converter

- **Kubernetes & Cloud**
  - [kubectl](https://kubernetes.io/docs/reference/kubectl/) + [Helm](https://helm.sh/) + [minikube](https://minikube.sigs.k8s.io/): Kubernetes core
  - [k9s](https://k9scli.io/) / [kubectx](https://github.com/ahmetb/kubectx) / [stern](https://github.com/stern/stern) / [kustomize](https://kustomize.io/) / [kubecolor](https://github.com/kubecolor/kubecolor): K8s tooling
  - [ArgoCD](https://argo-cd.readthedocs.io/) / [dive](https://github.com/wagoodman/dive) / [popeye](https://github.com/derailed/popeye): GitOps & cluster/image auditing
  - [AWS CLI](https://aws.amazon.com/cli/) (+ SSM plugin), [Stripe CLI](https://stripe.com/docs/stripe-cli), [gws](https://github.com/kbrdn1) (Google Workspace CLI), [gcloud](https://cloud.google.com/sdk)

- **Media**
  - [ffmpeg](https://ffmpeg.org/) / [ImageMagick](https://imagemagick.org/) / [poppler](https://poppler.freedesktop.org/): Media & document processing

### GUI Tools 🖥

Essential graphical tools:

- **Window Management** (migrated from Yabai + skhd — see [MIGRATION-YABAI-TO-AEROSPACE.md](MIGRATION-YABAI-TO-AEROSPACE.md))
  - [AeroSpace](https://github.com/nikitabobko/AeroSpace): i3-like tiling window manager (8 workspaces, native bindings)
  - [Karabiner-Elements](https://karabiner-elements.pqrs.org/): Keyboard remapper — maps right <kbd>⌥</kbd> to F18, the AeroSpace leader key
  - [JankyBorders](https://github.com/FelixKratz/JankyBorders): Active window borders
  - [SketchyVim](https://github.com/FelixKratz/SketchyVim): Vim keybindings in native text fields
  - [SwipeAeroSpace](https://github.com/MediosZ/SwipeAeroSpace): Trackpad swipe gestures to switch AeroSpace workspaces

- **UI Enhancement**
  - [Sketchybar](https://github.com/FelixKratz/SketchyBar): Custom menu bar (AeroSpace + SketchyVim integration)
  - [Open Island](https://github.com/Octane0411/open-vibe-island): Notch companion to monitor & control AI coding agents (Claude Code, Codex…)
  - [SF Symbols](https://developer.apple.com/sf-symbols/): Apple system symbols
  - [Sketchybar App Font](https://github.com/kvndrsslr/sketchybar-app-font): Icon font

### Applications 📦

Key applications:

- **Development**
  - [Ghostty](https://ghostty.org/) + **herdr**: Primary dev environment — GPU-accelerated terminal + workspace/agent manager
  - [Zed](https://zed.dev/): Secondary IDE
  - [Neovim](https://neovim.io/): Terminal editor
  - [OrbStack](https://orbstack.dev/): Docker / Linux VM alternative
  - [Postman](https://www.postman.com/): API platform

- **Browsers & Communication**
  - [Helium](https://helium.computer/): Privacy-first Chromium browser
  - [Mattermost](https://mattermost.com/): Team communication
  - [Discord](https://discord.com/): Community platform
  - [WhatsApp](https://www.whatsapp.com/): Messaging
  - [Spark Mail](https://sparkmailapp.com/): Email client

- **Productivity**
  - [Raycast](https://raycast.com/): Launcher & productivity tool
  - [Obsidian](https://obsidian.md/): Knowledge base
  - [Rectangle](https://rectangleapp.com/): Window management
  - [Dashlane](https://www.dashlane.com/): Password manager
  - [Figma](https://www.figma.com/): Design tool

### SetApp Applications 📦

Premium applications via SetApp:

- **Development**
  - [TablePlus](https://tableplus.com/): Database management

- **Productivity**
  - [CleanShot X](https://cleanshot.com/): Screenshot tool
  - [PixelSnap](https://getpixelsnap.com/): Measurement tool
  - [Sip](https://sipapp.io/): Color management

- **System Tools**
  - [CleanMyMac X](https://macpaw.com/cleanmymac): System cleaner

## Aliases & Functions 🔧

> Aliases and functions are defined in [`nix-config/home.nix`](nix-config/home.nix)
> (`programs.zsh.shellAliases` / `initExtra`), not in a standalone `.zshrc`.

### System Aliases
| Alias | Command | Description |
|-------|---------|-------------|
| `x` | `exit` | Exit terminal |
| `config` | `cd $XDG_CONFIG_HOME` | Navigate to config directory |
| `edit-config` | `$EDITOR $XDG_CONFIG_HOME` | Edit config directory |
| `reload-zsh` | `source ~/.zshrc` | Reload ZSH configuration |

### Nix Aliases
| Alias | Command | Description |
|-------|---------|-------------|
| `reload-nix` | `home-manager switch --flake ~/nix-config` | Apply the Home Manager config |
| `edit-nix` | `$EDITOR ~/nix-config/home.nix` | Edit `home.nix` |
| `edit-flake` | `$EDITOR ~/nix-config/flake.nix` | Edit `flake.nix` |

### Development Aliases
| Alias | Command | Description |
|-------|---------|-------------|
| `py` | `python3` | Python 3 (Nix) |
| `python` | `/usr/bin/python3` | System Python 3 |
| `pa`, `laravel` | `php artisan` | Laravel Artisan CLI |
| `a`, `adonis` | `node ace` | AdonisJS Ace CLI |
| `ls` | `eza --color=always --long --git --no-filesize --icons=always --no-time --no-user --no-permissions --group-directories-first` | Enhanced listing |
| `lg` | `lazygit` | Terminal UI for Git |
| `lzd` | `lazydocker` | Terminal UI for Docker |
| `f` | `fzf --tmux top,50%` | Fuzzy finder in a Tmux popup (top, 50% height) |

### GitHub Copilot Aliases
| Alias | Command | Description |
|-------|---------|-------------|
| `gcs` | `gh copilot suggest` | Get command suggestions |
| `gce` | `gh copilot explain` | Explain commands |
| `gcc` | `gh copilot config` | Configure Copilot |
| `gca` | `gh copilot alias` | Manage Copilot aliases |

### Claude Code Aliases
| Alias | Command | Description |
|-------|---------|-------------|
| `cc` | `claude --dangerously-skip-permissions` | Claude Code (skip permission prompts) |
| `cca` | `claude --enable-auto-mode` | Claude Code in auto mode |
| `ccc` | `claude --dangerously-skip-permissions --chrome` | Claude Code with Chrome |
| `ccv` | `claude --dangerously-skip-permissions --verbose` | Claude Code verbose |

### Window Manager Service Aliases
| Alias | Command | Description |
|-------|---------|-------------|
| `reload-sketchybar` | `brew services restart sketchybar` | Restart Sketchybar |
| `edit-sketchybar` | `$EDITOR $XDG_CONFIG_HOME/sketchybar` | Edit Sketchybar config |
| `reload-borders` | `brew services restart borders` | Restart JankyBorders |
| `edit-borders` | `$EDITOR $XDG_CONFIG_HOME/borders` | Edit JankyBorders config |

> AeroSpace has no reload alias — it reloads in-config via <kbd>⌥→</kbd> <kbd>⇧</kbd><kbd>R</kbd> (see [keybindings](#window-management)).

### Tmux Aliases
| Alias | Command | Description |
|-------|---------|-------------|
| `t` | `tmux -2` | Launch Tmux with 256 colors |
| `reload-tmux` | `tmux source-file ~/.tmux.conf` | Reload Tmux configuration |
| `ad` | `TMUX="" agent-deck` | Launch Agent Deck (outside a nested tmux) |

### Custom Functions
| Function | Description |
|----------|-------------|
| `y [dir]` | Open [Yazi](https://github.com/sxyazi/yazi) and `cd` into the last visited directory on exit |
| `ccp [path]` | Launch Claude Code in a new tmux window of the `main` session (opens Ghostty if needed) |
| `awsp [filter]` | Interactive AWS profile picker (fzf), exports `AWS_PROFILE`, runs `aws sso login` if the session expired |
| `awst` | SSM port-forwarding tunnel to an RDS instance through an SSM-managed bastion (fzf pickers) |
| `zen` | Toggle the Sketchybar "zen" plugin |
| `edit-zsh` / `edit-tmux` / `edit-git` | Jump `$EDITOR` straight to the matching section of `home.nix` |

## Shortcuts & Keybindings ⌨️

> **AeroSpace leader key.** Karabiner maps **right <kbd>⌥</kbd> → F18**, which
> enters AeroSpace's `aero` mode. Each shortcut below is **press <kbd>⌥→</kbd>
> (right Option), then the key**. A <kbd>⌃</kbd><kbd>⌥</kbd> + key fallback exists
> for external keyboards. Workspace keys map letters to numbers:
> `1 2 3` → 1-3, `Q W E` → 4-6, `O` → 7 (Obsidian), `C` → 8 (Claude).

### Workspace & Window Focus
| Shortcut | Action |
|----------|--------|
| <kbd>⌥→</kbd> <kbd>1</kbd>/<kbd>2</kbd>/<kbd>3</kbd> · <kbd>Q</kbd>/<kbd>W</kbd>/<kbd>E</kbd> · <kbd>O</kbd>/<kbd>C</kbd> | Focus workspace 1-8 |
| <kbd>⌥→</kbd> <kbd>Tab</kbd> | Back-and-forth between the last two workspaces |
| <kbd>⌥→</kbd> <kbd>H</kbd>/<kbd>J</kbd>/<kbd>K</kbd>/<kbd>L</kbd> (or arrows) | Focus window left/down/up/right |

### Move Windows
| Shortcut | Action |
|----------|--------|
| <kbd>⌥→</kbd> <kbd>⇧</kbd><kbd>H</kbd>/<kbd>J</kbd>/<kbd>K</kbd>/<kbd>L</kbd> (or arrows) | Move window left/down/up/right |
| <kbd>⌥→</kbd> <kbd>⇧</kbd> + workspace key (`1-3`, `Q W E`, `O`, `C`) | Move window to workspace 1-8 |

### Layout & Resize
| Shortcut | Action |
|----------|--------|
| <kbd>⌥→</kbd> <kbd>/</kbd> | Tiles layout (toggle horizontal/vertical) |
| <kbd>⌥→</kbd> <kbd>,</kbd> | Accordion layout |
| <kbd>⌥→</kbd> <kbd>⇧</kbd><kbd>Space</kbd> | Toggle floating / tiling |
| <kbd>⌥→</kbd> <kbd>F</kbd> | Fullscreen |
| <kbd>⌥→</kbd> <kbd>-</kbd>/<kbd>=</kbd> | Resize smart −/＋50 |
| <kbd>⌥→</kbd> <kbd>R</kbd> | Enter **resize mode** (<kbd>H</kbd>/<kbd>J</kbd>/<kbd>K</kbd>/<kbd>L</kbd> to resize, <kbd>Enter</kbd>/<kbd>Esc</kbd> to exit) |

### Service Mode & Reload
| Shortcut | Action |
|----------|--------|
| <kbd>⌥→</kbd> <kbd>⇧</kbd><kbd>R</kbd> | Reload AeroSpace config |
| <kbd>⌥→</kbd> <kbd>⇧</kbd><kbd>X</kbd> | Close focused window |
| <kbd>⌥→</kbd> <kbd>⇧</kbd><kbd>=</kbd> | Balance window sizes |
| <kbd>⌥→</kbd> <kbd>Enter</kbd> | Open Ghostty |
| <kbd>⌥→</kbd> <kbd>⇧</kbd><kbd>;</kbd> | Enter **service mode** (<kbd>R</kbd> flatten tree, <kbd>Backspace</kbd> close others, <kbd>H</kbd>/<kbd>V</kbd>/<kbd>S</kbd>/<kbd>W</kbd>/<kbd>T</kbd> layouts, <kbd>Esc</kbd> reload + exit) |

### Tmux Keybindings 🖥️

Prefix is <kbd>⌃</kbd> + <kbd>a</kbd> (replaces the default <kbd>⌃</kbd> + <kbd>b</kbd>). Mouse enabled, vi copy mode, windows/panes 1-indexed.

#### Session & Window Management
| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>prefix</kbd> <kbd>T</kbd> | `sesh connect` (fzf) | Smart session picker ([sesh](https://github.com/joshmedeski/sesh)) |
| <kbd>prefix</kbd> <kbd>L</kbd> | `sesh last` | Switch to last session |
| <kbd>prefix</kbd> <kbd>r</kbd> | `source-file ~/.tmux.conf` | Reload configuration |
| <kbd>prefix</kbd> <kbd>c</kbd> | `new-window` | New window (current path) |
| <kbd>prefix</kbd> <kbd>b</kbd> / <kbd>n</kbd> | `previous/next-window` | Previous / next window |
| <kbd>prefix</kbd> <kbd>X</kbd> | `kill-window` | Close window |

#### Pane Management
| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>prefix</kbd> <kbd>h</kbd>/<kbd>j</kbd>/<kbd>k</kbd>/<kbd>l</kbd> | `select-pane` | Focus pane left/down/up/right |
| <kbd>⌃</kbd> <kbd>h</kbd>/<kbd>j</kbd>/<kbd>k</kbd>/<kbd>l</kbd> | vim-aware `select-pane` | Focus pane (tmux.nvim, no prefix) |
| <kbd>prefix</kbd> <kbd>H</kbd>/<kbd>J</kbd>/<kbd>K</kbd>/<kbd>L</kbd> | `resize-pane` (repeatable) | Resize pane |
| <kbd>prefix</kbd> <kbd>v</kbd> / <kbd>s</kbd> | `split-window -h` / `-v` | Split horizontal / vertical (current path) |
| <kbd>prefix</kbd> <kbd>x</kbd> | `kill-pane` | Close pane |
| <kbd>prefix</kbd> <kbd>V</kbd> | `copy-mode` | Enter vi copy mode |
| <kbd>prefix</kbd> <kbd>u</kbd> | `fzf-url` | Pick a URL from the pane |

> [!NOTE]
> Plugins (TPM): tmux-sensible, tmux-yank, tmux-cpu, tmux-battery, tmux-fzf-url.
> The prefix key (<kbd>⌃</kbd> + <kbd>a</kbd>) must be pressed and released before most commands.

## Zed Configuration ⚡

My Zed editor configuration with custom keybindings and tasks.

### Keybindings 🎹

#### General Navigation

| Shortcut | Context | Action | Description |
|----------|---------|--------|-------------|
| <kbd>⌃</kbd> + <kbd>h</kbd> | Editor | `workspace::ActivatePaneLeft` | Focus left pane |
| <kbd>⌃</kbd> + <kbd>j</kbd> | Editor | `workspace::ActivatePaneDown` | Focus down pane |
| <kbd>⌃</kbd> + <kbd>k</kbd> | Editor | `workspace::ActivatePaneUp` | Focus up pane |
| <kbd>⌃</kbd> + <kbd>l</kbd> | Editor | `workspace::ActivatePaneRight` | Focus right pane |
| <kbd>⌘</kbd> + <kbd>@</kbd> | Editor | `editor::RestartLanguageServer` | Restart language server |
| <kbd>⌘</kbd> + <kbd>ù</kbd> | Editor | `git_panel::ToggleFocus` | Toggle Git panel |
| <kbd>⌘</kbd> + <kbd><</kbd> | Editor | `editor::ToggleInlayHints` | Toggle inlay hints |
| <kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>k</kbd> | Editor | `editor::DeleteLine` | Delete current line |
| <kbd>⌘</kbd> + <kbd>g</kbd> | Editor | `editor::SelectLargerSyntaxNode` | Select larger syntax node |
| <kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>g</kbd> | Editor | `editor::SelectSmallerSyntaxNode` | Select smaller syntax node |
| <kbd>⌘</kbd> + <kbd>i</kbd> | Editor | `assistant::InlineAssist` | Inline AI assist |
| <kbd>⌘</kbd> + <kbd>;</kbd> | Editor | `go_to_line::Toggle` | Toggle go to line |
| <kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>r</kbd> | Editor | `editor::Rename` | Rename symbol |

#### Formatting and Movement
| Shortcut | Context | Action | Description |
|----------|---------|--------|-------------|
| <kbd>⌥</kbd> + <kbd>⇧</kbd> + <kbd>f</kbd> | Editor | `editor::Format` | Format current file |
| <kbd>⌥</kbd> + <kbd>k</kbd> | Editor | `editor::MoveLineUp` | Move line up |
| <kbd>⌥</kbd> + <kbd>j</kbd> | Editor | `editor::MoveLineDown` | Move line down |
| <kbd>⌥</kbd> + <kbd>↑</kbd> | Editor | `editor::MoveLineUp` | Move line up |
| <kbd>⌥</kbd> + <kbd>↓</kbd> | Editor | `editor::MoveLineDown` | Move line down |
| <kbd>⌥</kbd> + <kbd>⇧</kbd> + <kbd>p</kbd> | Editor | `markdown::OpenPreview` | Open markdown preview |

#### Task Shortcuts

| Shortcut | Context | Action | Description |
|----------|---------|--------|-------------|
| <kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>t</kbd> | Workspace | `task::Spawn` | Open task launcher |
| <kbd>⌥</kbd> + <kbd>f</kbd> | Workspace | `task::Spawn "Files: FZF"` | Open FZF file finder |
| <kbd>⌥</kbd> + <kbd>y</kbd> | Workspace | `task::Spawn "Files: Yazi"` | Open Yazi file manager |
| <kbd>⌥</kbd> + <kbd>g</kbd> | Workspace | `task::Spawn "Git: Lazygit"` | Open Lazygit |
| <kbd>⌥</kbd> + <kbd>r</kbd> | Workspace | `task::Spawn "Files: Rename Files (Script)"` | Run file rename script |
| <kbd>⌥</kbd> + <kbd>d</kbd> | Workspace | `task::Spawn "Database: Redis CLI"` | Open Redis CLI |
| <kbd>⌥</kbd> + <kbd>⇧</kbd> + <kbd>d</kbd> | Workspace | `task::Spawn "Docker: Lazydocker"` | Open Lazydocker |
| <kbd>⌥</kbd> + <kbd>⇧</kbd> + <kbd>k</kbd> | Workspace | `task::Spawn "Kubernetes: Lazykube"` | Open Lazykube |
| <kbd>⌥</kbd> + <kbd>t</kbd> | Workspace | `task::Spawn "Laravel: Test"` | Run Laravel tests |
| <kbd>⌥</kbd> + <kbd>⇧</kbd> + <kbd>t</kbd> | Workspace | `task::Spawn "Laravel: Test (coverage)"` | Run Laravel tests with coverage |
| <kbd>⌥</kbd> + <kbd>⇧</kbd> + <kbd>m</kbd> | Workspace | `task::Spawn "Laravel: Migrate (fresh and seed)"` | Run Laravel migration fresh with seed |
| <kbd>⌥</kbd> + <kbd>p</kbd> | Workspace | `task::Spawn "Files: Generate Project Structure file"` | Generate project structure file |

#### AI and Terminal

| Shortcut | Context | Action | Description |
|----------|---------|--------|-------------|
| <kbd>⌘</kbd> + <kbd>⌥</kbd> + <kbd>i</kbd> | Workspace | `assistant::ToggleFocus` | Toggle AI assistant |
| <kbd>⌃</kbd> + <kbd>Esc</kbd> | Terminal | `terminal::ToggleViMode` | Toggle Vi mode in terminal |

> [!NOTE]
> See the [Zed Keybindings Documentation](https://zed.dev/docs/key-bindings) for more information.

### Vim-Mode Keybindings 🧙‍♂️

#### Editor Navigation
| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>z</kbd> + <kbd>a</kbd> | `editor::ToggleFold` | Toggle fold at cursor |
| <kbd>z</kbd> + <kbd>l</kbd> | `editor::Fold` | Fold at cursor |
| <kbd>z</kbd> + <kbd>L</kbd> | `editor::FoldAll` | Fold all regions |
| <kbd>z</kbd> + <kbd>h</kbd> | `editor::UnfoldLines` | Unfold at cursor |
| <kbd>z</kbd> + <kbd>H</kbd> | `editor::UnfoldAll` | Unfold all regions |
| <kbd>⌃</kbd> + <kbd>n</kbd> | `pane::ActivateNextItem` | Next tab/buffer |
| <kbd>⌃</kbd> + <kbd>b</kbd> | `pane::ActivatePreviousItem` | Previous tab/buffer |
| <kbd>⌃</kbd> + <kbd>x</kbd> | `pane::CloseActiveItem` | Close active tab/buffer |
| <kbd>⌃</kbd> + <kbd>-</kbd> | `pane::SplitRight` | Split pane right |
| <kbd>⌃</kbd> + <kbd>=</kbd> | `pane::SplitDown` | Split pane down |

#### Space Leader Commands
| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>Space</kbd> + <kbd>;</kbd> | `go_to_line::Toggle` | Toggle go to line |
| <kbd>Space</kbd> + <kbd>R</kbd> | `editor::Rename` | Rename symbol |
| <kbd>Space</kbd> + <kbd>@</kbd> | `editor::RestartLanguageServer` | Restart language server |
| <kbd>Space</kbd> + <kbd>g</kbd> | `editor::SelectLargerSyntaxNode` | Select larger syntax node |
| <kbd>Space</kbd> + <kbd>G</kbd> | `editor::SelectSmallerSyntaxNode` | Select smaller syntax node |
| <kbd>Space</kbd> + <kbd>j</kbd> | `terminal_panel::ToggleFocus` | Toggle terminal panel |
| <kbd>Space</kbd> + <kbd>ù</kbd> | `git_panel::ToggleFocus` | Toggle Git panel |
| <kbd>Space</kbd> + <kbd>0</kbd> | `vim::StartOfDocument` | Go to start of document |
| <kbd>Space</kbd> + <kbd>o</kbd> | `editor::Hover` | Show hover information |
| <kbd>Space</kbd> + <kbd>Tab</kbd> | `pane::ActivateNextItem` | Next tab/buffer |
| <kbd>Space</kbd> + <kbd>⇧</kbd> + <kbd>Tab</kbd> | `pane::ActivatePreviousItem` | Previous tab/buffer |
| <kbd>Space</kbd> + <kbd>⇧</kbd> + <kbd>s</kbd> | `project_symbols::Toggle` | Toggle project symbols |
| <kbd>Space</kbd> + <kbd>.</kbd> | `editor::ToggleCodeActions` | Toggle code actions |
| <kbd>Space</kbd> + <kbd>⇧</kbd> + <kbd>a</kbd> | `editor::FindAllReferences` | Find all references |
| <kbd>Space</kbd> + <kbd>w</kbd> + <kbd>d</kbd> | `pane::CloseActiveItem` | Close active item |
| <kbd>Space</kbd> + <kbd>*</kbd> | `vim::MoveToNext` (partial_word) | Move to next occurrence of word |
| <kbd>Space</kbd> + <kbd>¨</kbd> | `vim::MoveToPrevious` (partial_word) | Move to previous occurrence of word |

#### Task Commands
| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>Space</kbd> + <kbd>t</kbd> + <kbd>r</kbd> | `task::Spawn "Files: Rename Files (Script)"` | Run file rename script |
| <kbd>Space</kbd> + <kbd>t</kbd> + <kbd>f</kbd> | `task::Spawn "Files: FZF"` | Open FZF file finder |
| <kbd>Space</kbd> + <kbd>t</kbd> + <kbd>y</kbd> | `task::Spawn "Files: Yazi"` | Open Yazi file manager |
| <kbd>Space</kbd> + <kbd>t</kbd> + <kbd>d</kbd> | `task::Spawn "Docker: Lazydocker"` | Open Lazydocker |
| <kbd>Space</kbd> + <kbd>t</kbd> + <kbd>k</kbd> | `task::Spawn "Kubernetes: Lazykube"` | Open Lazykube |
| <kbd>Space</kbd> + <kbd>t</kbd> + <kbd>p</kbd> | `task::Spawn "Files: Generate Project Structure file"` | Generate project structure file |
| <kbd>Space</kbd> + <kbd>t</kbd> + <kbd>l</kbd> | `task::Spawn "Git: Generate Git Logs file"` | Generate Git logs file |
| <kbd>Space</kbd> + <kbd>t</kbd> + <kbd>L</kbd> | `task::Spawn "Git: Generate Git Logs file (All)"` | Generate all Git logs file |
| <kbd>Space</kbd> + <kbd>g</kbd> + <kbd>g</kbd> | `task::Spawn "Git: Lazygit"` | Open Lazygit |
| <kbd>Space</kbd> + <kbd>t</kbd> + <kbd>t</kbd> | `task::Spawn "Laravel: Test"` | Run Laravel tests |
| <kbd>Space</kbd> + <kbd>t</kbd> + <kbd>T</kbd> | `task::Spawn "Laravel: Test (coverage)"` | Run Laravel tests with coverage |
| <kbd>Space</kbd> + <kbd>M</kbd> | `task::Spawn "Laravel: Migrate (fresh and seed)"` | Run Laravel migration fresh with seed |

#### File & Search Operations
| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>Space</kbd> + <kbd>f</kbd> + <kbd>f</kbd> | `file_finder::Toggle` | Toggle file finder |
| <kbd>Space</kbd> + <kbd>f</kbd> + <kbd>p</kbd> | `projects::OpenRecent` | Open recent project |
| <kbd>Space</kbd> + <kbd>f</kbd> + <kbd>b</kbd> | `vim::Search` | Search in current file |
| <kbd>Space</kbd> + <kbd>f</kbd> + <kbd>s</kbd> | `outline::Toggle` | Toggle outline view |
| <kbd>Space</kbd> + <kbd>f</kbd> + <kbd>r</kbd> | `search::ToggleReplace` | Toggle search & replace |
| <kbd>Space</kbd> + <kbd>f</kbd> + <kbd>l</kbd> | `go_to_line::Toggle` | Toggle go to line |
| <kbd>Space</kbd> + <kbd>d</kbd> | `editor::SelectAllMatches` | Select all matches |
| <kbd>Space</kbd> + <kbd>e</kbd> | `project_panel::ToggleFocus` | Toggle project panel |
| <kbd>Space</kbd> + <kbd>b</kbd> + <kbd>f</kbd> | `editor::Format` | Format current file |

#### AI Assistant
| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>Space</kbd> + <kbd>i</kbd> | `assistant::InlineAssist` | Inline AI assist |
| <kbd>Space</kbd> + <kbd>c</kbd> + <kbd>c</kbd> + <kbd>o</kbd> | `assistant::ToggleFocus` | Toggle AI assistant |
| <kbd>Space</kbd> + <kbd>c</kbd> + <kbd>c</kbd> + <kbd>p</kbd> | `assistant::QuoteSelection` | Quote selected text to assistant |

#### Settings & Configuration
| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>Space</kbd> + <kbd>s</kbd> + <kbd>k</kbd> | `zed::OpenKeymap` | Open keymap settings |
| <kbd>Space</kbd> + <kbd>s</kbd> + <kbd>s</kbd> | `zed::OpenSettings` | Open settings |
| <kbd>Space</kbd> + <kbd>s</kbd> + <kbd>t</kbd> | `zed::OpenTasks` | Open tasks |
| <kbd>Space</kbd> + <kbd>s</kbd> + <kbd>T</kbd> | `theme_selector::Toggle` | Toggle theme selector |
| <kbd>Space</kbd> + <kbd>s</kbd> + <kbd>d</kbd> | `diagnostics::Deploy` | Deploy diagnostics |

> [!NOTE]
> You can use the default Vim keybindings in Zed by enabling Vim mode in the settings.
> See the [Zed Vim Documentation](https://zed.dev/docs/vim) for more information.

### Tasks 🔄

| Task Name | Command | Description |
|-----------|---------|-------------|
| Git: Generate Git Logs file | `~/.config/zed/tasks/generate_git_log.sh $(git rev-parse --abbrev-ref HEAD) 400` | Generate Git logs for current branch (limited entries) |
| Git: Generate Git Logs file (All) | `~/.config/zed/tasks/generate_git_log.sh $(git rev-parse --abbrev-ref HEAD) 999999` | Generate Git logs for current branch (all entries) |
| Git: Lazygit | `lazygit -p $ZED_WORKTREE_ROOT` | Open Lazygit in project root |
| Files: Rename Files (Script) | `~/.config/zed/tasks/rename_files.sh "${1:Path}" "${2:Pattern}" "${3:Find}" "${4:Replace}"` | Interactive batch file renaming with parameters |
| Files: FZF | `fzf` with preview and custom bindings | Advanced file finder with preview and syntax highlighting |
| Files: Yazi | `yazi` | Terminal file manager in project root |
| Files: Generate Project Structure | `eza --tree --level=5 --git-ignore` | Generate project structure avoiding vendor/node_modules |
| Laravel: Test | `php artisan test` | Run Laravel tests |
| Laravel: Test (coverage) | `php artisan test --coverage` | Run Laravel tests with coverage |
| Laravel: Migrate (fresh and seed) | `php artisan migrate:fresh --seed` | Fresh database migration with seed |
| Laravel: Migrate (fresh) | `php artisan migrate:fresh` | Fresh database migration without seed |
| Docker: Lazydocker | `lazydocker` | Terminal UI for Docker |
| Kubernetes: Lazykube | `lazykube` | Terminal UI for Kubernetes |
| Database: Redis CLI | `redis-cli` | Redis command line interface |

> [!NOTE]
> The tasks are executed in the context of the current workspace. The `ZED_WORKTREE_ROOT` environment variable is set to the root directory of the current workspace.
> See the [Zed Tasks Documentation](https://zed.dev/docs/tasks) for more information.

## Installation 📥

### One-Line Installation

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/kbrdn1/dotfiles/main/install.sh)"
```

### Manual Installation

1. **Install Command Line Tools**
```bash
xcode-select --install
```

2. **Install Homebrew**
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

3. **Install Oh My Zsh**
```bash
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
```

4. **Clone and Apply Dotfiles**
```bash
chezmoi init https://github.com/kbrdn1/dotfiles.git
chezmoi apply
```

5. **Install Nix & Home Manager** (CLI tools, shell, aliases — see [MIGRATION_NIX.md](MIGRATION_NIX.md))
```bash
# Install Nix (multi-user daemon)
sh <(curl -L https://nixos.org/nix/install) --daemon

# Apply the Home Manager config
nix run home-manager/release-24.11 -- switch --flake ~/nix-config
# thereafter: reload-nix
```

### Post-Installation

1. Configure system preferences:
```bash
# Keyboard
defaults write NSGlobalDomain KeyRepeat -int 1

# Screenshots
mkdir ~/Screenshots
defaults write com.apple.screencapture location ~/Screenshots
defaults write com.apple.screencapture type png
defaults write com.apple.screencapture disable-shadow -bool true

# Menu Bar
defaults write NSGlobalDomain _HIHideMenuBar -bool true

# Dock
defaults write com.apple.dock autohide -bool true
defaults write com.apple.dock autohide-time-modifier -float 0.15
```

2. Grant accessibility permissions to AeroSpace and Karabiner-Elements
3. Install SetApp applications manually
4. Restart your computer

## Acknowledgments 🙏

Special thanks to:
- [FelixKratz](https://github.com/FelixKratz) for window management setup inspiration
- [The Chezmoi team](https://github.com/twpayne/chezmoi) for the dotfiles management tool

## License 📄

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.