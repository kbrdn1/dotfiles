#!/bin/bash
SETTINGS_DIR="$HOME/.config/sketchybar/settings" # Directory where all the settings are stored
PLUGIN_DIR="$HOME/.config/sketchybar/plugins" # Directory where all the plugin scripts are stored

# Date and time format
DATE_FORMAT="+%a %d. %b" # The format of the date
TIME_FORMAT=+%H:%M # The format of the time

# Bar
BAR_POSITION=top # The position of the bar (top or bottom)
BAR_NOTCH_WIDTH=0 # The width of the notch

# Fonts
FONT="SF Pro" # Needs to have Regular, Bold, Semibold, Heavy and Black variants

# Sizes
BAR_HEIGHT=33 # The height of the bar
BAR_PADDINGS=10 # The padding of the bar
BG_HEIGHT=25 # The height of the background

# Spacing
BAR_Y_OFFSET=5 # The offset of the bar on the Y axis
BAR_MARGIN=10 # The margin of the bar
PADDINGS=3 # All paddings use this value (icon, label, background)

# Borders
BAR_BORDER_RADIUS=9 # The corner radius of the bar
BG_BORDER_RADIUS=9 # The border radius of the background
POPUP_BORDER_WIDTH=2 # The width of the border of the popup
POPUP_BORDER_RADIUS=9 # The border radius of the popup

# Backgrounds
BAR_BLUR_RADIUS=20 # The blur radius of the bar background
POPUP_BLUR_RADIUS=20 # The blur radius of the popup background