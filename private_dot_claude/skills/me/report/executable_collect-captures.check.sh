#!/usr/bin/env bash
# Check du fait `captures` de collect.py : STALE par `files` depuis captures/sha (comme une section), sha absent ou
# hors de l'historique = toutes en retard, image manquante dite « sans image », captures réclamées quand le diff touche
# au rendu, et front-patterns.txt du projet qui remplace les motifs. Tout vit dans un dossier temporaire.
set -euo pipefail
C="$(cd "$(dirname "$0")" && pwd)/collect.py"
T=$(mktemp -d "${TMPDIR:-/tmp}/collect-captures.XXXXXX")
trap 'rm -r "$T"' EXIT
export ME_REPORTS_ROOT="$T/root"
R="$T/repo"; OUT="$T/out"
g() { git -C "$R" -c user.name=t -c user.email=t@t "$@"; }
git init -q -b main "$R" && g commit -q --allow-empty -m init && g checkout -q -b 'feat/#1-x'
mkdir -p "$R/app" && echo a > "$R/app/x.vue" && echo b > "$R/app/y.css" && g add -A && g commit -q -m A
A=$(g rev-parse --short HEAD)
echo b2 > "$R/app/y.css" && g commit -q -am B
run() { (cd "$R" && "$C" --offline --base main --out "$OUT") > "$T/o"; }
has() { grep -q "$1" "$T/o"; }
cap() { python3 -c 'import json,sys; c=json.load(open(sys.argv[1]))["facts"]["captures"]; print(",".join(c[sys.argv[2]]))' "$OUT/facts.json" "$1"; }
fail() { echo "collect-captures: $*" >&2; exit 1; }

# sans manifeste, un diff de front réclame les captures
run; has '^CAPTURES absentes' || fail "diff de front sans captures.json : pas de « CAPTURES absentes »"
mkdir -p "$ME_REPORTS_ROOT/repo" && : > "$ME_REPORTS_ROOT/repo/front-patterns.txt"
run; has '^CAPTURES' && fail "front-patterns.txt vide : les captures sont encore réclamées"

mkdir -p "$OUT/captures"
cat > "$OUT/captures.json" <<'J'
{ "baseUrl": "http://localhost:3001", "shots": [
  { "id": "s1", "viewport": "desktop", "theme": "light", "files": ["app/x.vue"] },
  { "id": "s2", "viewport": "mobile", "theme": "dark", "files": ["app/*.css"] },
  { "id": "s3", "viewport": "desktop", "theme": "dark", "files": [] },
  { "id": "s4", "viewport": "desktop", "theme": "light", "files": ["app"] } ] }
J
for i in s1 s2 s3; do printf '\x89PNG\r\n\x1a\n\0\0\0\rIHDR\0\0\x05\xa0\0\0\x03\x84' > "$OUT/captures/$i.png"; done
echo "$A" > "$OUT/captures/sha"
run; has '^CAPTURES 4 (1 en retard, 1 sans image)' || fail "ligne CAPTURES attendue : 4 (1 en retard, 1 sans image)"
[ "$(cap stale)" = s2 ] || fail "en retard : $(cap stale), attendu s2 (glob sur le fichier modifié après le sha)"
[ "$(cap missing)" = s4 ] || fail "sans image : $(cap missing), attendu s4"
python3 -c 'import json,sys; s=json.load(open(sys.argv[1]))["facts"]["captures"]["shots"][0]["after"]; assert (s["w"], s["h"]) == (1440, 900) and "?v=" in s["src"], s' "$OUT/facts.json" || fail "dimensions ou src versionné"
rm "$OUT/captures/sha"; run >/dev/null
[ "$(cap stale)" = s1,s2 ] || fail "sans captures/sha : $(cap stale), attendu s1,s2 (s3 a files vide)"
echo 0000000 > "$OUT/captures/sha"; run >/dev/null
[ "$(cap stale)" = s1,s2 ] || fail "sha hors de l'historique : $(cap stale), attendu s1,s2"
echo "collect-captures: ok"
