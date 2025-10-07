#!/bin/bash

# AeroSpace + Sketchybar Integration Test Script
# This script tests all aspects of the AeroSpace integration

set -e

SKETCHYBAR_DIR="$HOME/.config/sketchybar"
AEROSPACE_CONFIG="$HOME/.config/aerospace/aerospace.toml"

echo "🧪 AeroSpace + Sketchybar Integration Test"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Test 1: Check if AeroSpace is installed
echo "1. Testing AeroSpace Installation"
echo "--------------------------------"
if command -v aerospace &> /dev/null; then
    success "AeroSpace CLI found"
    VERSION=$(aerospace --version 2>/dev/null | head -1 || echo "Unknown version")
    info "Version: $VERSION"
else
    error "AeroSpace CLI not found in PATH"
    exit 1
fi

# Test 2: Check if AeroSpace is running
echo ""
echo "2. Testing AeroSpace Process"
echo "---------------------------"
if pgrep AeroSpace >/dev/null; then
    success "AeroSpace process is running"
    PID=$(pgrep AeroSpace)
    info "Process ID: $PID"
else
    error "AeroSpace process not running"
    info "Start with: open -a AeroSpace"
fi

# Test 3: Test AeroSpace API responses
echo ""
echo "3. Testing AeroSpace API"
echo "-----------------------"

# Test workspace listing
if aerospace list-workspaces --all >/dev/null 2>&1; then
    success "Workspace listing works"
    WORKSPACES=$(aerospace list-workspaces --all 2>/dev/null)
    info "Available workspaces: $WORKSPACES"
    
    FOCUSED_WS=$(aerospace list-workspaces --focused 2>/dev/null)
    info "Current workspace: $FOCUSED_WS"
else
    error "Cannot list workspaces"
fi

# Test window listing
if aerospace list-windows --all >/dev/null 2>&1; then
    success "Window listing works"
    WINDOW_COUNT=$(aerospace list-windows --all 2>/dev/null | wc -l)
    info "Total windows: $WINDOW_COUNT"
else
    warning "Cannot list windows (might be no windows open)"
fi

# Test 4: Check Sketchybar
echo ""
echo "4. Testing Sketchybar"
echo "--------------------"
if pgrep sketchybar >/dev/null; then
    success "Sketchybar is running"
    PID=$(pgrep sketchybar)
    info "Process ID: $PID"
else
    error "Sketchybar not running"
    info "Start with: sketchybar &"
fi

# Test 5: Check plugin files
echo ""
echo "5. Testing Plugin Files"
echo "----------------------"

PLUGINS=(
    "$SKETCHYBAR_DIR/plugins/aerospace.sh"
    "$SKETCHYBAR_DIR/plugins/aerospace_integration.sh"
    "$SKETCHYBAR_DIR/plugins/aerospace/spaces.sh"
    "$SKETCHYBAR_DIR/plugins/aerospace/item.sh"
)

for plugin in "${PLUGINS[@]}"; do
    if [ -f "$plugin" ]; then
        if [ -x "$plugin" ]; then
            success "$(basename "$plugin") exists and is executable"
        else
            warning "$(basename "$plugin") exists but not executable"
            info "Fix with: chmod +x $plugin"
        fi
    else
        error "$(basename "$plugin") not found"
    fi
done

# Test 6: Check AeroSpace configuration
echo ""
echo "6. Testing AeroSpace Configuration"
echo "--------------------------------"
if [ -f "$AEROSPACE_CONFIG" ]; then
    success "AeroSpace config found"
    
    # Check for sketchybar callbacks
    if grep -q "sketchybar.*aerospace_workspace_change" "$AEROSPACE_CONFIG"; then
        success "Sketchybar callbacks configured"
    else
        warning "Sketchybar callbacks not found in config"
        info "Add these to your aerospace.toml:"
        info 'on-focused-monitor-changed = ["exec-and-forget sketchybar --trigger aerospace_workspace_change"]'
        info 'on-focus-changed = ["exec-and-forget sketchybar --trigger window_focus"]'
    fi
    
    # Test config reload
    if aerospace reload-config 2>/dev/null; then
        success "Configuration reload works"
    else
        warning "Could not reload configuration"
    fi
else
    error "AeroSpace config not found at $AEROSPACE_CONFIG"
fi

# Test 7: Test Sketchybar items
echo ""
echo "7. Testing Sketchybar Items"
echo "--------------------------"
if pgrep sketchybar >/dev/null; then
    # Check if aerospace spaces are added
    sketchybar --query bar >/dev/null 2>&1 && success "Sketchybar query works" || warning "Sketchybar query failed"
    
    # Test triggering events
    if sketchybar --trigger aerospace_workspace_change 2>/dev/null; then
        success "aerospace_workspace_change trigger works"
    else
        warning "Could not trigger aerospace_workspace_change"
    fi
    
    if sketchybar --trigger window_focus 2>/dev/null; then
        success "window_focus trigger works"
    else
        warning "Could not trigger window_focus"
    fi
    
    if sketchybar --trigger windows_on_spaces 2>/dev/null; then
        success "windows_on_spaces trigger works"
    else
        warning "Could not trigger windows_on_spaces"
    fi
else
    warning "Sketchybar not running, skipping item tests"
fi

# Test 8: Integration Test
echo ""
echo "8. Integration Test"
echo "------------------"
if pgrep AeroSpace >/dev/null && pgrep sketchybar >/dev/null; then
    info "Running integration test..."
    
    # Get current workspace
    ORIGINAL_WS=$(aerospace list-workspaces --focused 2>/dev/null)
    info "Current workspace: $ORIGINAL_WS"
    
    # Try switching to workspace 2 and back
    if [ "$ORIGINAL_WS" != "2" ]; then
        info "Switching to workspace 2..."
        if aerospace workspace 2 2>/dev/null; then
            sleep 0.5
            NEW_WS=$(aerospace list-workspaces --focused 2>/dev/null)
            if [ "$NEW_WS" = "2" ]; then
                success "Workspace switching works"
                
                # Trigger sketchybar update
                sketchybar --trigger aerospace_workspace_change 2>/dev/null
                success "Sketchybar update triggered"
                
                # Switch back
                aerospace workspace "$ORIGINAL_WS" 2>/dev/null
                sketchybar --trigger aerospace_workspace_change 2>/dev/null
                info "Returned to original workspace"
            else
                warning "Workspace switch didn't work as expected"
            fi
        else
            warning "Could not switch workspace"
        fi
    else
        info "Already on workspace 2, testing workspace 1..."
        if aerospace workspace 1 2>/dev/null; then
            sleep 0.5
            sketchybar --trigger aerospace_workspace_change 2>/dev/null
            aerospace workspace "$ORIGINAL_WS" 2>/dev/null
            sketchybar --trigger aerospace_workspace_change 2>/dev/null
            success "Workspace switching test completed"
        fi
    fi
else
    warning "Both AeroSpace and Sketchybar need to be running for integration test"
fi

# Test 9: Performance Test
echo ""
echo "9. Performance Test"
echo "------------------"
info "Testing response times..."

start_time=$(date +%s%N)
aerospace list-workspaces --all >/dev/null 2>&1
end_time=$(date +%s%N)
duration=$((($end_time - $start_time) / 1000000))
if [ $duration -lt 100 ]; then
    success "AeroSpace API response time: ${duration}ms (good)"
elif [ $duration -lt 500 ]; then
    warning "AeroSpace API response time: ${duration}ms (acceptable)"
else
    warning "AeroSpace API response time: ${duration}ms (slow)"
fi

# Summary
echo ""
echo "📊 Test Summary"
echo "==============="
echo ""

# Count successes and warnings/errors from the output above
TOTAL_TESTS=9
echo "Total test categories: $TOTAL_TESTS"
echo ""

echo "🔧 Recommended Actions:"
echo "----------------------"
if ! pgrep AeroSpace >/dev/null; then
    echo "• Start AeroSpace: open -a AeroSpace"
fi

if ! pgrep sketchybar >/dev/null; then
    echo "• Start Sketchybar: sketchybar &"
fi

echo "• Grant Accessibility permissions to AeroSpace in System Preferences"
echo "• Test keyboard shortcuts: alt + 1, alt + 2, etc."
echo "• Check sketchybar displays workspace indicators correctly"
echo ""

echo "📋 Key Files:"
echo "------------"
echo "• AeroSpace config: $AEROSPACE_CONFIG"
echo "• Sketchybar config: $SKETCHYBAR_DIR/sketchybarrc"
echo "• Main plugin: $SKETCHYBAR_DIR/plugins/aerospace_integration.sh"
echo "• Space plugin: $SKETCHYBAR_DIR/plugins/aerospace/item.sh"
echo ""

echo "🐛 Troubleshooting:"
echo "------------------"
echo "• If workspace switching doesn't work: check AeroSpace permissions"
echo "• If sketchybar doesn't update: check plugin permissions (chmod +x)"
echo "• If icons don't show: check icon_map.sh is working"
echo "• For logs: tail -f /tmp/sketchybar.log (if logging enabled)"
echo ""

echo "✨ Integration test completed!"
echo "   Use alt + 1-5 to test workspace switching"
echo "   The sketchybar should update workspace indicators automatically"