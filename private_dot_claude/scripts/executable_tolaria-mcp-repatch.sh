#!/usr/bin/env bash
# Repare le serveur MCP de Tolaria apres une auto-update.
#
# Bug (constate sur v2027-08-28, 2026-08-28) : le bundle CJS perd `import.meta.url`
# (esbuild emet `var import_meta = {}`), donc
#   new URL("./app-config-policy.json", import_meta.url)
# leve `TypeError: Invalid URL` au chargement du module — le serveur ne demarre plus.
# Second bug : `app-config-policy.json` n'est pas livre dans le bundle.
#
# Idempotent : ne fait rien si le bundle est deja sain ou deja patche.
# A relancer apres chaque mise a jour de Tolaria, tant que l'upstream n'a pas corrige.
set -euo pipefail

MCP_DIR="/Applications/Tolaria.app/Contents/Resources/mcp-server"
INDEX="$MCP_DIR/index.js"
POLICY="$MCP_DIR/app-config-policy.json"
NODE="${NODE_BIN:-$HOME/.nix-profile/bin/node}"
PATCHED='var import_meta = { url: require("node:url").pathToFileURL(__filename).href };'

[ -f "$INDEX" ] || { echo "introuvable : $INDEX — Tolaria est-il installe ?" >&2; exit 1; }

version=$(/usr/libexec/PlistBuddy -c "Print CFBundleShortVersionString" \
  /Applications/Tolaria.app/Contents/Info.plist 2>/dev/null || echo "?")
echo "Tolaria $version"

# Le bundle demarre-t-il ? Sur stdin ferme, les deux cas terminent tout de suite :
# un serveur sain sort en 0, un bundle casse meurt au chargement du module et sort en 1.
starts_ok() {
  local err; err=$(mktemp) rc=0
  WS_UI_PORT=9711 VAULT_PATH="$HOME/Vault/pro" "$NODE" "$INDEX" </dev/null >/dev/null 2>"$err" || rc=$?
  [ "$rc" -ne 0 ] && [ -s "$err" ] && head -4 "$err" >&2
  rm -f "$err"
  return "$rc"
}

if starts_ok; then
  echo "serveur MCP sain — rien a faire"
  exit 0
fi

if [ ! -f "$POLICY" ]; then
  echo "recuperation de app-config-policy.json depuis le repo…"
  gh api repos/refactoringhq/tolaria/contents/mcp-server/app-config-policy.json \
    --jq '.content' | base64 -d > "$POLICY"
fi

if grep -qF "$PATCHED" "$INDEX"; then
  echo "index.js deja patche"
else
  cp "$INDEX" "$INDEX.orig-$version"
  echo "backup : index.js.orig-$version"
  sed -i '' "s|var import_meta = {};|$PATCHED|" "$INDEX"
  grep -qF "$PATCHED" "$INDEX" \
    || { echo "le motif 'var import_meta = {};' n'existe plus — bundle change, patch a revoir" >&2; exit 1; }
  echo "patche : import_meta.url"
fi

if starts_ok; then
  echo "OK — le serveur MCP demarre"
else
  echo "le serveur ne demarre toujours pas, diagnostiquer a la main :" >&2
  echo "  WS_UI_PORT=9711 VAULT_PATH=\$HOME/Vault/pro $NODE $INDEX < /dev/null" >&2
  exit 1
fi
