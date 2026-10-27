#!/usr/bin/env bash
# Rendu dark + light d'une bannière, depuis la racine du repo (les chemins du config, comme un
# logo, y sont relatifs) :
#   render.sh <gen.ts> <config.json> <outdir> [dark.png] [light.png]
# Sans `height` dans le config, la hauteur suit le panneau : un premier rendu (DOM) lit le bas
# du panneau (data-panel-bottom), la page garde sous lui la marge qu'elle a au-dessus.
set -euo pipefail
GEN=$1; CFG=$2; OUT=$3; DARK=${4:-banner.png}; LIGHT=${5:-banner-light.png}
CHROME=${CHROME:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
mkdir -p "$OUT"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Lance Chrome et attend son fichier : --screenshot peut écrire puis ne pas rendre la main
shot() { # $1 html, $2 png, $3 W, $4 H
  rm -f "$2"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --virtual-time-budget=2500 --window-size="$3,$4" --screenshot="$2" "file://$1" >/dev/null 2>&1 &
  local pid=$!
  for _ in $(seq 1 80); do [ -s "$2" ] && break; sleep 0.25; done
  sleep 0.3; kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true
  [ -s "$2" ] || { echo "rendu vide : $2" >&2; exit 1; }
}

read -r W H TOP < <(python3 - "$CFG" "$GEN" <<'PY'
import json, re, sys
cfg = json.load(open(sys.argv[1])); gen = open(sys.argv[2]).read()
w = cfg.get("width") or int(re.search(r"cfg\.width \?\? (\d+)", gen).group(1))
h = cfg.get("height") or 0
print(w, h, 56)
PY
)

if [ "$H" = 0 ]; then
  python3 -c "import json,sys;c=json.load(open(sys.argv[1]));c['height']=2400;json.dump(c,open(sys.argv[2],'w'))" "$CFG" "$TMP/probe.json"
  bun "$GEN" "$TMP/probe.json" "$TMP" >/dev/null
  BOTTOM=$("$CHROME" --headless=new --disable-gpu --virtual-time-budget=2500 --window-size="$W,2400" --dump-dom "file://$TMP/dark.html" 2>/dev/null \
    | grep -o 'data-panel-bottom="[0-9]*"' | grep -o '[0-9]*' || true)
  if [ -n "$BOTTOM" ]; then H=$((BOTTOM + TOP)); else H=$(python3 -c "import re,sys;print(re.search(r'cfg\.height \?\? (\d+)',open(sys.argv[1]).read()).group(1))" "$GEN"); fi
fi

python3 -c "import json,sys;c=json.load(open(sys.argv[1]));c['height']=int(sys.argv[3]);json.dump(c,open(sys.argv[2],'w'))" "$CFG" "$TMP/final.json" "$H"
bun "$GEN" "$TMP/final.json" "$OUT" >/dev/null
shot "$OUT/dark.html" "$OUT/$DARK" "$W" "$H"
shot "$OUT/light.html" "$OUT/$LIGHT" "$W" "$H"
echo "$W x $H → $OUT/$DARK $OUT/$LIGHT"
