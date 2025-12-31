#!/bin/bash

# Formatter & Linter Expert - Installation Script
# Installs the skill to ~/.claude/skills/ for personal use

set -e  # Exit on error

echo "🚀 Formatter & Linter Expert - Installation"
echo "==========================================="
echo ""

# Determine target directory
TARGET_DIR="$HOME/.claude/skills/formatter-linter-expert"
SKILL_SOURCE=$(dirname "$(readlink -f "$0")")

echo "📍 Installation location: $TARGET_DIR"
echo "📦 Source: $SKILL_SOURCE"
echo ""

# Check if already installed
if [ -d "$TARGET_DIR" ]; then
    echo "⚠️  Skill already installed at $TARGET_DIR"
    read -p "   Overwrite existing installation? [y/N]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Installation cancelled"
        exit 1
    fi
    echo "   Removing existing installation..."
    rm -rf "$TARGET_DIR"
fi

# Create directories
echo "📁 Creating directory structure..."
mkdir -p "$TARGET_DIR"

# Copy skill files
echo "📋 Copying skill files..."
cp -r "$SKILL_SOURCE"/* "$TARGET_DIR/"

# Make scripts executable
echo "🔧 Setting permissions..."
chmod +x "$TARGET_DIR"/scripts/*.py
chmod +x "$TARGET_DIR"/scripts/**/*.py 2>/dev/null || true

# Verify Python version
echo ""
echo "🐍 Checking Python version..."
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d. -f1)
PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d. -f2)

if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 9 ]); then
    echo "   ⚠️  Python 3.9+ required, found $PYTHON_VERSION"
    echo "   Skill may not work correctly"
else
    echo "   ✅ Python $PYTHON_VERSION (OK)"
fi

# Check for asdf
echo ""
echo "📦 Checking for asdf..."
if command -v asdf &> /dev/null; then
    ASDF_VERSION=$(asdf --version | head -n 1)
    echo "   ✅ asdf installed: $ASDF_VERSION"
else
    echo "   ℹ️  asdf not found (optional)"
    echo "   Install from: https://asdf-vm.com/"
fi

# Check for ecosystem tools
echo ""
echo "🔍 Checking ecosystem tools..."

check_tool() {
    if command -v "$1" &> /dev/null; then
        VERSION=$("$1" $2 2>&1 | head -n 1 || echo "installed")
        echo "   ✅ $3: $VERSION"
        return 0
    else
        echo "   ❌ $3: Not found"
        return 1
    fi
}

# PHP/Laravel
check_tool "php" "--version" "PHP" || true
check_tool "composer" "--version" "Composer" || true
check_tool "pint" "--version" "Laravel Pint" || echo "   ℹ️  Install: composer global require laravel/pint"

# JavaScript/TypeScript
check_tool "node" "--version" "Node.js" || true
check_tool "bun" "--version" "Bun" || true
check_tool "prettier" "--version" "Prettier" || echo "   ℹ️  Install: npm install -g prettier"
check_tool "biome" "--version" "Biome" || echo "   ℹ️  Install: npm install -g @biomejs/biome"

# Go
check_tool "go" "version" "Go" || true

# Rust
check_tool "rustc" "--version" "Rust" || true
check_tool "cargo" "--version" "Cargo" || true

# Deno
check_tool "deno" "--version" "Deno" || true

# Test the installation
echo ""
echo "🧪 Testing installation..."
if python3 "$TARGET_DIR/scripts/main.py" --help &> /dev/null; then
    echo "   ✅ Installation successful!"
else
    echo "   ❌ Installation test failed"
    echo "   Try running manually: python3 $TARGET_DIR/scripts/main.py --help"
    exit 1
fi

# Success message
echo ""
echo "==========================================="
echo "✅ Installation Complete!"
echo "==========================================="
echo ""
echo "📍 Installed at: $TARGET_DIR"
echo ""
echo "🚀 Usage in Claude Code:"
echo "   Simply say:"
echo "   - \"Analyze this Laravel project\""
echo "   - \"Format all TypeScript files\""
echo "   - \"Interactive lint for Go code\""
echo ""
echo "🔧 Manual CLI usage:"
echo "   cd $TARGET_DIR"
echo "   python scripts/main.py --help"
echo ""
echo "📚 Documentation:"
echo "   - SKILL.md: Claude Code integration"
echo "   - README.md: Detailed usage guide"
echo ""
echo "🎉 Happy formatting!"
