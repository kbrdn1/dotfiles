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
  - [Arc](https://arc.net/): Modern browser
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
| `pa`, `laravel` | `php artisan` | PHP Artisan CLI |
| `a`, `adonis` | `node ace` | Adonis Ace CLI |
| `ls` | `eza --color=always --long --git --no-filesize --icons=always --no-time --no-user --no-permissions --group-directories-first` | Enhanced listing |
| `cd` | `zoxide` | Enhanced directory navigation |
| `lg` | `lazygit` | Terminal UI for Git |
| `lzd` | `lazydocker` | Terminal UI for Docker |

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