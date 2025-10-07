#!/bin/bash

update() {
    # Get current focused workspace from AeroSpace
    FOCUSED_WORKSPACE=$(aerospace list-workspaces --focused 2>/dev/null || echo "1")
    
    # Determine if this space is selected
    if [ "$SID" = "$FOCUSED_WORKSPACE" ]; then
        SELECTED="true"
        WIDTH="0"
        ICON_HIGHLIGHT="on"
        LABEL_WIDTH="0"
    else
        SELECTED="false"
        WIDTH="dynamic"
        ICON_HIGHLIGHT="off"
        LABEL_WIDTH="dynamic"
    fi

    # Update the space appearance
    sketchybar --animate tanh 20 \
               --set $NAME \
                     icon.highlight=$SELECTED \
                     label.width=$LABEL_WIDTH \
                     drawing=on
}

mouse_clicked() {
    if [ "$BUTTON" = "right" ]; then
        # Show workspace info on right click
        echo "AeroSpace workspaces: 1=Mail 2=Postman 3=Code 4=Arc(Q) 5=Slack(W) 6=Database(E)"
        sketchybar --set $NAME popup.drawing=toggle
    else
        # Focus the workspace using AeroSpace on left click
        aerospace workspace $SID 2>/dev/null
        
        # Force update of all spaces after workspace change
        sketchybar --trigger aerospace_workspace_change
        
        # Update this space immediately
        update
    fi
}

# Handle different events
case "$SENDER" in
    "mouse.clicked") 
        mouse_clicked
        ;;
    "aerospace_workspace_change"|"forced"|*)
        update
        ;;
esac