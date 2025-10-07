#!/bin/bash

# AeroSpace Event Integration for SketchyBar
# This file configures and manages AeroSpace event subscriptions
# ensuring proper synchronization between AeroSpace and SketchyBar

source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"
source "$SETTINGS_DIR/icons.sh"

# Event Configuration
AEROSPACE_EVENTS=(
  "workspace-change"
  "window-focus"
  "window-move"
  "layout-change"
)

# Register AeroSpace events with SketchyBar
register_aerospace_events() {
  echo "Registering AeroSpace events..."
  
  # Create custom events for AeroSpace integration
  sketchybar --add event aerospace_workspace_change
  sketchybar --add event aerospace_window_focus
  sketchybar --add event aerospace_window_move
  sketchybar --add event aerospace_layout_change
  
  echo "Events registered successfully"
}

# Setup event listeners
setup_event_listeners() {
  echo "Setting up AeroSpace event listeners..."
  
  # Subscribe workspace items to workspace changes
  for i in {1..6}; do
    sketchybar --subscribe aerospace_space.$i \
               aerospace_workspace_change \
               aerospace_window_focus \
               aerospace_window_move
  done
  
  # Subscribe monitor to all events
  sketchybar --subscribe aerospace_monitor \
             aerospace_workspace_change \
             aerospace_window_focus \
             aerospace_window_move \
             aerospace_layout_change
  
  # Subscribe window manager indicator
  sketchybar --subscribe aerospace_window_manager \
             aerospace_window_focus \
             aerospace_layout_change
  
  echo "Event listeners configured"
}

# AeroSpace state watcher daemon
start_aerospace_watcher() {
  echo "Starting AeroSpace state watcher..."
  
  # Kill any existing watcher
  pkill -f "aerospace_watcher.sh" 2>/dev/null
  
  # Start the watcher in background
  cat > /tmp/aerospace_watcher.sh << 'EOF'
#!/bin/bash

# AeroSpace State Watcher Daemon
# Monitors AeroSpace state changes and triggers SketchyBar events

LAST_WORKSPACE=""
LAST_WINDOW=""
CHECK_INTERVAL=0.1

while true; do
  # Check current workspace
  CURRENT_WORKSPACE=$(aerospace list-workspaces --focused 2>/dev/null)
  
  # Check if workspace changed
  if [ "$CURRENT_WORKSPACE" != "$LAST_WORKSPACE" ]; then
    sketchybar --trigger aerospace_workspace_change
    LAST_WORKSPACE="$CURRENT_WORKSPACE"
  fi
  
  # Check current focused window
  CURRENT_WINDOW=$(aerospace list-windows --focused 2>/dev/null | head -1)
  
  # Check if window changed
  if [ "$CURRENT_WINDOW" != "$LAST_WINDOW" ]; then
    sketchybar --trigger aerospace_window_focus
    LAST_WINDOW="$CURRENT_WINDOW"
  fi
  
  sleep $CHECK_INTERVAL
done
EOF
  
  chmod +x /tmp/aerospace_watcher.sh
  /tmp/aerospace_watcher.sh > /dev/null 2>&1 &
  
  echo "Watcher started with PID: $!"
  echo $! > /tmp/aerospace_watcher.pid
}

# Stop the watcher daemon
stop_aerospace_watcher() {
  echo "Stopping AeroSpace state watcher..."
  
  if [ -f /tmp/aerospace_watcher.pid ]; then
    kill $(cat /tmp/aerospace_watcher.pid) 2>/dev/null
    rm /tmp/aerospace_watcher.pid
  fi
  
  pkill -f "aerospace_watcher.sh" 2>/dev/null
  echo "Watcher stopped"
}

# Sync current state
sync_aerospace_state() {
  echo "Synchronizing AeroSpace state with SketchyBar..."
  
  # Get current workspace
  CURRENT_WORKSPACE=$(aerospace list-workspaces --focused 2>/dev/null || echo "1")
  
  # Update all workspace items
  for i in {1..6}; do
    if [ "$i" = "$CURRENT_WORKSPACE" ]; then
      # Selected state
      sketchybar --set aerospace_space.$i \
                 background.drawing=on \
                 background.color=0xffc6a0f6 \
                 background.corner_radius=11 \
                 background.height=22 \
                 icon.color=0xff1e1e2e \
                 icon.padding_left=8 \
                 icon.padding_right=8 \
                 padding_left=3 \
                 padding_right=3
    else
      # Unselected state
      sketchybar --set aerospace_space.$i \
                 background.drawing=off \
                 icon.color=0xffcad3f5 \
                 icon.padding_left=8 \
                 icon.padding_right=8 \
                 padding_left=3 \
                 padding_right=3
    fi
  done
  
  # Trigger events to update all components
  sketchybar --trigger aerospace_workspace_change
  sketchybar --trigger aerospace_window_focus
  
  echo "State synchronized"
}

# Initialize AeroSpace integration
initialize_aerospace_integration() {
  echo "Initializing AeroSpace integration..."
  
  # Register events
  register_aerospace_events
  
  # Setup listeners
  setup_event_listeners
  
  # Start watcher
  start_aerospace_watcher
  
  # Sync initial state
  sync_aerospace_state
  
  echo "AeroSpace integration initialized successfully"
}

# Cleanup function
cleanup_aerospace_integration() {
  echo "Cleaning up AeroSpace integration..."
  stop_aerospace_watcher
  echo "Cleanup complete"
}

# Handle script arguments
case "${1:-init}" in
  "init")
    initialize_aerospace_integration
    ;;
  "start")
    start_aerospace_watcher
    ;;
  "stop")
    stop_aerospace_watcher
    ;;
  "restart")
    stop_aerospace_watcher
    sleep 1
    start_aerospace_watcher
    ;;
  "sync")
    sync_aerospace_state
    ;;
  "cleanup")
    cleanup_aerospace_integration
    ;;
  *)
    echo "Usage: $0 {init|start|stop|restart|sync|cleanup}"
    exit 1
    ;;
esac