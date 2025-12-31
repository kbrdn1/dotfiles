#!/usr/bin/env bash
#
# Claude Code Status Line - Advanced
# Format: 󰧑 model  ~/path  branch  versions  tokens • burn • time
#

# Source dynamic color functions
DYNAMIC_COLORS_SCRIPT="$HOME/.claude/statusline-dynamic-colors.sh"
if [[ -f "$DYNAMIC_COLORS_SCRIPT" ]]; then
  source "$DYNAMIC_COLORS_SCRIPT"
fi

# Read JSON input from stdin
input=$(cat)

# Extract current directory from JSON input
cwd=$(echo "$input" | jq -r '.cwd // .workspace.current_dir // .workspace.project_dir // empty')

# If no cwd from JSON, use PWD as fallback
if [ -z "$cwd" ] || [ "$cwd" = "null" ]; then
  cwd="$PWD"
fi

# ============================================================================
# Configuration Loading (YAML + Environment Variables)
# ============================================================================
# Default configuration values
# Git Features
STATUSLINE_GIT_ENABLED="${STATUSLINE_GIT_ENABLED:-true}"
STATUSLINE_GIT_SHOW_BRANCH="${STATUSLINE_GIT_SHOW_BRANCH:-true}"
STATUSLINE_GIT_SHOW_STATUS="${STATUSLINE_GIT_SHOW_STATUS:-true}"
STATUSLINE_GIT_AHEAD_BEHIND="${STATUSLINE_GIT_AHEAD_BEHIND:-true}"
STATUSLINE_GIT_STASH="${STATUSLINE_GIT_STASH:-true}"
STATUSLINE_GIT_CONFLICT="${STATUSLINE_GIT_CONFLICT:-true}"

# Version Detection
STATUSLINE_VERSIONS_ENABLED="${STATUSLINE_VERSIONS_ENABLED:-true}"
STATUSLINE_NODE="${STATUSLINE_NODE:-true}"
STATUSLINE_PHP="${STATUSLINE_PHP:-true}"
STATUSLINE_GO="${STATUSLINE_GO:-true}"
STATUSLINE_PYTHON="${STATUSLINE_PYTHON:-true}"
STATUSLINE_RUST="${STATUSLINE_RUST:-true}"
STATUSLINE_RUBY="${STATUSLINE_RUBY:-true}"
STATUSLINE_JAVA="${STATUSLINE_JAVA:-true}"

# DevOps
STATUSLINE_DOCKER="${STATUSLINE_DOCKER:-true}"
STATUSLINE_KUBERNETES="${STATUSLINE_KUBERNETES:-true}"
STATUSLINE_K8S_MAX_LENGTH="${STATUSLINE_K8S_MAX_LENGTH:-15}"

# Tokens
STATUSLINE_TOKENS_ENABLED="${STATUSLINE_TOKENS_ENABLED:-true}"
STATUSLINE_SHOW_INPUT_OUTPUT="${STATUSLINE_SHOW_INPUT_OUTPUT:-true}"
STATUSLINE_SHOW_BURN_RATE="${STATUSLINE_SHOW_BURN_RATE:-true}"
STATUSLINE_SHOW_COST="${STATUSLINE_SHOW_COST:-true}"
STATUSLINE_SHOW_TIME_REMAINING="${STATUSLINE_SHOW_TIME_REMAINING:-true}"

# System
STATUSLINE_SHOW_MODEL="${STATUSLINE_SHOW_MODEL:-true}"
STATUSLINE_SHOW_PATH="${STATUSLINE_SHOW_PATH:-true}"

# Display
STATUSLINE_SHOW_DATE="${STATUSLINE_SHOW_DATE:-true}"
STATUSLINE_SHOW_TIME="${STATUSLINE_SHOW_TIME:-true}"
STATUSLINE_DATE_FORMAT="${STATUSLINE_DATE_FORMAT:-%d/%m/%y}"
STATUSLINE_TIME_FORMAT="${STATUSLINE_TIME_FORMAT:-%H:%M}"
STATUSLINE_MAX_PATH_LENGTH="${STATUSLINE_MAX_PATH_LENGTH:-50}"

# Load from YAML config file if it exists and yq is available
config_file="$HOME/.claude/statusline-config.yaml"
if [ -f "$config_file" ] && command -v yq &> /dev/null; then
  # Git Features (support both old and new nested structure)
  cfg_git_enabled=$(yq '.features.git.enabled // "true"' "$config_file" 2>/dev/null)
  [ "$cfg_git_enabled" = "false" ] && STATUSLINE_GIT_ENABLED="false"

  cfg_git_branch=$(yq '.features.git.show_branch // "true"' "$config_file" 2>/dev/null)
  [ "$cfg_git_branch" = "false" ] && STATUSLINE_GIT_SHOW_BRANCH="false"

  cfg_git_status=$(yq '.features.git.show_status // "true"' "$config_file" 2>/dev/null)
  [ "$cfg_git_status" = "false" ] && STATUSLINE_GIT_SHOW_STATUS="false"

  cfg_git_ahead=$(yq '.features.git.show_ahead_behind // .features.git_ahead_behind // "true"' "$config_file" 2>/dev/null)
  [ "$cfg_git_ahead" = "false" ] && STATUSLINE_GIT_AHEAD_BEHIND="false"

  cfg_git_stash=$(yq '.features.git.show_stash // .features.git_stash // "true"' "$config_file" 2>/dev/null)
  [ "$cfg_git_stash" = "false" ] && STATUSLINE_GIT_STASH="false"

  cfg_git_conflict=$(yq '.features.git.show_conflict // .features.git_conflict // "true"' "$config_file" 2>/dev/null)
  [ "$cfg_git_conflict" = "false" ] && STATUSLINE_GIT_CONFLICT="false"

  # Versions
  cfg_versions_enabled=$(yq '.features.versions.enabled // "true"' "$config_file" 2>/dev/null)
  [ "$cfg_versions_enabled" = "false" ] && STATUSLINE_VERSIONS_ENABLED="false"

  cfg_node=$(yq '.features.versions.node // "true"' "$config_file" 2>/dev/null)
  [ "$cfg_node" = "false" ] && STATUSLINE_NODE="false"

  cfg_php=$(yq '.features.versions.php // "true"' "$config_file" 2>/dev/null)
  [ "$cfg_php" = "false" ] && STATUSLINE_PHP="false"

  cfg_go=$(yq '.features.versions.go // "true"' "$config_file" 2>/dev/null)
  [ "$cfg_go" = "false" ] && STATUSLINE_GO="false"

  cfg_python=$(yq '.features.versions.python // "true"' "$config_file" 2>/dev/null)
  [ "$cfg_python" = "false" ] && STATUSLINE_PYTHON="false"

  cfg_rust=$(yq '.features.versions.rust // "true"' "$config_file" 2>/dev/null)
  [ "$cfg_rust" = "false" ] && STATUSLINE_RUST="false"

  cfg_ruby=$(yq '.features.versions.ruby // "true"' "$config_file" 2>/dev/null)
  [ "$cfg_ruby" = "false" ] && STATUSLINE_RUBY="false"

  cfg_java=$(yq '.features.versions.java // "true"' "$config_file" 2>/dev/null)
  [ "$cfg_java" = "false" ] && STATUSLINE_JAVA="false"

  # DevOps (support both old and new structure)
  cfg_docker=$(yq '.features.devops.docker // .features.docker // "true"' "$config_file" 2>/dev/null)
  [ "$cfg_docker" = "false" ] && STATUSLINE_DOCKER="false"

  cfg_k8s=$(yq '.features.devops.kubernetes // .features.kubernetes // "true"' "$config_file" 2>/dev/null)
  [ "$cfg_k8s" = "false" ] && STATUSLINE_KUBERNETES="false"

  cfg_k8s_max=$(yq '.features.devops.k8s_max_length // "15"' "$config_file" 2>/dev/null)
  [ -n "$cfg_k8s_max" ] && [ "$cfg_k8s_max" != "null" ] && STATUSLINE_K8S_MAX_LENGTH="$cfg_k8s_max"

  # Tokens
  cfg_tokens_enabled=$(yq '.features.tokens.enabled // "true"' "$config_file" 2>/dev/null)
  [ "$cfg_tokens_enabled" = "false" ] && STATUSLINE_TOKENS_ENABLED="false"

  cfg_show_io=$(yq '.features.tokens.show_input_output // "true"' "$config_file" 2>/dev/null)
  [ "$cfg_show_io" = "false" ] && STATUSLINE_SHOW_INPUT_OUTPUT="false"

  cfg_show_burn=$(yq '.features.tokens.show_burn_rate // "true"' "$config_file" 2>/dev/null)
  [ "$cfg_show_burn" = "false" ] && STATUSLINE_SHOW_BURN_RATE="false"

  cfg_show_cost=$(yq '.features.tokens.show_cost // "true"' "$config_file" 2>/dev/null)
  [ "$cfg_show_cost" = "false" ] && STATUSLINE_SHOW_COST="false"

  cfg_show_time_rem=$(yq '.features.tokens.show_time_remaining // "true"' "$config_file" 2>/dev/null)
  [ "$cfg_show_time_rem" = "false" ] && STATUSLINE_SHOW_TIME_REMAINING="false"

  # System
  cfg_show_model=$(yq '.features.system.show_model // "true"' "$config_file" 2>/dev/null)
  [ "$cfg_show_model" = "false" ] && STATUSLINE_SHOW_MODEL="false"

  cfg_show_path=$(yq '.features.system.show_path // "true"' "$config_file" 2>/dev/null)
  [ "$cfg_show_path" = "false" ] && STATUSLINE_SHOW_PATH="false"

  # Display options
  cfg_show_date=$(yq '.display.show_date // "true"' "$config_file" 2>/dev/null)
  [ "$cfg_show_date" = "false" ] && STATUSLINE_SHOW_DATE="false"

  cfg_show_time=$(yq '.display.show_time // "true"' "$config_file" 2>/dev/null)
  [ "$cfg_show_time" = "false" ] && STATUSLINE_SHOW_TIME="false"

  cfg_date_fmt=$(yq '.display.date_format // "%d/%m/%y"' "$config_file" 2>/dev/null)
  [ -n "$cfg_date_fmt" ] && [ "$cfg_date_fmt" != "null" ] && STATUSLINE_DATE_FORMAT="$cfg_date_fmt"

  cfg_time_fmt=$(yq '.display.time_format // "%H:%M"' "$config_file" 2>/dev/null)
  [ -n "$cfg_time_fmt" ] && [ "$cfg_time_fmt" != "null" ] && STATUSLINE_TIME_FORMAT="$cfg_time_fmt"

  cfg_max_path=$(yq '.display.max_path_length // "50"' "$config_file" 2>/dev/null)
  [ -n "$cfg_max_path" ] && [ "$cfg_max_path" != "null" ] && STATUSLINE_MAX_PATH_LENGTH="$cfg_max_path"
fi

# ============================================================================
# ANSI Color Codes
# ============================================================================
# Text colors
COLOR_BLACK=$'\e[30m'
COLOR_RED=$'\e[31m'
COLOR_GREEN=$'\e[32m'
COLOR_YELLOW=$'\e[33m'
COLOR_BLUE=$'\e[34m'
COLOR_MAGENTA=$'\e[35m'
COLOR_CYAN=$'\e[36m'
COLOR_WHITE=$'\e[37m'

# Bright colors
COLOR_BRIGHT_BLACK=$'\e[90m'
COLOR_BRIGHT_RED=$'\e[91m'
COLOR_BRIGHT_GREEN=$'\e[92m'
COLOR_BRIGHT_YELLOW=$'\e[93m'
COLOR_BRIGHT_BLUE=$'\e[94m'
COLOR_BRIGHT_MAGENTA=$'\e[95m'
COLOR_BRIGHT_CYAN=$'\e[96m'
COLOR_BRIGHT_WHITE=$'\e[97m'

# Styles
COLOR_BOLD=$'\e[1m'
COLOR_DIM=$'\e[2m'
COLOR_RESET=$'\e[0m'

# ============================================================================
# Color Configuration (Default Theme)
# ============================================================================
# Helper function to convert color strings to bash escape sequences
convert_color() {
  local color_str="$1"
  # If color string contains \e, convert it to actual escape sequence
  if [[ "$color_str" == *'\e'* ]]; then
    # Use printf to interpret the escape sequence
    printf '%b' "$color_str"
  else
    echo "$color_str"
  fi
}

# Default colors for each section
STATUSLINE_COLOR_MODEL="${STATUSLINE_COLOR_MODEL:-$COLOR_BRIGHT_CYAN}"
STATUSLINE_COLOR_PATH="${STATUSLINE_COLOR_PATH:-$COLOR_BLUE}"
STATUSLINE_COLOR_GIT_BRANCH="${STATUSLINE_COLOR_GIT_BRANCH:-$COLOR_BRIGHT_MAGENTA}"
STATUSLINE_COLOR_GIT_CLEAN="${STATUSLINE_COLOR_GIT_CLEAN:-$COLOR_GREEN}"
STATUSLINE_COLOR_GIT_DIRTY="${STATUSLINE_COLOR_GIT_DIRTY:-$COLOR_YELLOW}"
STATUSLINE_COLOR_GIT_CONFLICT="${STATUSLINE_COLOR_GIT_CONFLICT:-$COLOR_BRIGHT_RED}"
STATUSLINE_COLOR_VERSION="${STATUSLINE_COLOR_VERSION:-$COLOR_CYAN}"
STATUSLINE_COLOR_DOCKER="${STATUSLINE_COLOR_DOCKER:-$COLOR_BRIGHT_BLUE}"
STATUSLINE_COLOR_K8S="${STATUSLINE_COLOR_K8S:-$COLOR_BRIGHT_MAGENTA}"
STATUSLINE_COLOR_TOKEN="${STATUSLINE_COLOR_TOKEN:-$COLOR_BRIGHT_YELLOW}"
STATUSLINE_COLOR_DATETIME="${STATUSLINE_COLOR_DATETIME:-$COLOR_BRIGHT_BLACK}"

# Load colors from YAML config if available
if [ -f "$config_file" ] && command -v yq &> /dev/null; then
  # Model color
  cfg_color_model=$(yq '.colors.model // ""' "$config_file" 2>/dev/null)
  [ -n "$cfg_color_model" ] && [ "$cfg_color_model" != "null" ] && STATUSLINE_COLOR_MODEL=$(convert_color "$cfg_color_model")

  # Path color
  cfg_color_path=$(yq '.colors.path // ""' "$config_file" 2>/dev/null)
  [ -n "$cfg_color_path" ] && [ "$cfg_color_path" != "null" ] && STATUSLINE_COLOR_PATH=$(convert_color "$cfg_color_path")

  # Git colors
  cfg_color_git_branch=$(yq '.colors.git_branch // ""' "$config_file" 2>/dev/null)
  [ -n "$cfg_color_git_branch" ] && [ "$cfg_color_git_branch" != "null" ] && STATUSLINE_COLOR_GIT_BRANCH=$(convert_color "$cfg_color_git_branch")

  cfg_color_git_clean=$(yq '.colors.git_clean // ""' "$config_file" 2>/dev/null)
  [ -n "$cfg_color_git_clean" ] && [ "$cfg_color_git_clean" != "null" ] && STATUSLINE_COLOR_GIT_CLEAN=$(convert_color "$cfg_color_git_clean")

  cfg_color_git_dirty=$(yq '.colors.git_dirty // ""' "$config_file" 2>/dev/null)
  [ -n "$cfg_color_git_dirty" ] && [ "$cfg_color_git_dirty" != "null" ] && STATUSLINE_COLOR_GIT_DIRTY=$(convert_color "$cfg_color_git_dirty")

  cfg_color_git_conflict=$(yq '.colors.git_conflict // ""' "$config_file" 2>/dev/null)
  [ -n "$cfg_color_git_conflict" ] && [ "$cfg_color_git_conflict" != "null" ] && STATUSLINE_COLOR_GIT_CONFLICT=$(convert_color "$cfg_color_git_conflict")

  # Version color
  cfg_color_version=$(yq '.colors.version // ""' "$config_file" 2>/dev/null)
  [ -n "$cfg_color_version" ] && [ "$cfg_color_version" != "null" ] && STATUSLINE_COLOR_VERSION=$(convert_color "$cfg_color_version")

  # DevOps colors
  cfg_color_docker=$(yq '.colors.docker // ""' "$config_file" 2>/dev/null)
  [ -n "$cfg_color_docker" ] && [ "$cfg_color_docker" != "null" ] && STATUSLINE_COLOR_DOCKER=$(convert_color "$cfg_color_docker")

  cfg_color_k8s=$(yq '.colors.kubernetes // ""' "$config_file" 2>/dev/null)
  [ -n "$cfg_color_k8s" ] && [ "$cfg_color_k8s" != "null" ] && STATUSLINE_COLOR_K8S=$(convert_color "$cfg_color_k8s")

  # Token color
  cfg_color_token=$(yq '.colors.token // ""' "$config_file" 2>/dev/null)
  [ -n "$cfg_color_token" ] && [ "$cfg_color_token" != "null" ] && STATUSLINE_COLOR_TOKEN=$(convert_color "$cfg_color_token")

  # Datetime color
  cfg_color_datetime=$(yq '.colors.datetime // ""' "$config_file" 2>/dev/null)
  [ -n "$cfg_color_datetime" ] && [ "$cfg_color_datetime" != "null" ] && STATUSLINE_COLOR_DATETIME=$(convert_color "$cfg_color_datetime")
fi

# Icons (Unicode Symbols - High Compatibility)
model_icon="◉"           # Circle for Claude model
folder_icon="⌂"          # Home/folder icon
git_icon="⎇"             # Git branch symbol
git_clean="✓"            # Check mark
git_modified="✗"         # X mark
node_icon="⬢"            # Hexagon for Node.js
php_icon="◆"             # Diamond for PHP
go_icon="◈"             # Fisheye for Go
rust_icon="⚙"            # Gear for Rust
python_icon="⊙"          # Circle dot for Python
ruby_icon="◊"            # Diamond outline for Ruby
java_icon="◈"            # Fisheye for Java (changed from ☕)
token_icon="◉"           # Circle token for tokens (changed from ⚡)
burn_icon="≈"            # Wave/approximately for burn rate
time_icon="◷"            # Clock icon
calendar_icon="◫"        # Calendar icon
in_icon="⇣"              # Down arrow (input)
out_icon="⇡"             # Up arrow (output)
remaining_icon="⧗"       # Hourglass for time remaining
ahead_icon="↑"            # Ahead commits
behind_icon="↓"           # Behind commits
stash_icon="⊟"            # Stash count
conflict_icon="⚠"         # Merge conflict
docker_icon="◧"           # Docker container
k8s_icon="⎈"              # Kubernetes helm

# ============================================================================
# Claude Model (from JSON input or infer from ccusage)
# ============================================================================
model_display=""

# Try to get from JSON input first
model_json=$(echo "$input" | jq -r '.model.id // .model.name // empty' 2>/dev/null)

if [ -n "$model_json" ] && [ "$model_json" != "null" ]; then
  # Extract model name and version from full model ID
  # Examples: claude-sonnet-4-5-20250929, claude-opus-4-20250514, claude-3-5-haiku-20241022

  if [[ "$model_json" =~ sonnet-4-5 ]] || [[ "$model_json" =~ sonnet.*4.*5 ]]; then
    model_display="Sonnet 4.5"
  elif [[ "$model_json" =~ sonnet-3-5 ]] || [[ "$model_json" =~ sonnet.*3.*5 ]]; then
    model_display="Sonnet 3.5"
  elif [[ "$model_json" =~ sonnet ]]; then
    model_display="Sonnet"

  elif [[ "$model_json" =~ opus-4-1 ]] || [[ "$model_json" =~ opus.*4.*1 ]]; then
    model_display="Opus 4.1"
  elif [[ "$model_json" =~ opus-4 ]] || [[ "$model_json" =~ opus.*4 ]]; then
    model_display="Opus 4"
  elif [[ "$model_json" =~ opus-3 ]] || [[ "$model_json" =~ opus.*3 ]]; then
    model_display="Opus 3"
  elif [[ "$model_json" =~ opus ]]; then
    model_display="Opus"

  elif [[ "$model_json" =~ haiku-3-5 ]] || [[ "$model_json" =~ haiku.*3.*5 ]]; then
    model_display="Haiku 3.5"
  elif [[ "$model_json" =~ haiku ]]; then
    model_display="Haiku"
  fi
else
  # Fallback: assume Sonnet 4.5 if ccusage is working (most common)
  if command -v bunx &> /dev/null; then
    ccusage_check=$(bunx ccusage@latest blocks --active --compact 2>/dev/null)
    if [ -n "$ccusage_check" ]; then
      model_display="Sonnet 4.5"
    fi
  fi
fi

# ============================================================================
# Directory Path with Smart Aliases
# ============================================================================
dir_path="$cwd"

# Replace home with ~
if [[ "$cwd" == "$HOME"* ]]; then
  dir_path="~${cwd#$HOME}"
fi

# Smart aliases for common directories (Unicode symbols, no emojis)
dir_path="${dir_path//~\/Projects\/Flippad/◈ Flippad}"
dir_path="${dir_path//~\/Projects\/Perso/◆ Perso}"
dir_path="${dir_path//~\/Projects\/Pro/◇ Pro}"
dir_path="${dir_path//~\/Projects\/MNS/◈ MNS}"
dir_path="${dir_path//~\/Projects\/Labs/◉ Labs}"
dir_path="${dir_path//~\/Projects\/Learning/◎ Learn}"
dir_path="${dir_path//~\/Projects\/Mehdi/◊ Mehdi}"
dir_path="${dir_path//~\/Projects/⬡ Proj}"
dir_path="${dir_path//~\/Documents/◫ Docs}"
dir_path="${dir_path//~\/Downloads/⇣ DL}"
dir_path="${dir_path//~\/Desktop/◲ Desk}"
dir_path="${dir_path//~\/Scripts/⚙ Scripts}"
dir_path="${dir_path//~\/Pictures/◐ Pics}"
dir_path="${dir_path//~\/Movies/◎ Movies}"
dir_path="${dir_path//~\/Music/♪ Music}"

# ============================================================================
# Git Status with detailed stats
# ============================================================================
git_info=""
if [ "$STATUSLINE_GIT_ENABLED" = "true" ] && git -C "$cwd" rev-parse --git-dir > /dev/null 2>&1; then
  branch=$(git -C "$cwd" --no-optional-locks branch --show-current 2>/dev/null || echo "detached")

  # Get detailed git status
  git_status_output=$(git -C "$cwd" --no-optional-locks status --porcelain 2>/dev/null)

  # Count different types of changes
  staged=0
  modified=0
  untracked=0

  while IFS= read -r line; do
    if [[ -n "$line" ]]; then
      status_code="${line:0:2}"

      # Staged files
      if [[ "${status_code:0:1}" != " " && "${status_code:0:1}" != "?" ]]; then
        ((staged++))
      fi

      # Modified files
      if [[ "${status_code:1:1}" == "M" || "${status_code:1:1}" == "D" ]]; then
        ((modified++))
      fi

      # Untracked files
      if [[ "${status_code:0:2}" == "??" ]]; then
        ((untracked++))
      fi
    fi
  done <<< "$git_status_output"

  # Build git info string with stats
  git_stats=""
  if [ "$STATUSLINE_GIT_SHOW_STATUS" = "true" ]; then
    [[ $staged -gt 0 ]] && git_stats="${git_stats} *${staged}"
    [[ $modified -gt 0 ]] && git_stats="${git_stats} !${modified}"
    [[ $untracked -gt 0 ]] && git_stats="${git_stats} ?${untracked}"
  fi

  # ============================================================================
  # Git Advanced Features - Ahead/Behind
  # ============================================================================
  ahead_behind=""
  if [ "$STATUSLINE_GIT_AHEAD_BEHIND" = "true" ]; then
    if git -C "$cwd" rev-parse --abbrev-ref @{upstream} > /dev/null 2>&1; then
      # Get ahead/behind counts
      ahead_behind_counts=$(git -C "$cwd" --no-optional-locks rev-list --left-right --count @{upstream}...HEAD 2>/dev/null)
      if [ -n "$ahead_behind_counts" ]; then
        behind=$(echo "$ahead_behind_counts" | awk '{print $1}')
        ahead=$(echo "$ahead_behind_counts" | awk '{print $2}')

        # Only show if non-zero
        [[ "$ahead" -gt 0 ]] && ahead_behind="${ahead_behind} ${ahead_icon}${ahead}"
        [[ "$behind" -gt 0 ]] && ahead_behind="${ahead_behind} ${behind_icon}${behind}"
      fi
    fi
  fi

  # ============================================================================
  # Git Stash Count
  # ============================================================================
  stash_info=""
  if [ "$STATUSLINE_GIT_STASH" = "true" ]; then
    stash_count=$(git -C "$cwd" --no-optional-locks stash list 2>/dev/null | wc -l | tr -d ' ')
    [[ "$stash_count" -gt 0 ]] && stash_info=" ${stash_icon}${stash_count}"
  fi

  # ============================================================================
  # Merge Conflict Detection
  # ============================================================================
  conflict_info=""
  if [ "$STATUSLINE_GIT_CONFLICT" = "true" ]; then
    if echo "$git_status_output" | grep -qE '^(UU|AA|DD)'; then
      conflict_info=" ${conflict_icon}CONFLICT"
    fi
  fi

  # Build final git info
  if [ "$STATUSLINE_GIT_SHOW_BRANCH" = "true" ]; then
    if [[ -n "$git_stats" ]] || [[ -n "$ahead_behind" ]] || [[ -n "$stash_info" ]] || [[ -n "$conflict_info" ]]; then
      git_info="  ${git_icon} ${branch}${git_stats}${ahead_behind}${stash_info}${conflict_info}"
    else
      git_info="  ${git_icon} ${branch}"
    fi
  fi
fi

# ============================================================================
# Language Versions (Smart Detection - Only show if project uses them)
# ============================================================================
version_info=""

# Check for .tool-versions in current directory
tool_versions_file="${cwd}/.tool-versions"

# Detect which languages/runtimes are actually used in this project
uses_node=false
uses_php=false
uses_go=false
uses_python=false
uses_rust=false
uses_ruby=false
uses_java=false

# Detection based on project files
[[ -f "${cwd}/package.json" || -f "${cwd}/package-lock.json" || -f "${cwd}/yarn.lock" || -f "${cwd}/bun.lockb" ]] && uses_node=true
[[ -f "${cwd}/composer.json" || -f "${cwd}/composer.lock" ]] && uses_php=true
[[ -f "${cwd}/go.mod" || -f "${cwd}/go.sum" ]] && uses_go=true
[[ -f "${cwd}/requirements.txt" || -f "${cwd}/Pipfile" || -f "${cwd}/pyproject.toml" || -f "${cwd}/setup.py" ]] && uses_python=true
[[ -f "${cwd}/Cargo.toml" || -f "${cwd}/Cargo.lock" ]] && uses_rust=true
[[ -f "${cwd}/Gemfile" || -f "${cwd}/Gemfile.lock" ]] && uses_ruby=true
[[ -f "${cwd}/pom.xml" || -f "${cwd}/build.gradle" || -f "${cwd}/build.gradle.kts" ]] && uses_java=true

# Or check .tool-versions
[[ -f "$tool_versions_file" ]] && {
  grep -q "^nodejs" "$tool_versions_file" && uses_node=true
  grep -q "^php" "$tool_versions_file" && uses_php=true
  grep -q "^golang" "$tool_versions_file" && uses_go=true
  grep -q "^python" "$tool_versions_file" && uses_python=true
  grep -q "^rust" "$tool_versions_file" && uses_rust=true
  grep -q "^ruby" "$tool_versions_file" && uses_ruby=true
  grep -q "^java" "$tool_versions_file" && uses_java=true
}

# Node.js (only if used)
if [ "$STATUSLINE_VERSIONS_ENABLED" = "true" ] && [ "$STATUSLINE_NODE" = "true" ] && [ "$uses_node" = true ]; then
  node_ver=""
  if [ -f "$tool_versions_file" ] && grep -q "^nodejs" "$tool_versions_file"; then
    node_ver=$(grep "^nodejs" "$tool_versions_file" | awk '{print $2}')
  elif command -v node &> /dev/null; then
    node_ver=$(node --version 2>/dev/null | sed 's/v//')
  fi
  [[ -n "$node_ver" ]] && version_info="${version_info}  ${node_icon} ${node_ver}"
fi

# PHP (only if used)
if [ "$STATUSLINE_VERSIONS_ENABLED" = "true" ] && [ "$STATUSLINE_PHP" = "true" ] && [ "$uses_php" = true ]; then
  php_ver=""
  if [ -f "$tool_versions_file" ] && grep -q "^php" "$tool_versions_file"; then
    php_ver=$(grep "^php" "$tool_versions_file" | awk '{print $2}')
  elif command -v php &> /dev/null; then
    php_ver=$(php -v 2>/dev/null | head -n1 | awk '{print $2}' | cut -d'.' -f1,2)
  fi
  [[ -n "$php_ver" ]] && version_info="${version_info}  ${php_icon} ${php_ver}"
fi

# Go (only if used)
if [ "$STATUSLINE_VERSIONS_ENABLED" = "true" ] && [ "$STATUSLINE_GO" = "true" ] && [ "$uses_go" = true ]; then
  go_ver=""
  if [ -f "$tool_versions_file" ] && grep -q "^golang" "$tool_versions_file"; then
    go_ver=$(grep "^golang" "$tool_versions_file" | awk '{print $2}')
  elif command -v go &> /dev/null; then
    go_ver=$(go version 2>/dev/null | awk '{print $3}' | sed 's/go//' | cut -d'.' -f1,2)
  fi
  [[ -n "$go_ver" ]] && version_info="${version_info}  ${go_icon} ${go_ver}"
fi

# Python (only if used)
if [ "$STATUSLINE_VERSIONS_ENABLED" = "true" ] && [ "$STATUSLINE_PYTHON" = "true" ] && [ "$uses_python" = true ]; then
  python_ver=""
  if [ -f "$tool_versions_file" ] && grep -q "^python" "$tool_versions_file"; then
    python_ver=$(grep "^python" "$tool_versions_file" | awk '{print $2}')
  elif command -v python3 &> /dev/null; then
    python_ver=$(python3 --version 2>/dev/null | awk '{print $2}' | cut -d'.' -f1,2)
  fi
  [[ -n "$python_ver" ]] && version_info="${version_info}  ${python_icon} ${python_ver}"
fi

# Rust (only if used)
if [ "$STATUSLINE_VERSIONS_ENABLED" = "true" ] && [ "$STATUSLINE_RUST" = "true" ] && [ "$uses_rust" = true ]; then
  rust_ver=""
  if [ -f "$tool_versions_file" ] && grep -q "^rust" "$tool_versions_file"; then
    rust_ver=$(grep "^rust" "$tool_versions_file" | awk '{print $2}')
  elif command -v rustc &> /dev/null; then
    rust_ver=$(rustc --version 2>/dev/null | awk '{print $2}' | cut -d'.' -f1,2)
  fi
  [[ -n "$rust_ver" ]] && version_info="${version_info}  ${rust_icon} ${rust_ver}"
fi

# Ruby (only if used)
if [ "$STATUSLINE_VERSIONS_ENABLED" = "true" ] && [ "$STATUSLINE_RUBY" = "true" ] && [ "$uses_ruby" = true ]; then
  ruby_ver=""
  if [ -f "$tool_versions_file" ] && grep -q "^ruby" "$tool_versions_file"; then
    ruby_ver=$(grep "^ruby" "$tool_versions_file" | awk '{print $2}')
  elif command -v ruby &> /dev/null; then
    ruby_ver=$(ruby --version 2>/dev/null | awk '{print $2}' | cut -d'.' -f1,2)
  fi
  [[ -n "$ruby_ver" ]] && version_info="${version_info}  ${ruby_icon} ${ruby_ver}"
fi

# Java (only if used)
if [ "$STATUSLINE_VERSIONS_ENABLED" = "true" ] && [ "$STATUSLINE_JAVA" = "true" ] && [ "$uses_java" = true ]; then
  java_ver=""
  if [ -f "$tool_versions_file" ] && grep -q "^java" "$tool_versions_file"; then
    java_ver=$(grep "^java" "$tool_versions_file" | awk '{print $2}')
  elif command -v java &> /dev/null; then
    java_ver=$(java -version 2>&1 | head -n1 | awk -F '"' '{print $2}' | cut -d'.' -f1,2)
  fi
  [[ -n "$java_ver" ]] && version_info="${version_info}  ${java_icon} ${java_ver}"
fi

# ============================================================================
# Docker & Kubernetes Integration
# ============================================================================
docker_k8s_info=""

# Docker - Check for running containers
if [ "$STATUSLINE_DOCKER" = "true" ] && command -v docker &> /dev/null; then
  docker_count=$(docker ps -q 2>/dev/null | wc -l | tr -d ' ')
  [[ "$docker_count" -gt 0 ]] && docker_k8s_info="${docker_k8s_info}  ${docker_icon} ${docker_count}"
fi

# Kubernetes - Show current context (only if cluster is accessible)
if [ "$STATUSLINE_KUBERNETES" = "true" ] && command -v kubectl &> /dev/null; then
  k8s_context=$(kubectl config current-context 2>/dev/null)
  if [ -n "$k8s_context" ]; then
    # Verify cluster is actually accessible (quick check with 1s timeout)
    # Use timeout command if available, otherwise skip verification
    if command -v timeout &> /dev/null; then
      if timeout 1s kubectl cluster-info 2>/dev/null | grep -q "is running"; then
        # Abbreviate context name based on config
        if [ ${#k8s_context} -gt "$STATUSLINE_K8S_MAX_LENGTH" ]; then
          trim_len=$((STATUSLINE_K8S_MAX_LENGTH - 3))
          k8s_context="${k8s_context:0:$trim_len}..."
        fi
        docker_k8s_info="${docker_k8s_info}  ${k8s_icon} ${k8s_context}"
      fi
    else
      # macOS: use perl-based timeout alternative
      if perl -e 'alarm 1; exec @ARGV' kubectl cluster-info 2>/dev/null | grep -q "is running"; then
        if [ ${#k8s_context} -gt "$STATUSLINE_K8S_MAX_LENGTH" ]; then
          trim_len=$((STATUSLINE_K8S_MAX_LENGTH - 3))
          k8s_context="${k8s_context:0:$trim_len}..."
        fi
        docker_k8s_info="${docker_k8s_info}  ${k8s_icon} ${k8s_context}"
      fi
    fi
  fi
fi

# ============================================================================
# Token Usage + Burn Rate + Input/Output (ccusage blocks --active)
# ============================================================================
token_info=""
if [ "$STATUSLINE_TOKENS_ENABLED" = "true" ] && command -v bunx &> /dev/null; then
  ccusage_output=$(bunx ccusage@latest blocks --active --compact 2>/dev/null)

  if [ -n "$ccusage_output" ]; then
    # Extract all needed info
    input_tokens=$(echo "$ccusage_output" | grep "Input Tokens:" | grep -oE '[0-9,]+' | tr -d ',' | head -1)
    output_tokens=$(echo "$ccusage_output" | grep "Output Tokens:" | grep -oE '[0-9,]+' | tr -d ',' | head -1)
    burn_rate_raw=$(echo "$ccusage_output" | grep "Tokens/minute:" | grep -oE '[0-9,]+\.[0-9]+' | tr -d ',' | head -1)
    total_cost=$(echo "$ccusage_output" | grep "Total Cost:" | grep -oE '\$[0-9]+\.[0-9]+' | head -1)
    time_remaining=$(echo "$ccusage_output" | grep "Time Remaining:" | sed 's/.*Time Remaining: *//' | awk '{print $1, $2}')

    # Format burn rate (195380.66 -> 195k)
    if [ -n "$burn_rate_raw" ]; then
      burn_k=$(echo "$burn_rate_raw" | awk '{printf "%.0fk", $1/1000}')
    fi

    # Build token info
    # Format:  in/out • 195k tok/min • $3.81 • ⏳ 4h 2m
    if [ "$STATUSLINE_SHOW_INPUT_OUTPUT" = "true" ] && [ -n "$input_tokens" ] && [ -n "$output_tokens" ]; then
      token_info="  ${token_icon} ${in_icon}${input_tokens} ${out_icon}${output_tokens}"
    fi

    if [ "$STATUSLINE_SHOW_BURN_RATE" = "true" ] && [ -n "$burn_k" ]; then
      token_info="${token_info} • ${burn_icon} ${burn_k} tok/min"
    fi

    if [ "$STATUSLINE_SHOW_COST" = "true" ] && [ -n "$total_cost" ]; then
      token_info="${token_info} • ${total_cost}"
    fi

    if [ "$STATUSLINE_SHOW_TIME_REMAINING" = "true" ] && [ -n "$time_remaining" ]; then
      token_info="${token_info} • ${remaining_icon} ${time_remaining}"
    fi
  fi
fi

# ============================================================================
# Date & Time
# ============================================================================
datetime_info=""
if [ "$STATUSLINE_SHOW_DATE" = "true" ]; then
  current_date=$(date "+${STATUSLINE_DATE_FORMAT}")
  datetime_info="  ${calendar_icon} ${current_date}"
fi

if [ "$STATUSLINE_SHOW_TIME" = "true" ]; then
  current_time=$(date "+${STATUSLINE_TIME_FORMAT}")
  datetime_info="${datetime_info} ${time_icon} ${current_time}"
fi

# ============================================================================
# Build Status Line WITH COLORS
# ============================================================================
# Format: ◉ Claude 4.5  ⌂ ~/path  ⎇ branch  versions  tokens • burn • date time
output=""

# Model name
if [ "$STATUSLINE_SHOW_MODEL" = "true" ] && [ -n "$model_display" ]; then
  output="${output}${STATUSLINE_COLOR_MODEL}${model_icon} ${model_display}${COLOR_RESET}  "
fi

# Path
if [ "$STATUSLINE_SHOW_PATH" = "true" ]; then
  output="${output}${STATUSLINE_COLOR_PATH}${folder_icon} ${dir_path}${COLOR_RESET}"
fi

# Git (with dynamic color based on status)
if [ -n "$git_info" ]; then
  # Choose color based on git status
  git_color="$STATUSLINE_COLOR_GIT_BRANCH"

  # If conflict, use conflict color
  if [[ "$conflict_info" == *"CONFLICT"* ]]; then
    git_color="$STATUSLINE_COLOR_GIT_CONFLICT"
  # If dirty (has changes), use dirty color
  elif [[ -n "$git_stats" ]] || [[ -n "$ahead_behind" ]] || [[ -n "$stash_info" ]]; then
    git_color="$STATUSLINE_COLOR_GIT_DIRTY"
  # If clean, use clean color
  else
    git_color="$STATUSLINE_COLOR_GIT_CLEAN"
  fi

  output="${output}${git_color}${git_info}${COLOR_RESET}"
fi

# Versions
if [ -n "$version_info" ]; then
  output="${output}${STATUSLINE_COLOR_VERSION}${version_info}${COLOR_RESET}"
fi

# Docker & Kubernetes
if [ -n "$docker_k8s_info" ]; then
  # Apply colors to docker and k8s separately
  colored_docker_k8s=""
  if [[ "$docker_k8s_info" == *"$docker_icon"* ]]; then
    docker_part=$(echo "$docker_k8s_info" | grep -oE "${docker_icon}[^${k8s_icon}]*")
    colored_docker_k8s="${colored_docker_k8s}${STATUSLINE_COLOR_DOCKER}${docker_part}${COLOR_RESET}"
  fi
  if [[ "$docker_k8s_info" == *"$k8s_icon"* ]]; then
    k8s_part=$(echo "$docker_k8s_info" | grep -oE "${k8s_icon}.*")
    colored_docker_k8s="${colored_docker_k8s}  ${STATUSLINE_COLOR_K8S}${k8s_part}${COLOR_RESET}"
  fi
  output="${output}${colored_docker_k8s}"
fi

# Tokens + Burn Rate (with dynamic colors)
if [ -n "$token_info" ]; then
  # Apply dynamic colors to each component
  colored_token_info="$token_info"

  # Get dynamic colors if functions are available
  if type get_token_color &>/dev/null && [ -n "$input_tokens" ] && [ -n "$output_tokens" ]; then
    total_tokens=$((input_tokens + output_tokens))
    token_color_dynamic=$(get_token_color "$total_tokens" 200000)
    # Replace token icon with dynamically colored version
    colored_token_info=$(echo "$token_info" | sed "s|${token_icon}|${token_color_dynamic}${token_icon}${COLOR_RESET}|")
  fi

  if type get_burn_rate_color &>/dev/null && [ -n "$burn_k" ]; then
    burn_color_dynamic=$(get_burn_rate_color "$burn_k")
    # Color the burn rate part
    colored_token_info=$(echo "$colored_token_info" | sed "s|${burn_icon} ${burn_k}|${burn_color_dynamic}${burn_icon} ${burn_k}${COLOR_RESET}|")
  fi

  if type get_cost_color &>/dev/null && [ -n "$total_cost" ]; then
    cost_value=$(echo "$total_cost" | tr -d '$')
    cost_color_dynamic=$(get_cost_color "$cost_value")
    # Color the cost part
    colored_token_info=$(echo "$colored_token_info" | sed "s|${total_cost}|${cost_color_dynamic}${total_cost}${COLOR_RESET}|")
  fi

  if type get_time_color &>/dev/null && [ -n "$time_remaining" ]; then
    # Extract minutes from time_remaining (format: "4h 2m" or "45m")
    hours=$(echo "$time_remaining" | grep -oE '[0-9]+h' | tr -d 'h')
    minutes=$(echo "$time_remaining" | grep -oE '[0-9]+m' | tr -d 'm')
    total_minutes=$((${hours:-0} * 60 + ${minutes:-0}))
    time_color_dynamic=$(get_time_color "$total_minutes")
    # Color the time remaining part
    colored_token_info=$(echo "$colored_token_info" | sed "s|${remaining_icon} ${time_remaining}|${time_color_dynamic}${remaining_icon} ${time_remaining}${COLOR_RESET}|")
  fi

  output="${output}${colored_token_info}"
fi

# Date & Time
if [ -n "$datetime_info" ]; then
  output="${output}${STATUSLINE_COLOR_DATETIME}${datetime_info}${COLOR_RESET}"
fi

printf "%s" "$output"
