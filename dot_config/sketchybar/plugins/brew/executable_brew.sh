#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"
source "$SETTINGS_DIR/icons.sh"

# Define cache file location
CACHE_FILE="/tmp/sketchybar_brew_cache"
CACHE_TIMEOUT=60

popup() {
  sketchybar --set "$NAME" popup.drawing="$1"
}

update_cache() {
  local force=$1

  if [[ "$force" == true ]] || \
     [ ! -f "$CACHE_FILE" ] || \
     [ $(($(date +%s) - $(stat -f %m "$CACHE_FILE"))) -gt $CACHE_TIMEOUT ]; then
    brew outdated --verbose > "$CACHE_FILE"
    sketchybar --remove '/brew.outdated.*/'
  fi
}

update_brew() {
  local force=$1


  update_cache $force

  COUNT=$(wc -l < "$CACHE_FILE" | tr -d ' ')

  if [ "$COUNT" -gt 0 ]; then
    while read -r line; do
      if [ ! -z "$line" ]; then
        package=$(echo "$line" | awk '{print $1}')
        current=$(echo "$line" | grep -o '[0-9][0-9.]*' | head -1)
        latest=$(echo "$line" | grep -o '[0-9][0-9.]*' | tail -1)

        item_name="brew.outdated.$package"
        label_text="$package ($current → $latest)"
        CLICK_SCRIPT="brew upgrade $package"

        sketchybar --add item "$item_name" popup.brew \
                   --set "$item_name" \
                   label="$label_text" \
                   icon=$BREW_ITEM \
                   icon.font="$FONT:Bold:12.0" \
                   icon.color=$YELLOW \
                   icon.padding_left=10 \
                   label.padding_right=10 \
                   label.font="$FONT:Regular:12.0" \
                   label.color=$WHITE \
                   click_script="$CLICK_SCRIPT" \
                   --subscribe "$item_name" mouse.clicked
      fi
    done < "$CACHE_FILE"
  else
    sketchybar --add item brew.outdated.none popup.brew \
               --set "brew.outdated.none" \
               label="No outdated packages" \
               label.font="$FONT:Regular:12.0" \
               label.color=$GREEN \
               icon.drawing=off
  fi

  COLOR=$GREEN
  case "$COUNT" in
    [3-5][0-9]) COLOR=$ORANGE ;;
    [1-2][0-9]) COLOR=$YELLOW ;;
    [1-9]) COLOR=$WHITE ;;
    0) COUNT=􀆅 ;;
  esac

  sketchybar --set brew label=$COUNT icon.color=$COLOR
}

case "$SENDER" in
  "mouse.entered")
    popup on
    ;;
  "mouse.clicked")
    if [ "$MODIFIER" = "shift" ]; then
      update_brew true  # Force cache update with shift+click
    fi
    ;;
  "mouse.exited" | "mouse.exited.global")
    popup off
    ;;
  "brew_update"|"routine")
    update_brew
    ;;
esac

# Initial update
update_brew true
