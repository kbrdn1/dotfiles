#!/bin/zsh

echo "🚀 Starting installation process..."

# Install xCode CLI tools
echo "📦 Installing Command Line Tools..."
xcode-select --install

# Install Homebrew
echo "🍺 Installing Homebrew..."
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
brew analytics off

# Tap required repositories
echo "🔧 Tapping Homebrew repositories..."
brew tap homebrew/cask-fonts
brew tap FelixKratz/formulae
brew tap koekeishiya/formulae
brew tap dashlane/tap

# Install CLI tools
echo "⚙️ Installing CLI tools..."
brew install coreutils curl git gd bison openssl \
    chezmoi asdf gh tldr fd fzf thefuck powerlevel10k \
    bat eza composer zoxide lazygit lazydocker \
    neofetch dashlane-cli pcov symfony-cli \
    yq tmux yazi ffmpeg sevenzip jq poppler \
    ripgrep imagemagick font-symbols-only-nerd-font \
    blueutil php@8.4 python@3.12

# Install GUI applications
echo "🖥 Installing GUI applications..."
brew install --cask arc raycast zed ghostty warp \
    postman slack discord figma docker whatsapp \
    obsidian setapp sf-symbols

# Install window management tools
echo "🪟 Installing window management tools..."
brew install sketchybar borders svim koekeishiya/formulae/yabai skhd

# macOS Settings
echo "⚙️ Configuring macOS settings..."

# Keyboard
defaults write NSGlobalDomain KeyRepeat -int 1

# Screenshots
mkdir -p ~/Screenshots
defaults write com.apple.screencapture location ~/Screenshots
defaults write com.apple.screencapture type png
defaults write com.apple.screencapture disable-shadow -bool true
killall SystemUIServer

# Menu bar
defaults write NSGlobalDomain _HIHideMenuBar -bool true

# Dock
defaults write com.apple.dock autohide -bool true
defaults write com.apple.dock autohide-time-modifier -float 0.15
killall Dock

# Install Oh My Zsh
echo "🛠 Installing Oh My Zsh..."
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"

# Install ASDF plugins and versions
echo "📦 Installing ASDF plugins and versions..."
asdf plugin add neovim && asdf install neovim 0.10.4
asdf plugin add chezmoi && asdf install chezmoi 2.62.4
asdf plugin add stripe-cli && asdf install stripe-cli 1.26.1
asdf plugin add pnpm && asdf install pnpm 10.7.1
asdf plugin add golang && asdf install golang 1.23.6
asdf plugin add nodejs && asdf install nodejs 23.9.0
asdf plugin add rust && asdf install rust 1.84.1
asdf plugin add bun && asdf install bun 1.2.15
asdf plugin add deno && asdf install deno 2.3.1
asdf plugin add awscli && asdf install awscli 2.27.18

# Setup sketchybar
echo "🎨 Setting up sketchybar..."
chmod +x ~/.config/sketchybar/* ~/.config/sketchybar/plugins/**/* ~/.config/sketchybar/helper/*

# Initialize chezmoi
echo "🏠 Initializing chezmoi..."
chezmoi init https://github.com/kbrdn1/dotfiles.git
chezmoi apply

echo "✨ Installation complete!"
echo "⚠️ Don't forget to:"
echo "1. Configure Yabai permissions (See the wiki on GitHub)"
echo "2. Install SetApp applications manually"
echo "3. Restart your computer to apply all changes"