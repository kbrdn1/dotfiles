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
    # AeroSpace uses static workspaces (1,2,3,4,5,6)
    echo "AeroSpace workspaces are static: 1=Mail 2=Postman 3=Code 4=Arc 5=Slack 6=Database"
  else
    # Focus the workspace using AeroSpace
    aerospace workspace $SID 2>/dev/null
    # Trigger workspace change event for sketchybar updates
    sketchybar --trigger aerospace_workspace_change
  fi
}

case "$SENDER" in
  "mouse.clicked") mouse_clicked
  ;;
  *) update
  ;;
esac