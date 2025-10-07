#!/bin/bash

# Test script to diagnose and fix workspace background circle issue
# This script will test different configurations to find the optimal settings

echo "Testing SketchyBar workspace background circle configurations..."

# Test 1: Basic circle background
echo "Test 1: Testing basic circle background..."
sketchybar --set aerospace_space.1 \
           background.drawing=on \
           background.color=0xffc6a0f6 \
           background.corner_radius=12 \
           background.height=24 \
           icon.color=0xff1e1e2e \
           icon.padding_left=7 \
           icon.padding_right=7 \
           padding_left=2 \
           padding_right=2

sleep 2

# Test 2: Adjusted padding for better circle
echo "Test 2: Testing with adjusted padding..."
sketchybar --set aerospace_space.1 \
           background.drawing=on \
           background.color=0xffc6a0f6 \
           background.corner_radius=14 \
           background.height=28 \
           background.padding_left=0 \
           background.padding_right=0 \
           icon.color=0xff1e1e2e \
           icon.padding_left=10 \
           icon.padding_right=10 \
           padding_left=0 \
           padding_right=0 \
           width=dynamic

sleep 2

# Test 3: Perfect circle with fixed width
echo "Test 3: Testing perfect circle with fixed width..."
sketchybar --set aerospace_space.1 \
           background.drawing=on \
           background.color=0xffc6a0f6 \
           background.corner_radius=50 \
           background.height=30 \
           background.padding_left=-2 \
           background.padding_right=-2 \
           icon.color=0xff1e1e2e \
           icon.padding_left=9 \
           icon.padding_right=9 \
           padding_left=1 \
           padding_right=1 \
           width=34

sleep 2

# Test 4: Optimal settings based on original space design
echo "Test 4: Testing optimal settings..."
sketchybar --set aerospace_space.1 \
           background.drawing=on \
           background.color=0xffc6a0f6 \
           background.corner_radius=11 \
           background.height=22 \
           icon.color=0xff1e1e2e \
           icon.padding_left=8 \
           icon.padding_right=8 \
           padding_left=3 \
           padding_right=3

sleep 2

# Test 5: Test with all workspaces
echo "Test 5: Applying to all workspaces with different states..."
for i in {1..6}; do
  if [ "$i" = "1" ] || [ "$i" = "3" ]; then
    # Selected state
    sketchybar --set aerospace_space.$i \
               background.drawing=on \
               background.color=0xffc6a0f6 \
               background.corner_radius=11 \
               background.height=22 \
               icon.color=0xff1e1e2e \
               icon.padding_left=8 \
               icon.padding_right=8 \
               padding_left=3 \
               padding_right=3
  else
    # Unselected state
    sketchybar --set aerospace_space.$i \
               background.drawing=off \
               icon.color=0xffcad3f5 \
               icon.padding_left=8 \
               icon.padding_right=8 \
               padding_left=3 \
               padding_right=3
  fi
done

sleep 2

# Test 6: Final recommended configuration
echo "Test 6: Final recommended configuration..."
echo "Applying optimal settings to workspace 2 as selected..."
sketchybar --set aerospace_space.2 \
           background.drawing=on \
           background.color=0xffc6a0f6 \
           background.corner_radius=11 \
           background.height=22 \
           icon.color=0xff1e1e2e \
           icon.font="sketchybar-app-font:Regular:16.0" \
           icon.padding_left=8 \
           icon.padding_right=8 \
           padding_left=3 \
           padding_right=3

echo ""
echo "Testing complete!"
echo ""
echo "Recommended configuration:"
echo "  background.corner_radius=11"
echo "  background.height=22"
echo "  icon.color=0xff1e1e2e (for selected)"
echo "  icon.color=0xffcad3f5 (for unselected)"
echo "  icon.padding_left=8"
echo "  icon.padding_right=8"
echo "  padding_left=3"
echo "  padding_right=3"
echo ""
echo "Now resetting all workspaces to default state..."

# Reset to default unselected state
for i in {1..6}; do
  sketchybar --set aerospace_space.$i \
             background.drawing=off \
             icon.color=0xffcad3f5 \
             icon.padding_left=8 \
             icon.padding_right=8 \
             padding_left=3 \
             padding_right=3
done

echo "Reset complete. Run this script again to test different configurations."