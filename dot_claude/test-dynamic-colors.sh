#!/usr/bin/env bash
#
# Test Dynamic Colors - Preview how colors change based on usage
#

# Source the dynamic color functions
source "$HOME/.claude/statusline-dynamic-colors.sh"

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "           STATUSLINE DYNAMIC COLORS TEST                          "
echo "═══════════════════════════════════════════════════════════════════"
echo ""

# ========== Model Color Test ==========
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Model Color (Orange like Claude logo):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "    \e[38;5;208m🤖 Sonnet 4.5\e[0m"
echo ""

# ========== Token Usage Colors ==========
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Token Usage (based on 200K max):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_tokens=(50000 100000 150000 180000 195000)
test_percentages=("25%" "50%" "75%" "90%" "97.5%")

for i in "${!test_tokens[@]}"; do
  tokens=${test_tokens[$i]}
  percent=${test_percentages[$i]}
  color=$(get_token_color $tokens 200000)
  echo -e "    ${color}🧩 ${tokens} tokens (${percent})${COLOR_RESET}"
done
echo ""

# ========== Cost Colors ==========
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Cost Colors (Session/Daily/Block):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_costs=(2.50 8.00 20.00 35.00)
test_labels=("Low cost" "Medium cost" "High cost" "Very high cost")

for i in "${!test_costs[@]}"; do
  cost=${test_costs[$i]}
  label=${test_labels[$i]}
  color=$(get_cost_color $cost)
  echo -e "    ${color}💰 \$$(printf "%.2f" $cost) (${label})${COLOR_RESET}"
done
echo ""

# ========== Remaining Time Colors (based on 5h limit) ==========
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Remaining Time Colors (5h limit):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_times=(240 120 60 30)
test_time_labels=("4h 0m (>60% - Plenty)" "2h 0m (40% - Moderate)" "1h 0m (20% - Low)" "30m (<10% - Critical)")

for i in "${!test_times[@]}"; do
  minutes=${test_times[$i]}
  label=${test_time_labels[$i]}
  color=$(get_time_color $minutes)
  echo -e "    ${color}⧗ ${label}${COLOR_RESET}"
done
echo ""

# ========== Burn Rate Colors ==========
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Burn Rate Colors (tokens/min):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_burn_rates=("100K" "190K" "300K" "400K")
test_burn_labels=("Low usage" "Normal usage (~190k)" "High usage" "Very high usage")

for i in "${!test_burn_rates[@]}"; do
  burn_rate=${test_burn_rates[$i]}
  label=${test_burn_labels[$i]}
  color=$(get_burn_rate_color $burn_rate)
  echo -e "    ${color}≈ ${burn_rate} tok/min (${label})${COLOR_RESET}"
done
echo ""

# ========== Full Example StatusLine ==========
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Full StatusLine Example:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Example with low usage (green)
token_color=$(get_token_color 50000 200000)
cost_color=$(get_cost_color 2.50)
time_color=$(get_time_color 180)
echo -e "  \e[37m🌿 main \e[90m|\e[37m 💄 default \e[90m|\e[37m 📁 ~/projects \e[90m|\e[38;5;208m 🤖 Sonnet 4.5\e[0m"
echo -e "  \e[37m💰\e[0m ${cost_color}\$2.50\e[0m \e[90m|\e[37m 📅\e[0m ${cost_color}\$5.00\e[0m \e[90m|\e[37m 🧊\e[0m ${cost_color}\$10.00\e[0m \e[90m(\e[0m${time_color}3h 0m left\e[0m\e[90m) |\e[37m 🧩\e[0m ${token_color}50.0K\e[0m \e[90mtokens\e[0m"
echo ""

# Example with high usage (red/orange)
token_color=$(get_token_color 180000 200000)
cost_color=$(get_cost_color 25.00)
time_color=$(get_time_color 20)
echo -e "  \e[37m🌿 feature/new \e[90m|\e[37m 💄 compact \e[90m|\e[37m 📁 ~/work \e[90m|\e[38;5;208m 🤖 Opus 4\e[0m"
echo -e "  \e[37m💰\e[0m ${cost_color}\$25.00\e[0m \e[90m|\e[37m 📅\e[0m ${cost_color}\$32.00\e[0m \e[90m|\e[37m 🧊\e[0m ${cost_color}\$28.00\e[0m \e[90m(\e[0m${time_color}20m left\e[0m\e[90m) |\e[37m 🧩\e[0m ${token_color}180.0K\e[0m \e[90mtokens\e[0m"
echo ""

echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "Color Thresholds (Updated for 5h limit):"
echo "  • Tokens:   Green (<50%) | Yellow (50-75%) | Orange (75-90%) | Red (>90%)"
echo "  • Cost:     Green (<\$5)  | Yellow (\$5-\$15) | Orange (\$15-\$30) | Red (>\$30)"
echo "  • Time:     Green (>3h/60%) | Yellow (1.5h-3h/30-60%) | Orange (45m-1.5h/15-30%) | Red (<45m/<15%)"
echo "  • Burn:     Green (<150K) | Yellow (150-250K normal) | Orange (250-350K) | Red (>350K)"
echo ""
