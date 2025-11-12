#!/bin/bash

# Installation script to add changelog-generator to PATH
# This script adds the binary directory to your shell configuration

set -e

SKILL_DIR="$HOME/.claude/skills/changelog-generator"
BIN_DIR="$SKILL_DIR/bin"
SHELL_CONFIG=""

# Detect shell and config file
if [ -n "$ZSH_VERSION" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
elif [ -n "$BASH_VERSION" ]; then
    if [ -f "$HOME/.bash_profile" ]; then
        SHELL_CONFIG="$HOME/.bash_profile"
    else
        SHELL_CONFIG="$HOME/.bashrc"
    fi
fi

echo "🔧 Installation du changelog-generator dans le PATH"
echo ""

# Check if binary exists
if [ ! -f "$BIN_DIR/changelog-generator" ]; then
    echo "❌ Erreur: Le binaire n'existe pas à $BIN_DIR/changelog-generator"
    echo "   Exécutez d'abord: bash scripts/setup.sh"
    exit 1
fi

# Check if already in PATH
if echo "$PATH" | grep -q "$BIN_DIR"; then
    echo "✅ Le changelog-generator est déjà dans votre PATH"
    echo "   Vous pouvez utiliser: changelog-generator --help"
    exit 0
fi

# Add to shell config
if [ -n "$SHELL_CONFIG" ]; then
    echo "📝 Ajout de $BIN_DIR au $SHELL_CONFIG"

    # Add newline if file doesn't end with one
    [ -n "$(tail -c1 "$SHELL_CONFIG")" ] && echo "" >> "$SHELL_CONFIG"

    # Add PATH export
    cat >> "$SHELL_CONFIG" << EOF

# Changelog Generator (Claude Code Skill)
export PATH="\$PATH:$BIN_DIR"
EOF

    echo "✅ Configuration ajoutée à $SHELL_CONFIG"
    echo ""
    echo "Pour activer immédiatement:"
    echo "  source $SHELL_CONFIG"
    echo ""
    echo "Ou ouvrez un nouveau terminal"
else
    echo "⚠️  Shell non détecté automatiquement"
    echo ""
    echo "Ajoutez manuellement cette ligne à votre fichier de configuration shell:"
    echo "  export PATH=\"\$PATH:$BIN_DIR\""
fi

echo ""
echo "🎉 Installation terminée!"
echo ""
echo "Utilisation:"
echo "  changelog-generator generate --version v1.0.0"
echo "  changelog-generator calculate --from 2025-01-01 --to 2025-01-31"
echo "  changelog-generator validate"
