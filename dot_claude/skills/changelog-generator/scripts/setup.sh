#!/bin/bash
# Installation and setup script for changelog-generator

set -e

echo "🚀 Changelog Generator - Setup"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SKILL_DIR="$HOME/.claude/skills/changelog-generator"

# Change to skill directory
cd "$SKILL_DIR" || {
  echo -e "${RED}❌ Skill directory not found: $SKILL_DIR${NC}"
  exit 1
}

echo -e "${BLUE}📁 Working directory: $SKILL_DIR${NC}"
echo ""

# Check prerequisites
echo "🔍 Checking prerequisites..."

# Check Go installation
if ! command -v go &> /dev/null; then
  echo -e "${RED}❌ Go is not installed${NC}"
  echo "   Please install Go 1.22 or higher from https://go.dev/dl/"
  exit 1
else
  GO_VERSION=$(go version | awk '{print $3}')
  echo -e "${GREEN}✅ Go installed: $GO_VERSION${NC}"
fi

# Check Git installation
if ! command -v git &> /dev/null; then
  echo -e "${RED}❌ Git is not installed${NC}"
  exit 1
else
  GIT_VERSION=$(git --version)
  echo -e "${GREEN}✅ Git installed: $GIT_VERSION${NC}"
fi

echo ""

# Initialize Go module
echo "📦 Installing Go dependencies..."

if [ ! -f "go.sum" ]; then
  echo "   Running go mod download..."
  go mod download
else
  echo "   Dependencies already downloaded"
fi

# Tidy up dependencies
echo "   Running go mod tidy..."
go mod tidy

echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Build the binary
echo "🔨 Building changelog-generator..."

go build -o bin/changelog-generator cmd/changelog-generator/main.go

if [ -f "bin/changelog-generator" ]; then
  echo -e "${GREEN}✅ Binary built successfully: bin/changelog-generator${NC}"

  # Make it executable
  chmod +x bin/changelog-generator
else
  echo -e "${RED}❌ Build failed${NC}"
  exit 1
fi

echo ""

# Validate configuration files
echo "🔍 Validating configuration files..."

CONFIG_FILES=(
  "config/changelog_config.json"
  "config/exclusions.json"
  "config/translation_rules.json"
)

ALL_CONFIGS_OK=true

for config in "${CONFIG_FILES[@]}"; do
  if [ -f "$config" ]; then
    # Validate JSON syntax
    if command -v jq &> /dev/null; then
      if jq empty "$config" 2>/dev/null; then
        echo -e "${GREEN}✅ $config${NC}"
      else
        echo -e "${RED}❌ $config - Invalid JSON syntax${NC}"
        ALL_CONFIGS_OK=false
      fi
    else
      echo -e "${YELLOW}⚠️  $config (jq not available, skipping validation)${NC}"
    fi
  else
    echo -e "${RED}❌ $config - File not found${NC}"
    ALL_CONFIGS_OK=false
  fi
done

echo ""

# Check if running in a Git repository (for testing)
echo "📊 Environment check..."

if [ -d ".git" ]; then
  echo -e "${YELLOW}⚠️  Skill directory is a Git repository (not recommended)${NC}"
  echo "   This is fine for development, but users should run this in their project directories"
else
  echo -e "${GREEN}✅ Skill directory is clean (not a Git repository)${NC}"
fi

echo ""

# Installation summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 Installation complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$ALL_CONFIGS_OK" = true ]; then
  echo -e "${GREEN}✅ All validations passed${NC}"
else
  echo -e "${YELLOW}⚠️  Some configuration issues detected${NC}"
  echo "   Review the errors above and fix configuration files"
fi

echo ""
echo "📚 Next steps:"
echo ""
echo "1. Test the installation:"
echo "   cd $SKILL_DIR"
echo "   ./bin/changelog-generator validate"
echo ""
echo "2. Configure GitHub token (optional):"
echo "   export GITHUB_TOKEN='your_token_here'"
echo ""
echo "3. Use in your project:"
echo "   cd /your/project"
echo "   $SKILL_DIR/bin/changelog-generator generate --version v1.0.0"
echo ""
echo "4. Or add to PATH:"
echo "   echo 'export PATH=\"\$PATH:$SKILL_DIR/bin\"' >> ~/.zshrc"
echo "   source ~/.zshrc"
echo "   # Then use anywhere: changelog-generator generate --version v1.0.0"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "For help:"
echo "  ./bin/changelog-generator --help"
echo "  ./bin/changelog-generator generate --help"
echo ""
