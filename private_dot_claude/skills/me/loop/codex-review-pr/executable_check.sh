#!/usr/bin/env bash
# check_command de me:loop:codex-review-pr : la SKILL.md explique chaque garde.
# Usage : cd "$WT" && bash ~/.claude/skills/me/loop/codex-review-pr/check.sh
set -o pipefail
PR_JSON=$(gh pr view --json number,baseRefName 2>/dev/null) || { echo "❌ Aucune PR pour la branche courante"; exit 2; }
BASE=$(echo "$PR_JSON" | jq -r .baseRefName)
git fetch origin "$BASE" --quiet 2>/dev/null || true   # le SSH peut échouer → origin/$BASE en cache suffit
WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
STALL_S=${CODEX_STALL_S:-210}      # log du job actif sans progrès ≥ ce seuil ⇒ broker wedgé
MAX_RESTART=${CODEX_MAX_RESTART:-2}
POLL_S=20

# ── PARSER COMMUN (companion OU codex direct) : émet le bloc bloquant + P0P1P2_COUNT ──
# Compte via la ligne `RESUME:` si présente (chemin direct), sinon via les tags des puces
# (chemin companion). Les findings réels matchent `- [P0..P3]` ; l'exemple du prompt direct
# utilise `- [Pn]` (placeholder littéral) → jamais compté.
parse_findings() {  # $1 = fichier texte (rapport markdown) ; écrit aussi $WORK/codex-pass.md pour (D)
  python3 - "$1" "$WORK/codex-pass.md" <<'PY'
import re, sys
text = open(sys.argv[1], encoding="utf-8", errors="replace").read()
# Découpage APRÈS retrait du récap : sinon la dernière puce absorbe la ligne RESUME
# (le split court jusqu'à EOF) et le bloc bloquant l'affiche collée au finding.
bullets = re.split(r"\n(?=- \[P[0-3]\])", re.split(r"\n\s*RESUME:", text)[0])
blocking = [b.strip() for b in bullets if re.match(r"- \[P[012]\]", b.strip())]
resume = re.findall(r"RESUME:\s*P0=(\d+)\s+P1=(\d+)\s+P2=(\d+)\s+P3=(\d+)", text)
if resume:                                  # chemin direct : RESUME fait foi
    p0, p1, p2, p3 = map(int, resume[-1]); count = p0 + p1 + p2
    print("findings (RESUME) P0=%d P1=%d P2=%d P3=%d" % (p0, p1, p2, p3))
else:                                        # chemin companion : compter les tags
    allp = re.findall(r"\[P([0-3])\]", text); count = len(blocking)
    p0, p1, p2, p3 = (allp.count(k) for k in "0123")
    print("findings=%d (P0=%d P1=%d P2=%d P3=%d)" % (len(allp), p0, p1, p2, p3))
# rapport normalisé pour me:report : toutes les puces dans l'ordre (le rang des décisions s'y compte)
# + le RESUME qui a fait foi ici. Jamais écrit sans verdict : les gardes en amont sortent avant.
tags = [b.strip() for b in bullets if re.match(r"- \[P[0-3]\]", b.strip())]
open(sys.argv[2], "w", encoding="utf-8").write("".join(t + "\n\n" for t in tags) + "RESUME: P0=%d P1=%d P2=%d P3=%d\n" % (p0, p1, p2, p3))
print("=== blocking (P0/P1/P2) ===")
print("\n".join(blocking) if blocking else "(none)")
print("P0P1P2_COUNT=%d" % count)
PY
}

# ── (D) RAPPORT LIVE me:report : la passe rejoint la section review, série codex, 0 token ──
# Appelé seulement après un verdict (les gardes anti-faux-propre sortent avant).
# Étape cosmétique : elle ne doit JAMAIS changer le code de sortie du check (pipefail + dernière
# commande des deux chemins). Chaque échec rend 0, le verdict reste celui de parse_findings.
report_pass() {
  local C=~/.claude/skills/me/report/collect.py RD N
  [ -s "$WORK/codex-pass.md" ] && RD=$("$C" --dir 2>/dev/null) || return 0
  mkdir -p "$RD/review" || return 0
  N=$(( $(command ls "$RD/review" | grep -c '^codex-[0-9]*\.md$') + 1 ))
  cp "$WORK/codex-pass.md" "$RD/review/codex-$N.md" || return 0
  git rev-parse --short HEAD > "$RD/review/codex-$N.sha" 2>/dev/null
  "$C" 2>&1 | head -3 || true
  return 0
}

# ── FALLBACK : review directe `codex exec` (broker contourné, stdin fermé `</dev/null`) ──
# `</dev/null` est OBLIGATOIRE : sans lui, `codex exec` reste figé sur « Reading additional
# input from stdin… » quand il est lancé sans TTY. L'exemple de format utilise `- [Pn]` (pas
# de chiffre) pour que l'écho du prompt ne soit pas compté ; `RESUME:` (avec chiffres) fait foi.
direct_review() {
  echo "↪️ fallback: review directe codex exec (broker indisponible)"
  command -v codex >/dev/null 2>&1 || { echo "❌ ni companion ni CLI codex — fallback CodeRabbit (me:check-reviews)"; return 2; }
  local diff="$WORK/pr.diff" out="$WORK/codex.out"
  git diff "origin/$BASE...HEAD" > "$diff" 2>/dev/null
  codex exec --skip-git-repo-check "Tu es un reviewer senior STRICT. Reviewe UNIQUEMENT le diff de la PR (base origin/$BASE) — le diff complet est dans le fichier $diff. Ouvre aussi les fichiers source du repo courant pour le contexte et respecte ses conventions (CLAUDE.md, .claude/rules/). Signale les défauts RÉELS et ACTIONNABLES (correctness, sécurité, intégrité des données, multi-tenant, robustesse runtime) ; ignore le cosmétique ; n'invente pas de findings. Format STRICT, une puce par finding : '- [Pn] Titre court — chemin/fichier:ligne' où n vaut 0 (critique), 1 (élevé), 2 (moyen bloquant) ou 3 (nit), suivie de 1-2 phrases (cause + impact). Si AUCUN finding bloquant, écris la ligne: (none). Termine TOUJOURS par une ligne: RESUME: P0=<n> P1=<n> P2=<n> P3=<n>" </dev/null > "$out" 2>&1 || true
  # GARDE ANTI-FAUX-PROPRE : sans cette vérification, une review qui n'a pas tourné
  # (quota épuisé, crash, sortie vide) traverse `parse_findings` — qui ne trouve ni
  # puce `- [Pn]` ni ligne `RESUME:` — et imprime `P0P1P2_COUNT=0`. Le loop lit un
  # zéro et déclare la PR clean alors qu'aucun code n'a été relu. Vécu le 2026-09-01
  # sur la PR #772 (`ERROR: You've hit your usage limit`). Le prompt IMPOSE la ligne
  # `RESUME:` : son absence signifie que le modèle n'a pas répondu, pas qu'il n'a
  # rien trouvé.
  #
  # ⚠️ Le motif doit exiger un CHIFFRE. `grep -q "RESUME:"` ne mordait jamais :
  # `codex exec` réémet le prompt dans sa sortie, et ce prompt contient lui-même
  # « …Termine TOUJOURS par une ligne: RESUME: P0=<n> … ». Le garde matchait donc
  # son propre énoncé, quota épuisé compris — l'incident #772 s'est rejoué à
  # l'identique le 2026-09-02 sur la PR #1008. Le placeholder du prompt s'écrit
  # `P0=<n>`, une vraie réponse `P0=0` : le chiffre est ce qui les sépare.
  if ! grep -qE "RESUME:[[:space:]]*P0=[0-9]" "$out"; then
    echo "❌ review NON exécutée — aucune ligne RESUME chiffrée dans la sortie de codex exec"
    grep -iE "usage limit|rate limit|quota|unauthorized|ERROR:" "$out" | head -3
    echo "   (ne PAS lire ce résultat comme 0 finding — relancer plus tard, ou basculer sur me:check-reviews)"
    return 2
  fi
  parse_findings "$out" && report_pass
}

# `command ls` contourne un éventuel alias `ls` (eza/lsd) qui polluerait le chemin d'ANSI.
CODEX_COMPANION=$(command ls -t \
  /Users/kbrdn1/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs \
  /Users/kbrdn1/.claude/plugins/marketplaces/openai-codex/plugins/codex/scripts/codex-companion.mjs \
  2>/dev/null | head -1)
[ -z "$CODEX_COMPANION" ] && { direct_review; exit $?; }   # pas de companion → directe d'emblée

# (1) PRÉFLIGHT : nettoyer orphelins (PID mort) + broker mort.
node "$CODEX_COMPANION" reconcile --json >/dev/null 2>&1

# logFile du job review actif (vide si aucun)
run_log() { node "$CODEX_COMPANION" status --json 2>/dev/null | python3 -c '
import json,sys
try: d=json.load(sys.stdin)
except Exception: print(""); sys.exit()
r=[j for j in (d.get("running") or []) if j.get("jobClass")=="review" and j.get("logFile")]
print(r[0]["logFile"] if r else "")'; }

# (2) REVIEW + WATCHDOG anti-wedge (relance bornée), sinon fallback direct.
attempt=0; COMPANION_OK=0
while [ "$attempt" -le "$MAX_RESTART" ]; do
  attempt=$((attempt+1))
  node "$CODEX_COMPANION" review --wait --base "origin/$BASE" --scope branch >/dev/null 2>&1 &
  RPID=$!; LOGF=""; t=0
  while [ -z "$LOGF" ] && [ "$t" -lt 12 ] && kill -0 "$RPID" 2>/dev/null; do sleep 1; t=$((t+1)); LOGF=$(run_log); done
  STALLED=0; AGE=0
  while kill -0 "$RPID" 2>/dev/null; do
    sleep "$POLL_S"; [ -z "$LOGF" ] && LOGF=$(run_log)
    if [ -n "$LOGF" ] && [ -f "$LOGF" ]; then
      AGE=$(python3 -c "import os,time;print(int(time.time()-os.path.getmtime('$LOGF')))" 2>/dev/null || echo 0)
      [ "$AGE" -ge "$STALL_S" ] && { STALLED=1; break; }
    fi
  done
  if [ "$STALLED" = 1 ]; then
    echo "⚠️ review figée ${AGE}s (≥${STALL_S}s, broker wedgé) — reconcile --force + relance ($attempt/$MAX_RESTART)"
    kill "$RPID" 2>/dev/null; wait "$RPID" 2>/dev/null
    node "$CODEX_COMPANION" reconcile --force --json >/dev/null 2>&1
    continue
  fi
  wait "$RPID"; RC=$?
  if [ "$RC" -ne 0 ]; then
    echo "⚠️ review en échec (rc=$RC) — reconcile --force + relance ($attempt/$MAX_RESTART)"
    node "$CODEX_COMPANION" reconcile --force --json >/dev/null 2>&1
    continue
  fi
  COMPANION_OK=1; break
done

# (3) FALLBACK si le companion n'a pas abouti (wedge persistant / échecs répétés).
[ "$COMPANION_OK" != 1 ] && { echo "⚠️ companion KO après $MAX_RESTART relances"; direct_review; exit $?; }

# (4) PARSE du verdict companion (texte du rapport → parser commun).
RESULT_FILE="$WORK/result.json"
node "$CODEX_COMPANION" result --json > "$RESULT_FILE" 2>/dev/null || { direct_review; exit $?; }
python3 - "$RESULT_FILE" "$WORK/report.txt" <<'PY' || { direct_review; exit $?; }
import json, sys
raw = open(sys.argv[1], encoding="utf-8", errors="replace").read()
obj = json.loads(raw, strict=False)   # strict=False tolère les control chars bruts du companion
sj = obj.get("storedJob") or obj.get("job") or {}
res = sj.get("result") if isinstance(sj, dict) else {}
res = res if isinstance(res, dict) else {}
codex = res.get("codex") if isinstance(res, dict) else {}
text = (codex.get("stdout") if isinstance(codex, dict) else "") or sj.get("rendered") or res.get("rendered") or ""
open(sys.argv[2], "w", encoding="utf-8").write(text)
PY
# MÊME GARDE, chemin companion : si l'extraction ne rend rien (result illisible,
# job sans stdout), `parse_findings` sur un rapport vide imprimerait lui aussi
# `P0P1P2_COUNT=0`. Un rapport vide n'est pas une PR propre — on bascule sur la
# voie directe, qui porte son propre garde.
[ -s "$WORK/report.txt" ] || { echo "⚠️ rapport companion vide — pas un verdict"; direct_review; exit $?; }

parse_findings "$WORK/report.txt" && report_pass
