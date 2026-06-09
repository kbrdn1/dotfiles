---
name: loop:test-until-green
description: Loop auto-cadencé — relance `npm test` et corrige jusqu'à ce que tous les tests passent (exit 0), max 10 itérations. Déclencheurs : "/loop:test-until-green", "lance le loop test-until-green", "boucle jusqu'à ce que les tests soient verts".
---

# loop:test-until-green

Loop auto-cadencé. **mode:** closed · **trigger:** self-pace · **exécution:** single.
Applique le **PROTOCOLE SELF-PACE** ci-dessous (canonique dans `me:run-loop`).

## Définition

- **goal** : tous les tests passent
- **max_iterations** : 10
- **check_command** (eval gate) : `npm test`
- **exit_when** : la commande de test sort avec le code 0

## Cycle

- **Discovery** : repérer le runner de test du projet ; si ce n'est pas `npm test` (ex. `pnpm test`, `bun test`, `cargo test`), adapter le `check_command`.
- **Planning** : à partir des échecs, cibler la plus petite cause racine à corriger en premier.
- **Execution** :
  Step 1: Lance les tests. S'il y a des échecs, corrige la plus petite cause racine, puis recommence.
- **Verification** : lancer `npm test`, lire la sortie réelle (échecs + code de sortie).
- **Iteration** : corriger la cause racine (jamais skip/désactiver un test) ; reboucler ou stop quand vert.

## Protocole self-pace (compteur à 1)

1. Exécuter le ou les steps (corriger la plus petite cause racine).
2. Lancer `npm test` et **LIRE sa sortie réelle**. Ne jamais supposer le résultat.
3. Évaluer `exit_when` : si la commande sort avec le code 0 → **STOP**, annoncer le succès (citer la preuve dans la sortie).
4. Sinon incrémenter. Si compteur ≥ 10 → **STOP**, annoncer la limite sans succès + ce qui bloque.
5. Sinon recommencer.

Status à chaque passe : `🔁 Itération N/10 — <tenté> → check: <résultat>`.

Garde-fous : ne jamais dépasser `max_iterations` ; jamais de succès sans `exit_when` vu dans la sortie ; jamais skip/désactiver une validation — corriger la cause racine.
