#!/usr/bin/env bash

# Claude Dark Theme for Tmux - Standalone
# No Catppuccin dependency
# https://github.com/claude-dark

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source the theme
tmux source-file "${PLUGIN_DIR}/theme.conf"
