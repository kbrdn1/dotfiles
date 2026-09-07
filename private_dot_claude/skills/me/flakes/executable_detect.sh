#!/usr/bin/env bash
# ═══════════════════════════════════════════════════
# flakes - Project development environment detector
# Usage: detect.sh [init|show|update] [--empty|--light|--verbose]
# ═══════════════════════════════════════════════════
set -uo pipefail

ACTION="show"
VERBOSITY="--light"

for arg in "$@"; do
  case "$arg" in
    --empty|--light|--verbose) VERBOSITY="$arg" ;;
    init|update|show) ACTION="$arg" ;;
  esac
done

# --empty = silence totale
[[ "$VERBOSITY" == "--empty" ]] && exit 0

# ── Helpers ───────────────────────────────────────

get_version() {
  local cmd="$1"
  command -v "$cmd" &>/dev/null && {
    "$cmd" --version 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -1
  } || echo ""
}

line() {
  local emoji="$1" name="$2" version="$3"
  if [[ -n "$version" ]]; then
    printf "%s %s: %s\n" "$emoji" "$name" "$version"
  else
    printf "%s %s\n" "$emoji" "$name"
  fi
}

hint() {
  [[ "$VERBOSITY" != "--verbose" ]] && return
  for cmd in "$@"; do
    printf "   \033[2m$ %s\033[0m\n" "$cmd"
  done
}

has() { [[ -f "$1" ]]; }

has_any() {
  for f in "$@"; do [[ -f "$f" ]] && return 0; done
  return 1
}

FOUND=0
inc() { FOUND=$((FOUND + 1)); }

# ── Header ────────────────────────────────────────

case "$ACTION" in
  init)   printf "\n🔍 Scanning project environment...\n\n" ;;
  update) printf "\n🔄 Refreshing environment info...\n\n" ;;
  show)   printf "\n📋 Project stack\n\n" ;;
esac

# ═══════════════════════════════════════════════════
# LANGUAGES & RUNTIMES
# ═══════════════════════════════════════════════════

# Node.js
if has package.json && command -v node &>/dev/null; then
  v=$(node --version 2>/dev/null | tr -d 'v')
  line "🟢" "node" "$v"
  hint "node --version" "npx <cmd>"
  inc
fi

# Bun
if has_any bun.lockb bun.lock && command -v bun &>/dev/null; then
  v=$(bun --version 2>/dev/null)
  line "🍞" "bun" "$v"
  hint "bun --version" "bun run <script>" "bunx <cmd>"
  inc
fi

# Deno
if has_any deno.json deno.jsonc && command -v deno &>/dev/null; then
  v=$(deno --version 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  line "🦕" "deno" "$v"
  hint "deno --version" "deno task <name>" "deno run <file>"
  inc
fi

# Python
if has_any pyproject.toml setup.py requirements.txt Pipfile; then
  v=$(python3 --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || \
      python --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "")
  line "🐍" "python" "$v"
  hint "python3 --version" "pip install -r requirements.txt"
  inc
fi

# Rust
_rust_detected=false
if has Cargo.toml || has_any rust-toolchain.toml rust-toolchain; then
  _rust_detected=true
elif ls */Cargo.toml */*/Cargo.toml 2>/dev/null | head -1 | grep -q .; then
  _rust_detected=true
elif grep -rlq '\.rs"$\|\.rs[[:space:]]\|cargo ' Makefile makefile GNUmakefile Justfile justfile 2>/dev/null; then
  _rust_detected=true
fi
if [[ "$_rust_detected" == true ]] && command -v rustc &>/dev/null; then
  v=$(rustc --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "")
  line "🦀" "rust" "$v"
  hint "rustc --version" "cargo build" "cargo run" "cargo test"
  inc
fi

# Go
if has go.mod; then
  v=$(go version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' || echo "")
  line "🐹" "go" "$v"
  hint "go version" "go build" "go run ." "go test ./..."
  inc
fi

# PHP
if has composer.json; then
  v=$(php --version 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "")
  line "🐘" "php" "$v"
  hint "php --version" "php artisan" "composer install"
  inc
fi

# Ruby
if has Gemfile; then
  v=$(ruby --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "")
  line "💎" "ruby" "$v"
  hint "ruby --version" "bundle install" "rails server"
  inc
fi

# Java
if has_any pom.xml build.gradle build.gradle.kts; then
  v=$(java --version 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "")
  line "☕" "java" "$v"
  hint "java --version" "mvn clean install" "gradle build"
  inc
fi

# .NET / C#
if has_any *.csproj *.sln *.fsproj 2>/dev/null; then
  v=$(dotnet --version 2>/dev/null || echo "")
  line "🟣" "dotnet" "$v"
  hint "dotnet build" "dotnet run" "dotnet test"
  inc
fi

# ═══════════════════════════════════════════════════
# PACKAGE MANAGERS
# ═══════════════════════════════════════════════════

if has package-lock.json; then
  v=$(npm --version 2>/dev/null || echo "")
  line "📦" "npm" "$v"
  hint "npm install" "npm run <script>" "npm outdated"
  inc
fi

if has pnpm-lock.yaml; then
  v=$(pnpm --version 2>/dev/null || echo "")
  line "📦" "pnpm" "$v"
  hint "pnpm install" "pnpm run <script>" "pnpm outdated"
  inc
fi

if has yarn.lock; then
  v=$(yarn --version 2>/dev/null || echo "")
  line "📦" "yarn" "$v"
  hint "yarn install" "yarn <script>" "yarn outdated"
  inc
fi

if has poetry.lock; then
  v=$(poetry --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "")
  line "📦" "poetry" "$v"
  hint "poetry install" "poetry add <dep>" "poetry shell"
  inc
elif has Pipfile.lock; then
  v=$(pipenv --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "")
  line "📦" "pipenv" "$v"
  hint "pipenv install" "pipenv shell"
  inc
fi

if has uv.lock; then
  v=$(uv --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "")
  line "📦" "uv" "$v"
  hint "uv sync" "uv add <dep>" "uv run <cmd>"
  inc
fi

if has composer.lock; then
  v=$(composer --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "")
  line "📦" "composer" "$v"
  hint "composer install" "composer require <dep>" "composer update"
  inc
fi

# ═══════════════════════════════════════════════════
# BUILD & TASK RUNNERS
# ═══════════════════════════════════════════════════

if has_any Makefile makefile GNUmakefile; then
  line "⚙️" "make" ""
  hint "make help" "make build" "make test"
  inc
fi

if has_any Justfile justfile; then
  v=$(just --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "")
  line "⚙️" "just" "$v"
  hint "just --list" "just <recipe>"
  inc
fi

if has_any Taskfile.yml Taskfile.yaml; then
  v=$(task --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "")
  line "⚙️" "task" "$v"
  hint "task --list" "task <name>"
  inc
fi

if has Dockerfile; then
  v=$(docker --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "")
  line "🐳" "docker" "$v"
  hint "docker build ." "docker compose up"
  inc
fi

if has_any docker-compose.yml docker-compose.yaml compose.yml compose.yaml; then
  line "🐳" "compose" ""
  hint "docker compose up -d" "docker compose down" "docker compose logs"
  inc
fi

if has turbo.json; then
  line "⚡" "turbo" ""
  hint "turbo run build" "turbo run test" "turbo run lint"
  inc
fi

if has nx.json; then
  line "🔷" "nx" ""
  hint "nx build" "nx test" "nx graph"
  inc
fi

if has Procfile; then
  line "📄" "procfile" ""
  hint "heroku local" "foreman start"
  inc
fi

if has_any Vagrantfile; then
  line "📦" "vagrant" ""
  hint "vagrant up" "vagrant ssh" "vagrant destroy"
  inc
fi

if has_any flake.nix shell.nix default.nix; then
  v=$(nix --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "")
  line "❄️" "nix" "$v"
  hint "nix develop" "nix build" "nix flake show"
  inc
fi

# ═══════════════════════════════════════════════════
# FRAMEWORKS & CONFIGS
# ═══════════════════════════════════════════════════

# JS/TS Frameworks
if has_any next.config.js next.config.ts next.config.mjs; then
  line "▲" "next.js" ""
  hint "next dev" "next build" "next start"
  inc
fi

if has_any nuxt.config.ts nuxt.config.js; then
  line "💚" "nuxt" ""
  hint "nuxt dev" "nuxt build" "nuxt generate"
  inc
fi

if has_any vite.config.ts vite.config.js vite.config.mjs; then
  line "⚡" "vite" ""
  hint "vite dev" "vite build" "vite preview"
  inc
fi

if has_any astro.config.mjs astro.config.ts; then
  line "🚀" "astro" ""
  hint "astro dev" "astro build" "astro preview"
  inc
fi

if has_any svelte.config.js svelte.config.ts; then
  line "🔥" "svelte" ""
  hint "svelte-kit dev" "svelte-kit build"
  inc
fi

if has angular.json; then
  line "🅰️" "angular" ""
  hint "ng serve" "ng build" "ng test"
  inc
fi

if has remix.config.js || has_any app/root.tsx app/root.jsx 2>/dev/null; then
  line "💿" "remix" ""
  hint "remix dev" "remix build"
  inc
fi

# PHP Frameworks
if has artisan; then
  line "🔴" "laravel" ""
  hint "php artisan serve" "php artisan migrate" "php artisan tinker"
  inc
fi

if has symfony.lock; then
  line "⚫" "symfony" ""
  hint "symfony serve" "php bin/console"
  inc
fi

# Tooling configs
if has tsconfig.json; then
  v=$(tsc --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "")
  line "📘" "typescript" "$v"
  hint "tsc --build" "tsc --watch"
  inc
fi

if has_any tailwind.config.js tailwind.config.ts tailwind.config.mjs tailwind.config.cjs; then
  line "🎨" "tailwind" ""
  hint "tailwindcss --watch"
  inc
fi

if has_any .eslintrc .eslintrc.js .eslintrc.cjs .eslintrc.json .eslintrc.yml eslint.config.js eslint.config.mjs eslint.config.cjs eslint.config.ts; then
  line "📏" "eslint" ""
  hint "eslint ." "eslint --fix ."
  inc
fi

if has_any .prettierrc .prettierrc.js .prettierrc.cjs .prettierrc.json .prettierrc.yaml .prettierrc.yml prettier.config.js prettier.config.mjs prettier.config.cjs; then
  line "💅" "prettier" ""
  hint "prettier --write ." "prettier --check ."
  inc
fi

if has biome.json; then
  v=$(biome --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "")
  line "🌿" "biome" "$v"
  hint "biome check ." "biome format ." "biome lint ."
  inc
fi

if has_any .env .env.local .env.example; then
  line "🔒" "dotenv" ""
  inc
fi

if has_any .github/workflows/*.yml .github/workflows/*.yaml 2>/dev/null; then
  line "🤖" "github-actions" ""
  inc
fi

if has_any .gitlab-ci.yml; then
  line "🦊" "gitlab-ci" ""
  inc
fi

# ── Footer ────────────────────────────────────────

if [[ "$FOUND" -eq 0 ]]; then
  printf "  \033[2mNo development tools detected in this directory.\033[0m\n"
fi

printf "\n"
