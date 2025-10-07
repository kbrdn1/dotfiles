#!/bin/bash

update() {
  WIDTH="dynamic"
  if [ "$SELECTED" = "true" ]; then
    WIDTH="0"
  fi

  sketchybar --animate tanh 20 --set $NAME icon.highlight=$SELECTED label.width=$WIDTH
}

mouse_clicked() {
  if [ "$BUTTON" = "right" ]; then
    # AeroSpace doesn't support dynamic workspace creation/destruction like yabai
    # We could show a notification or do nothing
    echo "Right-click on workspace $SID - AeroSpace workspaces are static (1-5)"
  else
    # Focus the workspace using AeroSpace
    aerospace workspace $SID 2>/dev/null
    # Trigger workspace change event
    sketchybar --trigger aerospace_workspace_change
  fi
}

case "$SENDER" in
  "mouse.clicked") mouse_clicked
  ;;
  *) update
  ;;
esac