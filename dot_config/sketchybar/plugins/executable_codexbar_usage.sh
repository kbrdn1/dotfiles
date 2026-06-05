#!/bin/bash
source "$HOME/.config/sketchybar/settings/colors.sh"

CODEXBAR=/opt/homebrew/bin/codexbar
TMPDIR_CB=$(mktemp -d)

($CODEXBAR usage --json --provider claude --no-color 2>/dev/null | jq -r '.[0].usage.primary.usedPercent // empty' > "$TMPDIR_CB/claude" 2>/dev/null) &
($CODEXBAR usage --json --provider copilot --no-color 2>/dev/null | jq -r '.[0].usage.primary.usedPercent // empty' > "$TMPDIR_CB/copilot" 2>/dev/null) &
wait

CLAUDE_RAW=$(cat "$TMPDIR_CB/claude" 2>/dev/null)
COPILOT_RAW=$(cat "$TMPDIR_CB/copilot" 2>/dev/null)
rm -rf "$TMPDIR_CB"

# empty = error/timeout, valid number = real value (including 0)
if [ -n "$CLAUDE_RAW" ]; then
  CLAUDE=$(printf "%.0f" "$CLAUDE_RAW" 2>/dev/null)
  CLAUDE_LABEL="${CLAUDE}%"
  CLAUDE_COLOR=$ORANGE
else
  CLAUDE_LABEL="?"
  CLAUDE_COLOR=$GREY
fi

if [ -n "$COPILOT_RAW" ]; then
  COPILOT=$(printf "%.0f" "$COPILOT_RAW" 2>/dev/null)
  COPILOT_LABEL="${COPILOT}%"
  COPILOT_COLOR=$MAGENTA
else
  COPILOT_LABEL="?"
  COPILOT_COLOR=$GREY
fi

sketchybar --set codexbar_claude label="$CLAUDE_LABEL" icon.color="$CLAUDE_COLOR" label.color="$CLAUDE_COLOR" \
           --set codexbar_copilot label="$COPILOT_LABEL" icon.color="$COPILOT_COLOR" label.color="$COPILOT_COLOR"
