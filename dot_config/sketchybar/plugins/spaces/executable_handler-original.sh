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

  # Update the item appearance - colored circle background for selection
  if [ "$SELECTED" = "true" ]; then
    sketchybar --animate tanh 20 --set "$NAME" \
               width=40 \
               icon.padding_left=10 \
               icon.padding_right=10 \
               padding_left=2 \
               padding_right=2 \
               background.drawing=on \
               background.color=0xffc6a0f6 \
               background.corner_radius=11 \
               background.height=22 \
               icon.color=0xff1e1e2e \
               icon.highlight=off
  else
    sketchybar --animate tanh 20 --set "$NAME" \
               width=40 \
               icon.padding_left=10 \
               icon.padding_right=10 \
               padding_left=2 \
               padding_right=2 \
               background.drawing=off \
               background.color=0x00000000 \
               background.corner_radius=11 \
               background.height=22 \
               icon.color=0xffcad3f5 \
               icon.highlight=off
  fi
}

update_all_workspaces() {
  # Get current focused workspace from AeroSpace
  FOCUSED_WORKSPACE=$(aerospace list-workspaces --focused 2>/dev/null || echo "1")
  
  # Update all workspace items with colored circle background
  for i in {1..6}; do
    if [ "$i" = "$FOCUSED_WORKSPACE" ]; then
      sketchybar --set aerospace_space.$i \
                 width=40 \
                 icon.padding_left=10 \
                 icon.padding_right=10 \
                 padding_left=2 \
                 padding_right=2 \
                 background.drawing=on \
                 background.color=0xffc6a0f6 \
                 background.corner_radius=11 \
                 background.height=22 \
                 icon.color=0xff1e1e2e \
                 icon.highlight=off
    else
      sketchybar --set aerospace_space.$i \
                 width=40 \
                 icon.padding_left=10 \
                 icon.padding_right=10 \
                 padding_left=2 \
                 padding_right=2 \
                 background.drawing=off \
                 background.color=0x00000000 \
                 background.corner_radius=11 \
                 background.height=22 \
                 icon.color=0xffcad3f5 \
                 icon.highlight=off
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
    # Show workspace info on right click (same as original)
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