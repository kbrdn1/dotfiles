#!/usr/bin/env bash
#
# Dynamic Color Functions for StatusLine
# Colors change based on usage thresholds
#

# =============================[ Color Definitions ]=============================

# Base colors
COLOR_GREEN=$'\e[92m'      # Bright green - good/safe
COLOR_YELLOW=$'\e[93m'     # Bright yellow - warning/medium
COLOR_ORANGE=$'\e[38;5;208m'  # Orange - high usage
COLOR_RED=$'\e[91m'        # Bright red - critical/danger
COLOR_RESET=$'\e[0m'

# =============================[ Dynamic Color Functions ]=============================

# Get color based on token usage percentage
# Args: $1 = current_tokens, $2 = max_tokens
get_token_color() {
  local current=$1
  local max=$2

  if [[ -z "$current" ]] || [[ -z "$max" ]] || [[ "$max" -eq 0 ]]; then
    echo "$COLOR_YELLOW"
    return
  fi

  local percentage=$((current * 100 / max))

  if [[ $percentage -lt 50 ]]; then
    echo "$COLOR_GREEN"    # < 50% : Green (safe)
  elif [[ $percentage -lt 75 ]]; then
    echo "$COLOR_YELLOW"   # 50-75% : Yellow (moderate)
  elif [[ $percentage -lt 90 ]]; then
    echo "$COLOR_ORANGE"   # 75-90% : Orange (high)
  else
    echo "$COLOR_RED"      # > 90% : Red (critical)
  fi
}

# Get color based on remaining time (based on 5h limit)
# Args: $1 = remaining_minutes
get_time_color() {
  local minutes=$1

  if [[ -z "$minutes" ]] || [[ "$minutes" == "0" ]]; then
    echo "$COLOR_RED"
    return
  fi

  if [[ $minutes -gt 180 ]]; then
    echo "$COLOR_GREEN"    # > 3h (60% of 5h) : Green (plenty of time)
  elif [[ $minutes -gt 90 ]]; then
    echo "$COLOR_YELLOW"   # 1.5h-3h (30-60%) : Yellow (moderate)
  elif [[ $minutes -gt 45 ]]; then
    echo "$COLOR_ORANGE"   # 45min-1.5h (15-30%) : Orange (low)
  else
    echo "$COLOR_RED"      # < 45min (<15%) : Red (critical)
  fi
}

# Get color based on cost (daily or session)
# Args: $1 = cost_usd
get_cost_color() {
  local cost=$1

  if [[ -z "$cost" ]]; then
    echo "$COLOR_GREEN"
    return
  fi

  # Convert to integer for comparison (multiply by 100 to handle decimals)
  local cost_cents=$(echo "$cost * 100" | bc | cut -d'.' -f1)

  if [[ $cost_cents -lt 500 ]]; then
    echo "$COLOR_GREEN"    # < $5 : Green (low cost)
  elif [[ $cost_cents -lt 1500 ]]; then
    echo "$COLOR_YELLOW"   # $5-$15 : Yellow (moderate)
  elif [[ $cost_cents -lt 3000 ]]; then
    echo "$COLOR_ORANGE"   # $15-$30 : Orange (high)
  else
    echo "$COLOR_RED"      # > $30 : Red (very high)
  fi
}

# Get color based on burn rate (tokens per minute)
# Args: $1 = burn_rate
get_burn_rate_color() {
  local burn_rate=$1

  if [[ -z "$burn_rate" ]]; then
    echo "$COLOR_GREEN"
    return
  fi

  # Convert burn rate to numeric value (handle K/M suffixes, case insensitive)
  local burn_numeric
  if [[ "$burn_rate" =~ ([0-9.]+)[Mm] ]]; then
    burn_numeric=$(echo "${BASH_REMATCH[1]} * 1000" | bc 2>/dev/null | cut -d'.' -f1)
  elif [[ "$burn_rate" =~ ([0-9.]+)[Kk] ]]; then
    burn_numeric=$(echo "${BASH_REMATCH[1]}" | bc 2>/dev/null | cut -d'.' -f1)
  else
    burn_numeric=$burn_rate
  fi

  # Validate numeric value
  if [[ ! "$burn_numeric" =~ ^[0-9]+$ ]]; then
    echo "$COLOR_GREEN"
    return
  fi

  if [[ $burn_numeric -lt 150 ]]; then
    echo "$COLOR_GREEN"    # < 150k tok/min : Green (low)
  elif [[ $burn_numeric -lt 250 ]]; then
    echo "$COLOR_YELLOW"   # 150-250k (normal ~190k) : Yellow (moderate)
  elif [[ $burn_numeric -lt 350 ]]; then
    echo "$COLOR_ORANGE"   # 250-350k : Orange (high)
  else
    echo "$COLOR_RED"      # > 350k : Red (very high)
  fi
}

# Format with dynamic color
# Args: $1 = icon, $2 = value, $3 = color
format_with_color() {
  local icon=$1
  local value=$2
  local color=$3

  echo "${color}${icon} ${value}${COLOR_RESET}"
}

# Export functions for use in other scripts
export -f get_token_color
export -f get_time_color
export -f get_cost_color
export -f get_burn_rate_color
export -f format_with_color
