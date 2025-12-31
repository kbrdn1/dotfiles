#!/bin/bash

# Debug log
echo "$(date): aerospace_trigger.sh called" >> /tmp/aerospace_trigger.log

# Get current focused workspace
FOCUSED=$(aerospace list-workspaces --focused 2>/dev/null)
echo "$(date): FOCUSED=$FOCUSED" >> /tmp/aerospace_trigger.log

# Update all space items with the correct state
for i in {1..7}; do
  SENDER="aerospace_workspace_change" \
  NAME="space.$i" \
  bash "$HOME/.config/sketchybar/plugins/spaces/spaces.sh"
done

echo "$(date): Update completed" >> /tmp/aerospace_trigger.log
