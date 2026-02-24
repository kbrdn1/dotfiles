#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"

NIX=/nix/var/nix/profiles/default/bin/nix

# Show upgrading state
sketchybar --set nix label="↻" icon.color=$YELLOW

# Upgrade all
$NIX profile upgrade '.*' >/dev/null 2>&1

# Refresh outdated count
LATEST=$(git ls-remote https://github.com/NixOS/nixpkgs refs/heads/nixpkgs-unstable 2>/dev/null | cut -f1)

if [ -n "$LATEST" ]; then
  $NIX profile list --json 2>/dev/null | jq -r --arg latest "$LATEST" '
    .elements | to_entries[] |
    select(.value.url | test("NixOS/nixpkgs")) |
    select(.value.url | test($latest) | not) |
    .key
  ' > /tmp/sketchybar_nix_outdated 2>/dev/null
else
  echo -n > /tmp/sketchybar_nix_outdated
fi

COUNT=$(wc -l < /tmp/sketchybar_nix_outdated | tr -d ' ')

if [ "$COUNT" -eq 0 ]; then
  sketchybar --set nix label="✓" icon.color=$GREEN
else
  sketchybar --set nix label="$COUNT" icon.color=$WHITE
fi
