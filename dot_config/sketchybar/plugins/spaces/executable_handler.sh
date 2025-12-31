#!/bin/bash

update() {
  # Get current focused workspace from AeroSpace
  FOCUSED_WORKSPACE=$(aerospace list-workspaces --focused 2>/dev/null || echo "1")
  
  # Extract workspace ID from item name (aerospace_space.1 -> 1)
  WORKSPACE_ID=$(echo "$NAME" | sed 's/aerospace_space\.//')
  
  # Check if this workspace is the focused one
  if [ "$WORKSPACE_ID" = "$FOCUSED_WORKSPACE" ]; then
    SELECTED="true"
  else
    SELECTED="false"
  fi

  # Update the item appearance - NO animation, fixed dimensions
  if [ "$SELECTED" = "true" ]; then
    sketchybar --set "$NAME" \
               background.drawing=on \
               icon.color=0xff1e1e2e
  else
    sketchybar --set "$NAME" \
               background.drawing=off \
               icon.color=0xffcad3f5
  fi
}

update_all_workspaces() {
  # Get current focused workspace from AeroSpace
  FOCUSED_WORKSPACE=$(aerospace list-workspaces --focused 2>/dev/null || echo "1")
  
  # Update all workspace items - minimal changes only
  for i in {1..6}; do
    if [ "$i" = "$FOCUSED_WORKSPACE" ]; then
      sketchybar --set aerospace_space.$i \
                 background.drawing=on \
                 icon.color=0xff1e1e2e
    else
      sketchybar --set aerospace_space.$i \
                 background.drawing=off \
                 icon.color=0xffcad3f5
    fi
  done
}

monitor() {
  # Monitor workspace changes and update highlighting
  CURRENT_WORKSPACE=$(aerospace list-workspaces --focused 2>/dev/null || echo "1")
  
  # Store the last known workspace to detect changes
  LAST_WORKSPACE_FILE="/tmp/sketchybar_aerospace_workspace"
  
  if [ -f "$LAST_WORKSPACE_FILE" ]; then
    LAST_WORKSPACE=$(cat "$LAST_WORKSPACE_FILE")
  else
    LAST_WORKSPACE=""
  fi
  
  # If workspace changed, update all workspaces
  if [ "$CURRENT_WORKSPACE" != "$LAST_WORKSPACE" ]; then
    echo "$CURRENT_WORKSPACE" > "$LAST_WORKSPACE_FILE"
    update_all_workspaces
  fi
}

mouse_clicked() {
  # Extract workspace ID from SID or item name
  if [ -n "$SID" ]; then
    WORKSPACE_ID="$SID"
  else
    WORKSPACE_ID=$(echo "$NAME" | sed 's/aerospace_space\.//')
  fi
  
  if [ "$BUTTON" = "right" ]; then
    # Show workspace info on right click
    echo "AeroSpace workspaces: 1=Mail 2=Postman 3=Code 4=Arc 5=Slack 6=Database"
  else
    # Focus the workspace using AeroSpace on left click
    if [ -n "$WORKSPACE_ID" ]; then
      aerospace workspace "$WORKSPACE_ID" 2>/dev/null
      # Trigger workspace change event for all spaces to update
      sketchybar --trigger aerospace_workspace_change
    fi
  fi
}

# Handle different events and calls
case "${1:-$SENDER}" in
  "click")
    mouse_clicked
    ;;
  "mouse.clicked") 
    mouse_clicked
    ;;
  "monitor")
    monitor
    ;;
  "aerospace_workspace_change"|"forced")
    update_all_workspaces
    ;;
  *)
    update
    ;;
esac