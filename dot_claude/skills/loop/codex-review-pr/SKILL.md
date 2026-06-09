---
name: loop:codex-review-pr
description: Loop auto-cadencé — relance la review Codex CLI locale sur la PR de la branche courante et corrige jusqu'à 0 finding bloquant pertinent (P0/P1), max 5 itérations. Déclencheurs : "/loop:codex-review-pr", "lance le loop codex-review-pr", "codex review jusqu'à ce que la PR soit clean".
---

# loop:codex-review-pr

Loop auto-cadencé. **mode:** closed · **trigger:** self-pace · **exécution:** single.
Après la création d'une PR, relance la **review Codex CLI locale** (companion Node) et corrige les findings bloquants **pertinents** jusqu'à ce qu'il n'en reste plus. Applique le **PROTOCOLE SELF-PACE** ci-dessous (canonique dans `me:run-loop`).

> ⚠️ Le CLI Codex review l'arbre du **répertoire courant** sur la **branche courante** (cf. `me:check-reviews` Phase 1B). Lance ce loop **depuis le checkout/worktree de la PR**, sur sa branche — sinon il review le mauvais arbre.

## Définition

- **goal** : la PR de la branche courante passe la review Codex locale sans finding bloquant pertinent (P0 = `critical`, P1 = `high`).
- **max_iterations** : 5
- **exit_when** : la sortie du check affiche `P0P1_COUNT=0` (plus aucun finding `critical`/`high`) — OU les findings `critical`/`high` restants ont tous été explicitement documentés comme **faux positifs / hors-scope** et écartés (ils ne comptent pas). Idéalement `verdict == "approve"`.
- **check_command** : review Codex locale → JSON des findings bloquants. Commande complète :

```bash
set -o pipefail
PR_JSON=$(gh pr view --json number,baseRefName 2>/dev/null) || { echo "❌ Aucune PR pour la branche courante"; exit 2; }
BASE=$(echo "$PR_JSON" | jq -r .baseRefName)
git fetch origin "$BASE" --quiet
CODEX_COMPANION=$(ls -t \
  /Users/kbrdn1/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs \
  /Users/kbrdn1/.claude/plugins/marketplaces/openai-codex/plugins/codex/scripts/codex-companion.mjs \
  2>/dev/null | head -1)
[ -z "$CODEX_COMPANION" ] && { echo "❌ Companion Codex introuvable (fallback CodeRabbit nécessaire)"; exit 2; }
node "$CODEX_COMPANION" review --wait --base "origin/$BASE" --scope branch >/dev/null || { echo "❌ review Codex en échec"; exit 2; }
RESULT=$(node "$CODEX_COMPANION" result --json)
echo "$RESULT" | jq '{verdict, blocking: [.findings[] | select(.severity=="critical" or .severity=="high") | {severity, file, line_start, title, confidence}]}'
echo "$RESULT" | jq -r '[.findings[] | select(.severity=="critical" or .severity=="high")] | length | "P0P1_COUNT=\(.)"'
```

## Cycle

- **Discovery** : vérifier le contexte — être dans le checkout/worktree de la PR, sur sa branche (`gh pr view` doit renvoyer une PR) ; sinon s'y placer. Lire le contexte projet (`CLAUDE.md`, `.claude/rules/`, conventions/stack).
- **Planning** : déterminer la base (`origin/<baseRefName>`) et l'outillage de review (companion Codex local).
- **Execution** :
  Step 1: Lancer le `check_command`. Lire le JSON `blocking` : pour chaque finding `critical`/`high`, juger sa **pertinence** (vrai problème vs faux positif/hors-scope, en s'aidant de `confidence`).
  Step 2: Corriger la **cause racine** et les **éléments pertinents en fonction du contexte du projet** (conventions, stack, `CLAUDE.md` et `.claude/rules/` du repo) — commit atomique Gitmoji + Conventional référençant l'issue. Documenter et **écarter** les faux positifs / findings hors-scope ou contraires aux conventions du projet — sans jamais désactiver/skip une validation pour faire taire le finding.
- **Verification** : relancer le `check_command`, lire `P0P1_COUNT` et `verdict`.
- **Iteration** : tant qu'il reste des bloquants pertinents, reboucler ; sinon stop/handback.

## Protocole self-pace (compteur à 1)

1. Exécuter les steps (corriger les findings P0/P1 pertinents).
2. Lancer `check_command` et **LIRE sa sortie réelle** (le bloc JSON `blocking` + la ligne `P0P1_COUNT=`). Ne jamais supposer le résultat.
3. Évaluer `exit_when` : si `P0P1_COUNT=0` (ou les bloquants restants sont tous des faux positifs documentés/écartés) → **STOP**, annoncer le succès (citer `verdict`/`P0P1_COUNT`).
4. Sinon incrémenter. Si compteur ≥ 5 → **STOP**, annoncer la limite sans succès + lister les findings bloquants restants et pourquoi ils résistent.
5. Sinon recommencer.

Status à chaque passe : `🔁 Itération N/5 — <findings corrigés> → check: P0P1_COUNT=<n> (verdict <…>)`.

Garde-fous : ne jamais dépasser `max_iterations` ; jamais de succès sans `P0P1_COUNT=0` (ou écartement explicite) vu dans la sortie ; jamais skip/désactiver une validation — corriger la cause racine ; rester dans le bon checkout/branche. Si le companion est introuvable ou la review échoue (exit 2), **stopper et le signaler** (fallback CodeRabbit via `me:check-reviews`) plutôt que boucler à vide.
