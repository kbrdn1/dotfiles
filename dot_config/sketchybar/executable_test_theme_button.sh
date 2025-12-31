#!/bin/bash

# Test script to verify theme system integration

echo "🧪 Testing SketchyBar Theme System"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: Check if theme.sh exists
echo "✓ Test 1: Checking theme.sh..."
if [[ -f "$HOME/.config/sketchybar/settings/theme.sh" ]]; then
  echo "  ✅ theme.sh found"
else
  echo "  ❌ theme.sh not found"
  exit 1
fi

# Test 2: Check if change_theme.sh is executable
echo "✓ Test 2: Checking change_theme.sh..."
if [[ -x "$HOME/.config/sketchybar/change_theme.sh" ]]; then
  echo "  ✅ change_theme.sh is executable"
else
  echo "  ❌ change_theme.sh is not executable"
  exit 1
fi

# Test 3: Check current theme
echo "✓ Test 3: Checking current theme..."
current=$("$HOME/.config/sketchybar/settings/theme.sh" current)
echo "  ✅ Current theme: $current"

# Test 4: List available themes
echo "✓ Test 4: Listing available themes..."
"$HOME/.config/sketchybar/settings/theme.sh" list

# Test 5: Check if apple plugin has theme button
echo ""
echo "✓ Test 5: Checking apple plugin configuration..."
if grep -q "apple_theme" "$HOME/.config/sketchybar/plugins/apple/item.sh"; then
  echo "  ✅ Theme button found in apple plugin"
else
  echo "  ❌ Theme button not found in apple plugin"
  exit 1
fi

# Test 6: Source colors.sh to verify it works
echo "✓ Test 6: Testing colors.sh loading..."
source "$HOME/.config/sketchybar/settings/colors.sh" 2>&1
if [[ -n "$ACCENT_COLOR" ]]; then
  echo "  ✅ Colors loaded successfully"
  echo "  📊 Sample colors:"
  echo "     ACCENT_COLOR: $ACCENT_COLOR"
  echo "     BAR_COLOR: $BAR_COLOR"
  echo "     ORANGE: $ORANGE"
else
  echo "  ❌ Failed to load colors"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All tests passed!"
echo ""
echo "🎨 Theme System Integration Complete!"
echo ""
echo "📋 Next Steps:"
echo "  1. Click on the Apple logo in SketchyBar"
echo "  2. Select 'Change Theme' from the popup menu"
echo "  3. Choose your preferred theme from the dialog"
echo "  4. Enjoy your new color scheme!"
echo ""
echo "💡 You can also run: ./change_theme.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
