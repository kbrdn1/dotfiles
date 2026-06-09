---
name: me:create-loop
description: Utiliser quand l'utilisateur veut CRÉER ou définir un nouveau loop auto-cadencé (pas en lancer un existant). Demande la portée (globale ~/.claude ou per-project <repo>/.claude) si non précisée, puis scaffolde la skill loop:<name> + sa commande /loop:<name>.
---

# me:create-loop — Définir un nouveau loop (skill `loop:<name>`)

Ce skill **crée une skill loop** : un nouveau loop auto-cadencé, matérialisé comme la skill `loop:<name>` invocable via `/loop:<name>`. Il ne lance rien — il scaffolde la définition.

> Pour **exécuter** un loop, c'est `me:run-loop` (ou directement `/loop:<name>`).

## Étape 0 — Déterminer la portée (`<base>`)

Un loop peut être **global** (dispo dans tous les projets) ou **per-project** (versionné avec un repo). Cela fixe la racine `<base>` utilisée partout ensuite :

| Portée | `<base>` | Skill | Commande |
|--------|----------|-------|----------|
| **Globale** | `~/.claude` | `~/.claude/skills/loop/<name>/SKILL.md` | `~/.claude/commands/loop/<name>.md` |
| **Per-project** | `<racine_repo>/.claude` | `<repo>/.claude/skills/loop/<name>/SKILL.md` | `<repo>/.claude/commands/loop/<name>.md` |

🔴 **Si l'utilisateur n'a pas précisé la portée, la DEMANDER explicitement** (globale ou projet) avant d'écrire — ne pas deviner. Indices possibles : « pour ce projet / ce repo » → per-project ; « partout / global / pour tous mes projets » → globale. En cas de doute, poser la question.

> Chaque loop = **deux** fichiers, sous la même `<base>` : la skill `loop:<name>` (comportement) et la commande `/loop:<name>` (déclencheur slash).

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

## Étape 3 — Écrire la skill `loop:<name>` ET sa commande `/loop:<name>`

Un loop a **deux** fichiers : la skill (le comportement) et la commande (le déclencheur slash). Crée les deux.

### 3a — La skill : `<base>/skills/loop/<name>/SKILL.md`

Si le dossier existe déjà, le signaler et demander : écraser, renommer, ou éditer.

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

### 3b — La commande : `<base>/commands/loop/<name>.md`

C'est le déclencheur slash `/loop:<name>`. Une commande mince qui invoque la skill homonyme. Utilise **exactement** ce gabarit :

```markdown
---
description: "Loop auto-cadencé — <goal> ; relance `<check_command>` jusqu'à « <exit_when> », max <max_iterations> itérations"
---

Invoke the `loop:<name>` skill via the Skill tool to run this self-paced loop.

Pass along any user arguments: $ARGUMENTS
```

## Étape 4 — Confirmer

Affiche les **deux chemins créés** et rappelle comment le lancer :

> Loop créé (portée : <globale | per-project>) :
> - skill `<base>/skills/loop/<name>/SKILL.md` (`loop:<name>`)
> - commande `<base>/commands/loop/<name>.md` (`/loop:<name>`)
>
> Pour le lancer : `/loop:<name>` — ou « lance le loop <name> » (le moteur `me:run-loop` route). Un **redémarrage de session** est en général nécessaire pour que Claude Code découvre la nouvelle skill/commande.
>
> Si portée **globale** et dotfiles gérés par chezmoi → pense à versionner (skill `chezmoi`). Si **per-project**, commite les deux fichiers avec le repo.
