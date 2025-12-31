#!/bin/bash

# SketchyBar Configuration Manager
# This script provides easy management of SketchyBar configuration

SKETCHYBAR_DIR="$HOME/.config/sketchybar"
ARCHIVE_DIR="$SKETCHYBAR_DIR/archive"
BACKUP_DIR="$SKETCHYBAR_DIR/backups"

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

# Function to check if SketchyBar is running
check_sketchybar() {
    if pgrep -x "sketchybar" > /dev/null; then
        return 0
    else
        return 1
    fi
}

# Function to reload SketchyBar
reload() {
    print_color "$BLUE" "🔄 Reloading SketchyBar..."
    sketchybar --reload
    print_color "$GREEN" "✅ SketchyBar reloaded successfully"
}

# Function to restart SketchyBar
restart() {
    print_color "$BLUE" "🔄 Restarting SketchyBar..."
    brew services restart sketchybar
    sleep 2
    if check_sketchybar; then
        print_color "$GREEN" "✅ SketchyBar restarted successfully"
    else
        print_color "$RED" "❌ Failed to restart SketchyBar"
        exit 1
    fi
}

# Function to show status
status() {
    print_color "$BLUE" "📊 SketchyBar Status"
    echo ""
    
    if check_sketchybar; then
        print_color "$GREEN" "✅ SketchyBar is running"
        echo ""
        print_color "$YELLOW" "Process Info:"
        ps aux | grep -E "[s]ketchybar" | awk '{print "  PID: " $2 ", CPU: " $3 "%, MEM: " $4 "%"}'
    else
        print_color "$RED" "❌ SketchyBar is not running"
    fi
    
    echo ""
    print_color "$YELLOW" "Configuration:"
    echo "  Config Dir: $SKETCHYBAR_DIR"
    echo "  Main Config: $SKETCHYBAR_DIR/sketchybarrc"
    
    # Check AeroSpace integration
    echo ""
    if pgrep -x "aerospace" > /dev/null; then
        print_color "$GREEN" "✅ AeroSpace is running"
        CURRENT_WORKSPACE=$(aerospace list-workspaces --focused 2>/dev/null || echo "unknown")
        echo "  Current Workspace: $CURRENT_WORKSPACE"
    else
        print_color "$YELLOW" "⚠️  AeroSpace is not running"
    fi
}

# Function to backup configuration
backup() {
    local backup_name="${1:-backup_$(date +%Y%m%d_%H%M%S)}"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    print_color "$BLUE" "💾 Creating backup: $backup_name"
    
    mkdir -p "$BACKUP_DIR"
    
    # Create backup
    cp -R "$SKETCHYBAR_DIR"/{sketchybarrc,plugins,settings,icon_map.sh} "$backup_path" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        print_color "$GREEN" "✅ Backup created successfully at: $backup_path"
        
        # Create backup info file
        cat > "$backup_path/backup_info.txt" << EOF
Backup Date: $(date)
SketchyBar Version: $(sketchybar --version 2>/dev/null || echo "unknown")
Current Workspace: $(aerospace list-workspaces --focused 2>/dev/null || echo "unknown")
EOF
    else
        print_color "$RED" "❌ Failed to create backup"
        exit 1
    fi
}

# Function to list backups
list_backups() {
    print_color "$BLUE" "📁 Available Backups:"
    echo ""
    
    if [ -d "$BACKUP_DIR" ]; then
        for backup in "$BACKUP_DIR"/*; do
            if [ -d "$backup" ]; then
                backup_name=$(basename "$backup")
                if [ -f "$backup/backup_info.txt" ]; then
                    echo "  • $backup_name"
                    grep "Backup Date:" "$backup/backup_info.txt" | sed 's/^/    /'
                else
                    echo "  • $backup_name (no info available)"
                fi
            fi
        done
    else
        print_color "$YELLOW" "No backups found"
    fi
}

# Function to restore from backup
restore() {
    local backup_name="$1"
    
    if [ -z "$backup_name" ]; then
        print_color "$RED" "❌ Please specify a backup name"
        list_backups
        exit 1
    fi
    
    local backup_path="$BACKUP_DIR/$backup_name"
    
    if [ ! -d "$backup_path" ]; then
        print_color "$RED" "❌ Backup not found: $backup_name"
        list_backups
        exit 1
    fi
    
    print_color "$YELLOW" "⚠️  This will replace your current configuration!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Create safety backup of current config
        backup "auto_before_restore_$(date +%Y%m%d_%H%M%S)"
        
        print_color "$BLUE" "📥 Restoring from: $backup_name"
        
        # Restore files
        cp -R "$backup_path"/{sketchybarrc,plugins,settings,icon_map.sh} "$SKETCHYBAR_DIR/" 2>/dev/null
        
        if [ $? -eq 0 ]; then
            print_color "$GREEN" "✅ Configuration restored successfully"
            reload
        else
            print_color "$RED" "❌ Failed to restore configuration"
            exit 1
        fi
    else
        print_color "$YELLOW" "Restore cancelled"
    fi
}

# Function to clean archive
clean_archive() {
    print_color "$BLUE" "🧹 Cleaning archive directory..."
    
    if [ -d "$ARCHIVE_DIR" ]; then
        # Count files before cleaning
        file_count=$(find "$ARCHIVE_DIR" -type f | wc -l)
        
        print_color "$YELLOW" "Found $file_count archived files"
        read -p "Remove all archived files? (y/N): " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$ARCHIVE_DIR"/*
            print_color "$GREEN" "✅ Archive cleaned"
        else
            print_color "$YELLOW" "Clean cancelled"
        fi
    else
        print_color "$YELLOW" "No archive directory found"
    fi
}

# Function to test workspace switching
test_workspaces() {
    print_color "$BLUE" "🧪 Testing workspace switching..."
    echo ""
    
    if ! pgrep -x "aerospace" > /dev/null; then
        print_color "$RED" "❌ AeroSpace is not running"
        exit 1
    fi
    
    for ws in 1 2 3 1; do
        print_color "$YELLOW" "Switching to workspace $ws..."
        aerospace workspace $ws
        sketchybar --trigger aerospace_workspace_change
        sleep 1
    done
    
    print_color "$GREEN" "✅ Workspace test complete"
}

# Function to show help
show_help() {
    cat << EOF
$(print_color "$BLUE" "SketchyBar Configuration Manager")

$(print_color "$YELLOW" "Usage:") $0 [command] [options]

$(print_color "$YELLOW" "Commands:")
  reload          Reload SketchyBar configuration
  restart         Restart SketchyBar service
  status          Show SketchyBar and AeroSpace status
  backup [name]   Create backup of current configuration
  list-backups    List available backups
  restore <name>  Restore configuration from backup
  clean           Clean archive directory
  test            Test workspace switching
  help            Show this help message

$(print_color "$YELLOW" "Examples:")
  $0 reload                    # Reload configuration
  $0 backup                    # Create backup with timestamp
  $0 backup my_config          # Create named backup
  $0 restore my_config         # Restore from backup
  $0 status                    # Check current status

$(print_color "$YELLOW" "Configuration Files:")
  Main: $SKETCHYBAR_DIR/sketchybarrc
  Workspaces: $SKETCHYBAR_DIR/plugins/spaces/
  Settings: $SKETCHYBAR_DIR/settings/

EOF
}

# Main script logic
case "${1:-help}" in
    reload)
        reload
        ;;
    restart)
        restart
        ;;
    status)
        status
        ;;
    backup)
        backup "$2"
        ;;
    list-backups)
        list_backups
        ;;
    restore)
        restore "$2"
        ;;
    clean)
        clean_archive
        ;;
    test)
        test_workspaces
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_color "$RED" "❌ Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac