#!/bin/bash

# Music module - single optimized script for Apple Music
# Handles: info display, controls, hover, click
# Uses batched osascript to minimize process spawns

get_music_info() {
  # Single osascript call for all info (1 process instead of 4)
  local info
  info=$(osascript << 'EOF'
tell application "System Events"
  if not (exists (processes whose name is "Music")) then return "none|||"
end tell
tell application "Music"
  try
    set pState to player state as string
    if pState is "playing" or pState is "paused" then
      return pState & "|" & name of current track & "|" & artist of current track & "|" & album of current track
    end if
  end try
end tell
return "stopped|||"
EOF
  )

  [ -z "$info" ] && info="none|||"

  CACHE_STATE="${info%%|*}"; info="${info#*|}"
  CACHE_TITLE="${info%%|*}"; info="${info#*|}"
  CACHE_ARTIST="${info%%|*}"
  CACHE_ALBUM="${info#*|}"
}

update() {
  # Try $INFO from media_change first (free, no osascript needed)
  if [ -n "$INFO" ]; then
    CACHE_STATE="$(echo "$INFO" | jq -r '.state // empty' 2>/dev/null)"
    CACHE_TITLE="$(echo "$INFO" | jq -r '.title // empty' 2>/dev/null)"
    CACHE_ARTIST="$(echo "$INFO" | jq -r '.artist // empty' 2>/dev/null)"
    CACHE_ALBUM="$(echo "$INFO" | jq -r '.album // empty' 2>/dev/null)"
  fi

  # Fallback to osascript if no media_change data
  if [ -z "$CACHE_STATE" ]; then
    get_music_info
  fi

  # Build label
  local label=""
  if [ -n "$CACHE_TITLE" ]; then
    label="$CACHE_TITLE"
    [ -n "$CACHE_ARTIST" ] && label="$label - $CACHE_ARTIST"
  fi

  # Determine visual state
  local drawing=off play_icon="􀊄" ctrl_drawing=off
  case "$CACHE_STATE" in
    playing)
      drawing=on
      ctrl_drawing=on
      play_icon="􀊆"  # pause icon
      ;;
    paused)
      drawing=on
      ctrl_drawing=on
      play_icon="􀊄"  # play icon
      ;;
    *)
      label=""
      ;;
  esac

  # Single batched sketchybar call for all 4 items
  sketchybar --animate sin 10 \
    --set music label="$label" drawing="$drawing" \
    --set music_play icon="$play_icon" drawing="$ctrl_drawing" \
    --set music_prev drawing="$ctrl_drawing" \
    --set music_next drawing="$ctrl_drawing"
}

mouse_clicked() {
  case "$NAME" in
    music)
      case "$BUTTON" in
        left)   osascript -e 'tell application "Music" to playpause' 2>/dev/null ;;
        right)  osascript -e 'tell application "Music" to next track' 2>/dev/null ;;
        middle) osascript -e 'tell application "Music" to previous track' 2>/dev/null ;;
      esac
      ;;
    music_play) osascript -e 'tell application "Music" to playpause' 2>/dev/null ;;
    music_prev) osascript -e 'tell application "Music" to previous track' 2>/dev/null ;;
    music_next) osascript -e 'tell application "Music" to next track' 2>/dev/null ;;
  esac

  sleep 0.3
  CACHE_STATE="" INFO=""
  update
}

mouse_entered() {
  get_music_info
  if [ -n "$CACHE_TITLE" ] && [ -n "$CACHE_ALBUM" ]; then
    local hover="$CACHE_TITLE - $CACHE_ARTIST · $CACHE_ALBUM"
    sketchybar --animate sin 8 --set music label="$hover"
  fi
}

mouse_exited() {
  get_music_info
  local label=""
  if [ -n "$CACHE_TITLE" ]; then
    label="$CACHE_TITLE"
    [ -n "$CACHE_ARTIST" ] && label="$label - $CACHE_ARTIST"
  fi
  sketchybar --animate sin 8 --set music label="$label"
}

case "$SENDER" in
  "media_change")  update ;;
  "mouse.clicked") mouse_clicked ;;
  "mouse.entered") mouse_entered ;;
  "mouse.exited")  mouse_exited ;;
  *)               update ;;
esac
