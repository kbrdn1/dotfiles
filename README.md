# Dotfiles

Welcome to my dotfiles repository! This repository is managed using [chezmoi](https://www.chezmoi.io/) and [Nix Home Manager](https://github.com/nix-community/home-manager).

<img width="1512" alt="Preview" src="https://github.com/kbrdn1/dotfiles/blob/main/preview.png">

## Table of Contents 📚

- [Stack Overview 📦](#stack-overview-)
- [Sketchybar Themes 🎨](#sketchybar-themes-)
- [Package Management 🛠️](#package-management-)
- [CLI Tools 💻](#cli-tools-)
- [GUI Applications 🖥️](#gui-applications-)
- [Aliases & Functions 🔧](#aliases--functions-)
- [Window Manager (AeroSpace) 🪟](#window-manager-aerospace-)
- [Shortcuts & Keybindings ⌨️](#shortcuts--keybindings-)
- [Neovim Configuration 📝](#neovim-configuration-)
- [Zed Configuration ⚡](#zed-configuration-)
- [Installation 📥](#installation-)
- [Acknowledgments 🙏](#acknowledgments-)
- [License 📄](#license-)

## Stack Overview 📦

| Layer | Tool | Purpose |
|-------|------|---------|
| **Package Manager** | Nix + Home Manager 24.11 | Declarative CLI tools (64+ packages) |
| **GUI Apps** | Homebrew Casks | GUI applications and system tools |
| **Dotfiles** | Chezmoi | Configuration file management |
| **Shell** | Zsh + Oh-My-Zsh | Interactive shell with plugins |
| **Theme** | Powerlevel10k | Shell prompt theme |
| **Editor** | Neovim + LazyVim | Primary editor with LSP, Claude Code integration |
| **Terminal** | Ghostty + Tmux | GPU terminal with multiplexer (Claude Dark theme) |
| **Window Manager** | AeroSpace | Tiling window manager (no SIP required) |
| **Menu Bar** | Sketchybar | Custom menu bar with 6 themes |
| **File Manager** | Yazi + Superfile | Terminal file managers |

## Sketchybar Themes 🎨

| Theme | Style | Accent Color | Description |
|-------|-------|--------------|-------------|
| **Claude Dark** ⭐ | Dark | `#D4825D` (copper) | Warm, elegant theme (default) |
| **Claude Light** | Light | `#C15F3C` (copper) | Light version for bright environments |
| **Blueberry Dark** | Dark | `#27E8A7` (mint) | Fresh blue/violet palette |
| **Catppuccin** | Dark | Pastel | Modern pastel theme |
| **Tokyo Night** | Dark | Blue | Popular VS Code theme port |
| **Nord** | Dark | Cyan | Arctic, bluish color palette |

### Theme Commands

| Command | Description |
|---------|-------------|
| `~/.config/sketchybar/change_theme.sh <theme>` | Change to specified theme |
| `~/.config/sketchybar/preview_theme.sh` | Preview all available themes |

## Package Management 🛠️

| Tool | Version | Purpose | Packages |
|------|---------|---------|----------|
| **Nix** | Multi-user daemon | Declarative package manager | System foundation |
| **Home Manager** | 24.11 | User environment management | 63 CLI tools |
| **Homebrew** | Latest | GUI apps & system tools | Complementary to Nix |
| **Chezmoi** | Latest | Dotfile management | Config sync |

### Nix Management

| Alias | Command | Description |
|-------|---------|-------------|
| `reload-nix` | `nix run home-manager/release-24.11 -- switch --flake ~/nix-config` | Apply Nix configuration changes |
| `edit-nix` | `$EDITOR ~/nix-config/home.nix` | Edit Nix configuration file |

## CLI Tools 💻

### Programming Languages & Runtimes

| Tool | Version | Managed By | Notes |
|------|---------|------------|-------|
| [Node.js](https://nodejs.org/) | 24.11.0 | Nix | JavaScript runtime |
| [Python](https://www.python.org/) | 3.13.8 | Nix | Python interpreter |
| [uv](https://docs.astral.sh/uv/) | 0.8.23 | Nix | Fast Python package manager |
| [PHP](https://www.php.net/) | 8.4.14 | Nix | With pcov, redis extensions |
| [Go](https://golang.org/) | 1.25.2 | Nix | Golang compiler |
| [Rust](https://www.rust-lang.org/) | 1.89.0 | Nix | Rust toolchain |
| [Bun](https://bun.sh/) | 1.3.1 | Nix | Fast JavaScript runtime |
| [Deno](https://deno.land/) | 2.5.6 | Nix | Secure TypeScript runtime |
| [pnpm](https://pnpm.io/) | 10.20.0 | Nix | Fast package manager |
| [Symfony CLI](https://symfony.com/download) | 5.15.1 | Nix | Symfony tooling |
| [Composer](https://getcomposer.org/) | Latest | Homebrew | PHP dependency manager |

### Kubernetes & Container Tools

| Tool | Version | Managed By | Purpose |
|------|---------|------------|---------|
| [kubectl](https://kubernetes.io/) | 1.34.1 | Nix | Kubernetes CLI |
| [Helm](https://helm.sh/) | Latest | Nix | Kubernetes package manager |
| [Minikube](https://minikube.sigs.k8s.io/) | 1.37.0 | Nix | Local Kubernetes |
| [ArgoCD](https://argoproj.github.io/cd/) | Latest | Nix | GitOps CD tool |
| [k9s](https://k9scli.io/) | Latest | Nix | Kubernetes TUI |
| [kubectx](https://github.com/ahmetb/kubectx) | 0.9.5 | Nix | Context switcher |
| [stern](https://github.com/stern/stern) | 1.33.0 | Nix | Multi-pod logs |
| [kustomize](https://kustomize.io/) | 5.7.1 | Nix | Kubernetes config |
| [kubecolor](https://github.com/hidetatz/kubecolor) | 0.5.2 | Nix | Colorized kubectl |
| [dive](https://github.com/wagoodman/dive) | 0.13.1 | Nix | Docker image explorer |
| [popeye](https://popeyecli.io/) | 0.22.1 | Nix | Kubernetes scanner |
| [Lazykube](https://github.com/TNK-Studio/lazykube) | Latest | Homebrew | Kubernetes TUI |

### Development Tools

| Tool | Version | Managed By | Purpose |
|------|---------|------------|---------|
| [Git](https://git-scm.com/) | Latest | Nix | Version control |
| [GitHub CLI](https://cli.github.com/) | Latest | Nix | GitHub integration |
| [Lazygit](https://github.com/jesseduffield/lazygit) | Latest | Nix | Git TUI |
| [Lazydocker](https://github.com/jesseduffield/lazydocker) | Latest | Nix | Docker TUI |
| [Lazysql](https://github.com/jorgerojas26/lazysql) | Latest | Nix | SQL TUI client |
| [Redis](https://redis.io/) | 8.2.2 | Nix | In-memory database |
| [Pandoc](https://pandoc.org/) | 3.7.0.2 | Nix | Document converter |
| [Neovim](https://neovim.io/) | 0.11.5 | Nix | Primary editor (LazyVim) |
| [Sesh](https://github.com/joshmedeski/sesh) | Latest | Nix | Tmux session manager |
| [PlantUML](https://plantuml.com/) | Latest | Nix | Diagram generation |
| [D2](https://d2lang.com/) | Latest | Nix | Modern diagram scripting |
| [Rust Analyzer](https://rust-analyzer.github.io/) | Latest | Nix | Rust LSP server |

### Shell & Terminal

| Tool | Version | Managed By | Purpose |
|------|---------|------------|---------|
| [Zsh](https://www.zsh.org/) | Latest | System | Interactive shell |
| [Oh My Zsh](https://ohmyz.sh/) | Latest | Manual | Zsh framework |
| [Powerlevel10k](https://github.com/romkatv/powerlevel10k) | Latest | Homebrew | Zsh theme |
| [Bat](https://github.com/sharkdp/bat) | Latest | Nix | Enhanced cat |
| [Eza](https://eza.rocks/) | Latest | Nix | Modern ls |
| [Yazi](https://github.com/sxyazi/yazi) | Latest | Nix | File manager |
| [Superfile](https://github.com/yorukot/superfile) | Latest | Homebrew | File manager TUI |
| [Tmux](https://github.com/tmux/tmux) | Latest | Nix | Terminal multiplexer |
| [Fzf](https://github.com/junegunn/fzf) | Latest | Nix | Fuzzy finder |
| [Zoxide](https://github.com/ajeetdsouza/zoxide) | Latest | Nix | Smarter cd |
| [Thefuck](https://github.com/nvbn/thefuck) | Latest | Nix | Command corrector |
| [Neofetch](https://github.com/dylanaraps/neofetch) | Latest | Nix | System info |

### Cloud & API Tools

| Tool | Version | Managed By | Purpose |
|------|---------|------------|---------|
| [AWS CLI](https://aws.amazon.com/cli/) | v2 | Nix | Amazon Web Services |
| [Stripe CLI](https://stripe.com/docs/stripe-cli) | Latest | Nix | Stripe API testing |

### macOS App Store

| Tool | Version | Managed By | Purpose |
|------|---------|------------|---------|
| [mas](https://github.com/mas-cli/mas) | 2.2.2 | Nix | Mac App Store CLI (install App Store apps from terminal) |

## GUI Applications 🖥️

### Development

| Application | Purpose | Managed By | Cask |
|-------------|---------|------------|------|
| [Zed](https://zed.dev/) | Modern code editor | Homebrew | `zed@preview` |
| [Ghostty](https://ghostty.org/) | GPU-accelerated terminal | Homebrew | `ghostty` |
| [Warp](https://warp.dev/) | Rust-based terminal | Homebrew | `warp` |
| [OrbStack](https://orbstack.dev/) | Docker alternative | Homebrew | `orbstack` |
| [Postman](https://www.postman.com/) | API platform | Homebrew | `postman` |
| [TablePlus](https://tableplus.com/) | Database management | SetApp | - |

### Browsers & Communication

| Application | Purpose | Managed By | Cask |
|-------------|---------|------------|------|
| [Arc](https://arc.net/) | Modern browser | Homebrew | `arc` |
| [Slack](https://slack.com/) | Team communication | Homebrew | `slack` |
| [Discord](https://discord.com/) | Community platform | Homebrew | `discord` |
| [WhatsApp](https://www.whatsapp.com/) | Messaging | Homebrew | `whatsapp` |
| [Telegram](https://telegram.org/) | Messaging | Homebrew | `telegram` |
| [Mattermost](https://mattermost.com/) | Team collaboration | Homebrew | `mattermost` |

### Productivity

| Application | Purpose | Managed By | Cask |
|-------------|---------|------------|------|
| [Raycast](https://raycast.com/) | Launcher & productivity | Homebrew | `raycast` |
| [Obsidian](https://obsidian.md/) | Knowledge base | Homebrew | `obsidian` |
| [Claude](https://claude.ai/) | AI assistant | Homebrew | `claude` |
| [Dashlane](https://www.dashlane.com/) | Password manager | App Store | - |
| [Figma](https://www.figma.com/) | Design tool | Homebrew | `figma` |
| [Anki](https://apps.ankiweb.net/) | Spaced repetition | Homebrew | `anki` |
| [CleanShot X](https://cleanshot.com/) | Screenshot tool | SetApp | - |
| [PixelSnap](https://getpixelsnap.com/) | Measurement tool | SetApp | - |
| [Sip](https://sipapp.io/) | Color picker | SetApp | - |
| [Yoink](https://eternalstorms.at/yoink/mac/) | Drag & drop helper | SetApp | - |

### System Tools

| Application | Purpose | Managed By | Cask |
|-------------|---------|------------|------|
| [AeroSpace](https://github.com/nikitabobko/AeroSpace) | Window manager | Homebrew | `nikitabobko/tap/aerospace` |
| [Sketchybar](https://github.com/FelixKratz/SketchyBar) | Menu bar | Homebrew | `felixkratz/formulae/sketchybar` |
| [Borders](https://github.com/FelixKratz/JankyBorders) | Window borders | Homebrew | `felixkratz/formulae/borders` |
| [SF Symbols](https://developer.apple.com/sf-symbols/) | System icons | Homebrew | `sf-symbols` |
| [Logi Options+](https://www.logitech.com/en-us/software/logi-options-plus.html) | Logitech device manager | Homebrew | `logi-options+` |
| [Rectangle](https://rectangleapp.com/) | Window management | Homebrew | `rectangle` |
| [CleanMyMac X](https://macpaw.com/cleanmymac) | System cleaner | SetApp | - |
| [NotchNook](https://lo.cafe/notchnook) | Notch utility | SetApp | - |
| [Canary Mail](https://canarymail.io/) | Email client | SetApp | - |
| [Clop](https://setapp.com/apps/clop) | Media optimizer | SetApp | - |

### Gaming & Entertainment

| Application | Purpose | Managed By | Cask |
|-------------|---------|------------|------|
| [Steam](https://store.steampowered.com/) | Gaming platform | Homebrew | `steam` |

## Aliases & Functions 🔧

### System Aliases
| Alias | Command | Description |
|-------|---------|-------------|
| `x` | `exit` | Exit terminal |
| `config` | `cd $XDG_CONFIG_HOME` | Navigate to config directory |
| `edit-config` | `$EDITOR $XDG_CONFIG_HOME` | Edit config directory |
| `reload-zsh` | `source ~/.zshrc` | Reload ZSH configuration |
| `edit-zsh` | `$EDITOR ~/.zshrc` | Edit ZSH configuration |

### Development Aliases
| Alias | Command | Description |
|-------|---------|-------------|
| `py`, `python` | `/usr/bin/python3` | Python 3 |
| `pa` | `php artisan` | PHP Artisan CLI |
| `a`, `adonis` | `node ace` | Adonis Ace CLI |
| `ls` | `eza --color=always --long --git --no-filesize --icons=always --no-time --no-user --no-permissions --group-directories-first` | Enhanced listing |
| `cd` | `zoxide` | Enhanced directory navigation |
| `lg` | `lazygit` | Terminal UI for Git |
| `lzd` | `lazydocker` | Terminal UI for Docker |
| `f` | `fzf --tmux top,50%` | Fuzzy finder in Tmux fixed on top with 50% height |

### GitHub Copilot Aliases
| Alias | Command | Description |
|-------|---------|-------------|
| `gcs` | `gh copilot suggest` | Get command suggestions |
| `gce` | `gh copilot explain` | Explain commands |
| `gcc` | `gh copilot config` | Configure Copilot |
| `gca` | `gh copilot alias` | Manage Copilot aliases |

### Window Manager Services

| Alias | Command | Description |
|-------|---------|-------------|
| `reload-sketchybar` | `brew services restart sketchybar` | Restart Sketchybar menu bar |
| `edit-sketchybar` | `$EDITOR $XDG_CONFIG_HOME/sketchybar` | Edit Sketchybar configuration |
| `reload-borders` | `brew services restart borders` | Restart window borders |
| `edit-borders` | `$EDITOR $XDG_CONFIG_HOME/borders` | Edit borders configuration |

### Tmux

| Alias | Command | Description |
|-------|---------|-------------|
| `t` | `tmux -2` | Launch Tmux with 256 colors |
| `reload-tmux` | `tmux source-file ~/.tmux.conf` | Reload Tmux configuration |
| `edit-tmux` | `$EDITOR ~/.tmux.conf` | Edit Tmux configuration |

### Custom Functions

| Function | Usage | Description |
|----------|-------|-------------|
| `y()` | `y [path]` | Launch Yazi file manager with directory change on exit |
| `brew()` | `brew [args]` | Homebrew wrapper that triggers Sketchybar updates |
| `zen()` | `zen [mode]` | Toggle Sketchybar zen mode |

## Window Manager (AeroSpace) 🪟

> Modern tiling window manager (no SIP required) - See [MIGRATION-YABAI-TO-AEROSPACE.md](./MIGRATION-YABAI-TO-AEROSPACE.md)

### Workspace Navigation

| Shortcut | Action | Workspace |
|----------|--------|-----------|
| <kbd>⌥</kbd> + <kbd>1</kbd> | Focus workspace 1 | Mail/Calendar |
| <kbd>⌥</kbd> + <kbd>2</kbd> | Focus workspace 2 | Postman |
| <kbd>⌥</kbd> + <kbd>3</kbd> | Focus workspace 3 | Code Editors |
| <kbd>⌥</kbd> + <kbd>Q</kbd> | Focus workspace 4 | Arc Browser |
| <kbd>⌥</kbd> + <kbd>W</kbd> | Focus workspace 5 | Communication/Web |
| <kbd>⌥</kbd> + <kbd>E</kbd> | Focus workspace 6 | Database/Docker |
| <kbd>⌥</kbd> + <kbd>Tab</kbd> | Back and forth | Previous workspace |

### Window Focus

| Shortcut | Action |
|----------|--------|
| <kbd>⌥</kbd> + <kbd>h</kbd>/<kbd>j</kbd>/<kbd>k</kbd>/<kbd>l</kbd> | Focus window (left/down/up/right) |
| <kbd>⌥</kbd> + <kbd>←</kbd>/<kbd>↓</kbd>/<kbd>↑</kbd>/<kbd>→</kbd> | Focus window (arrows) |

### Window Movement

| Shortcut | Action |
|----------|--------|
| <kbd>⇧</kbd> + <kbd>⌥</kbd> + <kbd>h</kbd>/<kbd>j</kbd>/<kbd>k</kbd>/<kbd>l</kbd> | Move window (left/down/up/right) |
| <kbd>⇧</kbd> + <kbd>⌥</kbd> + <kbd>←</kbd>/<kbd>↓</kbd>/<kbd>↑</kbd>/<kbd>→</kbd> | Move window (arrows) |
| <kbd>⇧</kbd> + <kbd>⌥</kbd> + <kbd>1</kbd>/<kbd>2</kbd>/<kbd>3</kbd> | Move to workspace 1/2/3 |
| <kbd>⇧</kbd> + <kbd>⌥</kbd> + <kbd>Q</kbd>/<kbd>W</kbd>/<kbd>E</kbd> | Move to workspace 4/5/6 |
| <kbd>⌃</kbd> + <kbd>⇧</kbd> + <kbd>⌥</kbd> + <kbd>1-6</kbd> | Move to workspace and follow |

### Layout & Display

| Shortcut | Action |
|----------|--------|
| <kbd>⌥</kbd> + <kbd>/</kbd> | Toggle tiles layout (horizontal/vertical) |
| <kbd>⌥</kbd> + <kbd>,</kbd> | Toggle accordion layout (cascade) |
| <kbd>⇧</kbd> + <kbd>⌥</kbd> + <kbd>Space</kbd> | Toggle floating/tiling |
| <kbd>⌥</kbd> + <kbd>F</kbd> | Toggle fullscreen |
| <kbd>⌥</kbd> + <kbd>-</kbd>/<kbd>=</kbd> | Resize window (smart -50/+50) |
| <kbd>⌥</kbd> + <kbd>R</kbd> | Enter resize mode |

### Utilities

| Shortcut | Action |
|----------|--------|
| <kbd>⌥</kbd> + <kbd>Enter</kbd> | Open Ghostty terminal |
| <kbd>⇧</kbd> + <kbd>⌥</kbd> + <kbd>X</kbd> | Close window |
| <kbd>⇧</kbd> + <kbd>⌥</kbd> + <kbd>=</kbd> | Balance window sizes |
| <kbd>⇧</kbd> + <kbd>⌥</kbd> + <kbd>R</kbd> | Reload AeroSpace config |
| <kbd>⇧</kbd> + <kbd>⌥</kbd> + <kbd>;</kbd> | Enter service mode |

## Shortcuts & Keybindings ⌨️

### Tmux Keybindings 🖥️

> **Prefix**: <kbd>⌃</kbd> + <kbd>A</kbd> (replaces default <kbd>⌃</kbd> + <kbd>B</kbd>)
> **Theme**: Claude Dark with copper accent (`#D4825D`)

#### Session Management

| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>prefix</kbd> + <kbd>R</kbd> | `source-file ~/.tmux.conf` | Reload configuration |
| <kbd>prefix</kbd> + <kbd>T</kbd> | Sesh | Open session manager (sesh) |

#### Window Management

| Shortcut | Action |
|----------|--------|
| <kbd>prefix</kbd> + <kbd>C</kbd> | Create new window (in current path) |
| <kbd>prefix</kbd> + <kbd>B</kbd> | Previous window |
| <kbd>prefix</kbd> + <kbd>N</kbd> | Next window |
| <kbd>prefix</kbd> + <kbd>X</kbd> | Close window |

#### Pane Management

| Shortcut | Action |
|----------|--------|
| <kbd>prefix</kbd> + <kbd>H</kbd> | Focus left pane |
| <kbd>prefix</kbd> + <kbd>J</kbd> | Focus down pane |
| <kbd>prefix</kbd> + <kbd>K</kbd> | Focus up pane |
| <kbd>prefix</kbd> + <kbd>L</kbd> | Focus right pane |
| <kbd>prefix</kbd> + <kbd>X</kbd> | Close pane |
| <kbd>prefix</kbd> + <kbd>V</kbd> | Split horizontally (in current path) |
| <kbd>prefix</kbd> + <kbd>S</kbd> | Split vertically (in current path) |

#### Plugins

| Plugin | Trigger | Purpose |
|--------|---------|---------|
| [sesh](https://github.com/joshmedeski/sesh) | <kbd>prefix</kbd> + <kbd>T</kbd> | Smart session manager |
| [tmux.nvim](https://github.com/aserowy/tmux.nvim) | <kbd>⌃</kbd> + <kbd>h/j/k/l</kbd> | Seamless nvim/tmux navigation |
| [fzf-url](https://github.com/wfxr/tmux-fzf-url) | <kbd>prefix</kbd> + <kbd>U</kbd> | URL picker with fzf |
| claude-dark | - | Custom Claude Dark theme (copper accent `#D4825D`) |
| tmux-cpu | - | CPU usage in status bar |
| tmux-battery | - | Battery status (laptops) |

## Neovim Configuration 📝

Primary editor using [LazyVim](https://www.lazyvim.org/) with custom plugins and Claude Dark colorscheme.

### Key Features

| Feature | Plugin/Config | Description |
|---------|--------------|-------------|
| **Colorscheme** | `claude-dark` (custom) | Warm copper theme matching terminal setup |
| **AI Integration** | `claude-code.nvim` | Claude Code integration in editor |
| **Git Worktrees** | `git-worktree.nvim` | Manage git worktrees with telescope |
| **File Manager** | `neo-tree.nvim` | File tree with icons |
| **Docker** | `lazydocker.nvim` | Docker TUI integration |
| **Task Runner** | `overseer.nvim` | Run Zed-compatible tasks from nvim |
| **Tmux** | `tmux.nvim` | Seamless nvim/tmux pane navigation |
| **PHP** | Laravel/PHP extras | PHP development support |
| **Rust** | `rust-analyzer` + extras | Rust development support |
| **Markdown** | `render-markdown.nvim` | Rendered markdown preview |
| **Multi-cursor** | `vim-visual-multi` | Multiple cursor editing |
| **Autosave** | `auto-save.nvim` | Automatic file saving |

### Plugin Structure

```
~/.config/nvim/lua/
├── config/           # Core config (keymaps, options, autocmds, lazy)
├── plugins/          # Plugin specs (one file per plugin/group)
├── claude-dark/      # Custom colorscheme
└── overseer/         # Task templates (Zed tasks compat)
```

## Zed Configuration ⚡

Secondary editor with custom keybindings and tasks.

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

### Automated Installation (Recommended)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/kbrdn1/dotfiles/main/install.sh)"
```

This script performs a complete installation:
1. Install Xcode Command Line Tools
2. Install Nix package manager (multi-user daemon)
3. Install Homebrew (for GUI apps)
4. Clone nix-config repository
5. Install Oh My Zsh
6. Apply dotfiles with Chezmoi
7. Install Home Manager and apply Nix configuration
8. Configure macOS system settings
9. Start services (Sketchybar, Borders)

### Manual Installation

| Step | Command | Description |
|------|---------|-------------|
| **1. Xcode CLI** | `xcode-select --install` | Install Apple command line tools |
| **2. Nix** | `sh <(curl -L https://nixos.org/nix/install) --daemon` | Install Nix (multi-user) |
| **3. Homebrew** | `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"` | Install Homebrew |
| **4. Nix Config** | `git clone https://github.com/kbrdn1/nix-config.git ~/nix-config` | Clone Nix configuration |
| **5. Oh My Zsh** | `sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"` | Install Zsh framework |
| **6. Dotfiles** | `sh -c "$(curl -fsLS get.chezmoi.io)" -- init --apply https://github.com/kbrdn1/dotfiles.git` | Apply dotfiles |
| **7. Home Manager** | `nix run home-manager/release-24.11 -- switch --flake ~/nix-config` | Install CLI tools (64+ packages) |

### macOS System Configuration

```bash
# Keyboard - Fast key repeat
defaults write NSGlobalDomain KeyRepeat -int 1

# Screenshots - Custom location and format
mkdir -p ~/Screenshots
defaults write com.apple.screencapture location ~/Screenshots
defaults write com.apple.screencapture type png
defaults write com.apple.screencapture disable-shadow -bool true

# Menu Bar - Auto-hide
defaults write NSGlobalDomain _HIHideMenuBar -bool true

# Dock - Auto-hide with fast animation
defaults write com.apple.dock autohide -bool true
defaults write com.apple.dock autohide-time-modifier -float 0.15

# Apply changes
killall SystemUIServer Dock
```

### Post-Installation Steps

| Step | Action | Command |
|------|--------|---------|
| **1. Restart Terminal** | Apply shell changes | `exec zsh` |
| **2. Verify Nix** | Check installed packages | `nix profile list` |
| **3. Configure AeroSpace** | Reload window manager | `aerospace --reload` |
| **4. Install SetApp** | Manual installation | Install from SetApp website |
| **5. Restart Computer** | Complete setup | Full system restart |

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Nix not found | Restart terminal or run `. /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh` |
| Home Manager fails | Ensure Nix daemon is running: `sudo launchctl load /Library/LaunchDaemons/org.nixos.nix-daemon.plist` |
| Sketchybar not visible | Run `brew services restart sketchybar` |
| AeroSpace not working | Check permissions in System Settings → Privacy & Security |

### Migration Documentation

- **Nix Migration**: See [MIGRATION_NIX.md](./MIGRATION_NIX.md) for complete ASDF → Nix migration details
- **Homebrew Cleanup**: See [MIGRATION_HOMEBREW.md](./MIGRATION_HOMEBREW.md) for removed packages
- **AeroSpace Setup**: See [MIGRATION-YABAI-TO-AEROSPACE.md](./MIGRATION-YABAI-TO-AEROSPACE.md) for window manager setup

## Acknowledgments 🙏

| Project | Author | Contribution |
|---------|--------|--------------|
| [AeroSpace](https://github.com/nikitabobko/AeroSpace) | [@nikitabobko](https://github.com/nikitabobko) | Modern tiling window manager |
| [Sketchybar](https://github.com/FelixKratz/SketchyBar) | [@FelixKratz](https://github.com/FelixKratz) | Custom menu bar and setup inspiration |
| [JankyBorders](https://github.com/FelixKratz/JankyBorders) | [@FelixKratz](https://github.com/FelixKratz) | Window border visualization |
| [Chezmoi](https://github.com/twpayne/chezmoi) | [@twpayne](https://github.com/twpayne) | Dotfiles management tool |
| [Home Manager](https://github.com/nix-community/home-manager) | [Nix Community](https://github.com/nix-community) | Declarative user environment |
| [Nix](https://nixos.org/) | [NixOS Foundation](https://nixos.org/community/) | Reproducible package management |

## License 📄

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.