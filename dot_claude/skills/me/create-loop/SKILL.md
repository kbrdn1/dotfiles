---
name: me:create-loop
description: Utiliser quand l'utilisateur veut CRÉER ou définir un nouveau loop auto-cadencé (pas en lancer un existant). Conçoit un loop SUR MESURE (closed-loop discovery→planning→execution→verification→iteration), demande la portée (globale ~/.claude ou per-project <repo>/.claude) et les dimensions (mode closed/open, trigger self-pace/stop-hook, single/fleet) si non précisées, puis scaffolde la skill loop:<name> + sa commande /loop:<name> (+ hook si stop-hook).
---

# me:create-loop — Concevoir un loop sur mesure (skill `loop:<name>`)

Ce skill **crée un loop auto-cadencé** matérialisé comme la skill `loop:<name>` (invocable `/loop:<name>`). Il ne lance rien — il conçoit et scaffolde la définition.

> Pour **exécuter** un loop, c'est `me:run-loop` (ou directement `/loop:<name>`).

## 🎯 Principe : custom, pas un gabarit rigide

Un loop se conçoit **en fonction du besoin réel**. Les gabarits ci-dessous sont un point de départ, **pas un carcan** : adapte les phases, omets ce qui n'a pas de sens, ajoute ce qui manque. 🔴 **Dès qu'un élément structurant manque ou est ambigu, INTERROGE l'utilisateur — ne devine pas.** Mieux vaut deux questions ciblées qu'un loop bancal.

## 🔁 Modèle conceptuel — closed-loop en 5 phases

Tout loop suit ce cycle (réf. « agent looping ») ; chaque phase est adaptée au besoin :

1. **Discovery** — trouver ce qu'il faut savoir avant d'agir (contexte projet, état courant).
2. **Planning** — découper l'objectif en étapes claires.
3. **Execution** — faire le travail (les `steps`).
4. **Verification** — l'**eval gate** : `check_command` + évaluation de `exit_when` sur sa sortie réelle.
5. **Iteration** — corriger les écarts, reboucler ; sinon **stop / handback** à l'utilisateur.

Un loop simple (ex. `test-until-green`) condense discovery+planning dans un step ; un loop riche les explicite. À toi de juger.

## Dimensions à fixer (demander si non précisé)

| Dimension | Valeurs | Défaut | Quand demander |
|-----------|---------|--------|----------------|
| **portée `<base>`** | globale `~/.claude` \| per-project `<repo>/.claude` | — | 🔴 **toujours** si absent |
| **mode** | `closed` (borné) \| `open` (exploratoire) | `closed` | 🔴 avant tout `open` (coût tokens élevé) |
| **trigger** | `self-pace` (session) \| `stop-hook` (hook Stop) | `self-pace` | si l'utilisateur veut une relance automatique |
| **portée d'exécution** | `single` (1 agent) \| `fleet` (orchestrateur+specialists+subagents) | `single` | si l'objectif est gros/décomposable |

## Étape 1 — Discovery du besoin

Recueille (ou **infère du message, puis confirme**) : le `goal`, les 4 dimensions, et de quoi remplir les phases. Pose des questions ciblées pour tout champ structurant manquant. Inspecte au besoin le contexte projet (`CLAUDE.md`, `.claude/rules/`, stack) pour proposer un `check_command` réaliste.

## Étape 2 — Champs du loop

- `goal` — objectif mesurable.
- `max_iterations` — plafond d'itérations (entier > 0).
- `check_command` — l'eval gate : commande shell réelle, exécutable telle quelle.
- `exit_when` — condition **observable dans la sortie de `check_command`**.
- `steps` (Execution) +, si pertinent, notes de **Discovery** / **Planning** / **Iteration**.
- si `mode: open` → `budget` (plafond tokens/itérations) + garde-fous.
- si `fleet` → décomposition orchestrateur → specialists → subagents.

## Étape 3 — Valider avant d'écrire

- 🟡 `check_command` est une **vraie commande shell** (pas une description). S'appuyer sur le contexte repo (`package.json`, `Makefile`, `composer.json`, `cargo`…).
- 🔴 `exit_when` est **observable** dans la sortie de `check_command` (code de sortie, `0 failing`, `P0P1_COUNT=0`, `Build succeeded`…). Sinon reformuler / changer de check.
- 🟡 `max_iterations` entier > 0 ; au moins un step.
- 🔴 `mode: open` → exiger un `budget` explicite + avertir du coût ; sans standard clair, un open loop devient une « slop machine ».
- 🟡 `trigger: stop-hook` → prévoir le script + le hook dans le frontmatter de la skill (Étape 4c) ; rappeler que c'est **non testé** et que le caveat doc s'applique (cf. 4c).
- 🟡 `fleet` → exiger une décomposition nette (qui orchestre, quels specialists, quel eval gate global).

## Étape 4 — Écrire (sur mesure)

### 4a — La skill : `<base>/skills/loop/<name>/SKILL.md`

`<name>` en **kebab-case**. Si le dossier existe, demander : écraser, renommer, éditer. Pars du gabarit **self-pace closed** ci-dessous et **adapte-le au besoin** (ajoute/retire des phases, ajuste le protocole) :

```markdown
---
name: loop:<name>
description: Loop auto-cadencé — <goal>. Relance `<check_command>` jusqu'à « <exit_when> », max <max_iterations> itérations. Déclencheurs : "/loop:<name>", "lance le loop <name>", "<goal>".
---

# loop:<name>

Loop auto-cadencé. **mode:** <closed|open> · **trigger:** <self-pace|stop-hook> · **exécution:** <single|fleet>.
Applique le **PROTOCOLE SELF-PACE** ci-dessous (canonique dans `me:run-loop`).

## Définition
- **goal** : <goal>
- **max_iterations** : <max_iterations>
- **check_command** (eval gate) : `<check_command>`
- **exit_when** : <exit_when>
<- **budget** : <plafond>   (si mode: open)>

## Cycle
- **Discovery** : <ce qu'il faut savoir / lire avant d'agir — contexte projet>
- **Planning** : <découpage en étapes>
- **Execution (steps)** :
  Step 1: <…>
  <Step 2…N>
- **Verification** : lancer `<check_command>`, lire la sortie réelle, évaluer `exit_when`.
- **Iteration** : corriger les écarts pertinents (selon le contexte projet : CLAUDE.md, .claude/rules, conventions) ; reboucler ou stop/handback.

## Protocole self-pace (compteur à 1)
1. Exécuter Discovery+Planning+Execution (les steps).
2. Lancer `<check_command>` et **LIRE sa sortie réelle**. Ne jamais supposer le résultat.
3. Évaluer `exit_when` : si rempli → **STOP**, annoncer le succès (citer la preuve dans la sortie).
4. Sinon incrémenter. Si compteur ≥ <max_iterations> → **STOP**, annoncer la limite sans succès + ce qui bloque.
5. Sinon recommencer.

Status à chaque passe : `🔁 Itération N/<max_iterations> — <tenté> → check: <résultat>`.
Garde-fous : ne jamais dépasser `max_iterations` ; jamais de succès sans `exit_when` vu dans la sortie ; jamais skip/désactiver une validation — corriger la cause racine.
```

**Adaptations selon les dimensions :**
- **mode: open** → ajouter une ligne `budget` ; dans Iteration, autoriser l'exploration de pistes non spécifiées mais **borner par le budget** et un standard de qualité explicite (eval gate strict). Avertir l'utilisateur du coût.
- **fleet** → remplacer la section Execution par une orchestration : l'agent courant joue l'**orchestrateur**, délègue chaque sous-objectif à un `Agent`/`Task` (specialist), qui peut lui-même fan-out via subagents ; le `check_command` reste l'**eval gate global**. Chaque specialist applique le même mini-cycle discovery→…→verification.

### 4b — La commande : `<base>/commands/loop/<name>.md`

```markdown
---
description: "Loop auto-cadencé — <goal> ; relance `<check_command>` jusqu'à « <exit_when> », max <max_iterations> itérations"
---

Invoke the `loop:<name>` skill via the Skill tool to run this self-paced loop.

Pass along any user arguments: $ARGUMENTS
```

### 4c — (si `trigger: stop-hook`) Hook Stop scopé à la skill

Le hook ne doit s'armer **que quand le loop tourne** → on le déclare **dans le frontmatter de la skill** `loop:<name>` (la doc : actif « while the skill or agent is active »), pas dans `settings.json` global. Ajoute au frontmatter :

```yaml
hooks:
  Stop:
    - hooks:
        - type: command
          command: "<chemin_absolu_ou_$CLAUDE_PROJECT_DIR>/skills/loop/<name>/stop-hook.sh"
```

Et génère `<base>/skills/loop/<name>/stop-hook.sh` (`chmod +x`), gabarit :

```bash
#!/usr/bin/env bash
INPUT=$(cat)
# Garde-fou anti-boucle : si un blocage Stop est déjà actif, laisser s'arrêter
[ "$(printf '%s' "$INPUT" | jq -r '.stop_hook_active')" = "true" ] && exit 0
# Compteur d'itérations (respecte max_iterations en plus du cap natif de 8)
CNT_FILE="${TMPDIR:-/tmp}/loop-<name>.count"; N=$(cat "$CNT_FILE" 2>/dev/null || echo 0)
[ "$N" -ge <max_iterations> ] && { rm -f "$CNT_FILE"; exit 0; }
# Eval gate
OUT=$(<check_command> 2>&1)
if printf '%s' "$OUT" | <test exit_when, ex: grep -q 'P0P1_COUNT=0'>; then
  rm -f "$CNT_FILE"; exit 0   # exit_when atteint → laisser s'arrêter
fi
echo $((N+1)) > "$CNT_FILE"
jq -n --arg r "exit_when non atteint (itération $((N+1))/<max_iterations>). Refais les steps du loop:<name> puis laisse le hook revérifier." '{decision:"block", reason:$r}'
exit 0
```

⚠️ **Honnêteté** : variante **non testée end-to-end**. La doc ne garantit pas explicitement que le hook de frontmatter reste actif à *chaque* tour d'un loop multi-tour ; cap natif de 8 blocages (`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` pour l'élever). En cas de doute, préférer `self-pace`.

## Étape 5 — Confirmer

Affiche les chemins créés et comment lancer :

> Loop créé (portée <globale|per-project>, mode <…>, trigger <…>, <single|fleet>) :
> - skill `<base>/skills/loop/<name>/SKILL.md` (`loop:<name>`)
> - commande `<base>/commands/loop/<name>.md` (`/loop:<name>`)
> <- hook `<base>/skills/loop/<name>/stop-hook.sh` (si stop-hook)>
>
> Pour lancer : `/loop:<name>` — ou « lance le loop <name> » (le moteur `me:run-loop` route). **Redémarrage de session** en général nécessaire pour la découverte.
>
> Si portée **globale** + dotfiles chezmoi → versionner (skill `chezmoi`). Si **per-project** → committer avec le repo.
