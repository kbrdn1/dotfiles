---
name: me:run-loop
description: Utiliser quand l'utilisateur veut lancer une boucle auto-cadencée qui répète une action jusqu'à une condition de sortie observable — par ex. "boucle jusqu'à ce que les tests soient verts", "fix la CI jusqu'à ce qu'elle passe", "build until green", "lance le loop X". Porte le PROTOCOLE SELF-PACE partagé (closed-loop 5 phases) et route vers la bonne skill loop:<name>.
---

# me:run-loop — Moteur des boucles auto-cadencées (self-pace)

Ce skill est le **moteur** des loops : il porte le cycle closed-loop de référence et sert de point d'entrée en langage naturel (« boucle jusqu'à ce que les tests passent »). Chaque loop concret est une **skill `loop:<name>`** qui embarque sa définition et applique ce cycle.

> ⚠️ Ce n'est PAS la commande native `/loop` de Claude Code (planning récurrent multi-sessions). Ici tout se passe **dans la session courante**, en self-pace.

## Où vivent les loops

```
<base>/skills/loop/<name>/SKILL.md   →   /loop:<name>
```
`<base>` = `~/.claude` (global) ou `<repo>/.claude` (per-project). Claude Code découvre les deux ; pour le routing langage naturel, lister les skills `loop:*` visibles.

## Étape 1 — Localiser le loop

- **Invocation directe** `/loop:<name>` → loop identifié, passe au cycle.
- **Langage naturel** → matcher la demande sur le nom (`loop:<name>`) ou le goal/description. Un seul match → l'utiliser ; plusieurs → demander lequel ; aucun → lister les loops dispo et proposer `me:create-loop`.

## Étape 2 — Lire la définition + les dimensions

Depuis le corps de `loop:<name>`, extrais `goal`, `max_iterations`, `check_command`, `exit_when`, les phases du **Cycle**, et les **dimensions** annoncées en tête :

- **mode** : `closed` (borné) | `open` (exploratoire) — défaut `closed`.
- **trigger** : `self-pace` | `stop-hook` — défaut `self-pace`.
- **exécution** : `single` | `fleet` — défaut `single`.

(Si non annoncées, supposer les défauts : closed / self-pace / single.)

## Étape 3 — Exécuter selon le trigger

### trigger: self-pace (défaut)
Applique le **PROTOCOLE SELF-PACE**, compteur à `1`, à chaque passe :

1. **Discovery + Planning + Execution** — exécute les steps (et, si le loop les explicite, la découverte de contexte et le découpage).
2. **Verification** — lance `check_command` et **LIS sa sortie réelle** (stdout/stderr + code de sortie). Ne JAMAIS supposer le résultat.
3. Évalue **exit_when** sur cette sortie : **rempli → STOP**, annonce le succès (cite la preuve).
4. Sinon **incrémente**. Si `compteur ≥ max_iterations` → **STOP**, annonce la limite sans succès + ce qui bloque (cause racine probable).
5. Sinon **Iteration** : corrige les écarts pertinents (selon le contexte projet) et recommence à 1.

### trigger: stop-hook
Le loop porte un hook `Stop` dans son frontmatter qui relance tant que `exit_when` n'est pas atteint (garde-fou `stop_hook_active` + compteur). Ton rôle ici : **faire une première passe des steps**, puis laisser le hook piloter les relances. Si le hook est absent/cassé, **bascule en self-pace** et signale-le.

### exécution: fleet
Joue l'**orchestrateur** : décompose le goal, délègue chaque sous-objectif à un specialist (`Agent`/`Task`), qui peut fan-out via subagents. Le `check_command` reste l'**eval gate global** : la boucle continue jusqu'à `exit_when`, mais chaque specialist applique son propre mini-cycle discovery→…→verification. Respecte `max_iterations` au niveau orchestrateur.

## Étape 4 — Status à chaque passe

```
🔁 Itération N/max — <ce qui a été tenté> → check: <résultat observé de check_command>
```

## Garde-fous (non négociables)

- 🔴 **Ne jamais dépasser `max_iterations`.**
- 🔴 **Ne jamais déclarer succès** sans avoir **vu `exit_when` satisfaite** dans la sortie réelle du check.
- 🔴 **Ne jamais désactiver/skip** un test ou une validation pour faire passer le check — corriger la **cause racine**.
- 🟡 `mode: open` → borne l'exploration par le `budget` du loop et un standard de qualité explicite ; sans ça, un open loop part en dérive coûteuse.
- 🟡 `check_command` échoue pour raison d'environnement (commande introuvable, deps) → s'arrêter et le signaler plutôt que boucler à vide.
- 🟡 Deux passes consécutives avec exactement la même erreur sans progrès → le signaler (boucle stérile) au lieu de gaspiller les itérations.

## Créer un nouveau loop

Pour définir un nouveau loop (= une skill `loop:<name>`), utilise **`me:create-loop`** (conception sur mesure + dimensions).
