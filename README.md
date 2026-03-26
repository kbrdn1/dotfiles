# Dotfiles

Welcome to my dotfiles repository! This repository is managed using [Chezmoi](https://www.chezmoi.io/) and [Nix Home Manager](https://github.com/nix-community/home-manager).

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
| **Package Manager** | Nix + Home Manager 24.11 | Declarative CLI tools (70+ packages) |
| **GUI Apps** | Homebrew Casks | GUI applications and system tools |
| **Dotfiles** | Chezmoi | Configuration file management |
| **Shell** | Zsh + Oh-My-Zsh | Interactive shell with plugins |
| **Theme** | Powerlevel10k | Shell prompt theme |
| **Primary Editor** | Zed | Modern code editor with AI integration |
| **Secondary Editor** | Neovim + LazyVim | Terminal editor with LSP, Claude Code integration |
| **Terminal** | Ghostty + Kitty + Tmux | GPU terminals with multiplexer (Claude Dark theme) |
| **Window Manager** | AeroSpace + Karabiner-Elements | Tiling window manager (no SIP required) |
| **Menu Bar** | Sketchybar | Custom menu bar with 6 themes |
| **File Manager** | Yazi + Superfile | Terminal file managers |
| **Music** | MPD + rmpc | Music player daemon with TUI client |

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

> **Note**: All Nix-managed tools have their versions pinned via `flake.lock` (nixpkgs 24.11 channel). Specific version numbers are listed where explicitly configured in `home.nix`; otherwise versions follow the nixpkgs pin.

### Programming Languages & Runtimes

| Tool | Version | Managed By | Notes |
|------|---------|------------|-------|
| [Node.js](https://nodejs.org/) | 24.x | Nix | JavaScript runtime |
| [Python](https://www.python.org/) | 3.13.x | Nix | Python interpreter |
| [PHP](https://www.php.net/) | 8.4.x | Nix | With pcov, redis extensions |
| [Go](https://golang.org/) | - | Nix | Golang compiler |
| [Rust](https://www.rust-lang.org/) | - | Nix | Rust toolchain (rustc, cargo, clippy, rustfmt) |
| [Rust Analyzer](https://rust-analyzer.github.io/) | - | Nix | Rust LSP server |
| [Bun](https://bun.sh/) | - | Nix | Fast JavaScript runtime |
| [Deno](https://deno.land/) | - | Nix | Secure TypeScript runtime |
| [pnpm](https://pnpm.io/) | - | Nix | Fast package manager |
| [Symfony CLI](https://symfony.com/download) | - | Nix | Symfony tooling |
| [Composer](https://getcomposer.org/) | Latest | Homebrew | PHP dependency manager |

### Kubernetes & Container Tools

| Tool | Version | Managed By | Purpose |
|------|---------|------------|---------|
| [kubectl](https://kubernetes.io/) | - | Nix | Kubernetes CLI |
| [Helm](https://helm.sh/) | - | Nix | Kubernetes package manager |
| [Minikube](https://minikube.sigs.k8s.io/) | - | Nix | Local Kubernetes |
| [ArgoCD](https://argoproj.github.io/cd/) | - | Nix | GitOps CD tool |
| [k9s](https://k9scli.io/) | - | Nix | Kubernetes TUI |
| [kubectx](https://github.com/ahmetb/kubectx) | - | Nix | Context switcher |
| [stern](https://github.com/stern/stern) | - | Nix | Multi-pod logs |
| [kustomize](https://kustomize.io/) | - | Nix | Kubernetes config |
| [kubecolor](https://github.com/hidetatz/kubecolor) | - | Nix | Colorized kubectl |
| [dive](https://github.com/wagoodman/dive) | - | Nix | Docker image explorer |
| [popeye](https://popeyecli.io/) | - | Nix | Kubernetes scanner |
| [Lazykube](https://github.com/TNK-Studio/lazykube) | Latest | Homebrew | Kubernetes TUI |

### Development Tools

| Tool | Version | Managed By | Purpose |
|------|---------|------------|---------|
| [Git](https://git-scm.com/) | - | Nix | Version control |
| [GitHub CLI](https://cli.github.com/) | - | Nix | GitHub integration |
| [Lazygit](https://github.com/jesseduffield/lazygit) | - | Nix | Git TUI |
| [Lazydocker](https://github.com/jesseduffield/lazydocker) | - | Nix | Docker TUI |
| [Lazysql](https://github.com/jorgerojas26/lazysql) | - | Nix | SQL TUI client |
| [Redis](https://redis.io/) | - | Nix | In-memory database |
| [Pandoc](https://pandoc.org/) | - | Nix | Document converter |
| [Neovim](https://neovim.io/) | - | Nix | Secondary editor (LazyVim) |
| [Sesh](https://github.com/joshmedeski/sesh) | - | Nix | Tmux session manager |
| [PlantUML](https://plantuml.com/) | - | Nix | Diagram generation |
| [D2](https://d2lang.com/) | - | Nix | Modern diagram scripting |
| [Gnuplot](http://www.gnuplot.info/) | - | Nix | Graph generation |
| [Just](https://github.com/casey/just) | - | Nix | Task runner |
| [Tokei](https://github.com/XAMPPRocky/tokei) | - | Nix | Code statistics |
| [Hyperfine](https://github.com/sharkdp/hyperfine) | - | Nix | Benchmarking |
| [Chezmoi](https://www.chezmoi.io/) | - | Nix | Dotfiles management |
| [Direnv](https://direnv.net/) | - | Nix | Directory-level environments |

### Shell & Terminal

| Tool | Version | Managed By | Purpose |
|------|---------|------------|---------|
| [Zsh](https://www.zsh.org/) | - | Nix | Interactive shell |
| [Oh My Zsh](https://ohmyz.sh/) | Latest | Manual (install.sh) | Zsh framework |
| [Powerlevel10k](https://github.com/romkatv/powerlevel10k) | Latest | Manual (install.sh) | Zsh theme |
| [Bat](https://github.com/sharkdp/bat) | - | Nix | Enhanced cat (Claude Dark theme) |
| [Eza](https://eza.rocks/) | - | Nix | Modern ls |
| [Yazi](https://github.com/sxyazi/yazi) | - | Nix | File manager |
| [Superfile](https://github.com/yorukot/superfile) | Latest | Homebrew | File manager TUI |
| [Tmux](https://github.com/tmux/tmux) | - | Nix | Terminal multiplexer |
| [Fzf](https://github.com/junegunn/fzf) | - | Nix | Fuzzy finder (Claude Dark theme) |
| [Zoxide](https://github.com/ajeetdsouza/zoxide) | - | Nix | Smarter cd (`z` command) |
| [Neofetch](https://github.com/dylanaraps/neofetch) | - | Nix | System info |

### System & Network Tools

| Tool | Version | Managed By | Purpose |
|------|---------|------------|---------|
| [coreutils](https://www.gnu.org/software/coreutils/) | - | Nix | GNU core utilities |
| [findutils](https://www.gnu.org/software/findutils/) | - | Nix | GNU find utilities |
| [gnused](https://www.gnu.org/software/sed/) | - | Nix | GNU sed |
| [gnugrep](https://www.gnu.org/software/grep/) | - | Nix | GNU grep |
| [Tree](https://mama.indstate.edu/users/ice/tree/) | - | Nix | Directory listing |
| [fd](https://github.com/sharkdp/fd) | - | Nix | Find alternative |
| [ripgrep](https://github.com/BurntSushi/ripgrep) | - | Nix | Grep alternative |
| [htop](https://htop.dev/) | - | Nix | Process viewer |
| [duf](https://github.com/muesli/duf) | - | Nix | Disk usage |
| [bottom](https://github.com/ClementTsang/bottom) | - | Nix | System monitor |
| [jq](https://jqlang.github.io/jq/) | - | Nix | JSON processor |
| [yq](https://github.com/mikefarah/yq) | - | Nix | YAML processor |
| [curl](https://curl.se/) | - | Nix | URL transfer |
| [wget](https://www.gnu.org/software/wget/) | - | Nix | Web downloader |
| [HTTPie](https://httpie.io/) | - | Nix | HTTP client |
| [dogdns](https://github.com/ogham/dog) | - | Nix | DNS client |

### Multimedia & Music

| Tool | Version | Managed By | Purpose |
|------|---------|------------|---------|
| [ffmpeg](https://ffmpeg.org/) | - | Nix | Video/audio processing |
| [ImageMagick](https://imagemagick.org/) | - | Nix | Image processing |
| [Poppler](https://poppler.freedesktop.org/) | - | Nix | PDF tools |
| [rmpc](https://github.com/mierak/rmpc) | - | Nix | MPD client TUI |
| [mpc](https://www.musicpd.org/clients/mpc/) | - | Nix | MPD CLI client |

### Cloud & API Tools

| Tool | Version | Managed By | Purpose |
|------|---------|------------|---------|
| [AWS CLI](https://aws.amazon.com/cli/) | v2 | Nix | Amazon Web Services |
| [Stripe CLI](https://stripe.com/docs/stripe-cli) | - | Nix | Stripe API testing |

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
| `edit-p10k` | `$EDITOR ~/.p10k.zsh` | Edit Powerlevel10k configuration |

### Development Aliases
| Alias | Command | Description |
|-------|---------|-------------|
| `py`, `python` | `/usr/bin/python3` | Python 3 |
| `pa`, `laravel` | `php artisan` | PHP Artisan CLI |
| `a`, `adonis` | `node ace` | Adonis Ace CLI |
| `ls` | `eza --color=always --long --git --no-filesize --icons=always --no-time --no-user --no-permissions --group-directories-first` | Enhanced listing |
| `z` | `zoxide` | Smart directory navigation (replaces `cd` for frequent dirs) |
| `lg` | `lazygit` | Terminal UI for Git |
| `lzd` | `lazydocker` | Terminal UI for Docker |
| `f` | `fzf --tmux top,50%` | Fuzzy finder in Tmux fixed on top with 50% height |
| `ad` | `agent-deck` | Launch Agent Deck (bypasses nested tmux detection) |

### GitHub Copilot Aliases
| Alias | Command | Description |
|-------|---------|-------------|
| `gcs` | `gh copilot suggest` | Get command suggestions |
| `gce` | `gh copilot explain` | Explain commands |
| `gcc` | `gh copilot config` | Configure Copilot |
| `gca` | `gh copilot alias` | Manage Copilot aliases |

### Web Search Aliases
| Alias | Command | Description |
|-------|---------|-------------|
| `gg` | `google` | Google search from terminal |
| `yt` | `youtube` | YouTube search from terminal |

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

> [!NOTE]
> **Dual input mode** pour clavier AZERTY - le left Option reste libre pour les caracteres speciaux (`{ } [ ] @ # | \`).
>
> | Mode | Methode | Usage |
> |------|---------|-------|
> | **Leader key** | <kbd>⌥→</kbd> (F18 via Karabiner) puis touche | Clavier interne (portable) |
> | **Held modifier** | <kbd>⌥→</kbd> maintenu (Ctrl+Alt via Karabiner) puis touche | Clavier externe (desktop) |
>
> Sketchybar affiche un indicateur visuel du mode actif (aero/resize/service).

### Workspace Navigation

| Leader key | Held modifier | Workspace | Applications |
|------------|---------------|-----------|-------------|
| <kbd>⌥→</kbd> <kbd>1</kbd> | <kbd>⌥→</kbd>+<kbd>1</kbd> | 1 - Home | Mail, Calendar, Canary Mail |
| <kbd>⌥→</kbd> <kbd>2</kbd> | <kbd>⌥→</kbd>+<kbd>2</kbd> | 2 - Music | Apple Music, Spotify, Tidal |
| <kbd>⌥→</kbd> <kbd>3</kbd> | <kbd>⌥→</kbd>+<kbd>3</kbd> | 3 - Development | Zed, Ghostty, VS Code, JetBrains, Postman |
| <kbd>⌥→</kbd> <kbd>Q</kbd> | <kbd>⌥→</kbd>+<kbd>Q</kbd> | 4 - Web | Helium, Dia/Arc, Chrome, Safari |
| <kbd>⌥→</kbd> <kbd>W</kbd> | <kbd>⌥→</kbd>+<kbd>W</kbd> | 5 - Communication | Slack, Discord, Messages, Teams, Zoom |
| <kbd>⌥→</kbd> <kbd>E</kbd> | <kbd>⌥→</kbd>+<kbd>E</kbd> | 6 - Server Tools | TablePlus, OrbStack, Docker |
| <kbd>⌥→</kbd> <kbd>O</kbd> | <kbd>⌥→</kbd>+<kbd>O</kbd> | 7 - Notes | Obsidian |
| <kbd>⌥→</kbd> <kbd>C</kbd> | <kbd>⌥→</kbd>+<kbd>C</kbd> | 8 - Claude AI | Claude |
| <kbd>⌥→</kbd> <kbd>Tab</kbd> | <kbd>⌥→</kbd>+<kbd>Tab</kbd> | Back and forth | Previous workspace |

### Window Focus

| Leader key | Held modifier | Action |
|------------|---------------|--------|
| <kbd>⌥→</kbd> <kbd>h</kbd>/<kbd>j</kbd>/<kbd>k</kbd>/<kbd>l</kbd> | <kbd>⌥→</kbd>+<kbd>h</kbd>/<kbd>j</kbd>/<kbd>k</kbd>/<kbd>l</kbd> | Focus window (vim-style) |
| <kbd>⌥→</kbd> <kbd>←</kbd>/<kbd>↓</kbd>/<kbd>↑</kbd>/<kbd>→</kbd> | <kbd>⌥→</kbd>+<kbd>←</kbd>/<kbd>↓</kbd>/<kbd>↑</kbd>/<kbd>→</kbd> | Focus window (arrows) |

### Window Movement

| Leader key | Held modifier | Action |
|------------|---------------|--------|
| <kbd>⌥→</kbd> <kbd>⇧</kbd>+<kbd>h</kbd>/<kbd>j</kbd>/<kbd>k</kbd>/<kbd>l</kbd> | <kbd>⌥→</kbd>+<kbd>⇧</kbd>+<kbd>h</kbd>/<kbd>j</kbd>/<kbd>k</kbd>/<kbd>l</kbd> | Move window (vim-style) |
| <kbd>⌥→</kbd> <kbd>⇧</kbd>+<kbd>1</kbd>-<kbd>3</kbd>/<kbd>Q</kbd>/<kbd>W</kbd>/<kbd>E</kbd>/<kbd>O</kbd>/<kbd>C</kbd> | <kbd>⌥→</kbd>+<kbd>⇧</kbd>+<kbd>key</kbd> | Move to workspace |

### Layout & Display

| Leader key | Held modifier | Action |
|------------|---------------|--------|
| <kbd>⌥→</kbd> <kbd>/</kbd> | <kbd>⌥→</kbd>+<kbd>/</kbd> | Toggle tiles layout |
| <kbd>⌥→</kbd> <kbd>,</kbd> | <kbd>⌥→</kbd>+<kbd>,</kbd> | Toggle accordion layout |
| <kbd>⌥→</kbd> <kbd>⇧</kbd>+<kbd>Space</kbd> | <kbd>⌥→</kbd>+<kbd>⇧</kbd>+<kbd>Space</kbd> | Toggle floating/tiling |
| <kbd>⌥→</kbd> <kbd>F</kbd> | <kbd>⌥→</kbd>+<kbd>F</kbd> | Toggle fullscreen |
| <kbd>⌥→</kbd> <kbd>-</kbd>/<kbd>=</kbd> | <kbd>⌥→</kbd>+<kbd>-</kbd>/<kbd>=</kbd> | Resize window (smart) |
| <kbd>⌥→</kbd> <kbd>R</kbd> | <kbd>⌥→</kbd>+<kbd>R</kbd> | Enter resize mode |

### Resize Mode

> Enter with <kbd>⌥→</kbd> <kbd>R</kbd>. Exit with <kbd>Esc</kbd> or <kbd>Enter</kbd>. Stays in resize mode until exit.

| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>h</kbd> | `resize width +50` | Grow width (left) |
| <kbd>j</kbd> | `resize height -50` | Shrink height (down) |
| <kbd>k</kbd> | `resize height +50` | Grow height (up) |
| <kbd>l</kbd> | `resize width -50` | Shrink width (right) |
| <kbd>⇧</kbd>+<kbd>h</kbd> | `resize width -50` | Shrink width (opposite) |
| <kbd>⇧</kbd>+<kbd>j</kbd> | `resize height +50` | Grow height (opposite) |
| <kbd>⇧</kbd>+<kbd>k</kbd> | `resize height -50` | Shrink height (opposite) |
| <kbd>⇧</kbd>+<kbd>l</kbd> | `resize width +50` | Grow width (opposite) |
| <kbd>-</kbd>/<kbd>=</kbd> | Smart resize ±50 | Resize smart |
| <kbd>⇧</kbd>+<kbd>-</kbd>/<kbd>=</kbd> | Smart resize ±10 | Fine smart resize |

### Utilities

| Leader key | Held modifier | Action |
|------------|---------------|--------|
| <kbd>⌥→</kbd> <kbd>Enter</kbd> | <kbd>⌥→</kbd>+<kbd>Enter</kbd> | Open Ghostty terminal |
| <kbd>⌥→</kbd> <kbd>⇧</kbd>+<kbd>X</kbd> | <kbd>⌥→</kbd>+<kbd>⇧</kbd>+<kbd>X</kbd> | Close window |
| <kbd>⌥→</kbd> <kbd>⇧</kbd>+<kbd>=</kbd> | <kbd>⌥→</kbd>+<kbd>⇧</kbd>+<kbd>=</kbd> | Balance window sizes |
| <kbd>⌥→</kbd> <kbd>⇧</kbd>+<kbd>R</kbd> | <kbd>⌥→</kbd>+<kbd>⇧</kbd>+<kbd>R</kbd> | Reload config |
| <kbd>⌥→</kbd> <kbd>⇧</kbd>+<kbd>;</kbd> | <kbd>⌥→</kbd>+<kbd>⇧</kbd>+<kbd>;</kbd> | Enter service mode |
| <kbd>Esc</kbd> | <kbd>Esc</kbd> | Exit current mode |

### SketchyVim (svim)

> Ajoute les modes vim (Normal/Insert/Visual) a tous les champs texte macOS via l'API Accessibility.
> Indicateur de mode visible dans Sketchybar.

| Config | Description |
|--------|-------------|
| `~/.config/svim/svimrc` | Remaps vim (Y, H, L) |
| `~/.config/svim/blacklist` | Apps exclues (Ghostty, Zed, terminals) |
| `~/.config/svim/svim.sh` | Hook sketchybar pour indicateur de mode |

## Shortcuts & Keybindings ⌨️

### Tmux Keybindings 🖥️

> **Prefix**: <kbd>⌃</kbd> + <kbd>A</kbd> (replaces default <kbd>⌃</kbd> + <kbd>B</kbd>)
> **Theme**: Claude Dark with copper accent (`#D4825D`)
> **Config source**: `home.nix` (Nix Home Manager)

#### Session Management

| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>prefix</kbd> + <kbd>R</kbd> | `source-file ~/.tmux.conf` | Reload configuration |
| <kbd>prefix</kbd> + <kbd>T</kbd> | Sesh picker | Open session manager (fzf-based, with multi-source: tmux, configs, zoxide, find) |
| <kbd>prefix</kbd> + <kbd>L</kbd> | Sesh last | Switch to last session |

#### Window Management

| Shortcut | Action |
|----------|--------|
| <kbd>prefix</kbd> + <kbd>C</kbd> | Create new window (in current path) |
| <kbd>prefix</kbd> + <kbd>B</kbd> | Previous window |
| <kbd>prefix</kbd> + <kbd>N</kbd> | Next window |
| <kbd>prefix</kbd> + <kbd>X</kbd> (uppercase) | Close window |

#### Pane Management

| Shortcut | Action |
|----------|--------|
| <kbd>prefix</kbd> + <kbd>H</kbd> | Focus left pane |
| <kbd>prefix</kbd> + <kbd>J</kbd> | Focus down pane |
| <kbd>prefix</kbd> + <kbd>K</kbd> | Focus up pane |
| <kbd>prefix</kbd> + <kbd>L</kbd> | Focus right pane |
| <kbd>prefix</kbd> + <kbd>x</kbd> (lowercase) | Close pane |
| <kbd>prefix</kbd> + <kbd>V</kbd> | Split horizontally (in current path) |
| <kbd>prefix</kbd> + <kbd>S</kbd> | Split vertically (in current path) |
| <kbd>prefix</kbd> + <kbd>⇧</kbd> + <kbd>H/J/K/L</kbd> | Resize pane (repeatable, ±5) |

#### Navigation (no prefix)

| Shortcut | Action |
|----------|--------|
| <kbd>⌃</kbd> + <kbd>h</kbd>/<kbd>j</kbd>/<kbd>k</kbd>/<kbd>l</kbd> | Seamless navigation between tmux panes and nvim splits (tmux.nvim) |

#### Copy Mode

| Shortcut | Action |
|----------|--------|
| <kbd>prefix</kbd> + <kbd>V</kbd> | Enter copy mode |
| <kbd>Escape</kbd> | Cancel copy mode |
| <kbd>Enter</kbd> | Copy selection and exit |

#### Plugins

| Plugin | Trigger | Purpose |
|--------|---------|---------|
| [sesh](https://github.com/joshmedeski/sesh) | <kbd>prefix</kbd> + <kbd>T</kbd> | Smart session manager with fzf |
| [tmux.nvim](https://github.com/aserowy/tmux.nvim) | <kbd>⌃</kbd> + <kbd>h/j/k/l</kbd> | Seamless nvim/tmux navigation |
| [fzf-url](https://github.com/wfxr/tmux-fzf-url) | <kbd>prefix</kbd> + <kbd>U</kbd> | URL picker with fzf |
| [tmux-yank](https://github.com/tmux-plugins/tmux-yank) | - | System clipboard integration |
| claude-dark | - | Custom Claude Dark theme (copper accent `#D4825D`) |
| tmux-cpu | - | CPU usage in status bar |
| tmux-battery | - | Battery status (laptops) |

## Neovim Configuration 📝

Secondary editor using [LazyVim](https://www.lazyvim.org/) with custom plugins and Claude Dark colorscheme.

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

Primary editor with custom Vim-mode keybindings, task integrations, and Claude Dark theme.

### Keybindings 🎹

#### Global Navigation

| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>⌃</kbd> + <kbd>h</kbd>/<kbd>j</kbd>/<kbd>k</kbd>/<kbd>l</kbd> | `workspace::ActivatePane*` | Focus pane (left/down/up/right) |
| <kbd>⌃</kbd> + <kbd>⇧</kbd> + <kbd>h</kbd>/<kbd>j</kbd>/<kbd>k</kbd>/<kbd>l</kbd> | `pane::SplitAndMove*` | Split pane and move (left/down/up/right) |
| <kbd>⌘</kbd> + <kbd>@</kbd> | `editor::RestartLanguageServer` | Restart language server |
| <kbd>⌘</kbd> + <kbd>ù</kbd> | `git_panel::ToggleFocus` | Toggle Git panel |

#### Editor

| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>⌃</kbd> + <kbd>Space</kbd> | `editor::ShowCompletions` | Show completions |
| <kbd>⌥</kbd> + <kbd>⇧</kbd> + <kbd>f</kbd> | `editor::Format` | Format current file |
| <kbd>⌥</kbd> + <kbd>k</kbd>/<kbd>j</kbd> | `editor::MoveLineUp/Down` | Move line up/down |
| <kbd>⌥</kbd> + <kbd>↑</kbd>/<kbd>↓</kbd> | `editor::MoveLineUp/Down` | Move line up/down (arrows) |
| <kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>r</kbd> | `editor::Rename` | Rename symbol |
| <kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>k</kbd> | `editor::DeleteLine` | Delete current line |
| <kbd>⌘</kbd> + <kbd>g</kbd> | `editor::SelectLargerSyntaxNode` | Select larger syntax node |
| <kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>g</kbd> | `editor::SelectSmallerSyntaxNode` | Select smaller syntax node |
| <kbd>⌘</kbd> + <kbd><</kbd> | `editor::ToggleInlayHints` | Toggle inlay hints |
| <kbd>⌘</kbd> + <kbd>;</kbd> | `go_to_line::Toggle` | Go to line |
| <kbd>⌘</kbd> + <kbd>i</kbd> | `assistant::InlineAssist` | Inline AI assist |
| <kbd>⌥</kbd> + <kbd>⇧</kbd> + <kbd>p</kbd> | `markdown::OpenPreview` | Open markdown preview |

#### Alt Shortcuts (Workspace + Terminal)

> These shortcuts work globally and in terminal context for quick access to tools.

| Shortcut | Task | Description |
|----------|------|-------------|
| <kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>t</kbd> | `task::Spawn` | Open task launcher |
| <kbd>⌥</kbd> + <kbd>C</kbd> | Claude Code (skip perms) | Open Claude Code |
| <kbd>⌥</kbd> + <kbd>f</kbd> | Files: FZF | FZF file finder |
| <kbd>⌥</kbd> + <kbd>y</kbd> | Files: Yazi | Yazi file manager |
| <kbd>⌥</kbd> + <kbd>R</kbd> | Files: Rename Files (FZF) | Batch rename files |
| <kbd>⌥</kbd> + <kbd>g</kbd> | Git: Lazygit | Open Lazygit |
| <kbd>⌥</kbd> + <kbd>r</kbd> | Database: Redis CLI | Open Redis CLI |
| <kbd>⌥</kbd> + <kbd>s</kbd> | LazySQL | SQL TUI client |
| <kbd>⌥</kbd> + <kbd>c</kbd> | LazyCurl | HTTP client TUI |
| <kbd>⌥</kbd> + <kbd>S</kbd> | LazySSH | SSH manager TUI |
| <kbd>⌥</kbd> + <kbd>d</kbd> | Docker: Lazydocker | Docker TUI |
| <kbd>⌥</kbd> + <kbd>k</kbd> | Kubernetes: Lazykube | Kubernetes TUI |
| <kbd>⌥</kbd> + <kbd>p</kbd> | Files: Generate Project Structure | Generate project tree |

#### Terminal

> **No direct `ctrl-*` bindings** in Terminal context — all navigation uses the `ctrl-a` prefix (tmux-like) to avoid conflicts with Claude Code, lazygit, and other TUI apps.

| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>⌃</kbd> + <kbd>Esc</kbd> | `terminal::ToggleViMode` | Toggle Vi mode |

### Ctrl-A Prefix (tmux-like) 🖥️

> **Available in both Editor (vim mode) and Terminal.** Mirrors tmux prefix workflow — `ctrl-a` replaces `vim::Increment` in editor.

#### Pane Navigation & Management

| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>⌃a</kbd> <kbd>h</kbd>/<kbd>j</kbd>/<kbd>k</kbd>/<kbd>l</kbd> | `workspace::ActivatePane*` | Focus pane (left/down/up/right) |
| <kbd>⌃a</kbd> <kbd>H</kbd>/<kbd>J</kbd>/<kbd>K</kbd>/<kbd>L</kbd> | `workspace::SwapPane*` | Swap pane (left/down/up/right) |
| <kbd>⌃a</kbd> <kbd>z</kbd> | `workspace::ToggleZoom` | Toggle pane zoom |
| <kbd>⌃a</kbd> <kbd>=</kbd> | `workspace::IncreaseActiveDockSize` | Grow dock (matches aerospace) |
| <kbd>⌃a</kbd> <kbd>-</kbd> | `workspace::DecreaseActiveDockSize` | Shrink dock (matches aerospace) |
| <kbd>⌃a</kbd> <kbd>+</kbd> | `workspace::ResetActiveDockSize` | Reset dock size |

#### Tab / Buffer

| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>⌃a</kbd> <kbd>n</kbd> | `pane::ActivateNextItem` | Next tab |
| <kbd>⌃a</kbd> <kbd>b</kbd> | `pane::ActivatePreviousItem` | Previous tab |
| <kbd>⌃a</kbd> <kbd>x</kbd> | `pane::CloseActiveItem` | Close tab |
| <kbd>⌃a</kbd> <kbd>v</kbd> | `pane::SplitRight` | Split right |
| <kbd>⌃a</kbd> <kbd>s</kbd> | `pane::SplitDown` | Split down |
| <kbd>⌃a</kbd> <kbd>Tab</kbd> | `pane::ActivateNextItem` | Next tab (alt) |

#### Ctrl-A Sub-menus

| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>⌃a</kbd> <kbd>e</kbd> | `project_panel::ToggleFocus` | Toggle explorer |
| <kbd>⌃a</kbd> <kbd>Space</kbd> | `file_finder::Toggle` | File finder |
| <kbd>⌃a</kbd> <kbd>f</kbd> <kbd>f</kbd>/<kbd>g</kbd>/<kbd>p</kbd>/<kbd>s</kbd>/<kbd>t</kbd> | Find | File/Grep/Project/Symbols/Terminal |
| <kbd>⌃a</kbd> <kbd>a</kbd> <kbd>c</kbd> | Claude Code | New session (skip perms) |
| <kbd>⌃a</kbd> <kbd>a</kbd> <kbd>C</kbd> | Claude Code (Continue) | Continue session (skip perms) |
| <kbd>⌃a</kbd> <kbd>a</kbd> <kbd>i</kbd>/<kbd>f</kbd>/<kbd>p</kbd> | AI | Inline assist / Agent focus / Add to thread |
| <kbd>⌃a</kbd> <kbd>g</kbd> <kbd>g</kbd> | `git_panel::ToggleFocus` | Git panel |
| <kbd>⌃a</kbd> <kbd>G</kbd> <kbd>G</kbd> | Git: Lazygit | Open Lazygit |
| <kbd>⌃a</kbd> <kbd>t</kbd> <kbd>*</kbd> | Tools | All TUI tools (same as `space t *`) |
| <kbd>⌃a</kbd> <kbd>,</kbd> <kbd>*</kbd> | Settings | Keymap/Settings/Tasks/Theme/Extensions |

### Vim-Mode Keybindings 🧙‍♂️

#### Quick Navigation (Ctrl) — Editor only
| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>⌃</kbd> + <kbd>n</kbd> | `pane::ActivateNextItem` | Next tab/buffer |
| <kbd>⌃</kbd> + <kbd>b</kbd> | `pane::ActivatePreviousItem` | Previous tab/buffer |
| <kbd>⌃</kbd> + <kbd>x</kbd> | `pane::CloseActiveItem` | Close active tab/buffer |
| <kbd>⌃</kbd> + <kbd>v</kbd> | `pane::SplitRight` | Split pane right |
| <kbd>⌃</kbd> + <kbd>s</kbd> | `pane::SplitDown` | Split pane down |

#### Folding (z)
| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>z</kbd> + <kbd>a</kbd> | `editor::ToggleFold` | Toggle fold at cursor |
| <kbd>z</kbd> + <kbd>h</kbd> | `editor::Fold` | Fold at cursor |
| <kbd>z</kbd> + <kbd>H</kbd> | `editor::FoldAll` | Fold all regions |
| <kbd>z</kbd> + <kbd>l</kbd> | `editor::UnfoldLines` | Unfold at cursor |
| <kbd>z</kbd> + <kbd>L</kbd> | `editor::UnfoldAll` | Unfold all regions |

#### Space Leader - Explorer & Search (space f)
| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>Space</kbd> + <kbd>e</kbd> | `project_panel::ToggleFocus` | Toggle project panel |
| <kbd>Space</kbd> + <kbd>Space</kbd> | `file_finder::Toggle` | File finder |
| <kbd>Space</kbd> + <kbd>f</kbd> + <kbd>f</kbd> | `file_finder::Toggle` | File finder |
| <kbd>Space</kbd> + <kbd>f</kbd> + <kbd>g</kbd> | `pane::DeploySearch` | Global search |
| <kbd>Space</kbd> + <kbd>f</kbd> + <kbd>p</kbd> | `projects::OpenRecent` | Open recent project |
| <kbd>Space</kbd> + <kbd>f</kbd> + <kbd>b</kbd> | `vim::Search` | Search in buffer |
| <kbd>Space</kbd> + <kbd>f</kbd> + <kbd>s</kbd> | `outline::Toggle` | Toggle outline view |
| <kbd>Space</kbd> + <kbd>f</kbd> + <kbd>r</kbd> | `search::ToggleReplace` | Search & replace |
| <kbd>Space</kbd> + <kbd>f</kbd> + <kbd>l</kbd> | `go_to_line::Toggle` | Go to line |
| <kbd>Space</kbd> + <kbd>f</kbd> + <kbd>t</kbd> | `terminal_panel::ToggleFocus` | Toggle terminal |
| <kbd>Space</kbd> + <kbd>f</kbd> + <kbd>T</kbd> | `workspace::NewCenterTerminal` | New center terminal |
| <kbd>Space</kbd> + <kbd>;</kbd> | `go_to_line::Toggle` | Go to line |

#### Space Leader - Buffer (space b)
| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>Space</kbd> + <kbd>b</kbd> + <kbd>n</kbd> | `pane::ActivateNextItem` | Next buffer |
| <kbd>Space</kbd> + <kbd>b</kbd> + <kbd>b</kbd> | `pane::ActivatePreviousItem` | Previous buffer |
| <kbd>Space</kbd> + <kbd>b</kbd> + <kbd>d</kbd> | `pane::CloseActiveItem` | Close buffer |
| <kbd>Space</kbd> + <kbd>b</kbd> + <kbd>o</kbd> | `pane::CloseOtherItems` | Close other buffers |
| <kbd>Space</kbd> + <kbd>b</kbd> + <kbd>f</kbd> | `editor::Format` | Format buffer |
| <kbd>Space</kbd> + <kbd>b</kbd> + <kbd>D</kbd> | `editor::DiffClipboardWithSelection` | Diff clipboard |
| <kbd>Space</kbd> + <kbd>Tab</kbd> | `pane::ActivateNextItem` | Next tab |
| <kbd>Space</kbd> + <kbd>⇧</kbd> + <kbd>Tab</kbd> | `pane::ActivatePreviousItem` | Previous tab |
| <kbd>Space</kbd> + <kbd>v</kbd> | `pane::SplitRight` | Split right |
| <kbd>Space</kbd> + <kbd>s</kbd> | `pane::SplitDown` | Split down |
| <kbd>Space</kbd> + <kbd>x</kbd> | `pane::CloseActiveItem` | Close item |
| <kbd>Space</kbd> + <kbd>m</kbd> | `markdown::OpenPreview` | Markdown preview |
| <kbd>Space</kbd> + <kbd>M</kbd> | `markdown::OpenPreviewToTheSide` | Markdown preview (side) |

#### Space Leader - Window / Split (space w)
| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>Space</kbd> + <kbd>w</kbd> + <kbd>v</kbd> | `pane::SplitRight` | Split right |
| <kbd>Space</kbd> + <kbd>w</kbd> + <kbd>s</kbd> | `pane::SplitDown` | Split down |
| <kbd>Space</kbd> + <kbd>w</kbd> + <kbd>d</kbd> | `pane::CloseActiveItem` | Close pane |
| <kbd>Space</kbd> + <kbd>w</kbd> + <kbd>h</kbd>/<kbd>j</kbd>/<kbd>k</kbd>/<kbd>l</kbd> | `workspace::ActivatePane*` | Focus pane |
| <kbd>Space</kbd> + <kbd>w</kbd> + <kbd>H</kbd>/<kbd>J</kbd>/<kbd>K</kbd>/<kbd>L</kbd> | `workspace::SwapPane*` | Swap/move pane |
| <kbd>Space</kbd> + <kbd>w</kbd> + <kbd>n</kbd>/<kbd>b</kbd> | `workspace::ActivateNextPane/PreviousPane` | Next/previous pane |
| <kbd>Space</kbd> + <kbd>w</kbd> + <kbd>z</kbd> | `workspace::ToggleZoom` | Toggle pane zoom |
| <kbd>Space</kbd> + <kbd>w</kbd> + <kbd>=</kbd>/<kbd>-</kbd> | Increase/Decrease dock size | Resize dock (matches aerospace) |
| <kbd>Space</kbd> + <kbd>w</kbd> + <kbd>+</kbd> | Reset dock size | Reset to default |

#### Space Leader - Code / LSP (space c)
| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>Space</kbd> + <kbd>c</kbd> + <kbd>r</kbd> | `editor::Rename` | Rename symbol |
| <kbd>Space</kbd> + <kbd>c</kbd> + <kbd>a</kbd> | `editor::ToggleCodeActions` | Code actions |
| <kbd>Space</kbd> + <kbd>c</kbd> + <kbd>d</kbd> | `editor::GoToDefinition` | Go to definition |
| <kbd>Space</kbd> + <kbd>c</kbd> + <kbd>D</kbd> | `editor::GoToTypeDefinition` | Go to type definition |
| <kbd>Space</kbd> + <kbd>c</kbd> + <kbd>i</kbd> | `editor::GoToImplementation` | Go to implementation |
| <kbd>Space</kbd> + <kbd>R</kbd> | `editor::Rename` | Rename symbol |
| <kbd>Space</kbd> + <kbd>o</kbd> | `editor::Hover` | Show hover info |
| <kbd>Space</kbd> + <kbd>.</kbd> | `editor::ToggleCodeActions` | Code actions |
| <kbd>Space</kbd> + <kbd>A</kbd> | `editor::FindAllReferences` | Find all references |
| <kbd>Space</kbd> + <kbd>@</kbd> | `editor::RestartLanguageServer` | Restart LSP |

#### Space Leader - Git (space g)
| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>Space</kbd> + <kbd>g</kbd> + <kbd>g</kbd> | `git_panel::ToggleFocus` | Toggle Git panel |
| <kbd>Space</kbd> + <kbd>G</kbd> + <kbd>G</kbd> | `task::Spawn "Git: Lazygit"` | Open Lazygit |
| <kbd>Space</kbd> + <kbd>g</kbd> + <kbd>b</kbd> | `git::Blame` | Git blame |
| <kbd>Space</kbd> + <kbd>g</kbd> + <kbd>D</kbd> | `task::Spawn "Git: Lumen diff"` | Lumen diff |
| <kbd>Space</kbd> + <kbd>g</kbd> + <kbd>d</kbd> | `git::Diff` | Git diff |
| <kbd>Space</kbd> + <kbd>g</kbd> + <kbd>t</kbd> | `git_panel::ToggleTreeView` | Toggle tree view |
| <kbd>Space</kbd> + <kbd>g</kbd> + <kbd>w</kbd> | `git::Worktree` | Git worktree |
| <kbd>Space</kbd> + <kbd>g</kbd> + <kbd>v</kbd> | `editor::ToggleSplitDiff` | Toggle split diff |

#### Space Leader - Tools / Tasks (space t)
| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>Space</kbd> + <kbd>t</kbd> + <kbd>t</kbd> | `task::Spawn` | Open task launcher |
| <kbd>Space</kbd> + <kbd>t</kbd> + <kbd>T</kbd> | `terminal::RerunTask` | Rerun last task |
| <kbd>Space</kbd> + <kbd>t</kbd> + <kbd>n</kbd> | IDE: Neovim | Open Neovim |
| <kbd>Space</kbd> + <kbd>t</kbd> + <kbd>f</kbd> | Files: FZF | FZF file finder |
| <kbd>Space</kbd> + <kbd>t</kbd> + <kbd>y</kbd> | Files: Yazi | Yazi file manager |
| <kbd>Space</kbd> + <kbd>t</kbd> + <kbd>r</kbd> | Files: Rename Files (FZF) | Batch rename |
| <kbd>Space</kbd> + <kbd>t</kbd> + <kbd>d</kbd> | Docker: Lazydocker | Docker TUI |
| <kbd>Space</kbd> + <kbd>t</kbd> + <kbd>k</kbd> | Kubernetes: Lazykube | Kubernetes TUI |
| <kbd>Space</kbd> + <kbd>t</kbd> + <kbd>p</kbd> | Files: Generate Project Structure | Project tree |
| <kbd>Space</kbd> + <kbd>t</kbd> + <kbd>l</kbd> | Git: Generate Git Logs file | Git logs (limited) |
| <kbd>Space</kbd> + <kbd>t</kbd> + <kbd>L</kbd> | Git: Generate Git Logs file (All) | Git logs (all) |
| <kbd>Space</kbd> + <kbd>t</kbd> + <kbd>s</kbd> | LazySQL | SQL TUI |
| <kbd>Space</kbd> + <kbd>t</kbd> + <kbd>S</kbd> | LazySSH | SSH manager |
| <kbd>Space</kbd> + <kbd>t</kbd> + <kbd>c</kbd> | LazyCurl | HTTP client |
| <kbd>Space</kbd> + <kbd>t</kbd> + <kbd>e</kbd> | Ekphos | Documentation generator |
| <kbd>Space</kbd> + <kbd>t</kbd> + <kbd>m</kbd> | Lazymake | Build system |

#### Space Leader - AI (space a)
| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>Space</kbd> + <kbd>i</kbd> | `assistant::InlineAssist` | Inline AI assist |
| <kbd>Space</kbd> + <kbd>a</kbd> + <kbd>i</kbd> | `assistant::InlineAssist` | Inline AI assist |
| <kbd>Space</kbd> + <kbd>a</kbd> + <kbd>f</kbd> | `agent::ToggleFocus` | Toggle AI agent panel |
| <kbd>Space</kbd> + <kbd>a</kbd> + <kbd>p</kbd> | `agent::AddSelectionToThread` | Add selection to thread |
| <kbd>Space</kbd> + <kbd>a</kbd> + <kbd>c</kbd> | Claude Code (skip perms) | New Claude Code session |
| <kbd>Space</kbd> + <kbd>a</kbd> + <kbd>C</kbd> | Claude Code (continue + skip perms) | Continue previous session |

> All Claude Code shortcuts use `--dangerously-skip-permissions` by default. Other variants (Chrome, Resume) are available via <kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>t</kbd> task launcher.

#### Space Leader - Symbols & Diagnostics
| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>Space</kbd> + <kbd>S</kbd> | `project_symbols::Toggle` | Project symbols |
| <kbd>Space</kbd> + <kbd>G</kbd> | `editor::SelectAllMatches` | Select all matches |
| <kbd>Space</kbd> + <kbd>s</kbd> + <kbd>d</kbd> | `diagnostics::Deploy` | Deploy diagnostics |
| <kbd>Space</kbd> + <kbd>d</kbd> | `editor::GoToDiagnostic` | Next diagnostic |
| <kbd>Space</kbd> + <kbd>D</kbd> | `editor::GoToPreviousDiagnostic` | Previous diagnostic |

#### Space Leader - Settings (space ,)
| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>Space</kbd> + <kbd>,</kbd> + <kbd>k</kbd> | `zed::OpenKeymapFile` | Edit keymap file |
| <kbd>Space</kbd> + <kbd>,</kbd> + <kbd>K</kbd> | `zed::OpenKeymap` | Open keymap reference |
| <kbd>Space</kbd> + <kbd>,</kbd> + <kbd>s</kbd> | `zed::OpenSettingsFile` | Edit settings file |
| <kbd>Space</kbd> + <kbd>,</kbd> + <kbd>S</kbd> | `zed::OpenSettings` | Open settings reference |
| <kbd>Space</kbd> + <kbd>,</kbd> + <kbd>t</kbd> | `zed::OpenTasks` | Open tasks |
| <kbd>Space</kbd> + <kbd>,</kbd> + <kbd>c</kbd> | `theme_selector::Toggle` | Theme selector |
| <kbd>Space</kbd> + <kbd>,</kbd> + <kbd>C</kbd> | `icon_theme_selector::Toggle` | Icon theme selector |
| <kbd>Space</kbd> + <kbd>,</kbd> + <kbd>e</kbd> | `zed::Extensions` | Extensions |

#### Space Leader - Navigation
| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>Space</kbd> + <kbd>0</kbd> | `vim::StartOfDocument` | Start of document |
| <kbd>Space</kbd> + <kbd>*</kbd> | `vim::MoveToNext` (partial) | Next word occurrence |
| <kbd>Space</kbd> + <kbd>¨</kbd> | `vim::MoveToPrevious` (partial) | Previous word occurrence |

### File Explorer (ProjectPanel) 📁

> Vim-style keybindings when the project panel is focused.

| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>/</kbd> | `file_finder::Toggle` | File finder |
| <kbd>f</kbd> + <kbd>g</kbd> | `workspace::NewSearch` | Global search |
| <kbd>a</kbd> | `project_panel::NewFile` | New file |
| <kbd>A</kbd> | `project_panel::NewDirectory` | New directory |
| <kbd>d</kbd> | `project_panel::Delete` | Delete |
| <kbd>D</kbd> | `project_panel::Duplicate` | Duplicate |
| <kbd>R</kbd> | `project_panel::Rename` | Rename |
| <kbd>y</kbd> / <kbd>Y</kbd> | `Copy` / `Cut` | Copy / Cut |
| <kbd>p</kbd> | `project_panel::Paste` | Paste |
| <kbd>c</kbd> / <kbd>C</kbd> | Copy relative/absolute path | Copy file path |
| <kbd>n</kbd> / <kbd>b</kbd> | Next/Previous directory | Directory navigation |
| <kbd>T</kbd> | `workspace::OpenInTerminal` | Open in terminal |
| <kbd>⌃</kbd> + <kbd>v</kbd>/<kbd>s</kbd> | Split vertical/horizontal | Open in split |

> All the above also work with `Space` prefix (e.g., `Space a` = new file).

### Git Panel 🔀 (lazygit-style)

> Keybindings mirror [lazygit](https://github.com/jesseduffield/lazygit) for muscle memory consistency.

| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>Space</kbd> | `git::ToggleStaged` | Toggle file staging (lazygit: space) |
| <kbd>a</kbd> | `git::StageAll` | Stage all files (lazygit: a) |
| <kbd>u</kbd> | `git::UnstageAll` | Unstage all files |
| <kbd>c</kbd> | `git::Commit` | Commit (lazygit: c) |
| <kbd>⌃</kbd> + <kbd>i</kbd> | `git::GenerateCommitMessage` | AI-generate commit message |
| <kbd>P</kbd> / <kbd>p</kbd> / <kbd>f</kbd> | Push / Pull / Fetch | Remote operations (lazygit: P/p/f) |
| <kbd>b</kbd> / <kbd>B</kbd> | Branch / Checkout branch | Branch management (lazygit: n/space) |
| <kbd>w</kbd> | `git::Worktree` | Git worktree (lazygit: w) |
| <kbd>s</kbd> | `git::StashAll` | Stash all (lazygit: s) |
| <kbd>S</kbd> | `git::ViewStash` | View stash (lazygit: S) |
| <kbd>A</kbd> | `git::StashPop` | Pop stash |
| <kbd>d</kbd> / <kbd>D</kbd> | Restore file / Diff | Discard & diff (lazygit: d) |
| <kbd>C</kbd> | `git::CreatePullRequest` | Create pull request |
| <kbd>i</kbd> | `git::AddToGitignore` | Ignore file (lazygit: i) |
| <kbd>I</kbd> | `git::Init` | Git init |
| <kbd>`</kbd> or <kbd>t</kbd> | `git_panel::ToggleTreeView` | Toggle tree view (lazygit: `) |
| <kbd>/</kbd> | `pane::DeploySearch` | Search (lazygit: /) |
| <kbd>q</kbd> or <kbd>⌃</kbd> + <kbd>q</kbd> | `git_panel::Close` | Close panel (lazygit: q) |

### Tasks 🔄

| Task Name | Command | Description |
|-----------|---------|-------------|
| Claude Code | `claude` | Open Claude Code AI assistant |
| Claude Code (Continue) | `claude --continue` | Continue previous Claude session |
| Claude Code Usage | `bun x ccusage blocks` | Check Claude Code usage stats |
| Git: Lazygit | `lazygit -p $ZED_WORKTREE_ROOT` | Open Lazygit in project root |
| Git: Generate Git Logs file | `generate_git_log.sh <branch> 400` | Generate Git logs (limited) |
| Git: Generate Git Logs file (All) | `generate_git_log.sh <branch> 999999` | Generate Git logs (all) |
| LazySQL | `lazysql` | SQL TUI client |
| LazyCurl | `lazycurl` | HTTP client TUI |
| LazySSH | `lazyssh` | SSH manager TUI |
| Files: FZF | `fzf` with bat preview | Advanced file finder with preview |
| Files: Yazi | `yazi` | Terminal file manager |
| Files: Rename Files (FZF) | `rename_files.sh` | Interactive batch file renaming |
| Files: Generate Project Structure | `eza --tree --level=5 --git-ignore` | Generate project tree file |
| Docker: Lazydocker | `lazydocker` | Docker TUI |
| Kubernetes: Lazykube | `lazykube` | Kubernetes TUI |
| Database: Redis CLI | `redis-cli` | Redis command line interface |
| Laravel: Test | `php artisan test` | Run Laravel tests |
| Laravel: Test (coverage) | `php artisan test --coverage` | Run tests with coverage |
| Laravel: Migrate (fresh and seed) | `php artisan migrate:fresh --seed` | Fresh migration with seed |
| Laravel: Migrate (fresh) | `php artisan migrate:fresh` | Fresh migration |

> [!NOTE]
> Tasks run in the current workspace context. `$ZED_WORKTREE_ROOT` is set to the project root.
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
| **7. Home Manager** | `nix run home-manager/release-24.11 -- switch --flake ~/nix-config` | Install CLI tools (70+ packages) |

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
- **Homebrew Cleanup**: See [MIGRATION_HOMEBREW.md](./MIGRATION_HOMEBREW.md) for removed Homebrew packages
- **AeroSpace Setup**: See [MIGRATION-YABAI-TO-AEROSPACE.md](./MIGRATION-YABAI-TO-AEROSPACE.md) for Yabai → AeroSpace migration

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