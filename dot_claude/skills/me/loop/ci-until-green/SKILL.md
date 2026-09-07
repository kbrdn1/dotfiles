---
name: me:loop:ci-until-green
description: Loop auto-cadencé — attend la CI de la PR de la branche courante, lit les checks du SHA exact de HEAD, corrige la cause racine des jobs en échec et repousse, jusqu'à ce que tous les checks passent, max 6 itérations. Déclencheurs : "/me:loop:ci-until-green", "lance le loop ci-until-green", "fix la CI jusqu'à ce qu'elle passe", "boucle jusqu'à la CI verte".
---

# me:loop:ci-until-green

Loop auto-cadencé. **mode:** closed · **trigger:** self-pace · **exécution:** single · **hardened:** true (bloc anti-triche de `me:run-loop`).
Comble le trou entre « PR poussée » et « CI verte » dans les workflows git (`me:issue-worktree-pr`, `me:issue-branch-pr`, `me:release`). Applique le **PROTOCOLE SELF-PACE** ci-dessous (canonique dans `me:run-loop`).

> ⚠️ Lance ce loop **depuis le checkout/worktree de la PR**, sur sa branche — le check lit `gh pr view` sur la branche courante.

> Remplace la skill `watch-ci` (max 3 tentatives en dur, aucune garde anti-faux-propre, hors du système de loops).

## Définition

- **goal** : tous les checks CI de la PR de la branche courante passent, **sur le commit qui est actuellement HEAD**.
- **max_iterations** : 6
- **exit_when** : la sortie du check affiche `CI_FAILED=0` **et** `CI_PENDING=0` **et** `CI_TOTAL` ≥ 1.
- **check_command** (eval gate) : ci-dessous.

### La garde anti-faux-propre, ici

Trois façons pour cette boucle de déclarer une CI verte qui ne l'est pas — les trois sont fermées dans le script :

1. **Checks périmés.** `gh pr checks` rapporte le dernier état connu de la PR. Juste après un push, la nouvelle run n'existe pas encore → on lirait le **vert du commit précédent**. → le script interroge les checks du **SHA exact** (`repos/{repo}/commits/{sha}/check-runs`), pas « la PR », et **refuse** de conclure tant que HEAD local ≠ head de la PR.
2. **Aucun check.** Un repo sans CI, ou un workflow qui n'a pas déclenché, rend une liste vide → `0 échec` se lit « vert ». → `CI_TOTAL=0` sort en **erreur**, pas en succès.
3. **Travail non poussé.** Corriger en local sans pousser laisse la CI verte du commit d'avant. → comparaison `git rev-parse HEAD` vs `headRefOid`.

```bash
set -o pipefail
PR_JSON=$(gh pr view --json number,headRefOid,url 2>/dev/null) || { echo "❌ Aucune PR pour la branche courante"; exit 2; }
SHA=$(git rev-parse HEAD)
REMOTE_SHA=$(printf '%s' "$PR_JSON" | jq -r .headRefOid)
# (1) GARDE : tout doit être poussé, sinon on lirait la CI d'un commit qui n'est plus le nôtre.
[ "$SHA" = "$REMOTE_SHA" ] || {
  echo "❌ HEAD local ($SHA) ≠ head de la PR ($REMOTE_SHA) — pousse d'abord"
  echo "   (ne PAS lire la CI de la PR comme le verdict du travail local)"; exit 2; }
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner) || exit 2

# `neutral`/`skipped`/`success` ne sont pas des échecs. Un check-run non `completed`
# et un commit-status `pending` sont de l'attente, pas un verdict.
BAD='["failure","timed_out","action_required","cancelled","error"]'
WAIT='["queued","in_progress","pending"]'

# UNE SEULE source de vérité pour les compteurs : "<total> <pending> <failed>",
# sur l'union check-runs + commit statuses. Le verdict affiché et la garde (4) la
# partagent — deux comptes indépendants du même truc finissent toujours par diverger.
counts() {
  printf '%s\n%s\n' "$RUNS" "$ST" | jq -s -r --argjson w "$WAIT" --argjson b "$BAD" '
    ( [ (.[0].check_runs // [])[] | (.conclusion // .status) ]
    + [ (.[1].statuses  // [])[] | .state ] ) as $s
    | "\($s|length) \([$s[]|select(IN($w[]))]|length) \([$s[]|select(IN($b[]))]|length)"'
}

# (2) ATTENTE bornée sur CE sha.
NOW=$(date +%s)
DEADLINE=$(( NOW + ${CI_TIMEOUT_S:-2700} ))   # 45 min
# Fenêtre de décantation : juste après un push, la run n'est pas encore CRÉÉE →
# `check_runs` est vide, donc pending=0. Sans cette fenêtre on conclurait « aucune CI »
# (garde 4, exit 2) sur le cas parfaitement normal « poussé il y a 5 secondes », et la
# passe serait brûlée pour rien. Zéro check ne devient un verdict qu'après ce délai.
SETTLE=$(( NOW + ${CI_SETTLE_S:-120} ))
while :; do
  RUNS=$(gh api "repos/$REPO/commits/$SHA/check-runs?per_page=100" 2>/dev/null) || { echo "❌ API check-runs injoignable"; exit 2; }
  ST=$(gh api "repos/$REPO/commits/$SHA/status" 2>/dev/null || echo '{"statuses":[]}')
  read -r TOTAL PENDING FAILED <<< "$(counts)"
  NOW=$(date +%s)
  [ "$TOTAL" -gt 0 ] && [ "$PENDING" -eq 0 ] && break        # verdict disponible
  [ "$TOTAL" -eq 0 ] && [ "$NOW" -ge "$SETTLE" ] && break     # vraie absence de CI → garde (4)
  [ "$NOW" -ge "$DEADLINE" ] && { echo "⏱️ timeout — $PENDING check(s) encore en cours"; break; }
  if [ "$TOTAL" -eq 0 ]; then echo "⏳ aucun check encore créé sur $SHA — attente du déclenchement…"
  else echo "⏳ $PENDING/$TOTAL check(s) en cours…"; fi
  sleep "${CI_POLL_S:-30}"
done

# (3) VERDICT sur le sha exact.
echo "CI_TOTAL=$TOTAL"
echo "=== failing ==="
printf '%s\n%s\n' "$RUNS" "$ST" | jq -s -r --argjson b "$BAD" '
  ( [ (.[0].check_runs // [])[] | {name, state: (.conclusion // .status), url: .html_url} ]
  + [ (.[1].statuses  // [])[] | {name: .context, state: .state, url: .target_url} ] )
  | [ .[] | select(.state | IN($b[])) ]
  | if length == 0 then "(none)" else (.[] | "- \(.name) [\(.state)] \(.url // "")") end'
echo "CI_PENDING=$PENDING"
echo "CI_FAILED=$FAILED"

# (4) GARDE : zéro check n'est pas une CI verte.
[ "$TOTAL" -gt 0 ] || {
  echo "❌ aucun check rapporté sur $SHA — ce n'est pas une CI verte, c'est une absence de CI"
  echo "   (workflow non déclenché ? repo sans CI ? vérifier .github/workflows/)"; exit 2; }
```

## Cycle

- **Discovery** : être dans le checkout/worktree de la PR, sur sa branche, **tout poussé**. Lire le contexte projet (`CLAUDE.md`, `.claude/rules/`, stack, workflows CI dans `.github/workflows/`).
- **Planning** : sur échec, identifier le job fautif et cibler la **plus petite cause racine**. Un job rouge par une cause commune (lint global, version de toolchain) se corrige une fois, pas job par job.
- **Execution** :
  Step 1: lancer le `check_command`, lire le bloc `failing` + `CI_TOTAL` / `CI_PENDING` / `CI_FAILED`.
  Step 2: pour chaque check en échec, récupérer les logs — `gh run view <run-id> --log-failed` (l'id se déduit de l'URL du check) — et corriger la **cause racine**. Commit atomique Gitmoji + Conventional référençant l'issue, puis **push** (sans push, la passe suivante sortira en erreur sur la garde (1), c'est voulu).
- **Verification** : relancer le `check_command` sur le nouveau HEAD.
- **Iteration** : reboucler tant qu'il reste des échecs ; sinon stop/handback.

## Protocole self-pace (compteur à 1)

1. Exécuter les steps (corriger la cause racine du/des check(s) rouge(s), commit, push).
2. Lancer le `check_command` et **LIRE sa sortie réelle**. Ne jamais supposer le résultat.
3. Évaluer `exit_when` : si `CI_FAILED=0` **et** `CI_PENDING=0` **et** `CI_TOTAL` ≥ 1 → **STOP**, annoncer le succès (citer les trois compteurs).
4. Sinon incrémenter. Si compteur ≥ 6 → **STOP**, annoncer la limite sans succès + lister les checks qui résistent et pourquoi.
5. Sinon recommencer.

Status à chaque passe : `🔁 Itération N/6 — <corrections poussées> → check: CI_FAILED=<n> CI_PENDING=<n> CI_TOTAL=<n>`.

## Garde-fous

- 🔴 Ne jamais dépasser `max_iterations`.
- 🔴 Jamais de succès sans les trois compteurs vus dans la sortie. **`CI_TOTAL=0` n'est pas un succès** — c'est une absence de CI, le check sort en erreur.
- 🔴 **Jamais désactiver un job, retirer une étape, ajouter `continue-on-error`, marquer un test `skip` ou relancer la run en espérant qu'elle passe** — corriger la cause racine. Une CI rendue verte en la rendant aveugle est le pire résultat possible de cette boucle.
- 🟡 Échec **flaky** (passe au relancement sans changement de code) : ne pas le masquer. Le signaler explicitement dans le rapport final comme flaky à traiter à part — un flaky n'est pas une cause racine corrigée.
- 🟡 Échec d'**environnement** côté CI (secret manquant, quota du runner, service tiers indisponible) : `exit 2` du check ou échec non lié au diff → **stopper et signaler**, ne pas brûler des itérations sur ce que le code ne peut pas corriger.
- 🟡 Deux passes consécutives avec exactement le même échec sans progrès → le signaler (boucle stérile) au lieu de gaspiller les itérations.
