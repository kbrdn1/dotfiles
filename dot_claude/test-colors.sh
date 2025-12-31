#!/usr/bin/env bash
#
# Test Statusline Colors - Preview all available ANSI colors
#

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║         StatusLine Color Preview - ANSI Color Codes              ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Reset code
RESET='\e[0m'

echo "📊 Basic Colors (30-37):"
echo "──────────────────────────────────────────────────────────────────"
printf "  \e[30m◉ Black (30)${RESET}       \e[31m◉ Red (31)${RESET}         \e[32m◉ Green (32)${RESET}       \e[33m◉ Yellow (33)${RESET}\n"
printf "  \e[34m◉ Blue (34)${RESET}        \e[35m◉ Magenta (35)${RESET}     \e[36m◉ Cyan (36)${RESET}        \e[37m◉ White (37)${RESET}\n"
echo ""

echo "✨ Bright Colors (90-97):"
echo "──────────────────────────────────────────────────────────────────"
printf "  \e[90m◉ Bright Black (90)${RESET}   \e[91m◉ Bright Red (91)${RESET}     \e[92m◉ Bright Green (92)${RESET}   \e[93m◉ Bright Yellow (93)${RESET}\n"
printf "  \e[94m◉ Bright Blue (94)${RESET}    \e[95m◉ Bright Magenta (95)${RESET} \e[96m◉ Bright Cyan (96)${RESET}    \e[97m◉ Bright White (97)${RESET}\n"
echo ""

echo "🎨 Statusline Preview with Default Colors:"
echo "──────────────────────────────────────────────────────────────────"
printf "  \e[96m◉ Sonnet 4.5${RESET}  \e[34m⌂ ~/Projects/MyApp${RESET}  \e[32m⎇ main${RESET}  \e[36m⬢ 23.9.0${RESET}  \e[93m◉ ⇣1200 ⇡4990${RESET}  \e[90m◫ 07/10/25 ◷ 14:30${RESET}\n"
echo ""

echo "🔀 Git Status Colors:"
echo "──────────────────────────────────────────────────────────────────"
printf "  Clean:    \e[32m⎇ main${RESET}              (Green - no changes)\n"
printf "  Dirty:    \e[33m⎇ main *2 !1 ?3${RESET}     (Yellow - has changes)\n"
printf "  Conflict: \e[91m⎇ main ⚠CONFLICT${RESET}   (Bright Red - merge conflict)\n"
echo ""

echo "🌈 Theme Previews:"
echo "──────────────────────────────────────────────────────────────────"
printf "Ocean:      \e[96m◉ Model${RESET} \e[34m⌂ Path${RESET} \e[36m⎇ Git${RESET} \e[94m⬢ Ver${RESET} \e[93m◉ Token${RESET} \e[90m◷ Time${RESET}\n"
printf "Forest:     \e[92m◉ Model${RESET} \e[32m⌂ Path${RESET} \e[36m⎇ Git${RESET} \e[36m⬢ Ver${RESET} \e[93m◉ Token${RESET} \e[90m◷ Time${RESET}\n"
printf "Sunset:     \e[93m◉ Model${RESET} \e[35m⌂ Path${RESET} \e[95m⎇ Git${RESET} \e[33m⬢ Ver${RESET} \e[91m◉ Token${RESET} \e[90m◷ Time${RESET}\n"
printf "Monochrome: \e[97m◉ Model${RESET} \e[37m⌂ Path${RESET} \e[37m⎇ Git${RESET} \e[90m⬢ Ver${RESET} \e[90m◉ Token${RESET} \e[90m◷ Time${RESET}\n"
echo ""

echo "📝 How to Use:"
echo "──────────────────────────────────────────────────────────────────"
echo "  1. Choose colors you like from the preview above"
echo "  2. Edit ~/.claude/statusline-config.yaml"
echo "  3. Update the 'colors:' section with desired ANSI codes"
echo "  4. Example: model: '\\e[96m' for bright cyan"
echo ""
echo "  Or use environment variables:"
echo "  export STATUSLINE_COLOR_MODEL='\\e[93m'  # Bright yellow"
echo "  export STATUSLINE_COLOR_PATH='\\e[35m'   # Magenta"
echo ""

echo "💡 Quick Test:"
echo "──────────────────────────────────────────────────────────────────"
echo "  To test a specific color combination without editing config:"
echo "  STATUSLINE_COLOR_MODEL='\\e[93m' STATUSLINE_COLOR_PATH='\\e[35m' claude"
echo ""
