#!/bin/bash

# Comprehensive test script for workspace switching visualization
# This script tests the background circle and text color changes

echo "================================================"
echo "SketchyBar Workspace Switching Visualization Test"
echo "================================================"
echo ""

# Function to display current workspace state
show_workspace_state() {
  local current=$(aerospace list-workspaces --focused 2>/dev/null || echo "unknown")
  echo "Current workspace: $current"
  echo ""
}

# Function to wait and show progress
wait_with_progress() {
  local seconds=$1
  local message=$2
  echo -n "$message"
  for ((i=1; i<=seconds; i++)); do
    echo -n "."
    sleep 1
  done
  echo " Done!"
}

# Initial state
echo "Initial State:"
echo "--------------"
show_workspace_state

# Test 1: Cycle through all workspaces
echo "Test 1: Cycling through all workspaces"
echo "======================================="
echo "This test will switch through workspaces 1-6 to verify:"
echo "- Background circle appears on selected workspace"
echo "- Text color changes (dark on selected, light on unselected)"
echo ""

for workspace in 1 2 3 4 5 6; do
  echo "Switching to workspace $workspace..."
  aerospace workspace $workspace 2>/dev/null
  
  # Trigger the workspace change event
  sketchybar --trigger aerospace_workspace_change
  
  # Give visual feedback
  wait_with_progress 2 "Observing workspace $workspace"
  
  # Show current state
  show_workspace_state
done

# Test 2: Rapid switching
echo ""
echo "Test 2: Rapid workspace switching"
echo "================================="
echo "Testing rapid switching to ensure animations work smoothly..."
echo ""

for ((i=1; i<=3; i++)); do
  echo "Rapid switch cycle $i/3:"
  for workspace in 1 3 5 2 4 6; do
    echo -n "  → Workspace $workspace"
    aerospace workspace $workspace 2>/dev/null
    sketchybar --trigger aerospace_workspace_change
    sleep 0.5
    echo " ✓"
  done
  echo ""
done

# Test 3: Direct workspace clicking simulation
echo "Test 3: Testing click handler"
echo "============================="
echo "Simulating clicks on workspace items..."
echo ""

for workspace in 1 2 3; do
  echo "Simulating click on workspace $workspace..."
  
  # Execute the click script directly
  SID=$workspace /Users/kbrdn1/.config/sketchybar/plugins/spaces/aerospace-hybrid-handler.sh click
  
  wait_with_progress 2 "Observing result"
  show_workspace_state
done

# Test 4: Verify visual states
echo "Test 4: Verifying visual states"
echo "==============================="
echo "Setting specific visual states for verification..."
echo ""

echo "Setting workspace 1 as selected (with circle)..."
sketchybar --set aerospace_space.1 \
           background.drawing=on \
           background.color=0xffc6a0f6 \
           background.corner_radius=11 \
           background.height=22 \
           icon.color=0xff1e1e2e

echo "Setting workspaces 2-6 as unselected (no circle)..."
for i in {2..6}; do
  sketchybar --set aerospace_space.$i \
             background.drawing=off \
             icon.color=0xffcad3f5
done

wait_with_progress 3 "Observing manual state"

# Test 5: Return to actual state
echo ""
echo "Test 5: Returning to actual workspace state"
echo "==========================================="
echo "Triggering update to match actual workspace..."
echo ""

# Get current workspace and update
current_workspace=$(aerospace list-workspaces --focused 2>/dev/null || echo "1")
echo "Actual current workspace: $current_workspace"
echo "Triggering workspace change event..."

sketchybar --trigger aerospace_workspace_change

# Force update through monitor
/Users/kbrdn1/.config/sketchybar/plugins/spaces/aerospace-hybrid-handler.sh monitor

wait_with_progress 2 "Updating to actual state"

# Final status
echo ""
echo "================================================"
echo "Test Complete!"
echo "================================================"
echo ""
echo "Visual indicators to verify:"
echo "✓ Selected workspace should have:"
echo "  - Purple circular background (0xffc6a0f6)"
echo "  - Dark text color (0xff1e1e2e)"
echo "  - Smooth animation when switching"
echo ""
echo "✓ Unselected workspaces should have:"
echo "  - No background"
echo "  - Light text color (0xffcad3f5)"
echo ""
echo "✓ Clicking workspace icons should:"
echo "  - Switch to that workspace"
echo "  - Update visual indicators"
echo ""

# Show final state
echo "Final workspace state:"
show_workspace_state

echo "If any issues were observed, check:"
echo "1. ~/Users/kbrdn1/.config/sketchybar/plugins/spaces/aerospace-hybrid-handler.sh"
echo "2. ~/Users/kbrdn1/.config/sketchybar/plugins/spaces/aerospace-hybrid-items.sh"
echo "3. Run 'sketchybar --reload' to reload configuration"