---
name: loop:test-until-green
description: Loop auto-cadencé — tous les tests passent. Utiliser pour lancer cette boucle : répète les steps et relance `npm test` jusqu'à ce que la commande sorte avec le code 0, max 10 itérations. Déclencheurs : "/loop:test-until-green", "lance le loop test-until-green", "boucle jusqu'à ce que les tests soient verts".
---

# loop:test-until-green

Loop auto-cadencé. Applique le **PROTOCOLE SELF-PACE** ci-dessous (canonique dans la skill `me:run-loop`).

## Définition

- **goal** : tous les tests passent
- **max_iterations** : 10
- **check_command** : `npm test`
- **exit_when** : la commande de test sort avec le code 0

### Steps
Step 1: Lance les tests. S'il y a des échecs, corrige la plus petite cause racine, puis recommence.

## Protocole self-pace (compteur à 1)

1. Exécuter le ou les steps.
2. Lancer `npm test` et **LIRE sa sortie réelle** (stdout/stderr + code de sortie). Ne jamais supposer le résultat.
3. Évaluer `exit_when` sur cette sortie : si la commande sort avec le code 0 → **STOP**, annoncer le succès (citer la preuve dans la sortie).
4. Sinon incrémenter. Si compteur ≥ 10 → **STOP**, annoncer la limite sans succès + ce qui bloque.
5. Sinon recommencer.

Status à chaque passe : `🔁 Itération N/10 — <tenté> → check: <résultat>`.

Garde-fous : ne jamais dépasser `max_iterations` ; jamais de succès sans `exit_when` vu dans la sortie ; jamais skip/désactiver une validation — corriger la cause racine.
