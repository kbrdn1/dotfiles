#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh" # Loads all the settings

window_state() {
  source "$SETTINGS_DIR/colors.sh" # Loads all defined colors
  source "$SETTINGS_DIR/icons.sh" # Loads all defined icons

  # Get current focused window from AeroSpace
  FOCUSED_WINDOW=$(aerospace list-windows --focused 2>/dev/null)
  
  args=()
  
  if [ -z "$FOCUSED_WINDOW" ]; then
    # No focused window
    args+=(--set $NAME icon=$YABAI_GRID icon.color=$GREY label.drawing=off)
  else
    # Get current workspace to check layout
    CURRENT_WORKSPACE=$(aerospace list-workspaces --focused 2>/dev/null)
    
    # Check if any window in current workspace is floating
    # AeroSpace doesn't provide direct floating status per window like yabai
    # We'll use the workspace layout as indicator
    WORKSPACE_WINDOWS=$(aerospace list-windows --workspace "$CURRENT_WORKSPACE" 2>/dev/null)
    
    # For AeroSpace, we'll show:
    # - Tiled (default state) 
    # - Floating (when layout floating is active)
    # Since AeroSpace doesn't expose individual window floating state,
    # we'll assume tiled by default and show different colors based on activity
    
    if [ -n "$FOCUSED_WINDOW" ]; then
      # Window is focused and managed
      args+=(--set $NAME icon=$YABAI_GRID icon.color=$ORANGE label.drawing=off)
    else
      # Fallback state
      args+=(--set $NAME icon=$YABAI_GRID icon.color=$WHITE label.drawing=off)
    fi
  fi

  sketchybar -m "${args[@]}"
}

windows_on_spaces() {
  # Get all available workspaces
  ALL_WORKSPACES=$(aerospace list-workspaces --all 2>/dev/null)

  args=()
  
  for workspace in $ALL_WORKSPACES; do
    icon_strip=" "
    
    # Get all windows in this workspace and extract app names
    apps=$(aerospace list-windows --workspace "$workspace" 2>/dev/null | awk '{print $3}' | sort -u)
    
    if [ -n "$apps" ]; then
      while IFS= read -r app; do
        if [ -n "$app" ] && [ "$app" != "" ]; then
          icon_strip+=" $($HOME/.config/sketchybar/plugins/icon_map.sh "$app")"
        fi
      done <<< "$apps"
    fi
    
    args+=(--set space.$workspace label="$icon_strip" label.drawing=on)
  done

  sketchybar -m "${args[@]}"
}

workspace_change() {
  # Get current focused workspace
  CURRENT_WORKSPACE=$(aerospace list-workspaces --focused 2>/dev/null)
  
  # Update workspace highlighting for spaces 1-5
  for i in {1..5}; do
    if [ "$i" = "$CURRENT_WORKSPACE" ]; then
      sketchybar --set space.$i icon.highlight=on
    else
      sketchybar --set space.$i icon.highlight=off
    fi
  done
  
  # Also update the windows on spaces
  windows_on_spaces
}

mouse_clicked() {
  # Toggle between floating and tiling layout
  aerospace layout floating tiling 2>/dev/null
  sleep 0.1
  window_state
}

case "$SENDER" in
  "mouse.clicked") mouse_clicked
  ;;
  "forced") exit 0
  ;;
  "window_focus") window_state
  ;;
  "windows_on_spaces") windows_on_spaces
  ;;
  "aerospace_workspace_change") workspace_change
  ;;
esac