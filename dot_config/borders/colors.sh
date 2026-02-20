#!/bin/bash

# JankyBorders Color Configuration
# This file is automatically synchronized with SketchyBar theme system
# DO NOT EDIT MANUALLY - Use theme.sh to change themes

# Load colors from SketchyBar theme
source "$HOME/.config/sketchybar/settings/colors.sh"

# Border colors from theme (with fallback to defaults)
export BORDER_ACTIVE_COLOR="${BORDER_ACTIVE:-0xFFB7BDF8}"
export BORDER_INACTIVE_COLOR="${BORDER_INACTIVE:-0x77494D64}"
export BORDER_BACKGROUND_COLOR="0x00000000"

# Border style (these don't change with theme)
export BORDER_STYLE="round"
export BORDER_WIDTH="5.0"
export BORDER_HIDPI="on"
