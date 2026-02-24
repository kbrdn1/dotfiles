#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"
source "$SETTINGS_DIR/icons.sh"

BREW=/opt/homebrew/bin/brew
CACHE_FILE="/tmp/sketchybar_brew_outdated"

update_brew() {
  # Always background - brew outdated is slow (fetches API)
  ( $BREW outdated --quiet > "$CACHE_FILE.tmp" 2>/dev/null && mv "$CACHE_FILE.tmp" "$CACHE_FILE" ) &

  # Use existing cache, show ? if none yet
  if [ ! -f "$CACHE_FILE" ]; then
    sketchybar --set brew label="?" icon.color=$GREY
    return
  fi

  COUNT=$(wc -l < "$CACHE_FILE" | tr -d ' ')
  COUNT=${COUNT:-0}

  if [ "$COUNT" -eq 0 ]; then
    sketchybar --set brew label="✓" icon.color=$GREEN
  else
    COLOR=$WHITE
    case "$COUNT" in
      [3-9][0-9]|[1-9][0-9][0-9]) COLOR=$ORANGE ;;
      [1-2][0-9]) COLOR=$YELLOW ;;
    esac
    sketchybar --set brew label="$COUNT" icon.color="$COLOR"
  fi
}

build_popup() {
  sketchybar --remove '/brew.pkg\..*/' 2>/dev/null

  [ ! -f "$CACHE_FILE" ] && return

  local count
  count=$(wc -l < "$CACHE_FILE" | tr -d ' ')

  if [ "$count" -eq 0 ]; then
    sketchybar --add item brew.pkg.none popup.brew \
               --set brew.pkg.none \
                 label="All up to date" \
                 label.font="$FONT:Regular:12.0" \
                 label.color=$GREEN \
                 icon.drawing=off
    return
  fi

  while IFS= read -r pkg; do
    [ -z "$pkg" ] && continue
    sketchybar --add item "brew.pkg.$pkg" popup.brew \
               --set "brew.pkg.$pkg" \
                 label="$pkg" \
                 icon=$BREW_ITEM \
                 icon.font="$FONT:Bold:12.0" \
                 icon.color=$YELLOW \
                 icon.padding_left=10 \
                 label.padding_right=10 \
                 label.font="$FONT:Regular:12.0" \
                 label.color=$WHITE
  done < "$CACHE_FILE"
}

case "$SENDER" in
  "mouse.entered")
    build_popup
    sketchybar --set brew popup.drawing=on
    ;;
  "mouse.exited"|"mouse.exited.global")
    sketchybar --set brew popup.drawing=off
    ;;
  *)
    update_brew
    ;;
esac
