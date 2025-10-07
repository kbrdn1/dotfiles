#!/bin/bash

update() {
  # Get current focused workspace from AeroSpace
  FOCUSED_WORKSPACE=$(aerospace list-workspaces --focused 2>/dev/null || echo "1")
  
  # Check if this space is the focused one
  if [ "$SID" = "$FOCUSED_WORKSPACE" ]; then
    SELECTED="true"
  else
    SELECTED="false"
  fi

  # Update the space appearance - only icon highlighting, no labels
  sketchybar --animate tanh 20 --set $NAME icon.highlight=$SELECTED
}

mouse_clicked() {
  if [ "$BUTTON" = "right" ]; then
    # Show workspace info on right click
    echo "AeroSpace workspaces: 1=Mail 2=Postman 3=Code 4=Arc 5=Slack 6=Database"
  else
    # Focus the workspace using AeroSpace on left click
    aerospace workspace $SID 2>/dev/null
    # Trigger workspace change event for all spaces to update
    sketchybar --trigger aerospace_workspace_change
  fi
}

case "$SENDER" in
  "mouse.clicked") mouse_clicked
  ;;
  *) update
  ;;
esac