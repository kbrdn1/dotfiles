#!/usr/bin/env bash
# ═══════════════════════════════════════════════════
# flake.sh - Generate/update a Nix flake dev env from the detected project stack
# Usage: flake.sh [init|update] [--empty|--light|--verbose]
#   init    -> create flake.nix + .envrc (errors if flake.nix exists)
#   update  -> regenerate flake.nix from the current stack (keeps a .bak)
#   --empty   -> shellHook silencieux (PATH exports seulement)
#   --light   -> shellHook : résumé versions une ligne (défaut)
#   --verbose -> shellHook : bannière + versions + commandes
# ═══════════════════════════════════════════════════
set -uo pipefail

ACTION="init"
VERBOSITY="--light"
for arg in "$@"; do
  case "$arg" in
    --empty|--light|--verbose) VERBOSITY="$arg" ;;
    init|update) ACTION="$arg" ;;
  esac
done

FLAKE="flake.nix"
ENVRC=".envrc"

# ── Guards ────────────────────────────────────────
if [[ "$ACTION" == "init" && -f "$FLAKE" ]]; then
  printf "⚠️  %s existe déjà. Utilise 'update' pour le régénérer.\n" "$FLAKE"
  exit 1
fi
if [[ "$ACTION" == "update" && ! -f "$FLAKE" ]]; then
  printf "⚠️  Aucun %s à mettre à jour. Lance 'init' d'abord.\n" "$FLAKE"
  exit 1
fi

# ── Detection ─────────────────────────────────────

NAME=$(basename "$PWD")

HAS_PHP=false; HAS_NODE=false; HAS_BUN=false; HAS_COMPOSE=false; HAS_LARAVEL=false
PHP_ATTR=""; NODE_ATTR=""; DB_PKG=""

# PHP : contrainte composer.json (ce dont le projet a besoin) -> phpXY, sinon version locale.
# La contrainte du repo PRIME sur le PHP de l'hôte : un hôte plus récent que le plancher
# supporté (ex hôte 8.5 vs "php":"^8.3") casse composer (deps lockées <8.5, --ignore-platform-reqs
# obligatoire) ET la suite de tests DB. Le rôle de la flake est de fournir l'env que le projet
# déclare, pas de refléter le PHP installé sur la machine.
if [[ -f composer.json ]]; then
  HAS_PHP=true
  pv=$(grep -oE '"php"[[:space:]]*:[[:space:]]*"[^"]+"' composer.json | grep -oE '[0-9]+\.[0-9]+' | head -1)
  if [[ -z "$pv" ]]; then
    pv=$(php --version 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
  fi
  if [[ -n "$pv" ]]; then PHP_ATTR="php${pv//./}"; else PHP_ATTR="php"; fi
  [[ -f artisan ]] && HAS_LARAVEL=true
fi

# Node : nearest available nix LTS <= detected major
if [[ -f package.json ]]; then
  HAS_NODE=true
  nmaj=$(node --version 2>/dev/null | grep -oE '[0-9]+' | head -1)
  if [[ -z "$nmaj" ]]; then
    nmaj=$(grep -oE '"node"[[:space:]]*:[[:space:]]*"[^"]+"' package.json | grep -oE '[0-9]+' | head -1)
  fi
  [[ -z "$nmaj" ]] && nmaj=22
  closest=18
  for a in 18 20 22 24; do (( a <= nmaj )) && closest=$a; done
  NODE_ATTR="nodejs_${closest}"
fi

# Bun : lockfile, bunfig, ou packageManager "bun@…" dans package.json
if [[ -f bun.lockb || -f bun.lock || -f bunfig.toml ]]; then
  HAS_BUN=true
elif [[ -f package.json ]] && grep -qE '"packageManager"[[:space:]]*:[[:space:]]*"bun@' package.json; then
  HAS_BUN=true
fi

# Docker compose (glob : matche docker-compose.dev.yaml, .prod.yaml, compose.*.yaml…)
shopt -s nullglob
for f in docker-compose*.y*ml compose*.y*ml; do
  [[ -f "$f" ]] && HAS_COMPOSE=true
done
shopt -u nullglob

# DB : mariadb si l'image l'indique, sinon client mysql
if grep -RIlqE 'image:[[:space:]]*[^[:space:]]*mariadb' docker-compose*.y*ml compose*.y*ml 2>/dev/null; then
  DB_PKG="mariadb"
elif grep -RIlqE 'image:[[:space:]]*[^[:space:]]*mysql' docker-compose*.y*ml compose*.y*ml 2>/dev/null; then
  DB_PKG="mariadb.client"
elif [[ "$HAS_PHP" == true ]]; then
  DB_PKG="mariadb.client"
fi

# ── Fragments Nix ─────────────────────────────────

# bloc php = pkgs.phpXY.buildEnv { ... }  (uniquement si PHP)
PHP_LETBLOCK=""
PHP_INPUTS=""
if [[ "$HAS_PHP" == true && "$PHP_ATTR" != "php" ]]; then
  PHP_LETBLOCK=$(cat <<NIX

        php = pkgs.${PHP_ATTR}.buildEnv {
          extensions = { enabled, all }: enabled ++ (with all; [
            intl
            zip
            pdo_mysql
            mysqli
            gd
            bcmath
            redis
            exif
          ]);
          extraConfig = ''
            memory_limit = 2G
            upload_max_filesize = 2G
            post_max_size = 2G
            max_execution_time = 600
          '';
        };
NIX
)
  PHP_INPUTS=$(printf '            # PHP & Composer\n            php\n            %sPackages.composer\n' "$PHP_ATTR")
elif [[ "$HAS_PHP" == true ]]; then
  # PHP générique (version inconnue)
  PHP_INPUTS=$(printf '            # PHP & Composer\n            php\n            phpPackages.composer\n')
fi

NODE_INPUTS=""
if [[ "$HAS_NODE" == true ]]; then
  NODE_INPUTS="            # Node / Bun\n            ${NODE_ATTR}\n"
  [[ "$HAS_BUN" == true ]] && NODE_INPUTS+="            bun\n"
fi

DB_INPUTS=""
[[ -n "$DB_PKG" ]] && DB_INPUTS="            # Database\n            ${DB_PKG}\n"

COMPOSE_INPUTS=""
[[ "$HAS_COMPOSE" == true ]] && COMPOSE_INPUTS="            # Docker\n            docker-compose\n"

# ── shellHook selon verbosité ─────────────────────

# lignes de version conditionnelles
ver_php='echo "🐘 PHP $(php -r '"'"'echo PHP_VERSION;'"'"' 2>/dev/null)"'
ver_bun='echo "🍞 Bun $(bun --version 2>/dev/null)"'
ver_node='echo "🟢 Node $(node --version 2>/dev/null)"'
ver_compo='echo "📦 Composer $(composer --version 2>/dev/null | cut -d'"'"' '"'"' -f3)"'

light_php='PHP $(php -r '"'"'echo PHP_VERSION;'"'"' 2>/dev/null)'
light_bun='Bun $(bun --version 2>/dev/null)'
light_node='Node $(node --version 2>/dev/null)'

# exports PATH communs
EXPORTS=''
[[ "$HAS_PHP" == true ]]  && EXPORTS+='            export PATH="$PWD/vendor/bin:$PATH"'$'\n'
[[ "$HAS_NODE" == true ]] && EXPORTS+='            export PATH="$PWD/node_modules/.bin:$PATH"'$'\n'

build_shellhook() {
  case "$VERBOSITY" in
    --empty)
      printf '%s' "$EXPORTS"
      ;;
    --light)
      local parts=()
      [[ "$HAS_PHP" == true ]]  && parts+=("$light_php")
      [[ "$HAS_BUN" == true ]]  && parts+=("$light_bun")
      [[ "$HAS_NODE" == true ]] && parts+=("$light_node")
      local joined=""
      local i
      for i in "${parts[@]}"; do
        [[ -n "$joined" ]] && joined+=" | "
        joined+="$i"
      done
      printf '            echo "🔧 %s dev env loaded"\n' "$NAME"
      [[ -n "$joined" ]] && printf '            echo "   %s"\n' "$joined"
      printf '%s' "$EXPORTS"
      ;;
    --verbose)
      printf '            echo ""\n'
      printf '            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"\n'
      printf '            echo "💎 %s - Dev Environment"\n' "$NAME"
      printf '            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"\n'
      printf '            echo ""\n'
      [[ "$HAS_PHP" == true ]]  && printf '            %s\n' "$ver_php"
      [[ "$HAS_PHP" == true ]]  && printf '            %s\n' "$ver_compo"
      [[ "$HAS_BUN" == true ]]  && printf '            %s\n' "$ver_bun"
      [[ "$HAS_NODE" == true ]] && printf '            %s\n' "$ver_node"
      printf '            echo ""\n'
      printf '            echo "📋 Commands:"\n'
      [[ "$HAS_COMPOSE" == true ]] && printf '            echo "   docker compose up -d         Start services"\n'
      [[ "$HAS_BUN" == true ]]     && printf '            echo "   bun run dev                  Front dev server"\n'
      [[ "$HAS_BUN" == true ]]     && printf '            echo "   bun run build                Build front"\n'
      [[ "$HAS_LARAVEL" == true && "$HAS_COMPOSE" == true ]] && printf '            echo "   docker compose exec app php artisan test   Tests"\n'
      printf '            echo ""\n'
      printf '%s' "$EXPORTS"
      ;;
  esac
}

SHELLHOOK=$(build_shellhook)

# ── Assemblage flake.nix ──────────────────────────

# buildInputs : concatène les fragments présents
BUILD_INPUTS=""
[[ -n "$PHP_INPUTS" ]]     && BUILD_INPUTS+="$PHP_INPUTS"$'\n\n'
[[ -n "$NODE_INPUTS" ]]    && BUILD_INPUTS+=$(printf "$NODE_INPUTS")$'\n\n'
[[ -n "$DB_INPUTS" ]]      && BUILD_INPUTS+=$(printf "$DB_INPUTS")$'\n\n'
[[ -n "$COMPOSE_INPUTS" ]] && BUILD_INPUTS+=$(printf "$COMPOSE_INPUTS")$'\n\n'
BUILD_INPUTS+=$'            # Tools\n            git\n            curl\n            jq'

# backup en update
if [[ "$ACTION" == "update" ]]; then
  cp "$FLAKE" "${FLAKE}.bak"
fi

cat > "$FLAKE" <<NIXEOF
{
  description = "${NAME} - Development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
${PHP_LETBLOCK}
      in
      {
        devShells.default = pkgs.mkShell {
          name = "${NAME}";

          buildInputs = with pkgs; [
${BUILD_INPUTS}
          ];

          shellHook = ''
${SHELLHOOK}
          '';
        };
      }
    );
}
NIXEOF

# ── .envrc (direnv + nix-direnv) ──────────────────
if [[ ! -f "$ENVRC" ]]; then
  cat > "$ENVRC" <<'ENVEOF'
if has nix; then
  use flake
fi
ENVEOF
  ENVRC_MSG="créé"
else
  ENVRC_MSG="déjà présent (laissé tel quel)"
fi

# ── Rapport ───────────────────────────────────────
if [[ "$ACTION" == "init" ]]; then
  printf "\n✅ flake.nix créé pour « %s »\n" "$NAME"
else
  printf "\n🔄 flake.nix régénéré pour « %s » (backup : %s.bak)\n" "$NAME" "$FLAKE"
fi
printf "   Stack : "
parts=()
[[ "$HAS_PHP" == true ]]     && parts+=("${PHP_ATTR}")
[[ "$HAS_NODE" == true ]]    && parts+=("${NODE_ATTR}")
[[ "$HAS_BUN" == true ]]     && parts+=("bun")
[[ -n "$DB_PKG" ]]           && parts+=("${DB_PKG}")
[[ "$HAS_COMPOSE" == true ]] && parts+=("docker-compose")
( IFS=', '; printf "%s\n" "${parts[*]}" )
printf "   shellHook : %s\n" "${VERBOSITY#--}"
printf "   .envrc : %s\n\n" "$ENVRC_MSG"
printf "   Suivant : \033[2mdirenv allow\033[0m  (ou  \033[2mnix develop\033[0m)\n\n"
