#!/bin/bash
# Configuration validation script

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

SKILL_DIR="$HOME/.claude/skills/changelog-generator"
ERRORS=0

echo "🔍 Configuration Validation"
echo "==========================="
echo ""

# Check if jq is available for JSON validation
JQ_AVAILABLE=false
if command -v jq &> /dev/null; then
  JQ_AVAILABLE=true
fi

# Validate a JSON file
validate_json() {
  local file=$1
  local name=$2

  if [ ! -f "$file" ]; then
    echo -e "${RED}❌ $name: File not found${NC}"
    ((ERRORS++))
    return 1
  fi

  if [ "$JQ_AVAILABLE" = true ]; then
    if jq empty "$file" 2>/dev/null; then
      echo -e "${GREEN}✅ $name: Valid JSON${NC}"
      return 0
    else
      echo -e "${RED}❌ $name: Invalid JSON syntax${NC}"
      jq empty "$file" 2>&1 | head -n 5
      ((ERRORS++))
      return 1
    fi
  else
    echo -e "${YELLOW}⚠️  $name: Cannot validate (jq not installed)${NC}"
    return 0
  fi
}

# Validate changelog_config.json
echo "📄 Validating configuration files..."
echo ""

validate_json "$SKILL_DIR/config/changelog_config.json" "changelog_config.json"

# Check required fields in changelog_config
if [ "$JQ_AVAILABLE" = true ] && [ -f "$SKILL_DIR/config/changelog_config.json" ]; then
  REQUIRED_FIELDS=(".branches.default_base" ".branches.default_compare" ".output.dir" ".output.client_subdir")

  for field in "${REQUIRED_FIELDS[@]}"; do
    VALUE=$(jq -r "$field" "$SKILL_DIR/config/changelog_config.json" 2>/dev/null)
    if [ "$VALUE" = "null" ] || [ -z "$VALUE" ]; then
      echo -e "${RED}❌ changelog_config.json: Missing required field $field${NC}"
      ((ERRORS++))
    fi
  done
fi

echo ""

# Validate exclusions.json
validate_json "$SKILL_DIR/config/exclusions.json" "exclusions.json"

# Check course_weeks format
if [ "$JQ_AVAILABLE" = true ] && [ -f "$SKILL_DIR/config/exclusions.json" ]; then
  COURSE_WEEKS=$(jq -r '.course_weeks | length' "$SKILL_DIR/config/exclusions.json" 2>/dev/null)
  if [ "$COURSE_WEEKS" != "null" ]; then
    echo -e "${GREEN}✅ exclusions.json: $COURSE_WEEKS course weeks configured${NC}"
  fi
fi

echo ""

# Validate translation_rules.json
validate_json "$SKILL_DIR/config/translation_rules.json" "translation_rules.json"

echo ""

# Check Git repository (if running in project directory)
echo "📊 Environment check..."
echo ""

if [ -d ".git" ]; then
  echo -e "${GREEN}✅ Git repository detected${NC}"

  # Check default branches exist
  if git rev-parse --verify main >/dev/null 2>&1; then
    echo -e "${GREEN}✅ main branch exists${NC}"
  else
    echo -e "${YELLOW}⚠️  main branch not found${NC}"
  fi

  if git rev-parse --verify dev >/dev/null 2>&1; then
    echo -e "${GREEN}✅ dev branch exists${NC}"
  else
    echo -e "${YELLOW}⚠️  dev branch not found (not critical if using custom branches)${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  Not in a Git repository${NC}"
  echo "   (This is OK if running in skill directory)"
fi

echo ""

# Check GitHub token if GitHub integration is enabled
if [ "$JQ_AVAILABLE" = true ] && [ -f "$SKILL_DIR/config/changelog_config.json" ]; then
  GITHUB_ENABLED=$(jq -r '.github.enabled' "$SKILL_DIR/config/changelog_config.json" 2>/dev/null)
  TOKEN_ENV_VAR=$(jq -r '.github.token_env_var' "$SKILL_DIR/config/changelog_config.json" 2>/dev/null)

  if [ "$GITHUB_ENABLED" = "true" ]; then
    echo "🔑 GitHub integration check..."
    echo ""

    TOKEN_VALUE=$(eval echo \$$TOKEN_ENV_VAR)
    if [ -z "$TOKEN_VALUE" ]; then
      echo -e "${YELLOW}⚠️  GitHub token not configured${NC}"
      echo "   Set $TOKEN_ENV_VAR environment variable:"
      echo "   export $TOKEN_ENV_VAR='your_token_here'"
      echo ""
      echo "   Without token, GitHub enrichment will be skipped"
    else
      echo -e "${GREEN}✅ GitHub token configured ($TOKEN_ENV_VAR)${NC}"

      # Test GitHub API access (optional)
      if command -v curl &> /dev/null; then
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
          -H "Authorization: token $TOKEN_VALUE" \
          https://api.github.com/user)

        if [ "$HTTP_CODE" = "200" ]; then
          echo -e "${GREEN}✅ GitHub token valid (API accessible)${NC}"
        elif [ "$HTTP_CODE" = "401" ]; then
          echo -e "${RED}❌ GitHub token invalid (authentication failed)${NC}"
          ((ERRORS++))
        else
          echo -e "${YELLOW}⚠️  GitHub API returned HTTP $HTTP_CODE${NC}"
        fi
      fi
    fi
  fi
fi

echo ""

# Check binary exists
echo "🔨 Binary check..."
echo ""

if [ -f "$SKILL_DIR/bin/changelog-generator" ]; then
  echo -e "${GREEN}✅ changelog-generator binary exists${NC}"

  if [ -x "$SKILL_DIR/bin/changelog-generator" ]; then
    echo -e "${GREEN}✅ Binary is executable${NC}"
  else
    echo -e "${YELLOW}⚠️  Binary is not executable (fixing...)${NC}"
    chmod +x "$SKILL_DIR/bin/changelog-generator"
    echo -e "${GREEN}✅ Fixed${NC}"
  fi
else
  echo -e "${RED}❌ changelog-generator binary not found${NC}"
  echo "   Run: bash $SKILL_DIR/scripts/setup.sh"
  ((ERRORS++))
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ All validations passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Validation failed with $ERRORS error(s)${NC}"
  exit 1
fi
