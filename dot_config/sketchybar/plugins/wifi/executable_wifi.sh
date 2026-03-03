#!/bin/bash
source "$HOME/.config/sketchybar/settings/settings.sh" # Loads all the settings
source "$SETTINGS_DIR/colors.sh" # Loads all defined colors
source "$SETTINGS_DIR/icons.sh" # Loads all defined icons

IS_VPN=$(/usr/local/bin/piactl get connectionstate 2>/dev/null)
IP_ADDRESS="$(ipconfig getifaddr en0 2>/dev/null)"
SSID="$(system_profiler SPAirPortDataType 2>/dev/null | awk '/Current Network Information:/{getline; gsub(/^[ \t]+|:$/,""); print; exit}')"

if [[ $IS_VPN == "Connected" ]]; then
  ICON_COLOR=$GREEN
  ICON=$VPN
elif [[ $SSID == "iKyk’s" ]]; then
  ICON_COLOR=$BLUE
  ICON=$HOTSPOT
elif [[ $SSID != "" ]]; then
  ICON_COLOR=$WHITE
  ICON=$WIFI
else
  ICON_COLOR=$RED
  ICON=$WIFI_OFF
fi

if [[ $IP_ADDRESS == "" ]]; then
  IP_ADDRESS="No IP"
fi

render_bar_item() {
  sketchybar --set $NAME \
    icon.color=$ICON_COLOR \
    icon=$ICON
}

render_popup() {
  if [ "$SSID" != "" ]; then
    args=(
      --set wifi.ssid label="$SSID"
      --set wifi.ipaddress label="$IP_ADDRESS"
      click_script="printf $IP_ADDRESS | pbcopy;sketchybar --set wifi popup.drawing=toggle"
    )
  else
    args=(
      --set wifi.ssid label="Not connected"
      --set wifi.ipaddress label="No IP"
      )
  fi

  sketchybar "${args[@]}" >/dev/null
}

update() {
  render_bar_item
  render_popup
}

popup() {
  sketchybar --set "$NAME" popup.drawing="$1"
}

case "$SENDER" in
"routine" | "forced")
  update
  ;;
"mouse.entered")
  popup on
  ;;
"mouse.exited" | "mouse.exited.global")
  popup off
  ;;
"mouse.clicked")
  popup toggle
  ;;
esac