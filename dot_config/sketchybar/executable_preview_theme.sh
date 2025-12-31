#!/bin/bash

# Theme Preview Script
# Shows all colors from the current theme

source "$HOME/.config/sketchybar/settings/colors.sh"

# Helper function to print colored text
print_color() {
  local name="$1"
  local hex="$2"
  
  # Convert SketchyBar format (0xAARRGGBB) to display format
  # Remove 0x prefix and extract RGB (ignore alpha)
  local color="${hex#0x}"
  local r=$((16#${color:2:2}))
  local g=$((16#${color:4:2}))
  local b=$((16#${color:6:2}))
  
  # Print with ANSI color
  printf "  %-25s \033[48;2;%d;%d;%dm    \033[0m  %s\n" "$name" "$r" "$g" "$b" "$hex"
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🎨 SketchyBar Theme Preview"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get current theme
current_theme=$(~/.config/sketchybar/settings/theme.sh current)
echo "📦 Current Theme: $current_theme"
echo ""

echo "🎨 Base Colors:"
print_color "BLACK" "$BLACK"
print_color "WHITE" "$WHITE"
echo ""

echo "✨ Accent Colors:"
print_color "RED" "$RED"
print_color "GREEN" "$GREEN"
print_color "BLUE" "$BLUE"
print_color "YELLOW" "$YELLOW"
print_color "PEACH" "$PEACH"
print_color "ORANGE" "$ORANGE"
print_color "MAGENTA" "$MAGENTA"
print_color "CYAN" "$CYAN"
echo ""

echo "🎭 UI Element Colors:"
print_color "GREY" "$GREY"
print_color "GREY_DARK" "$GREY_DARK"
print_color "GREY_DARKER" "$GREY_DARKER"
echo ""

echo "📊 Bar Colors:"
print_color "BAR_COLOR" "$BAR_COLOR"
print_color "ICON_COLOR" "$ICON_COLOR"
print_color "LABEL_COLOR" "$LABEL_COLOR"
print_color "BACKGROUND_1" "$BACKGROUND_1"
print_color "BACKGROUND_2" "$BACKGROUND_2"
echo ""

echo "💬 Popup Colors:"
print_color "POPUP_BACKGROUND_COLOR" "$POPUP_BACKGROUND_COLOR"
print_color "POPUP_BORDER_COLOR" "$POPUP_BORDER_COLOR"
echo ""

echo "✨ Effects:"
print_color "SHADOW_COLOR" "$SHADOW_COLOR"
print_color "ACCENT_COLOR" "$ACCENT_COLOR"
print_color "HIGHLIGHT_COLOR" "$HIGHLIGHT_COLOR"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  💡 Change theme: ./change_theme.sh"
echo "  📋 List themes: ./settings/theme.sh list"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
