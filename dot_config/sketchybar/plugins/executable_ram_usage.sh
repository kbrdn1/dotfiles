#!/bin/bash
source "$HOME/.config/sketchybar/settings/colors.sh"

VMSTAT=$(vm_stat)
PAGE_SIZE=$(echo "$VMSTAT" | head -1 | grep -o '[0-9]*')

get_pages() { echo "$VMSTAT" | awk "/$1/"'{ gsub(/\./, "", $NF); print $NF }'; }

PAGES_ACTIVE=$(get_pages "Pages active")
PAGES_WIRED=$(get_pages "Pages wired down")
PAGES_COMPRESSED=$(get_pages "Pages occupied by compressor")

TOTAL_MEM=$(sysctl -n hw.memsize)
TOTAL_PAGES=$((TOTAL_MEM / PAGE_SIZE))
USED_PAGES=$(( ${PAGES_ACTIVE:-0} + ${PAGES_WIRED:-0} + ${PAGES_COMPRESSED:-0} ))
PCT=$((USED_PAGES * 100 / TOTAL_PAGES))
[ "$PCT" -gt 100 ] && PCT=100

# Normalized value for graph (0.0 - 1.0)
GRAPH_VAL=$(awk "BEGIN { printf \"%.2f\", $PCT / 100 }")

# Color based on usage level
if   [ "$PCT" -le 60 ]; then COLOR=$MAGENTA
elif [ "$PCT" -le 80 ]; then COLOR=$ORANGE
else                         COLOR=$RED
fi

sketchybar --set ram.percent label="${PCT}%" \
           --set ram.graph graph.color="$COLOR" graph.fill_color="$COLOR" \
           --push ram.graph "$GRAPH_VAL"
