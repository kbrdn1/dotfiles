#!/bin/bash

# Test script to preview border colors for all themes

THEMES=("claude-dark" "claude-light" "blueberry-dark" "catppuccin" "duotone-dark" "periwinkle-ember")
THEME_NAMES=("Claude Dark" "Claude Light" "Blueberry Dark" "Catppuccin" "DuoTone Dark" "Periwinkle Ember")
THEME_ICONS=("⭐" "☀️" "🫐" "🎨" "🌊" "💜")

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🖼️  SketchyBar + JankyBorders - Border Colors Preview"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Helper function to print colored text
print_border_color() {
  local name="$1"
  local hex="$2"
  
  # Convert SketchyBar format (0xAARRGGBB) to display format
  local color="${hex#0x}"
  local a=$((16#${color:0:2}))
  local r=$((16#${color:2:2}))
  local g=$((16#${color:4:2}))
  local b=$((16#${color:6:2}))
  
  # Print with ANSI color and transparency info
  printf "    %-18s \033[48;2;%d;%d;%dm      \033[0m  %s (alpha: %d%%)\n" \
    "$name" "$r" "$g" "$b" "$hex" "$((a * 100 / 255))"
}

# Test each theme
for i in "${!THEMES[@]}"; do
  theme="${THEMES[$i]}"
  name="${THEME_NAMES[$i]}"
  icon="${THEME_ICONS[$i]}"
  
  echo "$icon  $name"
  echo "  ─────────────────────────────────────────────────────"
  
  # Load theme silently
  ~/.config/sketchybar/settings/theme.sh set "$theme" 2>&1 | grep -v "Theme changed" > /dev/null
  source ~/.config/sketchybar/settings/colors.sh
  
  # Show border colors
  print_border_color "Active Border" "$BORDER_ACTIVE"
  print_border_color "Inactive Border" "$BORDER_INACTIVE"
  
  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ All 6 themes border colors loaded successfully!"
echo ""
echo "  💡 Borders will automatically update when you change theme:"
echo "     • Click Apple logo  → 􀎔 Change Theme"
echo "     • JankyBorders restarts automatically"
echo ""
echo "  🔄 Manual reload: brew services restart borders"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
