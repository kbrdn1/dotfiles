#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"

# -- Storage module (battery-style bar) --

storage_top=(
  label.font="$FONT:Semibold:7"
  label=SSD
  label.color=$GREY
  icon.drawing=off
  width=0
  padding_right=10
  y_offset=6
)

storage_usage=(
  label.font="$FONT:Heavy:10"
  label="0/0"
  label.color=$WHITE
  y_offset=-4
  padding_left=0
  padding_right=10
  width=65
  icon.drawing=off
  script="$PLUGIN_DIR/storage_usage.sh"
  update_freq=300
  updates=on
)

storage_bar=(
  label.font="$FONT:Black:12"
  label="▁"
  label.color=$BLUE
  icon.drawing=off
  y_offset=-4
  padding_left=0
  padding_right=8
  width=25
)

sketchybar --add item storage.top right               \
           --set storage.top "${storage_top[@]}"       \
                                                       \
           --add item storage.usage right              \
           --set storage.usage "${storage_usage[@]}"   \
                                                       \
           --add item storage.bar right                \
           --set storage.bar "${storage_bar[@]}"
