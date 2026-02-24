#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"

BREW=/opt/homebrew/bin/brew

# Show upgrading state
sketchybar --set brew label="↻" icon.color=$YELLOW

# Upgrade
$BREW update >/dev/null 2>&1
$BREW upgrade >/dev/null 2>&1

# Refresh count
rm -f /tmp/sketchybar_brew_outdated
$BREW outdated --quiet > /tmp/sketchybar_brew_outdated 2>/dev/null

COUNT=$(wc -l < /tmp/sketchybar_brew_outdated | tr -d ' ')

if [ "$COUNT" -eq 0 ]; then
  sketchybar --set brew label="✓" icon.color=$GREEN
else
  COLOR=$WHITE
  case "$COUNT" in
    [3-9][0-9]|[1-9][0-9][0-9]) COLOR=$ORANGE ;;
    [1-2][0-9]) COLOR=$YELLOW ;;
  esac
  sketchybar --set brew label="$COUNT" icon.color="$COLOR"
fi
