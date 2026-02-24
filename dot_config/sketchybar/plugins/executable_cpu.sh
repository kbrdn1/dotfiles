#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"

# -- Claude Dark theme (Zed port style) --
# Graph colors: $ORANGE for user, $CYAN for sys
# Labels: $GREY muted for "CPU" label, $WHITE for percentage

cpu_top=(
  label.font="$FONT:Semibold:7"
  label=CPU
  label.color=$GREY
  icon.drawing=off
  width=0
  padding_right=10
  y_offset=6
)

cpu_percent=(
  label.font="$FONT:Heavy:10"
  label="0%"
  label.color=$WHITE
  y_offset=-4
  padding_left=0
  padding_right=10
  width=40
  icon.drawing=off
  update_freq=2
  mach_helper="$HELPER"
)

cpu_sys=(
  width=0
  graph.color=$ORANGE
  graph.fill_color=$ORANGE
  label.drawing=off
  icon.drawing=off
  background.height=20
  background.drawing=on
  background.color=$TRANSPARENT
)

cpu_user=(
  graph.color=$CYAN
  label.drawing=off
  icon.drawing=off
  background.height=20
  background.drawing=on
  background.color=$TRANSPARENT
)

sketchybar --add item cpu.top right              \
           --set cpu.top "${cpu_top[@]}"         \
                                                 \
           --add item cpu.percent right          \
           --set cpu.percent "${cpu_percent[@]}" \
                                                 \
           --add graph cpu.sys right 50          \
           --set cpu.sys "${cpu_sys[@]}"         \
                                                 \
           --add graph cpu.user right 50         \
           --set cpu.user "${cpu_user[@]}"
