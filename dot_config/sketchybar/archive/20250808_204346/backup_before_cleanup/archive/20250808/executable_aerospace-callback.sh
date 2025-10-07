#!/bin/bash

# AeroSpace Callback Script for SketchyBar
# This script is called by AeroSpace when workspace events occur
# It triggers SketchyBar updates to keep the UI in sync

# Get the event type from AeroSpace (passed as first argument)
EVENT_TYPE="$1"
WORKSPACE_ID="$2"

# Log events for debugging (optional)
if [ -n "$DEBUG" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] AeroSpace Event: $EVENT_TYPE, Workspace: $WORKSPACE_ID" >> /tmp/aerospace-callback.log
fi

# Function to update workspace highlighting
update_workspace_highlighting() {
  local focused_workspace=$(aerospace list-workspaces --focused 2>/dev/null || echo "1")
  
  # Update all workspace items
  for i in {1..6}; do
    if [ "$i" = "$focused_workspace" ]; then
      # Selected state with circle background
      sketchybar --set aerospace_space.$i \
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
                 width=36 \
                 icon.highlight=off
    else
      # Unselected state without background
      sketchybar --set aerospace_space.$i \
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
                 width=36 \
                 icon.highlight=off
    fi
  done
}

# Function to update window state indicator
update_window_state() {
  # Trigger the aerospace window state update
  sketchybar --trigger aerospace_window_focus
}

# Function to update app icons on workspaces
update_workspace_apps() {
  # Trigger the windows_on_spaces update
  $HOME/.config/sketchybar/plugins/aerospace.sh windows_on_spaces
}

# Main event handler
case "$EVENT_TYPE" in
  "workspace-change"|"workspace_change")
    # Workspace has changed
    update_workspace_highlighting
    update_workspace_apps
    
    # Store the current workspace for future reference
    echo "$WORKSPACE_ID" > /tmp/sketchybar_aerospace_workspace
    
    # Trigger SketchyBar event
    sketchybar --trigger aerospace_workspace_change
    ;;
    
  "window-focus"|"window_focus")
    # Window focus has changed
    update_window_state
    
    # Trigger SketchyBar event
    sketchybar --trigger aerospace_window_focus
    ;;
    
  "window-move"|"window_move")
    # Window has been moved to different workspace
    update_workspace_apps
    
    # Trigger SketchyBar event
    sketchybar --trigger aerospace_window_move
    ;;
    
  "layout-change"|"layout_change")
    # Layout has changed (tiling/floating)
    update_window_state
    
    # Trigger SketchyBar event
    sketchybar --trigger aerospace_layout_change
    ;;
    
  "reload"|"init")
    # Full reload/initialization
    update_workspace_highlighting
    update_window_state
    update_workspace_apps
    
    # Trigger all events
    sketchybar --trigger aerospace_workspace_change
    sketchybar --trigger aerospace_window_focus
    ;;
    
  *)
    # Unknown event - do a safe update
    update_workspace_highlighting
    ;;
esac

# Exit successfully
exit 0