#!/bin/bash

# Generate git log for a specific branch
# Usage: ./generate_git_log.sh <branch-name> [limit] [output-file]
# Example: ./generate_git_log.sh main 10 git-log.txt

# Define colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
OUTPUT_FILE="git-log.txt"
PROJECT_ROOT="${ZED_WORKTREE_ROOT:-$(pwd)}"

# Display usage information
show_usage() {
  echo -e "${BLUE}Usage:${NC} $0 <branch-name> [limit] [output-file]"
  echo -e "${BLUE}Example:${NC} $0 main 10 changelog.txt"
  exit 1
}

# Function to validate branch name
validate_branch() {
  local branch="$1"
  if [ -z "$branch" ]; then
    echo -e "${RED}Error: Please provide a branch name${NC}"
    show_usage
  fi

  if ! git show-ref --verify --quiet refs/heads/$branch; then
    echo -e "${RED}Error: Branch '$branch' does not exist${NC}"
    exit 1
  fi

  echo -e "${GREEN}Using branch: ${branch}${NC}" >&2
}

# Function to set limit parameter
set_limit_param() {
  local limit_value="$1"
  local limit_param=""

  if [ ! -z "$limit_value" ] && [[ "$limit_value" =~ ^[0-9]+$ ]]; then
    limit_param="-n $limit_value"
    echo -e "${GREEN}Limiting to $limit_value commits${NC}" >&2
  else
    echo -e "${YELLOW}No limit specified, showing all commits${NC}" >&2
  fi

  echo "$limit_param"
}

# Function to get git log
get_git_log() {
  local branch_name="$1"
  local limit_param="$2"

  git log $branch_name $limit_param --pretty=format:"%h %ad %s %d [%an] <%ae>" --date=iso-strict
}

# Check if git is available
if ! command -v git &> /dev/null; then
  echo -e "${RED}Error: git is not installed or not in PATH${NC}"
  exit 1
fi

# Check if we're in a git repository
if ! git rev-parse --is-inside-work-tree &> /dev/null; then
  echo -e "${RED}Error: Not in a git repository${NC}"
  exit 1
fi

# Process arguments
if [ $# -lt 1 ]; then
  show_usage
fi

BRANCH="$1"
LIMIT=$(set_limit_param "$2")

# Set output file if provided
if [ ! -z "$3" ]; then
  OUTPUT_FILE="$3"
  echo -e "${GREEN}Output will be written to: $OUTPUT_FILE${NC}" >&2
fi

# Validate branch
validate_branch "$BRANCH"

# Get git log and write to file
echo -e "${BLUE}Generating git log...${NC}" >&2
get_git_log "$BRANCH" "$LIMIT" > "$OUTPUT_FILE"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}Git log successfully generated in $OUTPUT_FILE${NC}" >&2
else
  echo -e "${RED}Failed to generate git log${NC}" >&2
  exit 1
fi
