#!/bin/bash

# SketchyBar Configuration Cleanup Script
# This script cleans and organizes the SketchyBar configuration

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SKETCHYBAR_DIR="$HOME/.config/sketchybar"
ARCHIVE_DIR="$SKETCHYBAR_DIR/archive/$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$SKETCHYBAR_DIR/backup_before_cleanup"

# Function to print colored output
print_color() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Create directories
print_color "$BLUE" "================================================"
print_color "$BLUE" "SketchyBar Configuration Cleanup"
print_color "$BLUE" "================================================"
echo ""

# Step 1: Create backup
print_color "$YELLOW" "Step 1: Creating backup..."
if [ -d "$BACKUP_DIR" ]; then
    print_color "$YELLOW" "Backup already exists, skipping..."
else
    cp -R "$SKETCHYBAR_DIR" "$BACKUP_DIR"
    print_color "$GREEN" "✅ Backup created at: $BACKUP_DIR"
fi
echo ""

# Step 2: Create archive directory
print_color "$YELLOW" "Step 2: Creating archive directory..."
mkdir -p "$ARCHIVE_DIR"
mkdir -p "$ARCHIVE_DIR/plugins"
mkdir -p "$ARCHIVE_DIR/scripts"
print_color "$GREEN" "✅ Archive directory created"
echo ""

# Step 3: Archive old sketchybarrc versions
print_color "$YELLOW" "Step 3: Archiving old configuration files..."
cd "$SKETCHYBAR_DIR"
for file in sketchybarrc-* sketchybarrc.*; do
    if [ -f "$file" ] && [ "$file" != "sketchybarrc" ]; then
        mv "$file" "$ARCHIVE_DIR/" 2>/dev/null
        print_color "$GREEN" "  Archived: $file"
    fi
done
echo ""

# Step 4: Archive test scripts
print_color "$YELLOW" "Step 4: Archiving test scripts..."
for file in test*.sh verify*.sh debug*.sh; do
    if [ -f "$file" ]; then
        mv "$file" "$ARCHIVE_DIR/scripts/" 2>/dev/null
        print_color "$GREEN" "  Archived: $file"
    fi
done
echo ""

# Step 5: Clean plugins directory
print_color "$YELLOW" "Step 5: Cleaning plugins directory..."
cd "$SKETCHYBAR_DIR/plugins"

# Archive unused aerospace variants
for file in aerospace-*.sh aerospace_*.sh; do
    if [ -f "$file" ] && [ "$file" != "aerospace.sh" ]; then
        mv "$file" "$ARCHIVE_DIR/plugins/" 2>/dev/null
        print_color "$GREEN" "  Archived: $file"
    fi
done

# Archive other unused plugins
for file in *-modern.sh *-backup.sh yabai.sh zen.sh front_app.sh icon_map.sh; do
    if [ -f "$file" ]; then
        mv "$file" "$ARCHIVE_DIR/plugins/" 2>/dev/null
        print_color "$GREEN" "  Archived: $file"
    fi
done
echo ""

# Step 6: Remove unused plugin directories (if confirmed)
print_color "$YELLOW" "Step 6: Checking for unused plugin directories..."
UNUSED_DIRS=("brew" "github" "svim" "bluetooth")
for dir in "${UNUSED_DIRS[@]}"; do
    if [ -d "$SKETCHYBAR_DIR/plugins/$dir" ]; then
        print_color "$YELLOW" "  Found unused directory: $dir"
        read -p "  Remove $dir? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            mv "$SKETCHYBAR_DIR/plugins/$dir" "$ARCHIVE_DIR/plugins/" 2>/dev/null
            print_color "$GREEN" "    Archived: $dir"
        fi
    fi
done
echo ""

# Step 7: Archive old backups
print_color "$YELLOW" "Step 7: Archiving old backups..."
cd "$SKETCHYBAR_DIR"
for dir in backup_* backups; do
    if [ -d "$dir" ] && [ "$dir" != "$BACKUP_DIR" ]; then
        mv "$dir" "$ARCHIVE_DIR/" 2>/dev/null
        print_color "$GREEN" "  Archived: $dir"
    fi
done
echo ""

# Step 8: Clean temporary files
print_color "$YELLOW" "Step 8: Cleaning temporary files..."
rm -f "$SKETCHYBAR_DIR"/*.log 2>/dev/null
rm -f "$SKETCHYBAR_DIR"/*.tmp 2>/dev/null
rm -f "$SKETCHYBAR_DIR"/.DS_Store 2>/dev/null
print_color "$GREEN" "✅ Temporary files cleaned"
echo ""

# Step 9: Organize remaining files
print_color "$YELLOW" "Step 9: Organizing configuration..."

# Essential files that should remain
ESSENTIAL_FILES=(
    "sketchybarrc"
    "icon_map.sh"
    "manage.sh"
    "README.md"
    "AEROSPACE_INTEGRATION.md"
)

# Essential directories
ESSENTIAL_DIRS=(
    "plugins/spaces"
    "plugins/apple"
    "plugins/battery"
    "plugins/calendar"
    "plugins/volume"
    "plugins/wifi"
    "settings"
    "helper"
)

print_color "$GREEN" "✅ Essential files preserved"
echo ""

# Step 10: Create clean structure report
print_color "$YELLOW" "Step 10: Generating structure report..."
cat > "$SKETCHYBAR_DIR/STRUCTURE.md" << 'EOF'
# SketchyBar Configuration Structure

## Directory Layout
```
.config/sketchybar/
├── sketchybarrc              # Main configuration
├── icon_map.sh               # Icon mapping helper
├── manage.sh                 # Management script
├── README.md                 # Documentation
├── AEROSPACE_INTEGRATION.md # AeroSpace integration docs
├── plugins/
│   ├── spaces/
│   │   ├── items.sh         # Workspace configuration
│   │   └── handler.sh       # Event handler
│   ├── aerospace.sh         # Window state handler
│   ├── front_app_aerospace.sh # Front app display
│   ├── cpu.sh               # CPU monitor
│   ├── apple/               # Apple menu
│   ├── battery/             # Battery indicator
│   ├── calendar/            # Date & time
│   ├── volume/              # Volume control
│   └── wifi/                # WiFi status
├── settings/
│   ├── settings.sh          # General settings
│   ├── colors.sh            # Color definitions
│   └── icons.sh             # Icon definitions
├── helper/                  # Helper binary
└── archive/                 # Archived files
```

## Active Components
- **Workspaces**: 6 AeroSpace workspaces with app icons
- **System Info**: CPU, Battery, WiFi
- **Time**: Calendar and clock
- **Audio**: Volume control

## Management Commands
- `./manage.sh reload` - Reload configuration
- `./manage.sh status` - Check status
- `./manage.sh backup` - Create backup
EOF

print_color "$GREEN" "✅ Structure report created"
echo ""

# Step 11: Summary
print_color "$BLUE" "================================================"
print_color "$BLUE" "Cleanup Summary"
print_color "$BLUE" "================================================"
echo ""

# Count files
TOTAL_FILES=$(find "$SKETCHYBAR_DIR" -type f | wc -l)
ARCHIVED_FILES=$(find "$ARCHIVE_DIR" -type f 2>/dev/null | wc -l)

print_color "$GREEN" "✅ Cleanup completed successfully!"
echo ""
echo "  📁 Active files: $TOTAL_FILES"
echo "  📦 Archived files: $ARCHIVED_FILES"
echo "  💾 Backup location: $BACKUP_DIR"
echo "  🗄️  Archive location: $ARCHIVE_DIR"
echo ""

# Optional: Remove old archives
print_color "$YELLOW" "Optional: Remove old archives?"
echo "  Found archives:"
ls -d "$SKETCHYBAR_DIR"/archive/* 2>/dev/null | head -5
echo ""
read -p "Remove archives older than 7 days? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    find "$SKETCHYBAR_DIR/archive" -type d -mtime +7 -exec rm -rf {} + 2>/dev/null
    print_color "$GREEN" "✅ Old archives removed"
fi

echo ""
print_color "$BLUE" "================================================"
print_color "$GREEN" "Configuration is now clean and organized!"
print_color "$BLUE" "================================================"
echo ""

# Reload SketchyBar
read -p "Reload SketchyBar now? (Y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    sketchybar --reload
    print_color "$GREEN" "✅ SketchyBar reloaded"
fi