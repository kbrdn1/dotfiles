#!/bin/bash

# Karabiner Configuration Test Script
# Tests the AeroSpace + IDE Friendly configuration

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to check if a process is running
check_process() {
    local process_name=$1
    if pgrep -x "$process_name" > /dev/null; then
        return 0
    else
        return 1
    fi
}

# Function to get current app info
get_current_app() {
    local app_name=$(osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true' 2>/dev/null)
    local bundle_id=$(osascript -e 'id of app "'$app_name'"' 2>/dev/null)
    echo "$app_name|$bundle_id"
}

# Function to check if current app is an IDE
is_ide() {
    local bundle_id=$1
    local ide_patterns=(
        "^com\.microsoft\.VSCode$"
        "^dev\.zed\.Zed$"
        "^dev\.zed\.Zed-Preview$"
        "^com\.jetbrains\."
        "^com\.sublimetext\."
        "^com\.github\.atom$"
        "^com\.apple\.dt\.Xcode$"
        "^com\.panic\.Nova$"
        "^com\.visualstudio\.code\.oss$"
    )
    
    for pattern in "${ide_patterns[@]}"; do
        if [[ "$bundle_id" =~ $pattern ]]; then
            return 0
        fi
    done
    return 1
}

# Header
echo ""
print_color "$BLUE" "================================================"
print_color "$BLUE" "Karabiner Configuration Test"
print_color "$BLUE" "================================================"
echo ""

# Test 1: Check if Karabiner is running
print_color "$YELLOW" "Test 1: Karabiner Service Status"
echo "----------------------------------------"

if check_process "karabiner_grabber"; then
    print_color "$GREEN" "✅ Karabiner grabber is running"
else
    print_color "$RED" "❌ Karabiner grabber is not running"
fi

if check_process "karabiner_observer"; then
    print_color "$GREEN" "✅ Karabiner observer is running"
else
    print_color "$RED" "❌ Karabiner observer is not running"
fi

if check_process "karabiner_console_user_server"; then
    print_color "$GREEN" "✅ Karabiner console user server is running"
else
    print_color "$RED" "❌ Karabiner console user server is not running"
fi

echo ""

# Test 2: Check configuration files
print_color "$YELLOW" "Test 2: Configuration Files"
echo "----------------------------------------"

CONFIG_DIR="$HOME/.config/karabiner"
MAIN_CONFIG="$CONFIG_DIR/karabiner.json"
COMPLEX_MOD="$CONFIG_DIR/complex_modifications/aerospace-ide-friendly.json"

if [ -f "$MAIN_CONFIG" ]; then
    print_color "$GREEN" "✅ Main configuration file exists"
    
    # Check if profile is active
    if grep -q "AeroSpace + IDE Friendly" "$MAIN_CONFIG"; then
        print_color "$GREEN" "✅ IDE-friendly profile found"
    else
        print_color "$YELLOW" "⚠️  IDE-friendly profile not found in config"
    fi
    
    # Check if rules are present
    RULE_COUNT=$(grep -c "AeroSpace.*disabled in IDEs" "$MAIN_CONFIG" 2>/dev/null || echo 0)
    if [ "$RULE_COUNT" -gt 0 ]; then
        print_color "$GREEN" "✅ AeroSpace rules found ($RULE_COUNT rules)"
    else
        print_color "$YELLOW" "⚠️  AeroSpace rules not found"
    fi
else
    print_color "$RED" "❌ Main configuration file missing"
fi

if [ -f "$COMPLEX_MOD" ]; then
    print_color "$GREEN" "✅ Complex modifications file exists"
else
    print_color "$YELLOW" "⚠️  Complex modifications file not found"
fi

echo ""

# Test 3: Current application analysis
print_color "$YELLOW" "Test 3: Current Application Analysis"
echo "----------------------------------------"

APP_INFO=$(get_current_app)
APP_NAME=$(echo "$APP_INFO" | cut -d'|' -f1)
BUNDLE_ID=$(echo "$APP_INFO" | cut -d'|' -f2)

echo "Current application: $APP_NAME"
echo "Bundle ID: $BUNDLE_ID"

if is_ide "$BUNDLE_ID"; then
    print_color "$GREEN" "✅ This is a recognized IDE"
    print_color "$BLUE" "   Expected behavior: IDE shortcuts should work normally"
    print_color "$BLUE" "   • Alt+Tab - IDE tab switching"
    print_color "$BLUE" "   • Alt+J/K/H/L - IDE navigation"
    print_color "$BLUE" "   • Alt+1/2/3 - IDE functions"
else
    print_color "$YELLOW" "ℹ️  This is not a recognized IDE"
    print_color "$BLUE" "   Expected behavior: AeroSpace shortcuts should work"
    print_color "$BLUE" "   • Alt+1/2/3 - Workspace switching"
    print_color "$BLUE" "   • Alt+Q/W/E - Workspace switching"
    print_color "$BLUE" "   • Alt+H/J/K/L - Window focus"
    print_color "$BLUE" "   • Alt+Tab - Previous workspace"
fi

echo ""

# Test 4: Check AeroSpace integration
print_color "$YELLOW" "Test 4: AeroSpace Integration"
echo "----------------------------------------"

if check_process "aerospace"; then
    print_color "$GREEN" "✅ AeroSpace is running"
    
    # Get current workspace
    CURRENT_WS=$(aerospace list-workspaces --focused 2>/dev/null || echo "unknown")
    echo "Current workspace: $CURRENT_WS"
    
    # Get available workspaces
    ALL_WS=$(aerospace list-workspaces --all 2>/dev/null || echo "unknown")
    echo "Available workspaces: $ALL_WS"
else
    print_color "$RED" "❌ AeroSpace is not running"
    print_color "$YELLOW" "   Start AeroSpace to test workspace switching"
fi

echo ""

# Test 5: Manual testing instructions
print_color "$YELLOW" "Test 5: Manual Testing Instructions"
echo "----------------------------------------"

print_color "$BLUE" "To test the configuration manually:"
echo ""

print_color "$GREEN" "In an IDE (VSCode, Zed, etc.):"
echo "1. Press Alt+Tab - Should switch between applications"
echo "2. Press Alt+J/K - Should work as IDE navigation"
echo "3. Press Alt+1/2/3 - Should work as IDE shortcuts"
echo ""

print_color "$GREEN" "Outside IDEs (Finder, Terminal, etc.):"
echo "1. Press Alt+1 - Should switch to workspace 1"
echo "2. Press Alt+Q - Should switch to workspace 4"
echo "3. Press Alt+H/J/K/L - Should focus windows"
echo "4. Press Alt+Tab - Should switch to previous workspace"
echo ""

# Test 6: Troubleshooting
print_color "$YELLOW" "Test 6: Troubleshooting"
echo "----------------------------------------"

print_color "$BLUE" "If shortcuts don't work:"
echo "1. Restart Karabiner:"
echo "   launchctl stop org.pqrs.karabiner.karabiner_console_user_server"
echo "   launchctl start org.pqrs.karabiner.karabiner_console_user_server"
echo ""
echo "2. Check Karabiner-Elements app:"
echo "   - Open Karabiner-Elements"
echo "   - Go to 'Complex Modifications'"
echo "   - Verify rules are enabled"
echo ""
echo "3. Check AeroSpace:"
echo "   open -a AeroSpace"
echo ""

# Test 7: Configuration summary
print_color "$YELLOW" "Test 7: Configuration Summary"
echo "----------------------------------------"

print_color "$BLUE" "Supported IDEs:"
echo "• Visual Studio Code"
echo "• Zed & Zed Preview"
echo "• JetBrains IDEs (IntelliJ, WebStorm, etc.)"
echo "• Sublime Text"
echo "• Atom"
echo "• Xcode"
echo "• Nova"
echo "• VSCodium"
echo ""

print_color "$BLUE" "AeroSpace Workspaces:"
echo "• Alt+1 - Workspace 1 (Mail)"
echo "• Alt+2 - Workspace 2 (Postman)"
echo "• Alt+3 - Workspace 3 (Code)"
echo "• Alt+Q - Workspace 4 (Arc Browser)"
echo "• Alt+W - Workspace 5 (Messages/Slack)"
echo "• Alt+E - Workspace 6 (OrbStack/Docker)"
echo ""

# Final status
echo ""
print_color "$BLUE" "================================================"

# Count successful tests
TESTS_PASSED=0
TOTAL_TESTS=4

if check_process "karabiner_grabber"; then TESTS_PASSED=$((TESTS_PASSED + 1)); fi
if [ -f "$MAIN_CONFIG" ]; then TESTS_PASSED=$((TESTS_PASSED + 1)); fi
if grep -q "AeroSpace + IDE Friendly" "$MAIN_CONFIG" 2>/dev/null; then TESTS_PASSED=$((TESTS_PASSED + 1)); fi
if check_process "aerospace"; then TESTS_PASSED=$((TESTS_PASSED + 1)); fi

if [ $TESTS_PASSED -eq $TOTAL_TESTS ]; then
    print_color "$GREEN" "✅ All tests passed! Configuration is ready."
elif [ $TESTS_PASSED -gt $((TOTAL_TESTS / 2)) ]; then
    print_color "$YELLOW" "⚠️  Most tests passed ($TESTS_PASSED/$TOTAL_TESTS). Minor issues detected."
else
    print_color "$RED" "❌ Multiple tests failed ($TESTS_PASSED/$TOTAL_TESTS). Configuration needs attention."
fi

print_color "$BLUE" "================================================"
echo ""

print_color "$YELLOW" "For more help:"
echo "• Check README.md in ~/.config/karabiner/"
echo "• Run this test again after making changes"
echo "• Restart Karabiner if issues persist"
echo ""