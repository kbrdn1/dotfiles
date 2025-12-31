#!/usr/bin/env bash
#
# Claude Code Status Line - Enhanced with Nerd Fonts & ccusage
# Modern UI with rich icons and token usage tracking
#

# Read JSON input from stdin
input=$(cat)

# Extract current directory from JSON input
cwd=$(echo "$input" | jq -r '.workspace.current_dir // .cwd')

# =========================[ OS Icon ]=========================
os_icon="󰀵"  # Nerd Font: OS icon
if [[ "$OSTYPE" == "darwin"* ]]; then
  os_icon=""  # macOS icon
elif [[ "$OSTYPE" == "linux"* ]]; then
  os_icon=""  # Linux icon
fi

# =========================[ Directory ]=========================
dir_name=$(basename "$cwd")

# =========================[ Git/VCS Status ]=========================
git_info=""
if git -C "$cwd" rev-parse --git-dir > /dev/null 2>&1; then
  # Get current branch (skip optional locks for speed)
  branch=$(git -C "$cwd" --no-optional-locks branch --show-current 2>/dev/null || echo "detached")

  # Check for changes (porcelain format, skip locks)
  if [[ -n $(git -C "$cwd" --no-optional-locks status --porcelain 2>/dev/null) ]]; then
    git_status=""  # Has changes (Nerd Font modified icon)
  else
    git_status=""  # Clean (Nerd Font check icon)
  fi

  git_info="  ${branch} ${git_status}"
fi

# =========================[ Token Usage via ccusage ]=========================
token_info=""
if command -v bunx &> /dev/null; then
  ccusage_output=$(bunx ccusage 2>/dev/null)
  if [[ $? -eq 0 && -n "$ccusage_output" ]]; then
    # Parse ccusage output to extract token usage percentage
    # Assuming format like "48262/200000 (24.1%)"
    usage=$(echo "$ccusage_output" | grep -oE '[0-9]+\.[0-9]+%|[0-9]+%' | head -1)
    if [[ -n "$usage" ]]; then
      token_info=" 󱫋 ${usage}"  # Nerd Font: memory/usage icon
    fi
  fi
fi

# =========================[ Context: user@hostname ]=========================
context="󰀄 $(whoami)@$(hostname -s)"  # Nerd Font: user icon

# =========================[ Version Information ]=========================
versions=""

# Node.js version
if command -v node &> /dev/null; then
  node_ver=$(node --version 2>/dev/null | sed 's/v//')
  if [[ -n "$node_ver" ]]; then
    versions="${versions}  ${node_ver}"  # Nerd Font: Node.js logo
  fi
fi

# PHP version (matching your Herd setup)
if command -v php &> /dev/null; then
  php_ver=$(php -v 2>/dev/null | head -n1 | awk '{print $2}' | cut -d'.' -f1,2)
  if [[ -n "$php_ver" ]]; then
    versions="${versions}  ${php_ver}"  # Nerd Font: PHP logo
  fi
fi

# Go version
if command -v go &> /dev/null; then
  go_ver=$(go version 2>/dev/null | awk '{print $3}' | sed 's/go//')
  if [[ -n "$go_ver" ]]; then
    versions="${versions}  ${go_ver}"  # Nerd Font: Go gopher
  fi
fi

# Python version
if command -v python3 &> /dev/null; then
  py_ver=$(python3 --version 2>/dev/null | awk '{print $2}' | cut -d'.' -f1,2)
  if [[ -n "$py_ver" ]]; then
    versions="${versions}  ${py_ver}"  # Nerd Font: Python logo
  fi
fi

# =========================[ Build Status Line ]=========================
# Format: os_icon dir git_info token_info │ context versions
# Enhanced with better separators and Nerd Font icons
printf "%s  %s%s%s │ %s%s" "$os_icon" "$dir_name" "$git_info" "$token_info" "$context" "$versions"
