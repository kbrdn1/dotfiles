#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"
source "$SETTINGS_DIR/icons.sh"

# -- Claude Dark theme (Zed port style) --
# Slider highlight: $ORANGE accent (like scrollbar in Zed)
# Slider track: muted surface
# Volume icon: $GREY muted

volume_slider=(
  script="$PLUGIN_DIR/volume/volume.sh"
  updates=on
  label.drawing=off
  icon.drawing=off
  slider.highlight_color=$ORANGE
  slider.background.height=5
  slider.background.corner_radius=3
  slider.background.color=$BACKGROUND_2
  slider.knob=􀀁
  slider.knob.drawing=off
)

volume_icon=(
  click_script="$PLUGIN_DIR/volume/actions/click.sh"
  padding_left=5
  padding_right=0
  icon=$VOLUME_100
  icon.width=0
  icon.align=left
  icon.color=$GREY
  icon.font="$FONT:Regular:14.0"
  label.width=25
  label.align=left
  label.font="$FONT:Regular:14.0"
  label.color=$GREY
  drawing=on
)

status_bracket=(
  background.color=$BAR_COLOR
  background.border_color=$HIGHLIGHT_COLOR
  background.border_width=1
)

sketchybar --add slider volume right            \
           --set volume "${volume_slider[@]}"   \
           --subscribe volume volume_change     \
                              mouse.clicked     \
                              mouse.entered     \
                              mouse.exited      \
                                                \
           --add item volume_icon right         \
           --set volume_icon "${volume_icon[@]}"

# status bracket moved to sketchybarrc (after music items are created)
