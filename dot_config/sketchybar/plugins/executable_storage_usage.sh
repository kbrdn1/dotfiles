#!/bin/bash
source "$HOME/.config/sketchybar/settings/colors.sh"

# Get real APFS container usage (df lies on APFS snapshots)
CONTAINER_INFO=$(diskutil apfs list 2>/dev/null | grep -A5 "Container disk3")
TOTAL_BYTES=$(echo "$CONTAINER_INFO" | awk '/Size \(Capacity Ceiling\)/{print $4}')
USED_BYTES=$(echo "$CONTAINER_INFO" | awk '/Capacity In Use By Volumes/{print $6}')

# Convert bytes to human readable (GB)
USED_GB=$(awk "BEGIN { printf \"%.0f\", $USED_BYTES / 1000000000 }")
TOTAL_GB=$(awk "BEGIN { printf \"%.0f\", $TOTAL_BYTES / 1000000000 }")

# Calculate percentage
PCT=$(awk "BEGIN { printf \"%.0f\", $USED_BYTES * 100 / $TOTAL_BYTES }")

# Color based on usage level
if   [ "$PCT" -le 60 ]; then COLOR=$BLUE
elif [ "$PCT" -le 80 ]; then COLOR=$ORANGE
else                         COLOR=$RED
fi

# Vertical battery gauge (single block character, fills from bottom)
if   [ "$PCT" -le 12 ]; then BAR="▁"
elif [ "$PCT" -le 25 ]; then BAR="▂"
elif [ "$PCT" -le 37 ]; then BAR="▃"
elif [ "$PCT" -le 50 ]; then BAR="▄"
elif [ "$PCT" -le 62 ]; then BAR="▅"
elif [ "$PCT" -le 75 ]; then BAR="▆"
elif [ "$PCT" -le 87 ]; then BAR="▇"
else                         BAR="█"
fi

sketchybar --set storage.usage label="${USED_GB}G/${TOTAL_GB}G" label.color="$COLOR" \
           --set storage.bar label="$BAR" label.color="$COLOR"
