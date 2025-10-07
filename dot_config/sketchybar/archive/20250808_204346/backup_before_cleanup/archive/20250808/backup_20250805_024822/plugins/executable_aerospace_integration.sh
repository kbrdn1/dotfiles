#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh" # Loads all the settings

window_state() {
  source "$SETTINGS_DIR/colors.sh" # Loads all defined colors
  source "$SETTINGS_DIR/icons.sh" # Loads all defined icons

  # Get focused window information from AeroSpace
  FOCUSED_WINDOW=$(aerospace list-windows --focused 2>/dev/null)
  
  args=()
  
  if [ -z "$FOCUSED_WINDOW" ]; then
    # No focused window - show inactive state
    args+=(--set $NAME icon=$YABAI_GRID icon.color=$GREY label.drawing=off)
  else
    # Get current workspace
    CURRENT_WORKSPACE=$(aerospace list-workspaces --focused 2>/dev/null)
    
    # Check if we have a focused window
    if [ -n "$FOCUSED_WINDOW" ]; then
      # Parse window info to determine state
      # AeroSpace doesn't provide floating state per window like yabai
      # We'll show different states based on available info
      
      # Default to tiled state (AeroSpace's primary mode)
      args+=(--set $NAME icon=$YABAI_GRID icon.color=$ORANGE label.drawing=off)
      
      # You could extend this to check for fullscreen mode:
      # FULLSCREEN_CHECK=$(aerospace list-windows --focused --format '%{is-fullscreen}' 2>/dev/null)
      # if [ "$FULLSCREEN_CHECK" = "true" ]; then
      #   args+=(--set $NAME icon=$YABAI_FULLSCREEN_ZOOM icon.color=$GREEN)
      # fi
    fi
  fi

  sketchybar -m "${args[@]}"
}

windows_on_spaces() {
  # Get all workspaces (AeroSpace typically uses 1-10, but we'll check dynamically)
  WORKSPACES=$(aerospace list-workspaces --all 2>/dev/null)
  
  args=()
  
  for workspace in $WORKSPACES; do
    icon_strip=" "
    
    # Get apps in this workspace
    apps=$(aerospace list-windows --workspace "$workspace" 2>/dev/null | awk '{print $3}' | sort -u)
    
    if [ -n "$apps" ]; then
      while IFS= read -r app; do
        if [ -n "$app" ] && [ "$app" != "" ]; then
          # Use the existing icon_map.sh to get app icons
          app_icon=$($HOME/.config/sketchybar/plugins/icon_map.sh "$app" 2>/dev/null)
          if [ -n "$app_icon" ]; then
            icon_strip+=" $app_icon"
          fi
        fi
      done <<< "$apps"
    fi
    
    # Update the space label with app icons
    args+=(--set space.$workspace label="$icon_strip" label.drawing=on)
  done

  sketchybar -m "${args[@]}"
}

workspace_change() {
  # Get current focused workspace
  CURRENT_WORKSPACE=$(aerospace list-workspaces --focused 2>/dev/null)
  
  # Update workspace highlighting
  for i in {1..10}; do
    if [ "$i" = "$CURRENT_WORKSPACE" ]; then
      sketchybar --set space.$i icon.highlight=on
    else
      sketchybar --set space.$i icon.highlight=off
    fi
  done
  
  # Update windows on all spaces
  windows_on_spaces
  
  # Update window state
  window_state
}

mouse_clicked() {
  # Toggle between floating and tiling layout
  aerospace layout floating tiling 2>/dev/null
  
  # Small delay to let AeroSpace process the change
  sleep 0.1
  
  # Update window state after layout change
  window_state
}

reload_aerospace() {
  # Reload AeroSpace configuration
  aerospace reload-config 2>/dev/null
  
  # Update all states after reload
  workspace_change
}

# Handle different events sent by sketchybar
case "$SENDER" in
  "mouse.clicked") 
    mouse_clicked
    ;;
  "forced") 
    exit 0
    ;;
  "window_focus") 
    window_state
    ;;
  "windows_on_spaces") 
    windows_on_spaces
    ;;
  "aerospace_workspace_change") 
    workspace_change
    ;;
  "space_change")
    workspace_change
    ;;
  "reload_aerospace")
    reload_aerospace
    ;;
  *)
    # Default action - update everything
    workspace_change
    ;;
esac