#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"

NIX=/nix/var/nix/profiles/default/bin/nix
CACHE_FILE="/tmp/sketchybar_nix_outdated"

update_nix() {
  # Always background - git ls-remote + nix profile list can be slow
  (
    # Get latest nixpkgs-unstable commit
    LATEST=$(git ls-remote https://github.com/NixOS/nixpkgs refs/heads/nixpkgs-unstable 2>/dev/null | cut -f1)
    [ -z "$LATEST" ] && exit 1

    # Get locked commits per package, output outdated names
    $NIX profile list --json 2>/dev/null | jq -r --arg latest "$LATEST" '
      .elements | to_entries[] |
      select(.value.url | test("NixOS/nixpkgs")) |
      select(.value.url | test($latest) | not) |
      .key
    ' > "$CACHE_FILE.tmp" 2>/dev/null

    mv "$CACHE_FILE.tmp" "$CACHE_FILE"
  ) &

  # Use existing cache, show ? if none yet
  if [ ! -f "$CACHE_FILE" ]; then
    sketchybar --set nix label="?" icon.color=$GREY
    return
  fi

  COUNT=$(wc -l < "$CACHE_FILE" | tr -d ' ')
  COUNT=${COUNT:-0}

  if [ "$COUNT" -eq 0 ]; then
    sketchybar --set nix label="✓" icon.color=$GREEN
  else
    COLOR=$WHITE
    case "$COUNT" in
      [5-9]|[1-9][0-9]) COLOR=$YELLOW ;;
    esac
    sketchybar --set nix label="$COUNT" icon.color="$COLOR"
  fi
}

build_popup() {
  sketchybar --remove '/nix.pkg\..*/' 2>/dev/null

  [ ! -f "$CACHE_FILE" ] && return

  local count
  count=$(wc -l < "$CACHE_FILE" | tr -d ' ')

  if [ "$count" -eq 0 ]; then
    sketchybar --add item nix.pkg.none popup.nix \
               --set nix.pkg.none \
                 label="All up to date" \
                 label.font="$FONT:Regular:12.0" \
                 label.color=$GREEN \
                 icon.drawing=off
    return
  fi

  while IFS= read -r pkg; do
    [ -z "$pkg" ] && continue
    sketchybar --add item "nix.pkg.$pkg" popup.nix \
               --set "nix.pkg.$pkg" \
                 label="$pkg" \
                 icon="󱄅" \
                 icon.font="$FONT:Bold:12.0" \
                 icon.color=$CYAN \
                 icon.padding_left=10 \
                 label.padding_right=10 \
                 label.font="$FONT:Regular:12.0" \
                 label.color=$WHITE
  done < "$CACHE_FILE"
}

case "$SENDER" in
  "mouse.entered")
    build_popup
    sketchybar --set nix popup.drawing=on
    ;;
  "mouse.exited"|"mouse.exited.global")
    sketchybar --set nix popup.drawing=off
    ;;
  *)
    update_nix
    ;;
esac
