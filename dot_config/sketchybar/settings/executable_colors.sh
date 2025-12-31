#!/bin/bash

# SketchyBar Color Configuration
# This file loads the active theme using the theme manager

# Source the theme manager and load the current theme
source "$(dirname "${BASH_SOURCE[0]}")/theme.sh" load

# Color variables are now set by theme.sh based on the active theme
# Available themes: claude-dark (default), claude-light, catppuccin
#
# To change theme:
#   ./settings/theme.sh set claude-dark
#   ./settings/theme.sh set claude-light
#   ./settings/theme.sh set catppuccin
#
# To list available themes:
#   ./settings/theme.sh list
