#!/bin/bash
source "$HOME/.config/sketchybar/settings/colors.sh"

TMPDIR_CB=$(mktemp -d)

(codexbar usage --json --provider claude --no-color 2>/dev/null | jq -r '.[0].usage.primary.usedPercent // empty' > "$TMPDIR_CB/claude" 2>/dev/null) &
(codexbar usage --json --provider copilot --no-color 2>/dev/null | jq -r '.[0].usage.primary.usedPercent // empty' > "$TMPDIR_CB/copilot" 2>/dev/null) &
wait

CLAUDE_RAW=$(cat "$TMPDIR_CB/claude" 2>/dev/null)
COPILOT_RAW=$(cat "$TMPDIR_CB/copilot" 2>/dev/null)
rm -rf "$TMPDIR_CB"

CLAUDE=$(printf "%.0f" "${CLAUDE_RAW:-0}" 2>/dev/null || echo "?")
COPILOT=$(printf "%.0f" "${COPILOT_RAW:-0}" 2>/dev/null || echo "?")

[ "$CLAUDE" = "0" ] && CLAUDE="?"
[ "$COPILOT" = "0" ] && COPILOT="?"

sketchybar --set codexbar_claude label="${CLAUDE}%" \
           --set codexbar_copilot label="${COPILOT}%"
