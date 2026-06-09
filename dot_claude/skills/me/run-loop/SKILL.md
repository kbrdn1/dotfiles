---
name: me:run-loop
description: Utiliser quand l'utilisateur veut lancer une boucle auto-cadencée qui répète une action jusqu'à une condition de sortie observable — par ex. "boucle jusqu'à ce que les tests soient verts", "fix la CI jusqu'à ce qu'elle passe", "build until green", "lance le loop X". Porte le PROTOCOLE SELF-PACE partagé et route vers la bonne skill loop:<name>.
---

# me:run-loop — Moteur des boucles auto-cadencées (self-pace)

Ce skill est le **moteur** des loops : il porte le PROTOCOLE SELF-PACE de référence et sert de point d'entrée en langage naturel (« boucle jusqu'à ce que les tests passent »). Chaque loop concret est une **skill `loop:<name>`** qui embarque sa définition et applique ce même protocole.

> ⚠️ Ce n'est PAS la commande native `/loop` de Claude Code (planning récurrent multi-sessions). Ici tout se passe **dans la session courante**, en self-pace : tu enchaînes les itérations toi-même.

## Où vivent les loops

Chaque loop est une skill sous le namespace `loop:` :

```
~/.claude/skills/loop/<name>/SKILL.md   →   invocable via /loop:<name>
```

Le frontmatter d'une skill loop porte `name: loop:<name>` ; son corps contient la définition (`goal`, `max_iterations`, `check_command`, `exit_when`, steps).

## Étape 1 — Localiser le loop demandé

- **Invocation directe** `/loop:<name>` → le loop est déjà identifié, passe au protocole.
- **Langage naturel** (« boucle jusqu'à vert », « lance le loop X ») → cherche la skill `loop:*` correspondante :
  - Liste les skills `loop:*` disponibles (dossiers de `~/.claude/skills/loop/`).
  - Matche sur le nom (`loop:<name>`) ou la description/le goal du loop.
  - **Un seul match** → l'utiliser. **Plusieurs** → demander lequel. **Aucun** → lister les loops disponibles et proposer d'en créer un via `me:create-loop`.

## Étape 2 — Lire la définition

Depuis le corps de la skill `loop:<name>`, extrais :

- `goal` — l'objectif mesurable.
- `max_iterations` — le plafond d'itérations (entier).
- `check_command` — la commande shell lancée entre les passes.
- `exit_when` — la condition de sortie, **observable dans la sortie de `check_command`**.
- Les **steps** — ce qu'il faut faire à chaque passe.

## Étape 3 — PROTOCOLE SELF-PACE (à appliquer exactement)

Initialise un compteur à `1`. À chaque passe :

1. **Exécuter le ou les steps** (faire le travail réel décrit).
2. **Lancer `check_command`** et **LIRE sa sortie réelle** (stdout/stderr + code de sortie). Ne JAMAIS supposer le résultat.
3. **Évaluer `exit_when`** sur cette sortie observée :
   - **Remplie** → **STOP**, annoncer le succès (citer l'élément de sortie qui satisfait `exit_when`).
4. **Sinon, incrémenter le compteur.**
   - Si `compteur ≥ max_iterations` → **STOP**, annoncer la limite atteinte **sans succès**, résumer **ce qui bloque** (dernière erreur, hypothèse de cause racine).
5. **Sinon, recommencer** à l'étape 1.

## Étape 4 — Status update à chaque passe

```
🔁 Itération N/max — <ce qui a été tenté> → check: <résultat observé de check_command>
```

## Garde-fous (non négociables)

- 🔴 **Ne jamais dépasser `max_iterations`.**
- 🔴 **Ne jamais déclarer succès** sans avoir **vu `exit_when` satisfaite** dans la sortie réelle du check.
- 🔴 **Ne jamais désactiver/skip** un test ou une validation pour faire passer le check — corriger la **cause racine** (cf. RULES.md « Échecs »).
- 🟡 Si `check_command` échoue pour une raison d'environnement (commande introuvable, deps manquantes), s'arrêter et le signaler plutôt que de tourner à vide.
- 🟡 Chaque itération doit tenter une action **incrémentale** ; deux passes consécutives avec exactement la même erreur sans progrès → le signaler (boucle stérile) au lieu de gaspiller les itérations.

## Créer un nouveau loop

Pour définir un nouveau loop (= une nouvelle skill `loop:<name>`), utilise **`me:create-loop`**.
