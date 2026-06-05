#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh"
source "$SETTINGS_DIR/colors.sh"
source "$SETTINGS_DIR/icons.sh"

# -- Claude Dark theme (Zed port style) --

POPUP_OFF="sketchybar --set wifi popup.drawing=off"

wifi=(
  "${menu_defaults[@]}"
  icon.padding_right=0
  icon.color=$GREY
  label.drawing=off
  label.color=$WHITE
  popup.align=left
  update_freq=60
  script="$PLUGIN_DIR/wifi/wifi.sh"
  --subscribe wifi wifi_change \
                   mouse.clicked \
                   mouse.exited \
                   mouse.exited.global \
                   mouse.entered \
                   forced \
                   routine
)

sketchybar --add item wifi right \
           --set wifi "${wifi[@]}" \
           --add item wifi.ssid popup.wifi \
           --set wifi.ssid icon=$WIFI_INFO \
                           icon.color=$GREY \
                           label="SSID" \
                           label.color=$WHITE \
                           "${menu_item_defaults[@]}" \
                           click_script="open 'x-apple.systempreferences:com.apple.preference.network?Wi-Fi';$POPUP_OFF" \
           --add item wifi.ipaddress popup.wifi \
           --set wifi.ipaddress icon=$WIFI_IP \
                               icon.color=$GREY \
                               label="IP Address" \
                               label.color=$WHITE \
                               "${menu_item_defaults[@]}" \
                               click_script="echo \"$IP_ADDRESS\" | pbcopy; $POPUP_OFF"
