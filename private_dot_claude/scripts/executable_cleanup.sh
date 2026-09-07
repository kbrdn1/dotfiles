#!/bin/bash
# Auto-cleanup script for Claude runtime data

echo "🧹 Cleaning Claude runtime data..."

# Remove old logs (>7 days)
find ~/.claude/logs -type f -mtime +7 -delete 2>/dev/null
echo "  ✓ Cleaned old logs (>7 days)"

# Remove old shell snapshots (>3 days)
find ~/.claude/shell-snapshots -type f -mtime +3 -delete 2>/dev/null
echo "  ✓ Cleaned shell snapshots (>3 days)"

# Compress old history
if [ -f ~/.claude/history.jsonl ]; then
    SIZE=$(du -m ~/.claude/history.jsonl | cut -f1)
    if [ "$SIZE" -gt 10 ]; then
        echo "  📦 Compressing large history file (${SIZE}MB)..."
        gzip -c ~/.claude/history.jsonl > ~/.claude/history-$(date +%Y%m).jsonl.gz
        > ~/.claude/history.jsonl  # Truncate
        echo "  ✓ History compressed and archived"
    fi
fi

# Clean completed todos older than 30 days
find ~/.claude/todos -type f -mtime +30 -delete 2>/dev/null
echo "  ✓ Cleaned old todos (>30 days)"

echo ""
echo "✅ Cleanup complete!"
du -sh ~/.claude
