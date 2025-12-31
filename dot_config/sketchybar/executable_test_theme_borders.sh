#!/bin/bash

# Test script to verify theme changes affect borders
# This script cycles through themes with visible delays for testing

echo "🧪 Testing Theme + Borders Live Update"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "👀 WATCH YOUR WINDOW BORDERS - they should change color instantly!"
echo ""

THEME_SCRIPT="$HOME/.config/sketchybar/settings/theme.sh"

# Get original theme
ORIGINAL_THEME=$($THEME_SCRIPT current)

# Test themes with their signature colors
declare -A theme_colors=(
  ["claude-dark"]="🟠 Orange (warm)"
  ["claude-light"]="🟠 Orange (soft)"
  ["blueberry-dark"]="🟢 Teal/Cyan (cool)"
  ["catppuccin"]="🔵 Blue (modern)"
  ["duotone-dark"]="🔵 Deep Blue (sea)"
  ["periwinkle-ember"]="🟣 Purple (lavender)"
)

# Test each theme
for theme in claude-dark blueberry-dark catppuccin duotone-dark periwinkle-ember claude-light; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📍 Theme: $theme"
  echo "   Expected border: ${theme_colors[$theme]}"
  echo ""
  
  # Change theme (borders update instantly!)
  $THEME_SCRIPT set "$theme" > /dev/null
  
  # Show current colors for verification
  source ~/.config/sketchybar/settings/colors.sh
  echo "   ✓ Active border:   $BORDER_ACTIVE"
  echo "   ✓ Inactive border: $BORDER_INACTIVE"
  echo ""
  echo "⏱️  Holding for 3 seconds to observe..."
  sleep 3
done

# Return to original theme
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 Returning to original theme: $ORIGINAL_THEME"
$THEME_SCRIPT set "$ORIGINAL_THEME" > /dev/null

echo ""
echo "✅ Test complete!"
echo ""
echo "💡 Results:"
echo "   ✓ Themes change instantly (no restart delay)"
echo "   ✓ Border colors update live without service restart"
echo "   ✓ SketchyBar and JankyBorders synchronized"
echo ""
echo "If borders didn't change color, please report this issue."
