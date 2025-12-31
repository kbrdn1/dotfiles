#!/bin/bash

# Quick theme switcher for SketchyBar
# Usage: ./change_theme.sh [theme-name]

THEME_SCRIPT="$HOME/.config/sketchybar/settings/theme.sh"

if [[ ! -f "$THEME_SCRIPT" ]]; then
  echo "❌ Theme manager not found at: $THEME_SCRIPT"
  exit 1
fi

# If no argument, show interactive menu with osascript dialog
if [[ -z "$1" ]]; then
  # Get current theme
  current=$("$THEME_SCRIPT" current)
  
  # Use macOS native dialog for GUI selection
  choice=$(osascript <<EOF
set themes to {"Claude Dark", "Claude Light", "Blueberry Dark", "Catppuccin", "DuoTone Dark", "Periwinkle Ember"}
set currentTheme to "$current"

set dialogText to "Select a theme:" & return & return & "Current: " & currentTheme

choose from list themes with prompt dialogText default items {"Claude Dark"} with title "SketchyBar Theme Switcher"
EOF
)
  
  # Handle cancel or empty selection
  if [[ "$choice" == "false" ]] || [[ -z "$choice" ]]; then
    exit 0
  fi
  
  # Convert display name to theme ID
  case "$choice" in
    "Claude Dark") theme="claude-dark" ;;
    "Claude Light") theme="claude-light" ;;
    "Blueberry Dark") theme="blueberry-dark" ;;
    "Catppuccin") theme="catppuccin" ;;
    "DuoTone Dark") theme="duotone-dark" ;;
    "Periwinkle Ember") theme="periwinkle-ember" ;;
    *)
      osascript -e 'display notification "Invalid theme selection" with title "SketchyBar Theme"'
      exit 1
      ;;
  esac
else
  theme="$1"
fi

# Apply the theme
"$THEME_SCRIPT" set "$theme"

if [[ $? -eq 0 ]]; then
  # Reload SketchyBar to apply new colors
  sketchybar --reload
  
  # Show success notification
  osascript -e "display notification \"Theme changed to: $theme\" with title \"SketchyBar Theme\" sound name \"Glass\""
else
  osascript -e 'display notification "Failed to apply theme" with title "SketchyBar Theme"'
  exit 1
fi
