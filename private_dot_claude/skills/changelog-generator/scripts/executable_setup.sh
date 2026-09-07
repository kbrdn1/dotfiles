#!/bin/bash
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo -e "${YELLOW}changelog-generator setup${NC}"
echo "========================="

# check go
if ! command -v go &>/dev/null; then
  echo -e "${RED}go is not installed${NC}"
  echo "install: https://golang.org/doc/install"
  exit 1
fi
echo -e "${GREEN}go$(go version | awk '{print " "$3}')${NC}"

# check git
if ! command -v git &>/dev/null; then
  echo -e "${RED}git is not installed${NC}"
  exit 1
fi
echo -e "${GREEN}git ok${NC}"

# build
echo -e "${YELLOW}building...${NC}"
cd "$SKILL_DIR"
go build -o bin/changelog-generator ./cmd/changelog-generator
echo -e "${GREEN}binary: $SKILL_DIR/bin/changelog-generator${NC}"

# copy config template if not in project
if [ -n "${PROJECT_ROOT:-}" ] && [ ! -f "$PROJECT_ROOT/changelog.config.json" ]; then
  cp "$SKILL_DIR/config/changelog.config.json" "$PROJECT_ROOT/changelog.config.json"
  echo -e "${GREEN}config copied to $PROJECT_ROOT/changelog.config.json${NC}"
fi

echo ""
echo -e "${GREEN}setup complete${NC}"
echo ""
echo "usage:"
echo "  changelog-generator extract --base main --compare dev"
echo "  changelog-generator split --output-dir ./changelogs"
echo "  changelog-generator metrics"
echo "  changelog-generator generate --version v1.0.0"
