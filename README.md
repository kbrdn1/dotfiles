# Dotfiles

Welcome to my dotfiles repository! This repository is managed using [chezmoi](https://www.chezmoi.io/), a tool designed to manage your dotfiles across multiple machines.

## Requirements 📋

### CLI Tools 🛠

To get started, ensure you have the following command-line tools installed:

- [Homebrew](https://brew.sh/): The missing package manager for macOS.
- [Coreutils](https://www.gnu.org/software/coreutils/): Essential GNU utilities.
- [Curl](https://curl.se/): Command-line tool for transferring data with URLs.
- [Git](https://git-scm.com/): Distributed version control system.
- [Bison](https://www.gnu.org/software/bison/): General-purpose parser generator.
- [OpenSSL](https://www.openssl.org/): Robust, full-featured open-source toolkit for SSL/TLS.
- [Chezmoi](https://www.chezmoi.io/docs/install/): Manage your dotfiles across multiple diverse machines.
- [Asdf](https://asdf-vm.com/#/core-manage-asdf-vm): Extendable version manager with support for Ruby, Node.js, Elixir, Erlang & more.
- [Oh My Zsh](https://ohmyz.sh/): Framework for managing your Zsh configuration.
- [GH](https://cli.github.com/): GitHub’s official command line tool.
- [Tldr](https://tldr.sh/): Simplified and community-driven man pages.
- [Fd](https://github.com/sharkdp/fd): Simple, fast and user-friendly alternative to 'find'.
- [Fzf](https://junegunn.github.io/fzf/): General-purpose command-line fuzzy finder.
- [Thefuck](https://github.com/nvbn/thefuck): Magnificent app which corrects your previous console command.
- [Powerlevel10k](https://github.com/romkatv/powerlevel10k): A fast reimplementation of Powerlevel9k ZSH theme.
- [Bat](https://github.com/sharkdp/bat): A cat clone with syntax highlighting and Git integration.
- [Eza](https://eza.rocks/): Modern replacement for 'ls'.
- [Composer](https://getcomposer.org/): Dependency Manager for PHP.
- [Zoxide](https://crates.io/crates/zoxide): A smarter cd command.
- [Lazygit](https://github.com/jesseduffield/lazygit): Simple terminal UI for git commands.
- [Lazydocker](https://github.com/jesseduffield/lazydocker): Simple terminal UI for Docker.
- [Neofetch](https://github.com/dylanaraps/neofetch): A command-line system information tool.
- [Dashlane CLI](https://cli.dashlane.com/install): Command-line interface for Dashlane.
- [PHP](https://www.php.net/): Popular general-purpose scripting language.
- [Pcov](https://github.com/krakjoe/pcov): Code coverage driver for PHP.
- [Symfony CLI](https://symfony.com/download): CLI tool to manage Symfony applications.
- [Python](https://www.python.org/): Powerful programming language.

### Applications 📦

Ensure you have the following applications installed:

- [Arc](https://arc.net/): A new kind of web browser.
- [Raycast](https://raycast.com/): Blazing fast, totally extendable launcher.
- [Zed](https://zed.dev/): next-generation code editor designed for
high-performance collaboration with humans and AI.
- [Ghostty](https://ghostty.org/): Fast, feature-rich, and cross-platform terminal emulator that uses platform-native UI and GPU acceleration.
- [Warp](https://warp.dev/): A modern, Rust-based terminal.
- [OrbStack](https://orbstack.dev/): Fast, lightweight Docker desktop alternative.
- [Postman](https://www.postman.com/): API development environment.
- [Slack](https://slack.com/): Collaboration hub that connects your work.
- [Discord](https://discord.com/): Voice, video, and text communication service.
- [Figma](https://www.figma.com/): Collaborative interface design tool.
- [Docker](https://www.docker.com/): Platform for developing, shipping, and running applications.
- [WhatsApp](https://www.whatsapp.com/): Messaging and voice over IP service.
- [Obsidian](https://obsidian.md/): Powerful knowledge base that works on top of a local folder of plain text Markdown files.
- [Dashlane](https://www.dashlane.com/): Password manager and digital wallet.
- [SetApp](https://setapp.com/): Subscription-based service for macOS applications.

### SetApp Applications 📦

If you are using SetApp, make sure to install these applications:

- [TablePlus](https://tableplus.com/): Modern, native tool for database management.
- [Canary Mail](https://canarymail.io/): Secure email app.
- [CleanMyMac X](https://macpaw.com/cleanmymac): All-in-one package to clean your Mac.
- [CleanShot X](https://cleanshot.com/): Best screenshot tool for macOS.
- [PixelSnap](https://getpixelsnap.com/): Measure anything on your screen.
- [Sip](https://sipapp.io/): The best way to collect, organize & share your colors.
- [NotchNook](https://lo.cafe/notchnook): Utility to manage the notch on your MacBook.
- [Yoink](https://eternalstorms.at/yoink/mac/): Simplifies and improves drag and drop between windows, apps, spaces, and fullscreen apps.
- [Clop](https://setapp.com/fr/apps/clop?accname=setapp&adgroupid=159512510282&adpos=&ci=737183467&ck=clop%20mac&creative=688198389097&extensionid=&gnetwork=g&match=e&placecat=&placement=&targetid=aud-315654669593:kwd-2273594097558): Lightweight images, videos, and PDFs.

> [!IMPORTANT]
> Refer to the `.tool-versions` file for the specific versions of the tools and other CLI utilities that need to be installed.

## Installation 📥

Follow these steps to set up your environment:

```bash
# Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
echo >> /Users/<user>/.zprofile
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> /Users/<user>/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"

# Install Oh My Zsh
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"

# Install CLI tools via Homebrew
brew install coreutils curl git gd bison openssl chezmoi asdf gh tldr fd fzf thefuck powerlevel10k bat eza composer zoxide lazygit lazydocker neofetch dashlane/tap/dashlane-cli php@8.4 pcov@8.4 symfony-cli python@3.12 orbstack

# Install applications via Homebrew Cask
brew install --cask arc raycast zed ghostty warp postman slack discord figma docker whatsapp obsidian setapp

# Install additional tools via asdf
asdf plugin add neovim && asdf install neovim 0.10.3
asdf plugin add chezmoi && asdf install chezmoi 2.58.0
asdf plugin add stripe-cli && asdf install stripe-cli 1.22.0
asdf plugin add pnpm && asdf install pnpm 9.15.4
asdf plugin add golang && asdf install golang 1.23.4
asdf plugin add nodejs && asdf install nodejs 22.9.0
asdf plugin add rust && asdf install rust 1.83.0
asdf plugin add bun && asdf install bun 1.1.45

# Initialize and apply chezmoi configuration
chezmoi init https://github.com/kbrdn1/dotfiles.git
chezmoi apply
```

> [!NOTE]
> Replace `<user>` with your username.

## Usage 🚀

### Navigation 🧭

- Use `z` to quickly navigate to frequently visited directories.
  ```bash
  z projects
  ```
- Use `ls` to list directory contents with `eza` and `-l <number>` for a detailed tree view.
  ```bash
  eza -l 2
  ```
- Press `ctrl + t` or type `**` and press `tab` to open fzf and navigate to a directory or file.
  ```bash
  **<tab>
  ```

### Git 🌳

- Use `git` to manage your repositories.
  ```bash
  git clone https://github.com/user/repo.git
  ```
- Use `lg` for a simple terminal UI for git commands.
  ```bash
  lg
  ```

### Docker 🐳

- Use `docker` to manage your containers.
  ```bash
  docker run -d -p 80:80 nginx
  ```
- Use `docker-compose` to manage your multi-container Docker applications.
  ```bash
  docker-compose up -d
  ```
- Use `lzd` for a simple terminal UI for Docker.
  ```bash
  lzd
  ```
- Use `orbstack` app for a fast, lightweight Docker desktop alternative.

### Help 🆘

- Use `tldr` for general-purpose command-line help.
  ```bash
  tldr git
  ```
- Use `fk` to corrects your previous console command.
  ```bash
  fk
  ```

### Copilot 🤖

- Use `gh copilot` to generate code with GitHub Copilot.
  ```bash
  gh copilot suggest
  ```

### Development 🛠

- Use `asdf` to manage your versions.
  ```bash
  asdf list all <plugin>
  ```
- Use `composer` to manage your PHP dependencies.
- Use `pnpm` to manage your Node.js dependencies.
