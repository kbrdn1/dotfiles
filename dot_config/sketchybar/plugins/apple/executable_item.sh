#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"
source "$SETTINGS_DIR/icons.sh"

# -- Claude Dark theme (Zed port style) --

POPUP_OFF="sketchybar --set apple.logo popup.drawing=off"
POPUP_CLICK_SCRIPT="sketchybar --set \$NAME popup.drawing=toggle"

apple_logo=(
  icon=$APPLE
  icon.font="$FONT:Black:16.0"
  icon.color=$ORANGE
  padding_right=15
  label.drawing=off
  script="$PLUGIN_DIR/apple/apple.sh"
  click_script="$POPUP_CLICK_SCRIPT"
)

apple_prefs=(
  icon=$PREFERENCES
  icon.color=$GREY
  label="Preferences"
  label.color=$WHITE
  click_script="open -a 'System Preferences'; $POPUP_OFF"
)

apple_activity=(
  icon=$ACTIVITY
  icon.color=$GREY
  label="Activity"
  label.color=$WHITE
  click_script="open -a 'Activity Monitor'; $POPUP_OFF"
)

apple_lock=(
  icon=$LOCK
  icon.color=$GREY
  label="Lock Screen"
  label.color=$WHITE
  click_script="pmset displaysleepnow; $POPUP_OFF"
)

apple_theme=(
  icon=$THEME
  icon.color=$GREY
  label="Change Theme"
  label.color=$WHITE
  click_script="$HOME/.config/sketchybar/change_theme.sh; $POPUP_OFF"
)

sketchybar --add item apple.logo left                  \
           --set apple.logo "${apple_logo[@]}"         \
           --subscribe apple.logo mouse.clicked        \
                                  mouse.exited         \
                                  mouse.exited.global  \
                                  mouse.entered        \
                                                       \
           --add item apple.prefs popup.apple.logo     \
           --set apple.prefs "${apple_prefs[@]}"       \
                                                       \
           --add item apple.activity popup.apple.logo  \
           --set apple.activity "${apple_activity[@]}" \
                                                       \
           --add item apple.lock popup.apple.logo      \
           --set apple.lock "${apple_lock[@]}"         \
                                                       \
           --add item apple.theme popup.apple.logo     \
           --set apple.theme "${apple_theme[@]}"
