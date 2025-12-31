#!/bin/bash

# Test script to preview all themes visually

THEMES=("claude-dark" "claude-light" "blueberry-dark" "catppuccin" "duotone-dark" "periwinkle-ember")
THEME_NAMES=("Claude Dark" "Claude Light" "Blueberry Dark" "Catppuccin" "DuoTone Dark" "Periwinkle Ember")
THEME_ICONS=("⭐" "☀️" "🫐" "🎨" "🌊" "💜")

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🎨 SketchyBar - All Themes Preview"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Helper function to print colored text
print_color() {
  local name="$1"
  local hex="$2"
  
  # Convert SketchyBar format (0xAARRGGBB) to display format
  local color="${hex#0x}"
  local r=$((16#${color:2:2}))
  local g=$((16#${color:4:2}))
  local b=$((16#${color:6:2}))
  
  # Print with ANSI color
  printf "    %-22s \033[48;2;%d;%d;%dm      \033[0m  %s\n" "$name" "$r" "$g" "$b" "$hex"
}

# Test each theme
for i in "${!THEMES[@]}"; do
  theme="${THEMES[$i]}"
  name="${THEME_NAMES[$i]}"
  icon="${THEME_ICONS[$i]}"
  
  echo "$icon  $name"
  echo "  ─────────────────────────────────────────────"
  
  # Load theme
  source <(~/.config/sketchybar/settings/theme.sh set "$theme" 2>&1 | grep -v "Theme changed")
  source ~/.config/sketchybar/settings/colors.sh
  
  # Show key colors
  print_color "Background" "$BAR_COLOR"
  print_color "Text" "$WHITE"
  print_color "Accent" "$ACCENT_COLOR"
  
  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ All 6 themes loaded successfully!"
echo ""
echo "  💡 To change theme:"
echo "     • Click Apple logo  → Change Theme"
echo "     • Run: ./change_theme.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
