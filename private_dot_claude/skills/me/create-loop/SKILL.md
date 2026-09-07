---
name: me:create-loop
description: Utiliser quand l'utilisateur veut CRÉER ou définir un nouveau loop auto-cadencé (pas en lancer un existant). Conçoit un loop SUR MESURE (closed-loop discovery→planning→execution→verification→iteration), demande la portée (globale ~/.claude ou per-project <repo>/.claude) et les dimensions (mode closed/open, trigger self-pace/stop-hook, single/fleet) si non précisées, puis scaffolde la skill me:loop:<name> + sa commande /me:loop:<name> (+ hook si stop-hook).
---

# me:create-loop — Concevoir un loop sur mesure (skill `me:loop:<name>`)

Ce skill **crée un loop auto-cadencé** matérialisé comme la skill `me:loop:<name>` (invocable `/me:loop:<name>`). Il ne lance rien — il conçoit et scaffolde la définition.

> Pour **exécuter** un loop, c'est `me:run-loop` (ou directement `/me:loop:<name>`).

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
- 🔴 **Garde anti-faux-propre** — si `exit_when` se déduit d'un **parsing de texte** (et non d'un code de sortie), le check DOIT exiger une **preuve d'exécution positive** avant de rendre un verdict, et sortir en **erreur** — jamais en zéro — quand elle manque. Sans ça, un outil en échec (quota épuisé, binaire absent, rapport vide) rend une sortie vide que le parser lit « 0 problème » : le loop déclare le succès sans qu'une ligne ait été vérifiée. Le motif de la preuve doit exiger un **chiffre** (`RESUME:[[:space:]]*P0=[0-9]`), sinon un gabarit de prompt réémis dans la sortie le satisfait tout seul. Vécu deux fois : #772 (2026-09-01), rejoué à l'identique #1008 (2026-09-02). Gabarit :

  ```bash
  grep -qE "<motif de preuve avec un chiffre>" "$OUT" || {
    echo "❌ check NON exécuté — aucune preuve d'exécution dans la sortie"
    grep -iE "usage limit|rate limit|quota|unauthorized|ERROR:" "$OUT" | head -3
    echo "   (ne PAS lire ce résultat comme 0 — relancer, ou basculer sur <fallback>)"
    exit 2
  }
  ```
- 🔴 **Test de mutation du gate — le loop n'est pas livrable tant que son `check_command` n'a pas été VU rouge.** La garde anti-faux-propre prouve que le check *a tourné*. Rien ne prouve qu'il *sait échouer*. Un `check_command` cassé qui rend toujours `0` ressemble exactement à un projet parfait, et rien ne le signale — jamais. Donc, avant de déclarer le loop utilisable, trois observations, dans cet ordre :

  1. **vert** sur l'état courant (propre),
  2. **rouge** après avoir cassé volontairement une chose que le check doit attraper — inverser une assertion, retirer un flag des docs, injecter une violation a11y, ajouter un job CI qui échoue,
  3. **vert** de nouveau après le revert.

  > **Si l'étape 2 n'échoue pas, le gate n'est pas branché.** Pas de discussion : on corrige le check, on ne livre pas le loop.

  Vécu le 2026-09-07 sur `me:loop:docs-sync` : `set -o pipefail` + `grep -q` fait échouer le pipeline **quand le motif est trouvé** (grep sort au premier match → SIGPIPE sur `printf` → 141). Le check rapportait 216 écarts inexistants. Il n'a été démasqué que parce qu'il criait `--help documenté, absent de --help` — s'il avait été bloqué à `0` au lieu de `216`, il aurait été livré vert à vie. Écrire l'observation des trois états dans le skill du loop, avec les chiffres réels.
- 🟡 `max_iterations` entier > 0 ; au moins un step.
- 🔴 `mode: open` → exiger un `budget` explicite + avertir du coût ; sans standard clair, un open loop devient une « slop machine ».
- 🟡 `trigger: stop-hook` → prévoir le script + le hook dans le frontmatter de la skill (Étape 4c) ; rappeler que c'est **non testé** et que le caveat doc s'applique (cf. 4c).
- 🟡 `fleet` → exiger une décomposition nette (qui orchestre, quels specialists, quel eval gate global).

## Étape 4 — Écrire (sur mesure)

### 4a — La skill : `<base>/skills/me/loop/<name>/SKILL.md`

`<name>` en **kebab-case**. Si le dossier existe, demander : écraser, renommer, éditer. Pars du gabarit **self-pace closed** ci-dessous et **adapte-le au besoin** (ajoute/retire des phases, ajuste le protocole) :

```markdown
---
name: me:loop:<name>
description: Loop auto-cadencé — <goal>. Relance `<check_command>` jusqu'à « <exit_when> », max <max_iterations> itérations. Déclencheurs : "/me:loop:<name>", "lance le loop <name>", "<goal>".
---

# me:loop:<name>

Loop auto-cadencé. **mode:** <closed|open> · **trigger:** <self-pace|stop-hook> · **exécution:** <single|fleet> · **hardened:** true (bloc anti-triche de `me:run-loop`).
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
0. Lire les guardrails (`git rev-parse --path-format=absolute --git-path loop-guardrails.md`) — chaque sign est une **contrainte dure**. Ne jamais supprimer ce fichier.
1. Exécuter Discovery+Planning+Execution (les steps).
2. Lancer `<check_command>` et **LIRE sa sortie réelle**. Ne jamais supposer le résultat.
3. Évaluer `exit_when` : si rempli → **STOP**, annoncer le succès (citer la preuve dans la sortie).
4. Sinon incrémenter. Si compteur ≥ <max_iterations> → **STOP**, annoncer la limite sans succès + ce qui bloque.
5. Même échec qu'une passe antérieure → **appender un sign** aux guardrails avant de retenter.
6. Sinon recommencer en respectant tous les signs.

Status à chaque passe : `🔁 Itération N/<max_iterations> — <tenté> → check: <résultat>`.
Garde-fous : ne jamais dépasser `max_iterations` ; jamais de succès sans `exit_when` vu dans la sortie ; **bloc anti-triche `hardened`** de `me:run-loop` (ne pas modifier le check ni l'exit_when, ne pas skipper une validation, ne pas remplacer une assertion réelle par un test toujours vert, corriger le code de production plutôt que rustiner le test).
```

**Adaptations selon les dimensions :**
- **mode: open** → ajouter une ligne `budget` ; dans Iteration, autoriser l'exploration de pistes non spécifiées mais **borner par le budget** et un standard de qualité explicite (eval gate strict). Avertir l'utilisateur du coût.
- **fleet** → remplacer la section Execution par une orchestration : l'agent courant joue l'**orchestrateur**, délègue chaque sous-objectif à un `Agent`/`Task` (specialist), qui peut lui-même fan-out via subagents ; le `check_command` reste l'**eval gate global**. Chaque specialist applique le même mini-cycle discovery→…→verification.

### 4b — La commande : `<base>/commands/me/loop/<name>.md`

```markdown
---
description: "Loop auto-cadencé — <goal> ; relance `<check_command>` jusqu'à « <exit_when> », max <max_iterations> itérations"
---

Lance le loop **<name>** dans cette session : lis
`<base>/skills/me/loop/<name>/SKILL.md` et applique son **protocole self-pace**
directement (n'appelle PAS le Skill tool sur `me:loop:<name>` — la commande et la
skill partagent ce nom, donc le ré-invoquer reboucle sur ce shim). Respecte les
garde-fous de `me:run-loop`.

Arguments utilisateur : $ARGUMENTS
```

> ⚠️ **Pourquoi pas « Invoke the skill via the Skill tool ».** La commande
> `me:loop:<name>` et la skill `me:loop:<name>` portent le **même nom** → `Skill(me:loop:<name>)`
> re-résout vers le shim (qui dit « invoque la skill ») → **ping-pong infini**. Le shim
> doit donc pointer vers le **chemin du SKILL.md** pour application inline, sans dépendre
> de la résolution de nom du Skill tool.

### 4c — (si `trigger: stop-hook`) Hook Stop déclaré au frontmatter de la skill

On le déclare **dans le frontmatter de la skill** `me:loop:<name>` plutôt que dans `settings.json` global, pour qu'il n'existe pas dans les sessions qui n'invoquent jamais ce loop.

🔴 **Mais il ne se désarme PAS tout seul à la fin du loop.** La doc est explicite : un hook de skill est enregistré à l'invocation de la skill et Claude Code *« keeps running them for the rest of the session, on turns after the skill's own turn as well »*. Donc, une fois le loop terminé, le hook continue de lancer `check_command` à **chaque** `Stop` de la session et peut re-bloquer sur un travail sans aucun rapport. → **sentinelle d'armement obligatoire** : le hook ne fait rien tant qu'un fichier `.armed` n'existe pas, et il le supprime dès que `exit_when` est atteinte ou `max_iterations` dépassé. C'est le Step 0 du loop de l'armer.

(`once: true` existe mais ne convient pas ici : il retire le hook après sa **première** exécution réussie, donc dès la première relance — ça tue le loop au lieu de le borner.)

Ajoute au frontmatter :

```yaml
hooks:
  Stop:
    - hooks:
        - type: command
          command: "<chemin_absolu_ou_$CLAUDE_PROJECT_DIR>/skills/me/loop/<name>/stop-hook.sh"
```

Et génère `<base>/skills/me/loop/<name>/stop-hook.sh` (`chmod +x`), gabarit :

```bash
#!/usr/bin/env bash
STATE="${TMPDIR:-/tmp}/me-loop-<name>"; ARMED="$STATE.armed"; CNT_FILE="$STATE.count"
disarm() { rm -f "$ARMED" "$CNT_FILE"; exit 0; }

# (0) SENTINELLE — le hook survit à la fin du loop (il reste enregistré pour toute la
# session). Sans ce garde, il relancerait check_command à chaque Stop, indéfiniment,
# sur du travail sans rapport. Le Step 0 du loop fait : touch "$ARMED".
[ -f "$ARMED" ] || exit 0

INPUT=$(cat)
# (1) Garde-fou anti-boucle natif : si un blocage Stop est déjà actif, laisser s'arrêter
[ "$(printf '%s' "$INPUT" | jq -r '.stop_hook_active')" = "true" ] && disarm

# (2) Compteur d'itérations (respecte max_iterations en plus du cap natif de blocages)
N=$(cat "$CNT_FILE" 2>/dev/null || echo 0)
[ "$N" -ge <max_iterations> ] && disarm

# (3) Eval gate — porte sa propre garde anti-faux-propre (cf. Étape 3) :
#     une sortie qui ne prouve pas que le check a tourné doit DÉSARMER, pas boucler à vide.
OUT=$(<check_command> 2>&1); RC=$?
[ "$RC" = 2 ] && disarm                                     # check inexécutable
printf '%s' "$OUT" | <test exit_when, ex: grep -q 'P0P1_COUNT=0'> && disarm   # succès

echo $((N+1)) > "$CNT_FILE"
jq -n --arg r "exit_when non atteint (itération $((N+1))/<max_iterations>). Refais les steps du me:loop:<name> puis laisse le hook revérifier." '{decision:"block", reason:$r}'
exit 0
```

Et le **Step 0** du loop, côté skill : `mkdir -p "$(dirname "$STATE")" && touch "${TMPDIR:-/tmp}/me-loop-<name>.armed"`.

⚠️ **Ce qui est vérifié et ce qui ne l'est pas** (2026-09-07) :
- ✅ **vérifié dans la doc** : les hooks de frontmatter de skill existent, même format que dans `settings.json`, et restent enregistrés **pour tout le reste de la session** (d'où la sentinelle). `decision: "block"` + `reason` sur `Stop` relance un tour ; le code de sortie 2 le fait aussi.
- ❓ **non vérifié** : le cap natif de blocages `Stop` consécutifs et sa variable d'environnement ne sont pas documentés. Ne pas compter dessus — `max_iterations` dans le script fait foi.
- ❓ **non testé end-to-end** ici : le comportement sur un loop multi-tour réel. En cas de doute, `self-pace` reste le défaut sûr.

## Étape 5 — Confirmer

Affiche les chemins créés et comment lancer :

> Loop créé (portée <globale|per-project>, mode <…>, trigger <…>, <single|fleet>) :
> - skill `<base>/skills/me/loop/<name>/SKILL.md` (`me:loop:<name>`)
> - commande `<base>/commands/me/loop/<name>.md` (`/me:loop:<name>`)
> <- hook `<base>/skills/me/loop/<name>/stop-hook.sh` (si stop-hook)>
>
> Pour lancer : `/me:loop:<name>` — ou « lance le loop <name> » (le moteur `me:run-loop` route). **Redémarrage de session** en général nécessaire pour la découverte.
>
> Si portée **globale** + dotfiles chezmoi → versionner (skill `chezmoi`). Si **per-project** → committer avec le repo.
