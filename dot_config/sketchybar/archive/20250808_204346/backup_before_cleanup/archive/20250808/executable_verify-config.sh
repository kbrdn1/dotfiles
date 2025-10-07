#!/bin/bash

# SketchyBar Configuration Verification Script
# This script verifies that the configuration is correct and all files are in place

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration paths
SKETCHYBAR_DIR="$HOME/.config/sketchybar"
PLUGINS_DIR="$SKETCHYBAR_DIR/plugins"
SPACES_DIR="$PLUGINS_DIR/spaces"
SETTINGS_DIR="$SKETCHYBAR_DIR/settings"

# Required files
REQUIRED_FILES=(
  "$SKETCHYBAR_DIR/sketchybarrc"
  "$SKETCHYBAR_DIR/icon_map.sh"
  "$SPACES_DIR/items.sh"
  "$SPACES_DIR/handler.sh"
  "$PLUGINS_DIR/aerospace.sh"
  "$PLUGINS_DIR/front_app_aerospace.sh"
  "$SETTINGS_DIR/settings.sh"
  "$SETTINGS_DIR/colors.sh"
  "$SETTINGS_DIR/icons.sh"
)

# Function to print colored output
print_color() {
  local color=$1
  local message=$2
  echo -e "${color}${message}${NC}"
}

# Function to check if a file exists and is executable
check_file() {
  local file=$1
  local name=$(basename "$file")
  
  if [ -f "$file" ]; then
    if [ -x "$file" ] || [[ "$file" == *.sh && ! -x "$file" ]]; then
      print_color "$GREEN" "  ✅ $name"
      return 0
    else
      print_color "$YELLOW" "  ⚠️  $name (not executable)"
      return 1
    fi
  else
    print_color "$RED" "  ❌ $name (missing)"
    return 1
  fi
}

# Header
echo ""
print_color "$BLUE" "================================================"
print_color "$BLUE" "SketchyBar Configuration Verification"
print_color "$BLUE" "================================================"
echo ""

# Check SketchyBar installation
print_color "$YELLOW" "Checking SketchyBar installation..."
if command -v sketchybar &> /dev/null; then
  print_color "$GREEN" "✅ SketchyBar is installed"
  SKETCHYBAR_VERSION=$(sketchybar --version 2>/dev/null || echo "unknown")
  echo "   Version: $SKETCHYBAR_VERSION"
else
  print_color "$RED" "❌ SketchyBar is not installed"
  echo "   Install with: brew install sketchybar"
fi
echo ""

# Check if SketchyBar is running
print_color "$YELLOW" "Checking SketchyBar process..."
if pgrep -x "sketchybar" > /dev/null; then
  print_color "$GREEN" "✅ SketchyBar is running"
  PID=$(pgrep -x "sketchybar" | head -1)
  echo "   PID: $PID"
else
  print_color "$RED" "❌ SketchyBar is not running"
  echo "   Start with: brew services start sketchybar"
fi
echo ""

# Check AeroSpace
print_color "$YELLOW" "Checking AeroSpace integration..."
if command -v aerospace &> /dev/null; then
  print_color "$GREEN" "✅ AeroSpace is installed"
  if pgrep -x "aerospace" > /dev/null; then
    print_color "$GREEN" "✅ AeroSpace is running"
    CURRENT_WS=$(aerospace list-workspaces --focused 2>/dev/null || echo "unknown")
    echo "   Current workspace: $CURRENT_WS"
  else
    print_color "$YELLOW" "⚠️  AeroSpace is not running"
  fi
else
  print_color "$RED" "❌ AeroSpace is not installed"
fi
echo ""

# Check required files
print_color "$YELLOW" "Checking required files..."
MISSING_FILES=0
for file in "${REQUIRED_FILES[@]}"; do
  if ! check_file "$file"; then
    MISSING_FILES=$((MISSING_FILES + 1))
  fi
done

if [ $MISSING_FILES -eq 0 ]; then
  print_color "$GREEN" "✅ All required files are present"
else
  print_color "$RED" "❌ $MISSING_FILES required files are missing"
fi
echo ""

# Check font installation
print_color "$YELLOW" "Checking fonts..."
if ls ~/Library/Fonts/*sketchybar* &> /dev/null || ls /Library/Fonts/*sketchybar* &> /dev/null; then
  print_color "$GREEN" "✅ sketchybar-app-font is installed"
else
  print_color "$YELLOW" "⚠️  sketchybar-app-font may not be installed"
  echo "   Install from: https://github.com/kvndrsslr/sketchybar-app-font"
fi
echo ""

# Check workspace configuration
print_color "$YELLOW" "Checking workspace configuration..."
if [ -f "$SPACES_DIR/items.sh" ]; then
  # Extract workspace icons
  ICONS=$(grep 'SPACE_ICONS=' "$SPACES_DIR/items.sh" 2>/dev/null | sed 's/.*(\(.*\)).*/\1/' | tr ' ' '\n' | grep -v '^$')
  if [ -n "$ICONS" ]; then
    print_color "$GREEN" "✅ Workspace icons configured:"
    i=1
    echo "$ICONS" | while read icon; do
      echo "   Workspace $i: $icon"
      i=$((i+1))
    done
  else
    print_color "$YELLOW" "⚠️  Could not parse workspace icons"
  fi
else
  print_color "$RED" "❌ Workspace configuration not found"
fi
echo ""

# Check for common issues
print_color "$YELLOW" "Checking for common issues..."
ISSUES_FOUND=0

# Check if handler script references correct paths
if [ -f "$SPACES_DIR/handler.sh" ]; then
  if grep -q "handler-optimized.sh\|aerospace-hybrid" "$SPACES_DIR/handler.sh" 2>/dev/null; then
    print_color "$YELLOW" "⚠️  Handler may have outdated references"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
  fi
fi

# Check if items script references correct handler
if [ -f "$SPACES_DIR/items.sh" ]; then
  if grep -q "handler-optimized.sh\|aerospace-hybrid" "$SPACES_DIR/items.sh" 2>/dev/null; then
    print_color "$YELLOW" "⚠️  Items script may have outdated references"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
  fi
fi

# Check for duplicate workspace monitors
MONITOR_COUNT=$(grep -c "aerospace_monitor" "$SPACES_DIR/items.sh" 2>/dev/null || echo 0)
if [ $MONITOR_COUNT -gt 2 ]; then
  print_color "$YELLOW" "⚠️  Multiple workspace monitors detected"
  ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if [ $ISSUES_FOUND -eq 0 ]; then
  print_color "$GREEN" "✅ No common issues detected"
else
  print_color "$YELLOW" "⚠️  $ISSUES_FOUND potential issues found"
fi
echo ""

# Test workspace switching
print_color "$YELLOW" "Testing workspace switching..."
if command -v aerospace &> /dev/null && pgrep -x "aerospace" > /dev/null; then
  ORIGINAL_WS=$(aerospace list-workspaces --focused 2>/dev/null)
  
  # Try switching to workspace 1
  aerospace workspace 1 2>/dev/null
  sleep 0.5
  NEW_WS=$(aerospace list-workspaces --focused 2>/dev/null)
  
  if [ "$NEW_WS" = "1" ]; then
    print_color "$GREEN" "✅ Workspace switching works"
  else
    print_color "$YELLOW" "⚠️  Workspace switching may have issues"
  fi
  
  # Return to original workspace
  if [ -n "$ORIGINAL_WS" ] && [ "$ORIGINAL_WS" != "1" ]; then
    aerospace workspace "$ORIGINAL_WS" 2>/dev/null
  fi
else
  print_color "$YELLOW" "⚠️  Cannot test workspace switching (AeroSpace not running)"
fi
echo ""

# Summary
print_color "$BLUE" "================================================"
print_color "$BLUE" "Summary"
print_color "$BLUE" "================================================"
echo ""

TOTAL_CHECKS=0
PASSED_CHECKS=0

# Count results
if command -v sketchybar &> /dev/null; then PASSED_CHECKS=$((PASSED_CHECKS + 1)); fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

if pgrep -x "sketchybar" > /dev/null; then PASSED_CHECKS=$((PASSED_CHECKS + 1)); fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

if [ $MISSING_FILES -eq 0 ]; then PASSED_CHECKS=$((PASSED_CHECKS + 1)); fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

if [ $ISSUES_FOUND -eq 0 ]; then PASSED_CHECKS=$((PASSED_CHECKS + 1)); fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

# Display summary
if [ $PASSED_CHECKS -eq $TOTAL_CHECKS ]; then
  print_color "$GREEN" "✅ All checks passed! ($PASSED_CHECKS/$TOTAL_CHECKS)"
  print_color "$GREEN" "Your SketchyBar configuration is ready to use."
elif [ $PASSED_CHECKS -gt $((TOTAL_CHECKS / 2)) ]; then
  print_color "$YELLOW" "⚠️  Some checks failed ($PASSED_CHECKS/$TOTAL_CHECKS)"
  print_color "$YELLOW" "Your configuration may work but could have issues."
else
  print_color "$RED" "❌ Multiple checks failed ($PASSED_CHECKS/$TOTAL_CHECKS)"
  print_color "$RED" "Your configuration needs attention."
fi
echo ""

# Provide quick fix command if needed
if [ $MISSING_FILES -gt 0 ] || [ $ISSUES_FOUND -gt 0 ]; then
  print_color "$BLUE" "Quick fixes:"
  echo "  1. Reload configuration: sketchybar --reload"
  echo "  2. Check logs: tail -f /tmp/sketchybar*.log"
  echo "  3. Run manage script: $SKETCHYBAR_DIR/manage.sh status"
  echo ""
fi

print_color "$BLUE" "================================================"
echo ""