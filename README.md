# Dotfiles

Welcome to my dotfiles repository! This repository is managed using [chezmoi](https://www.chezmoi.io/), a tool designed to manage your dotfiles across multiple machines.

<img width="1512" alt="Preview" src="https://github.com/kbrdn1/dotfiles/blob/main/preview.png">

## Table of Contents 📚

- [CLI Tools 🛠️](#cli-tools-)
- [AI & Dev Workflow 🤖](#ai--dev-workflow-)
- [Claude Code Configuration 🧠](#claude-code-configuration-) → [`CLAUDE-CODE.md`](CLAUDE-CODE.md)
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
- [Shortcuts & Keybindings ⌨️](#shortcuts--keybindings-) → [`KEYBINDINGS.md`](KEYBINDINGS.md)
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
  - [herdr](https://herdr.dev): Terminal multiplexer — workspaces, panes and AI-agent panes. The daily driver.
  - [Tmux](https://github.com/tmux/tmux): Multiplexer it replaced. Still installed and configured (via home-manager) for existing sessions, but no longer the default.
  - [sesh](https://github.com/joshmedeski/sesh): Smart tmux session manager
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

### AI & Dev Workflow 🤖

The toolchain the Claude Code config in [`private_dot_claude/`](private_dot_claude)
is built on. **None of it comes from Nix or Homebrew** — a fresh machine running
`home-manager switch` + `brew bundle` gets *none* of these, so they are listed
here with their real install command.

| Tool | What it does | Install |
|---|---|---|
| [Claude Code](https://claude.ai/code) | Primary coding agent — the whole `.claude/` config targets it | `curl -fsSL https://claude.ai/install.sh \| bash` |
| [Codex CLI](https://github.com/openai/codex) | Third-party reviewer, used on sensitive PRs for adversarial diversity | `npm i -g @openai/codex` |
| [CodeRabbit CLI](https://coderabbit.ai/) | Complementary review pass (`coderabbit review --agent`) | official installer → `~/.local/bin` |
| [gwm](https://github.com/kbrdn1/gwm-cli) | Git worktree manager (TUI + CLI) — the default dev flow runs on it | `cargo install --path .` from the repo |
| [graphify](https://pypi.org/project/graphifyy/) | AST graph of a codebase (`graphify extract . --code-only`, free, no API key) | `uv tool install graphifyy` |
| [mgrep](https://www.npmjs.com/package/@mixedbread/mgrep) | Semantic project search, first stop before `grep` | `bun add -g @mixedbread/mgrep` |
| [spark](https://sparkmailapp.com/) | CLI shim into Spark Mail (email / calendar / contacts) | ships with Spark Mail (SetApp) |

Version pinning is deliberate only for **gwm**, built from a local checkout. The
rest track upstream.

### Claude Code Configuration 🧠

The largest part of this repo. It lives in
[`private_dot_claude/`](private_dot_claude) → `~/.claude`, a `private_` tree
because it holds `.credentials.json` and must stay `0700`.

**Full inventory — every skill, command and agent, one by one:
[`CLAUDE-CODE.md`](CLAUDE-CODE.md)** (generated, see below).

#### How it is organised

| Path | What it holds |
|---|---|
| `CLAUDE.md` | Entry point. Imports the four files below and defines the triggers for `graphify` and `tolaria`. |
| `RULES.md` | The working method: priorities (🔴 critical / 🟡 important / 🟢 recommended), the tool cascade, git workflows, quality rules. |
| `WORKFLOW.md` | The same, in diagrams — tool-choice cascade, one flowchart per git workflow, where each kind of knowledge lives. |
| `FLAGS.md`, `PRINCIPLES.md` | Behavioural flags and engineering principles (SuperClaude base). |
| `skills/me/` | My own procedures: git flows, self-paced loops, project bootstrap, document generation. |
| `skills/` (others) | Standalone skills, plus 101 symlinks to third-party installs under `~/.agents/skills` — **those are not versioned here**, the symlink records where they come from. |
| `commands/` | Thin entry points (`/me:…`) that delegate to a skill. |
| `agents/`, `hooks/`, `output-styles/` | Sub-agents, hooks, and output styles. |
| `scripts/` | `statusline.ts` (the live status line, run through the Open Island wrapper) and its tests. |

#### The idea behind it

Three principles hold the config together:

1. **Evidence over assumption.** A claim is backed by a command's real output, a
   test, or documentation — never by what looks plausible.
2. **A gate is a shell command, not a judgement.** The self-paced loops
   (`me:loop:*`) each own a `check_command` whose exit code decides whether to
   continue. A check that cannot prove it ran is not a verdict — a review tool
   that fails with an exhausted quota returns empty output, and empty is not
   "zero findings".
3. **Knowledge is not duplicated.** Git holds the *what* (issues, PRs,
   changelogs), the code and `graphify` hold the *how*, and the Obsidian-style
   vaults hold the *why*. If git already knows it, the vault does not repeat it.

#### Regenerating the inventory

```bash
python3 scripts/gen-claude-doc.py     # → CLAUDE-CODE.md
python3 scripts/gen-keybindings.py    # → KEYBINDINGS.md
```

Both read the live `~/.claude` and `~/.config`, so they cannot drift silently —
which is exactly why the tables are not maintained by hand in this README.

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
  - [Ghostty](https://ghostty.org/) + [herdr](https://herdr.dev): Primary dev environment — GPU-accelerated terminal + workspace/agent manager
  - [Claude](https://claude.ai/download): Desktop companion to the Claude Code CLI
  - [Codex](https://openai.com/codex/): Desktop companion to the Codex CLI
  - [Zed](https://zed.dev/) (+ Zed Preview): Secondary IDE
  - [Neovim](https://neovim.io/): Terminal editor
  - [OrbStack](https://orbstack.dev/): Docker / Linux VM alternative
  - [Postman](https://www.postman.com/): API platform — **not installed right now**, kept here as a target to reinstall

- **Design**
  - [Open Design](https://open-design.ai): Local-first design workspace (MCP server wired into Claude Code)
  - [Pencil](https://pencil.dev): `.pen` design files editor (MCP server wired into Claude Code)
  - [Figma](https://www.figma.com/): Design tool

- **Browsers & Communication**
  - [Helium](https://helium.computer/): Privacy-first Chromium browser
  - [Mattermost](https://mattermost.com/): Team communication
  - [Discord](https://discord.com/): Community platform
  - [WhatsApp](https://www.whatsapp.com/): Messaging

- **Productivity**
  - [Raycast](https://raycast.com/): Launcher & productivity tool
  - [Tolaria](https://tolaria.md): Knowledge base over the `~/Vault/pro` and `~/Vault/perso` git vaults — **replaced [Obsidian](https://obsidian.md/)**, which is still installed but no longer where notes are written
  - [Rectangle](https://rectangleapp.com/): Window management
  - [Dashlane](https://www.dashlane.com/): Password manager

### SetApp Applications 📦

Premium applications via SetApp:

- **Development**
  - [TablePlus](https://tableplus.com/): Database management

- **Productivity**
  - [CleanShot X](https://cleanshot.com/): Screenshot tool
  - [PixelSnap](https://getpixelsnap.com/): Measurement tool
  - [Sip](https://sipapp.io/): Color management
  - [ForkLift](https://binarynights.com/): Dual-pane file manager
  - [Nitro PDF Pro](https://www.gonitro.com/): PDF editing

- **System Tools**
  - [CleanMyMac](https://macpaw.com/cleanmymac): System cleaner
  - [Spark Mail](https://sparkmailapp.com/): Email client — also provides the `spark` CLI used by the `use-spark` skill

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

Every keybinding lives in **[`KEYBINDINGS.md`](KEYBINDINGS.md)** — herdr, AeroSpace,
Neovim, Zed, tmux and Ghostty, in one place.

That file is **generated** from the live configs on the machine:

```bash
python3 scripts/gen-keybindings.py
```

It used to be ~230 lines of tables maintained by hand here, and they drifted from
the actual config every time a binding changed. Regenerating is the only way to
update them, so the document cannot go stale silently. Sources it reads:

| Section | Read from |
|---|---|
| herdr | `~/.config/herdr/config.toml` |
| AeroSpace | `~/.config/aerospace/aerospace.toml` |
| Neovim | `~/.config/nvim/lua/config/keymaps.lua` + `lua/plugins/*.lua` |
| Zed | `~/.config/zed/keymap.json` |
| tmux | `~/.tmux.conf` (generated by home-manager) |
| Ghostty | `~/.config/ghostty/config` |

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