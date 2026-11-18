#!/usr/bin/env bash
# Check de `collect.py --pass` (étape D de me:loop:claude-review-pr) : passe enregistrée, pas de
# doublon quand (C) est rejoué sur les mêmes rapports, spec non lancé jamais affiché « propre »,
# et le rapport régénéré voit bien les passes. Tout vit dans un dossier temporaire, rien sous ~/Reports.
set -euo pipefail
C="$(cd "$(dirname "$0")" && pwd)/collect.py"
T=$(mktemp -d "${TMPDIR:-/tmp}/collect-pass.XXXXXX")
trap 'rm -r "$T"' EXIT
git -C "$T" init -q repo && git -C "$T/repo" -c user.name=t -c user.email=t@t commit -q --allow-empty -m init
OUT="$T/out"
printf -- '- [P2] titre — a.js\n  détail\n\nRESUME: P0=0 P1=0 P2=1 P3=0\n' > "$T/std.md"
printf 'RESUME: P0=0 P1=0 P2=0 P3=0\n' > "$T/spec.md"
run() { (cd "$T/repo" && "$C" --offline --out "$OUT" --pass "$@" >/dev/null); }
passes() { python3 -c 'import json,sys; print(len(json.load(open(sys.argv[1]))["facts"]["review"]["passes"]))' "$OUT/facts.json"; }
fail() { echo "collect-pass: $*" >&2; exit 1; }

run "$T/std.md" "$T/spec.md"
[ -f "$OUT/review/pass-1-standards.md" ] && [ -s "$OUT/review/pass-1.sha" ] || fail "passe 1 non écrite"
[ "$(passes)" = 1 ] || fail "facts.json ne voit pas la passe 1"
run "$T/std.md" "$T/spec.md"
[ ! -e "$OUT/review/pass-2-standards.md" ] || fail "doublon sur des rapports identiques"
printf 'RESUME: P0=0 P1=0 P2=0 P3=0\n' > "$T/std.md"
run "$T/std.md" -
grep -q SPEC_SKIPPED=1 "$OUT/review/pass-2-spec.md" || fail "spec non lancé écrit comme propre"
[ "$(passes)" = 2 ] || fail "facts.json ne voit pas la passe 2"
echo "collect-pass: ok"
