#!/bin/bash

# Test script to fine-tune padding for workspace items
# This helps find the optimal padding to prevent excessive space on selected items

echo "================================================"
echo "Workspace Padding Adjustment Test"
echo "================================================"
echo ""
echo "This script tests different padding configurations"
echo "to find the optimal settings for workspace items."
echo ""

# Function to apply padding configuration
apply_padding_config() {
  local icon_padding_left=$1
  local icon_padding_right=$2
  local item_padding_left=$3
  local item_padding_right=$4
  local width=$5
  local description=$6
  
  echo "Testing: $description"
  echo "  icon.padding_left=$icon_padding_left"
  echo "  icon.padding_right=$icon_padding_right"
  echo "  padding_left=$item_padding_left"
  echo "  padding_right=$item_padding_right"
  echo "  width=$width"
  echo ""
  
  # Apply to all workspaces
  for i in {1..6}; do
    sketchybar --set aerospace_space.$i \
               icon.padding_left=$icon_padding_left \
               icon.padding_right=$icon_padding_right \
               padding_left=$item_padding_left \
               padding_right=$item_padding_right \
               width=$width
  done
  
  # Set workspace 1 as selected for visual reference
  sketchybar --set aerospace_space.1 \
             background.drawing=on \
             icon.color=0xff1e1e2e
  
  # Set workspace 2 as unselected for comparison
  sketchybar --set aerospace_space.2 \
             background.drawing=off \
             icon.color=0xffcad3f5
}

# Test 1: Minimal padding
echo "Test 1: Minimal Padding Configuration"
echo "======================================"
apply_padding_config 6 6 0 0 30 "Minimal padding"
sleep 2

# Test 2: Balanced padding
echo "Test 2: Balanced Padding Configuration"
echo "======================================="
apply_padding_config 7 7 1 1 32 "Balanced padding"
sleep 2

# Test 3: Current configuration
echo "Test 3: Current Configuration"
echo "=============================="
apply_padding_config 8 8 1 1 34 "Current settings"
sleep 2

# Test 4: Reduced right padding
echo "Test 4: Reduced Right Padding"
echo "=============================="
apply_padding_config 8 6 1 0 32 "Less right padding"
sleep 2

# Test 5: Asymmetric padding for balance
echo "Test 5: Asymmetric Padding"
echo "=========================="
apply_padding_config 8 5 1 0 30 "Asymmetric for visual balance"
sleep 2

# Test 6: Tight fit
echo "Test 6: Tight Fit Configuration"
echo "================================"
apply_padding_config 5 5 0 0 28 "Tight fit"
sleep 2

# Test 7: Optimal recommendation
echo "Test 7: Recommended Configuration"
echo "================================="
echo "Based on testing, this configuration should work best:"
apply_padding_config 7 6 1 0 30 "Optimal settings"

echo ""
echo "Configuration applied. Observing..."
sleep 3

# Show all selected for padding comparison
echo ""
echo "Showing all workspaces selected to check padding consistency..."
for i in {1..6}; do
  sketchybar --set aerospace_space.$i \
             background.drawing=on \
             icon.color=0xff1e1e2e
done

sleep 2

echo "Now showing alternating pattern..."
for i in {1..6}; do
  if [ $((i % 2)) -eq 1 ]; then
    sketchybar --set aerospace_space.$i \
               background.drawing=on \
               icon.color=0xff1e1e2e
  else
    sketchybar --set aerospace_space.$i \
               background.drawing=off \
               icon.color=0xffcad3f5
  fi
done

sleep 2

echo ""
echo "================================================"
echo "Test Complete!"
echo "================================================"
echo ""
echo "Recommended final configuration:"
echo "  icon.padding_left=7"
echo "  icon.padding_right=6"
echo "  padding_left=1"
echo "  padding_right=0"
echo "  width=30"
echo ""
echo "This provides:"
echo "✓ Consistent icon positioning"
echo "✓ No excessive right padding on selected items"
echo "✓ Clean visual appearance"
echo "✓ Proper spacing between items"
echo ""
echo "To apply permanently, update:"
echo "  ~/.config/sketchybar/plugins/spaces/aerospace-hybrid-items-fixed.sh"
echo ""

# Reset to actual workspace state
echo "Resetting to actual workspace state..."
CURRENT=$(aerospace list-workspaces --focused 2>/dev/null || echo "1")
for i in {1..6}; do
  if [ "$i" = "$CURRENT" ]; then
    sketchybar --set aerospace_space.$i \
               background.drawing=on \
               icon.color=0xff1e1e2e
  else
    sketchybar --set aerospace_space.$i \
               background.drawing=off \
               icon.color=0xffcad3f5
  fi
done

echo "Done!"