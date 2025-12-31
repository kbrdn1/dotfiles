#!/bin/zsh

echo "🚀 Installation - Nix First Approach"

# 1. Install xCode CLI tools
echo "📦 Installing xCode CLI tools..."
xcode-select --install

# 2. Install Nix (multi-user)
echo "❄️  Installing Nix package manager..."
sh <(curl -L https://nixos.org/nix/install) --daemon

# 3. Install Homebrew (for GUI apps and system tools)
echo "🍺 Installing Homebrew..."
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
brew analytics off

# 4. Tap Homebrew repositories
echo "🔧 Tapping Homebrew repos..."
brew tap homebrew/cask-fonts
brew tap FelixKratz/formulae
brew tap nikitabobko/tap

# 5. Install system dependencies (Homebrew only)
echo "🛠️  Installing system dependencies..."
brew install gd bison openssl blueutil

# 6. Install GUI applications (Homebrew casks)
echo "📲 Installing GUI applications..."
brew install --cask \
  zed@preview ghostty warp orbstack postman \
  arc slack discord whatsapp telegram mattermost \
  raycast obsidian claude figma anki \
  logi-options+ rectangle steam \
  setapp sf-symbols

# 7. Install window management tools (Homebrew only)
echo "🪟 Installing window management tools..."
brew install aerospace sketchybar borders

# 8. Install Homebrew exclusive tools (not in nixpkgs)
echo "📦 Installing Homebrew exclusive tools..."
brew install lazykube composer

# 9. Install fonts
echo "🔤 Installing fonts..."
brew install --cask font-symbols-only-nerd-font
brew install --cask font-jetbrains-mono-nerd-font
brew install --cask font-fira-code-nerd-font

# 10. Clone nix-config
echo "❄️  Cloning nix-config..."
git clone https://github.com/kbrdn1/nix-config.git ~/nix-config

# 11. Install Oh My Zsh
echo "🐚 Installing Oh My Zsh..."
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"

# 12. Clone and apply dotfiles
echo "📂 Applying dotfiles..."
sh -c "$(curl -fsLS get.chezmoi.io)" -- init --apply https://github.com/kbrdn1/dotfiles.git

# 13. Install Home Manager and apply Nix configuration
echo "❄️  Installing Home Manager..."
nix run home-manager/release-24.11 -- switch --flake ~/nix-config

# 13.1. Install mas (Mac App Store CLI) via Nix for App Store apps
echo "🍎 Installing mas for App Store management..."
# mas is now available in home.nix, just need to use it after HM installation
# To install Dashlane from App Store, get the App ID with: mas search Dashlane
# Then install with: mas install <APP_ID>

# 14. macOS System Settings
echo "⚙️  Configuring macOS settings..."

# Keyboard
defaults write NSGlobalDomain KeyRepeat -int 1

# Screenshots
mkdir -p ~/Screenshots
defaults write com.apple.screencapture location ~/Screenshots
defaults write com.apple.screencapture type png
defaults write com.apple.screencapture disable-shadow -bool true
killall SystemUIServer

# Menu Bar
defaults write NSGlobalDomain _HIHideMenuBar -bool true

# Dock
defaults write com.apple.dock autohide -bool true
defaults write com.apple.dock autohide-time-modifier -float 0.15
killall Dock

# 15. Setup sketchybar
echo "🎨 Setting up sketchybar..."
chmod +x ~/.config/sketchybar/* ~/.config/sketchybar/plugins/**/* ~/.config/sketchybar/helper/*

# 16. Start services
echo "🚀 Starting services..."
brew services start sketchybar
brew services start borders

echo "✅ Installation complete! Please restart your terminal."
echo ""
echo "📝 Next steps:"
echo "1. Restart your terminal: exec zsh"
echo "2. Check Nix packages: nix profile list"
echo "3. Configure AeroSpace: aerospace --reload-config"
echo "4. Install SetApp applications manually"
echo "5. Install App Store apps (optional):"
echo "   - Sign in to App Store"
echo "   - mas search Dashlane  # Get App ID"
echo "   - mas install <APP_ID> # Install app"
