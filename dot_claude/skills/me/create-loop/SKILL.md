---
name: me:create-loop
description: Utiliser quand l'utilisateur veut CRÉER ou définir un nouveau loop auto-cadencé (pas en lancer un existant). Scaffolde une skill loop:<name> dans ~/.claude/skills/loop/<name>/SKILL.md, lançable via /loop:<name>.
---

# me:create-loop — Définir un nouveau loop (skill `loop:<name>`)

Ce skill **crée une skill loop** : un nouveau loop auto-cadencé, matérialisé comme la skill `loop:<name>` invocable via `/loop:<name>`. Il ne lance rien — il scaffolde la définition.

> Pour **exécuter** un loop, c'est `me:run-loop` (ou directement `/loop:<name>`).

## Où écrire

```
~/.claude/skills/loop/<name>/SKILL.md      →   name: loop:<name>   →   /loop:<name>
```

`<name>` est en **kebab-case** (ex. `Build Until Green` → `build-until-green` → `loop:build-until-green`).

## Étape 1 — Recueillir les 5 champs

Demande (ou **infère du message**, puis confirme ce qui manque) :

| Champ | Description | Exemple |
|-------|-------------|---------|
| `goal` | Objectif mesurable | `tous les tests passent` |
| `max_iterations` | Plafond d'itérations (entier > 0) | `10` |
| `check_command` | Commande shell lancée entre les passes | `npm test` |
| `exit_when` | Condition de sortie **observable dans la sortie de `check_command`** | `la commande sort avec le code 0` |
| `Step 1` (…N) | Ce qu'il faut faire à chaque passe | `Lance les tests, corrige la plus petite cause racine, recommence.` |

## Étape 2 — Valider avant d'écrire

- 🟡 **`check_command` est une vraie commande shell** exécutable telle quelle (pas une description vague). En cas de doute sur l'outil, s'appuyer sur le contexte du repo (`package.json`, `Makefile`, `composer.json`, `cargo`, etc.).
- 🔴 **`exit_when` est observable dans la sortie de `check_command`** : vérifiable en lisant stdout/stderr ou le code de sortie (ex. « code de sortie 0 », « 0 failing », « Build succeeded »). Sinon reformuler ou changer de `check_command` — autrement `me:run-loop` ne pourra jamais conclure proprement.
- 🟡 `max_iterations` entier > 0. Au moins un `Step`.

Si une validation échoue, l'expliquer et proposer une correction **avant** d'écrire.

## Étape 3 — Écrire la skill `loop:<name>`

Crée `~/.claude/skills/loop/<name>/SKILL.md`. Si le dossier existe déjà, le signaler et demander : écraser, renommer, ou éditer.

Utilise **exactement** ce gabarit (remplace les `<…>`) :

```markdown
---
name: loop:<name>
description: Loop auto-cadencé — <goal>. Utiliser pour lancer cette boucle : répète les steps et relance `<check_command>` jusqu'à ce que « <exit_when> », max <max_iterations> itérations. Déclencheurs : "/loop:<name>", "lance le loop <name>", "<goal>".
---

# loop:<name>

Loop auto-cadencé. Applique le **PROTOCOLE SELF-PACE** ci-dessous (canonique dans la skill `me:run-loop`).

## Définition

- **goal** : <goal>
- **max_iterations** : <max_iterations>
- **check_command** : `<check_command>`
- **exit_when** : <exit_when>

### Steps
Step 1: <step 1>
<Step 2…N si fournis>

## Protocole self-pace (compteur à 1)

1. Exécuter le ou les steps.
2. Lancer `<check_command>` et **LIRE sa sortie réelle** (stdout/stderr + code de sortie). Ne jamais supposer le résultat.
3. Évaluer `exit_when` sur cette sortie : si « <exit_when> » → **STOP**, annoncer le succès (citer la preuve dans la sortie).
4. Sinon incrémenter. Si compteur ≥ <max_iterations> → **STOP**, annoncer la limite sans succès + ce qui bloque.
5. Sinon recommencer.

Status à chaque passe : `🔁 Itération N/<max_iterations> — <tenté> → check: <résultat>`.

Garde-fous : ne jamais dépasser `max_iterations` ; jamais de succès sans `exit_when` vu dans la sortie ; jamais skip/désactiver une validation — corriger la cause racine.
```

## Étape 4 — Confirmer

Affiche le **chemin créé** et rappelle comment le lancer :

> Loop créé : `~/.claude/skills/loop/<name>/SKILL.md` (skill `loop:<name>`). Pour le lancer : `/loop:<name>` — ou « lance le loop <name> » (le moteur `me:run-loop` route). Un redémarrage de session peut être nécessaire pour que Claude Code découvre la nouvelle skill.
