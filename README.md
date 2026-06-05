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
  - [Development Aliases 👨‍💻](#development-aliases)
  - [GitHub Copilot Aliases 🤖](#github-copilot-aliases)
  - [Window Manager Service Aliases 🪟](#window-manager-service-aliases)
  - [Tmux Aliases 📟](#tmux-aliases)
  - [Custom Functions ⚙️](#custom-functions)
- [Shortcuts & Keybindings ⌨️](#shortcuts--keybindings-)
  - [Space & Window Navigation 🔍](#space--window-navigation)
  - [Window Management 🪟](#window-management)
  - [Window Stacking & Resizing 📐](#window-stacking--resizing)
  - [Miscellaneous Controls 🎛️](#miscellaneous-controls)
  - [Tmux Keybindings 🖥️](#tmux-keybindings-)
- [Zed Configuration ⚡](#zed-configuration-)
  - [Keybindings 🎹](#keybindings-)
  - [Vim-Mode Keybindings 🧙‍♂️](#vim-mode-keybindings-)
  - [Tasks 🔄](#tasks-)
- [Installation 📥](#installation-)
- [Acknowledgments 🙏](#acknowledgments-)
- [License 📄](#license-)

### CLI Tools 🛠

Our essential command-line tools:

- **Package Management**
  - [Homebrew](https://brew.sh/): The missing package manager for macOS
  - [Asdf](https://asdf-vm.com/): Multi-language version manager

- **Core Utilities**
  - [Coreutils](https://www.gnu.org/software/coreutils/): GNU core utilities
  - [Curl](https://curl.se/): Data transfer tool
  - [Git](https://git-scm.com/): Version control system
  - [OpenSSL](https://www.openssl.org/): SSL/TLS toolkit
  - [Bison](https://www.gnu.org/software/bison/): Parser generator

- **Shell & Terminal**
  - [Oh My Zsh](https://ohmyz.sh/): Zsh configuration framework
  - [Powerlevel10k](https://github.com/romkatv/powerlevel10k): Zsh theme
  - [Bat](https://github.com/sharkdp/bat): Enhanced cat command
  - [Eza](https://eza.rocks/): Modern ls replacement
  - [Yazi](https://github.com/sxyazi/yazi): Terminal file manager
  - [Tmux](https://github.com/tmux/tmux): Terminal multiplexer

- **Development Tools**
  - [PHP](https://www.php.net/) & [Composer](https://getcomposer.org/): PHP ecosystem
  - [Python](https://www.python.org/): Programming language
  - [Symfony CLI](https://symfony.com/download): Symfony framework tools
  - [Node.js](https://nodejs.org/): JavaScript runtime
  - [Rust](https://www.rust-lang.org/): Systems programming language
  - [Go](https://golang.org/): Programming language
  - [Bun](https://bun.sh/): JavaScript runtime & toolkit
  - [Deno](https://deno.land/): JavaScript runtime

- **Productivity Tools**
  - [GH](https://cli.github.com/): GitHub CLI
  - [Lazygit](https://github.com/jesseduffield/lazygit): Git TUI
  - [Lazydocker](https://github.com/jesseduffield/lazydocker): Docker TUI
  - [Fzf](https://github.com/junegunn/fzf): Fuzzy finder
  - [Zoxide](https://github.com/ajeetdsouza/zoxide): Smarter cd
  - [Thefuck](https://github.com/nvbn/thefuck): Command correction
  - [Neofetch](https://github.com/dylanaraps/neofetch): System info tool
  - [Dashlane CLI](https://cli.dashlane.com/): Password manager CLI

### GUI Tools 🖥

Essential graphical tools:

- **Window Management**
  - [Yabai](https://github.com/koekeishiya/yabai): Tiling window manager
  - [Skhd](https://github.com/koekeishiya/skhd): Hotkey daemon
  - [JankyBorders](https://github.com/FelixKratz/JankyBorders): Window borders
  - [SketchyVim](https://github.com/FelixKratz/SketchyVim): Vim input fields

- **UI Enhancement**
  - [Sketchybar](https://github.com/FelixKratz/SketchyBar): Custom menu bar
  - [SF Symbols](https://developer.apple.com/sf-symbols/): Apple system symbols
  - [Sketchybar App Font](https://github.com/kvndrsslr/sketchybar-app-font): Icon font

### Applications 📦

Key applications:

- **Development**
  - [Zed](https://zed.dev/): Modern code editor
  - [Ghostty](https://ghostty.org/): GPU-accelerated terminal
  - [Warp](https://warp.dev/): Rust-based terminal
  - [OrbStack](https://orbstack.dev/): Docker alternative
  - [Postman](https://www.postman.com/): API platform

- **Browsers & Communication**
  - [Helium](https://helium.computer/): Privacy-first Chromium browser
  - [Slack](https://slack.com/): Team communication
  - [Discord](https://discord.com/): Community platform
  - [WhatsApp](https://www.whatsapp.com/): Messaging

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
  - [Yoink](https://eternalstorms.at/yoink/mac/): Drag and drop helper

- **System Tools**
  - [CleanMyMac X](https://macpaw.com/cleanmymac): System cleaner
  - [NotchNook](https://lo.cafe/notchnook): Notch utility
  - [Canary Mail](https://canarymail.io/): Email client
  - [Clop](https://setapp.com/apps/clop): Media optimizer

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

### Window Manager Service Aliases
| Alias | Command | Description |
|-------|---------|-------------|
| `reload-sketchybar` | `brew services restart sketchybar` | Restart Sketchybar |
| `edit-sketchybar` | `$EDITOR $XDG_CONFIG_HOME/sketchybar` | Edit Sketchybar config |
| `reload-borders` | `brew services restart borders` | Restart JankyBorders |
| `edit-borders` | `$EDITOR $XDG_CONFIG_HOME/borders` | Edit JankyBorders config |
| `reload-yabai` | `yabai --restart-service` | Restart Yabai |
| `edit-yabai` | `$EDITOR $XDG_CONFIG_HOME/yabai` | Edit Yabai config |
| `reload-skhd` | `skhd --restart-service` | Restart SKHD |
| `edit-skhd` | `$EDITOR $XDG_CONFIG_HOME/skhd/skhdrc` | Edit SKHD config |

### Tmux Aliases
| Alias | Command | Description |
|-------|---------|-------------|
| `t` | `tmux -2` | Launch Tmux with 256 colors |
| `reload-tmux` | `tmux source-file ~/.tmux.conf` | Reload Tmux configuration |
| `edit-tmux` | `$EDITOR ~/.tmux.conf` | Edit Tmux configuration |

## Shortcuts & Keybindings ⌨️

### Space & Window Navigation
| Shortcut | Action |
|----------|--------|
| <kbd>⌥</kbd> + <kbd>1</kbd>-<kbd>5</kbd> | Focus space 1-5 on current display |
| <kbd>⌥</kbd> + <kbd>h</kbd>/<kbd>j</kbd>/<kbd>k</kbd>/<kbd>l</kbd> | Focus window in direction (west/south/north/east) |
| <kbd>⌥</kbd> + <kbd>0</kbd> | Focus first window |
| <kbd>⌥</kbd> + <kbd>$</kbd> | Focus last window |
| <kbd>⌥</kbd> + <kbd>Space</kbd> | Toggle float window |
| <kbd>⇧</kbd> + <kbd>⌥</kbd> + <kbd>f</kbd> | Toggle fullscreen |
| <kbd>⌥</kbd> + <kbd>f</kbd> | Toggle parent zoom |

### Window Management
| Shortcut | Action |
|----------|--------|
| <kbd>⇧</kbd> + <kbd>⌥</kbd> + <kbd>h</kbd>/<kbd>j</kbd>/<kbd>k</kbd>/<kbd>l</kbd> | Move window in direction |
| <kbd>⇧</kbd> + <kbd>⌥</kbd> + <kbd>s</kbd> | Toggle split orientation |
| <kbd>⇧</kbd> + <kbd>⌥</kbd> + <kbd>1</kbd>-<kbd>5</kbd> | Move window to space 1-5 |
| <kbd>⇧</kbd> + <kbd>⌥</kbd> + <kbd>b</kbd>/<kbd>n</kbd> | Move window to prev/next space |

### Window Stacking & Resizing
| Shortcut | Action |
|----------|--------|
| <kbd>⇧</kbd> + <kbd>⌃</kbd> + <kbd>h</kbd>/<kbd>j</kbd>/<kbd>k</kbd>/<kbd>l</kbd> | Stack window in direction |
| <kbd>⇧</kbd> + <kbd>⌃</kbd> + <kbd>b</kbd>/<kbd>p</kbd> | Navigate through stack |
| <kbd>⌃</kbd> + <kbd>⌥</kbd> + <kbd>h</kbd>/<kbd>j</kbd>/<kbd>k</kbd>/<kbd>l</kbd> | Resize window |
| <kbd>⌃</kbd> + <kbd>⌥</kbd> + <kbd>e</kbd> | Equalize window sizes |
| <kbd>⌃</kbd> + <kbd>⌥</kbd> + <kbd>g</kbd> | Toggle gaps |

### Miscellaneous Controls
| Shortcut | Action |
|----------|--------|
| <kbd>⌥</kbd> + <kbd>-</kbd>/<kbd>_</kbd> | Create new window in horizontal/vertical split |
| <kbd>⇧</kbd> + <kbd>⌥</kbd> + <kbd>Space</kbd> | Toggle Sketchybar visibility |
| <kbd>⇧</kbd> + <kbd>⌥</kbd> + <kbd>r</kbd> | Reload Sketchybar |

### Tmux Keybindings 🖥️
| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>⌃</kbd> + <kbd>s</kbd> | `prefix` | Prefix key (replaces default <kbd>⌃</kbd> + <kbd>b</kbd>) |

#### Session Management
| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>prefix</kbd> + <kbd>r</kbd> | `source-file ~/.tmux.conf` | Reload tmux configuration |
| <kbd>prefix</kbd> + <kbd>o</kbd> | `tmux-sessionx` | Open session manager |
| <kbd>prefix</kbd> + <kbd>Space</kbd> | `which-key` | Show available keybindings |

#### Window Management
| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>prefix</kbd> + <kbd>c</kbd> | `new-window` | Create new window |
| <kbd>prefix</kbd> + <kbd>⌃</kbd> + <kbd>H</kbd> | `previous-window` | Go to previous window |
| <kbd>prefix</kbd> + <kbd>⌃</kbd> + <kbd>L</kbd> | `next-window` | Go to next window |
| <kbd>prefix</kbd> + <kbd>⌃</kbd> + <kbd>x</kbd> | `kill-window` | Close current window |

#### Pane Management
| Shortcut | Action | Description |
|----------|--------|-------------|
| <kbd>prefix</kbd> + <kbd>h</kbd> | `select-pane -L` | Focus left pane |
| <kbd>prefix</kbd> + <kbd>j</kbd> | `select-pane -D` | Focus down pane |
| <kbd>prefix</kbd> + <kbd>k</kbd> | `select-pane -U` | Focus up pane |
| <kbd>prefix</kbd> + <kbd>l</kbd> | `select-pane -R` | Focus right pane |
| <kbd>prefix</kbd> + <kbd>x</kbd> | `kill-pane` | Close current pane |
| <kbd>prefix</kbd> + <kbd>-</kbd> | `split-window -h` | Split pane horizontally |
| <kbd>prefix</kbd> + <kbd>_</kbd> | `split-window -v` | Split pane vertically |

> [!NOTE]
> The prefix key (<kbd>⌃</kbd> + <kbd>s</kbd>) must be pressed before using most tmux commands. After pressing the prefix key, release it before pressing the command key.

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

2. Set up Yabai permissions
3. Install SetApp applications manually
4. Restart your computer

## Acknowledgments 🙏

Special thanks to:
- [FelixKratz](https://github.com/FelixKratz) for window management setup inspiration
- [The Chezmoi team](https://github.com/twpayne/chezmoi) for the dotfiles management tool

## License 📄

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.