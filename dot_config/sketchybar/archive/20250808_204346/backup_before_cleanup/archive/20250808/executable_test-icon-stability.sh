#!/bin/bash

# Test script to verify icon positioning stability
# This script checks that icons don't move when switching between selected/unselected states

echo "================================================"
echo "Icon Positioning Stability Test"
echo "================================================"
echo ""
echo "This test verifies that workspace icons remain in fixed positions"
echo "when switching between selected and unselected states."
echo ""

# Function to set workspace to selected state
set_selected() {
  local workspace=$1
  echo "Setting workspace $workspace to SELECTED state..."
  sketchybar --set aerospace_space.$workspace \
             background.drawing=on \
             background.color=0xffc6a0f6 \
             background.corner_radius=11 \
             background.height=22 \
             background.padding_left=2 \
             background.padding_right=2 \
             icon.color=0xff1e1e2e \
             icon.padding_left=8 \
             icon.padding_right=8 \
             padding_left=3 \
             padding_right=3 \
             width=36
}

# Function to set workspace to unselected state
set_unselected() {
  local workspace=$1
  echo "Setting workspace $workspace to UNSELECTED state..."
  sketchybar --set aerospace_space.$workspace \
             background.drawing=off \
             background.corner_radius=11 \
             background.height=22 \
             background.padding_left=2 \
             background.padding_right=2 \
             icon.color=0xffcad3f5 \
             icon.padding_left=8 \
             icon.padding_right=8 \
             padding_left=3 \
             padding_right=3 \
             width=36
}

# Test 1: Toggle single workspace rapidly
echo "Test 1: Rapid Toggle Test"
echo "========================="
echo "Rapidly toggling workspace 1 between selected/unselected."
echo "The icon should NOT move horizontally."
echo ""

for i in {1..5}; do
  echo "Toggle cycle $i/5:"
  set_selected 1
  sleep 0.3
  set_unselected 1
  sleep 0.3
done

echo ""

# Test 2: Sequential selection
echo "Test 2: Sequential Selection Test"
echo "================================="
echo "Selecting each workspace in sequence."
echo "Icons should remain in their fixed positions."
echo ""

for current in {1..6}; do
  echo "Selecting workspace $current..."
  
  # Set all to unselected
  for ws in {1..6}; do
    if [ "$ws" != "$current" ]; then
      set_unselected $ws > /dev/null 2>&1
    fi
  done
  
  # Set current to selected
  set_selected $current
  
  sleep 0.5
done

echo ""

# Test 3: Multiple selected (edge case)
echo "Test 3: Multiple Selected Test"
echo "=============================="
echo "Testing with multiple workspaces selected (unusual case)."
echo "All icons should maintain their positions."
echo ""

echo "Selecting workspaces 1, 3, and 5..."
set_selected 1
set_selected 3
set_selected 5
set_unselected 2
set_unselected 4
set_unselected 6

sleep 2

echo "Now unselecting all..."
for ws in {1..6}; do
  set_unselected $ws
done

sleep 1

echo ""

# Test 4: Animation smoothness
echo "Test 4: Animation Smoothness Test"
echo "================================="
echo "Testing smooth transitions between states."
echo ""

echo "Watch workspace 2 for smooth color and background transitions..."
for i in {1..3}; do
  echo "  Cycle $i: Selecting..."
  sketchybar --animate tanh 20 --set aerospace_space.2 \
             background.drawing=on \
             background.color=0xffc6a0f6 \
             icon.color=0xff1e1e2e
  sleep 1
  
  echo "  Cycle $i: Unselecting..."
  sketchybar --animate tanh 20 --set aerospace_space.2 \
             background.drawing=off \
             icon.color=0xffcad3f5
  sleep 1
done

echo ""

# Test 5: Real workspace switching
echo "Test 5: Real Workspace Switching Test"
echo "====================================="
echo "Switching actual AeroSpace workspaces."
echo "Icons should remain stable during transitions."
echo ""

for ws in 1 2 3 1; do
  echo "Switching to workspace $ws..."
  aerospace workspace $ws 2>/dev/null
  sketchybar --trigger aerospace_workspace_change
  sleep 1
done

echo ""

# Final reset
echo "Final Reset"
echo "==========="
echo "Resetting all workspaces to match current state..."

# Get current workspace
CURRENT=$(aerospace list-workspaces --focused 2>/dev/null || echo "1")
echo "Current workspace: $CURRENT"

# Update all based on current
for ws in {1..6}; do
  if [ "$ws" = "$CURRENT" ]; then
    set_selected $ws > /dev/null 2>&1
  else
    set_unselected $ws > /dev/null 2>&1
  fi
done

echo ""
echo "================================================"
echo "Test Complete!"
echo "================================================"
echo ""
echo "Visual checks:"
echo "✓ Icons should NOT move horizontally during state changes"
echo "✓ Only background and color should change"
echo "✓ All icons should maintain fixed width of 36px"
echo "✓ Padding should remain consistent"
echo ""
echo "If icons are moving, check:"
echo "- width parameter (should be 36 for all states)"
echo "- padding values (should be identical for both states)"
echo "- background.padding values (should be identical)"
echo ""