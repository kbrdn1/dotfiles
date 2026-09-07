---
name: me:loop:codex-review-pr
description: Loop auto-cadencé — relance la review Codex CLI locale sur la PR de la branche courante et corrige jusqu'à 0 finding bloquant pertinent (P0/P1/P2), max 8 itérations, avec analyse de convergence pour s'arrêter quand les passes n'apportent plus rien. Déclencheurs : "/me:loop:codex-review-pr", "lance le loop codex-review-pr", "codex review jusqu'à ce que la PR soit clean".
---

# loop:codex-review-pr

Loop auto-cadencé. **mode:** closed · **trigger:** self-pace · **exécution:** single · **hardened:** true (bloc anti-triche de `me:run-loop`).
Après la création d'une PR, relance la **review Codex CLI locale** (companion Node, avec **fallback `codex exec` direct** si le broker wedge) **inline** (le `check_command` redirige le transcript Codex vers `/dev/null` et n'imprime que le verdict compact — aucun subagent nécessaire, inutile et coûteux en tokens), et corrige les findings bloquants **pertinents** jusqu'à ce qu'il n'en reste plus. Applique le **PROTOCOLE SELF-PACE** ci-dessous (canonique dans `me:run-loop`).

> ⚠️ Le CLI Codex review l'arbre du **répertoire courant** sur la **branche courante** (cf. `me:check-reviews` Phase 1B). Lance ce loop **depuis le checkout/worktree de la PR**, sur sa branche — sinon il review le mauvais arbre.

## Définition

- **goal** : la PR de la branche courante passe la review Codex locale sans finding bloquant pertinent (P0 = `critical`, P1 = `high`, P2 = `medium`).
- **max_iterations** : 8
- **exit_when** : la sortie du check affiche `P0P1P2_COUNT=0` (plus aucun finding `[P0]`/`[P1]`/`[P2]`) — OU les findings `[P0]`/`[P1]`/`[P2]` restants ont tous été explicitement documentés comme **faux positifs / hors-scope** et écartés (ils ne comptent pas). Le companion (≥ 1.0.4) n'émet pas de `verdict` structuré : on se fie au `P0P1P2_COUNT` extrait des tags de sévérité du rapport.
- **exit_on_stagnation** : troisième sortie, **distincte du succès** — la boucle n'apporte plus de valeur (cf. « Analyse de convergence »). On s'arrête avec un `P0P1P2_COUNT` non nul, en l'annonçant comme tel et en listant ce qui reste. Ce n'est pas un échec : c'est reconnaître qu'une passe de plus produirait du durcissement théorique au lieu d'un correctif.
- **check_command** : review Codex locale → findings bloquants extraits du rapport markdown. Le companion **1.0.4** ne renvoie plus de tableau `.findings[]`/`.verdict` ; la review est du texte (`storedJob.result.codex.stdout` / `rendered`) où chaque finding est préfixé `- [P0]`…`- [P3]` (P0 = critical, P1 = high, P2 = medium, bloquants). On parse ces tags en Python (tolérant aux control chars via `strict=False`), sans `jq` sur un schéma obsolète. Commande complète :

> ⚠️ **Exécuter le `check_command` inline** (Bash, dans le contexte du loop). Le script redirige déjà le transcript Codex volumineux (≈ 10 k lignes) vers `/dev/null` (companion `--wait`) ou un fichier temporaire (`codex exec`), et n'imprime sur stdout que le **bloc verdict** (`=== blocking (P0/P1/P2) ===` + `P0P1P2_COUNT=`) plus quelques lignes de progression. **Pas de subagent** : le bruit est déjà absorbé par le script, donc l'isoler dans un agent jetable est inutile et brûle des tokens (~50 k par passe). Lance-le depuis le worktree de la PR.

Le check fait quatre choses : (1) **préflight** — `reconcile` nettoie les jobs orphelins (PID mort) + un broker mort ; (2) **watchdog pendant le `--wait`** — review en arrière-plan, on surveille le **mtime du log du job actif** : s'il stagne ≥ `STALL_S` (broker wedgé qui répond `BROKER_BUSY` à l'infini, cf. note plus bas), on `reconcile --force` et on **relance** (borné à `MAX_RESTART`) ; (3) **fallback direct** — si le companion reste wedgé après `MAX_RESTART` (ou est introuvable / `result` illisible), bascule sur une **review directe `codex exec` (broker contourné, `</dev/null`)** sur le diff `origin/$BASE...HEAD`, dans le **même format parsable** ; (4) **parser commun** — compte via la ligne `RESUME:` (chemin direct) sinon via les tags de puces (chemin companion), les deux chemins refusant de rendre un verdict sur une sortie qui ne prouve pas qu'une review a eu lieu. Un wedge ne bloque donc plus jamais le loop : il dégrade vers la voie directe.

```bash
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
parse_findings() {  # $1 = fichier texte (rapport markdown)
  python3 - "$1" <<'PY'
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
    print("findings=%d (P0=%d P1=%d P2=%d P3=%d)" % (len(allp), allp.count("0"), allp.count("1"), allp.count("2"), allp.count("3")))
print("=== blocking (P0/P1/P2) ===")
print("\n".join(blocking) if blocking else "(none)")
print("P0P1P2_COUNT=%d" % count)
PY
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
  parse_findings "$out"
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

parse_findings "$WORK/report.txt"
```

## Cycle

- **Discovery** : vérifier le contexte — être dans le checkout/worktree de la PR, sur sa branche (`gh pr view` doit renvoyer une PR) ; sinon s'y placer. Lire le contexte projet (`CLAUDE.md`, `.claude/rules/`, conventions/stack).
- **Planning** : déterminer la base (`origin/<baseRefName>`) et l'outillage de review (companion Codex local).
- **Execution** :
  Step 1: **Exécuter le `check_command` inline** (Bash) et lire son **retour compact** : le bloc `blocking (P0/P1/P2)` + la ligne `P0P1P2_COUNT=`. Pour chaque finding `[P0]`/`[P1]`/`[P2]`, juger sa **pertinence** (vrai problème vs faux positif/hors-scope, à partir du texte du finding et du fichier/ligne cités).
  Step 2: Corriger la **cause racine** et les **éléments pertinents en fonction du contexte du projet** (conventions, stack, `CLAUDE.md` et `.claude/rules/` du repo) — commit atomique Gitmoji + Conventional référençant l'issue. Documenter et **écarter** les faux positifs / findings hors-scope ou contraires aux conventions du projet — sans jamais désactiver/skip une validation pour faire taire le finding.
- **Verification** : relancer le `check_command` **inline**, lire le bloc `blocking (P0/P1/P2)` + la ligne `P0P1P2_COUNT=`.
- **Analyse de convergence** (à partir de l'itération 3, puis à chaque passe) : la boucle apporte-t-elle encore quelque chose ? Cf. la section dédiée. Trois issues possibles — continuer, s'arrêter sur `exit_when`, s'arrêter sur `exit_on_stagnation`.
- **Iteration** : tant qu'il reste des bloquants pertinents **et** que l'analyse conclut « continuer », reboucler ; sinon stop/handback.

## Protocole self-pace (compteur à 1)

1. Exécuter les steps (corriger les findings P0/P1/P2 pertinents).
2. **Lancer le `check_command` inline** (Bash) et **LIRE son retour compact** (le bloc `blocking (P0/P1/P2)` + la ligne `P0P1P2_COUNT=`). Ne jamais supposer le résultat.
3. Évaluer `exit_when` : si `P0P1P2_COUNT=0` (ou les bloquants restants sont tous des faux positifs documentés/écartés) → **STOP**, annoncer le succès (citer `P0P1P2_COUNT` + le récap `findings=…`).
4. **À partir de l'itération 3** : dérouler l'« Analyse de convergence ». Si elle conclut à la stagnation → **STOP** sur `exit_on_stagnation`, avec le rapport prévu. Ne pas attendre `max_iterations` pour le faire : arrêter à la 4ᵉ passe quand c'est justifié vaut mieux que d'en enchaîner quatre de plus par automatisme.
5. Sinon incrémenter. Si compteur ≥ 8 → **STOP**, annoncer la limite sans succès + lister les findings bloquants restants et pourquoi ils résistent.
6. Sinon recommencer.

Status à chaque passe : `🔁 Itération N/8 — <findings corrigés> → check: P0P1P2_COUNT=<n> (P3 restants <n>)`.

Garde-fous : ne jamais dépasser `max_iterations` ; jamais de succès sans `P0P1P2_COUNT=0` (ou écartement explicite) vu dans la sortie du `check_command` — un arrêt sur stagnation s'annonce comme un arrêt sur stagnation, **jamais** comme un succès ; jamais skip/désactiver une validation — corriger la cause racine ; rester dans le bon checkout/branche. Le `check_command` se dégrade tout seul (companion wedgé → review directe `codex exec`) : il n'`exit 2` qu'en **dernier recours** (ni companion ni CLI `codex` dispo) → alors **stopper et le signaler** (fallback CodeRabbit via `me:check-reviews`) plutôt que boucler à vide.

## Analyse de convergence

🔗 **Canonique dans `~/.claude/skills/me/loop/_shared/convergence.md`** — partagé avec `me:loop:claude-review-pr`. Lire ce fichier à partir de l'itération 3, puis à chaque passe, et appliquer sa décision (continuer / `exit_when` / `exit_on_stagnation`). Éditer là-bas, jamais ici.

En bref, pour ne pas avoir à l'ouvrir trop tôt : tenir dès la 1ʳᵉ passe le tableau `passe | findings | P0 | P1 | P2 | nature` ; cinq signaux d'épuisement (findings auto-générés, gravité qui s'effondre, scénarios à 3+ conjonctions, premier faux positif, code jamais exécuté) ; on sort sur stagnation si le signal 1 tient deux passes consécutives, ou si le 5 se combine à (2, 3 ou 4) ; l'arrêt s'accompagne d'un **rapport** en 5 points, jamais d'un simple « ça n'avance plus ».

## Exécution inline (pas de subagent)

**Lance le `check_command` inline** via Bash, dans le contexte du loop — depuis le worktree de la PR, sur sa branche (`cd <WORKTREE>` d'abord). **Pas de subagent.** Le script absorbe lui-même le bruit : la sortie du companion `review --wait` part dans `/dev/null`, la review directe `codex exec` écrit dans un fichier temporaire, et seul `parse_findings` imprime sur stdout le **verdict compact** (~10 lignes : `findings…`, `=== blocking (P0/P1/P2) ===`, les puces bloquantes, `P0P1P2_COUNT=`) + quelques lignes de progression `⚠️/↪️`. Le contexte du loop ne reçoit donc que ce verdict — l'isoler dans un agent jetable serait redondant et brûlerait ~50 k tokens par passe (mesuré).

Le loop lit ce retour, juge la pertinence des findings, corrige (il a le contexte projet), commit/push, puis relance le `check_command` inline pour la passe de vérification.

> Mode dégradé : si le `check_command` `exit 2` (ni companion ni CLI `codex`), **stopper et signaler** (fallback CodeRabbit via `me:check-reviews`), sans boucler à vide.

## Anti-wedge : le broker Codex & `reconcile`

Le companion partage un **broker daemon** par workspace (`app-server-broker.mjs serve`, un par `--cwd`, état dans `~/.claude/plugins/data/codex-openai-codex/state/<branch>-<hash>/broker.json` + socket dans `/var/folders/.../cxc-*/`). Le broker **sérialise** les requêtes et garde en mémoire `activeStreamSocket`/`activeRequestSocket`. **Si un client review est tué en plein stream** (timeout, `kill`, contention de N reviews concurrentes), ces refs pointent vers un socket mort que le broker ne nettoie pas → il répond `BROKER_BUSY` à **toute** nouvelle review, qui reste alors **figée à `Starting Codex review thread`** indéfiniment (vécu : 10–14 min, broker `pid` pourtant **vivant**). Tuer le wrapper `review --wait` ne suffit pas — il faut **redémarrer le broker**. Et si le broker **reste** wedgé après `MAX_RESTART` `reconcile --force` (vécu : 2 cycles complets, ~34 min, le reset ne suffisait pas), le check **abandonne le companion** et bascule sur la **review directe `codex exec </dev/null`** (cf. `direct_review` dans le `check_command`) — le loop n'est donc jamais bloqué par un wedge.

Le check ci-dessus s'auto-soigne d'abord via la sous-commande **`reconcile`** (ajoutée au companion) :

- `node "$CODEX_COMPANION" reconcile [--json]` — préflight : marque `failed` les jobs `running`/`queued` à **PID mort**, et reset un broker **mort** (pid absent). Sans danger (n'effleure jamais une review vivante qui progresse). Affiche aussi la **file d'attente**.
- `… reconcile --force [--json]` — reset **inconditionnel** du broker (graceful `broker/shutdown` puis teardown socket/pidfile/sessionDir + `clearBrokerSession`). Utilisé par le watchdog quand le log du job actif stagne ≥ `STALL_S`.
- `… reconcile --stall-ms <n>` — reset si le log du job actif est figé depuis ≥ `n` ms (le **vrai** signal de wedge : `pid` vivant mais plus aucun progrès ; `updatedAt` ne bouge qu'aux transitions de phase, donc on se fie au **mtime du log**).

> ⚠️ **Patch vendored à ré-appliquer.** `reconcile` et le préflight auto vivent dans `codex-companion.mjs`, **dans le dossier versionné du plugin** (`codex/<ver>/scripts/`) — **écrasés à chaque update/pull du plugin**. Le diff ré-appliquable est sauvegardé à côté de ce skill : `companion-reconcile.patch`. Après un bump du companion : `node --check` la cible, puis `patch -p1 < companion-reconcile.patch` (ou ré-appliquer à la main), et re-tester (`reconcile --json` + une review).

## Mode parallèle borné (multi-branches)

Pour reviewer **plusieurs branches/worktrees à la fois** : chaque worktree = `cwd` distinct = **broker distinct** → parallélisable. Mais la **concurrence est précisément ce qui stresse le broker** vers le wedge (3–4 reviews simultanées l'ont déclenché) — donc **borner** (≤ 2–3 en vol) et **un watchdog par branche**, pas un fan-out illimité.

Esquisse (la review d'**une** branche reste sérialisée par son broker — normal) :

```bash
CAP=${CODEX_PARALLEL_CAP:-2}        # reviews concurrentes max
# BRANCHES = liste de chemins de worktrees à reviewer
for WT in "${BRANCHES[@]}"; do
  while [ "$(jobs -rp | wc -l)" -ge "$CAP" ]; do wait -n; done
  ( cd "$WT" && /bin/sh -c "$CHECK_COMMAND" > "review-$(basename "$WT").out" 2>&1 ) &
done
wait
# puis agréger : grep -H 'P0P1P2_COUNT=' review-*.out
```

Chaque sous-review embarque son propre préflight + watchdog anti-wedge (le `check_command` ci-dessus), donc un wedge sur une branche n'entraîne pas les autres. Agréger les `P0P1P2_COUNT=` par branche pour le verdict global.
