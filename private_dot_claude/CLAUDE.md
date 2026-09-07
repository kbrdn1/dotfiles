# SuperClaude Entry Point

This file serves as the entry point for the SuperClaude framework.
Additional framework components are loaded on-demand via skills (see ~/.claude/frameworks/).

# ═══════════════════════════════════════════════════
# SuperClaude Core (always loaded)
# ═══════════════════════════════════════════════════

@FLAGS.md
@PRINCIPLES.md
@RULES.md
@WORKFLOW.md

## Déclencheurs — graphify & tolaria

`RULES.md` et `WORKFLOW.md` disent **ce que** sont ces deux outils. Voici **quand** ils partent.
Deux conditions, pas plus. Le détail (gotchas, recettes, conventions du vault) reste là-bas.

**① J'entre dans un dépôt que je ne connais pas ou plus** — avant tout `grep`, toute lecture
à l'aveugle, tout fan-out de subagents :

```bash
ROOT=$(git rev-parse --path-format=absolute --git-common-dir | xargs dirname)  # jamais depuis worktrees/
test -f "$ROOT/graphify-out/graph.json" || (cd "$ROOT" && graphify extract . --code-only)
```

`--code-only` : AST local, **0 token, 0 clé API**. Ensuite on interroge `graph.json`, on ne
devine pas. Le graphe existe déjà ? `graphify update .` (gratuit) suffit s'il a du retard.

**② Une PR vient d'être mergée** — c'est le **seul** moment où le contexte est frais et où git
ne le garde pas. Une note dans le bon vault :

| Ce qu'on écrit | Vault | Template |
|---|---|---|
| des options ont été départagées | `~/Vault/{pro,perso}` | `Template — Décision.md` |
| pas d'options, une leçon qu'on n'avait pas vue | idem | `Template — Retex.md` |

Le vault par sujet : Jewely / Flippad / clients → `pro`, projets perso → `perso`.
⛔ **Jamais** : changelog, doc technique de repo, tâche, procédure. Le vault est mort une
première fois parce qu'il redoublait git — il ne le redouble pas. Frontmatter selon
l'`AGENTS.md` du vault, valeurs de chaîne **quotées**, aucune syntaxe Templater.

## Loops
Les loops auto-cadencés sont des skills `me:loop:<name>` (`~/.claude/skills/me/loop/<name>/SKILL.md` ou `<repo>/.claude/skills/me/loop/<name>/SKILL.md` en per-project), chacune portant sa définition (goal, max_iterations, check_command, exit_when) et un cycle closed-loop en 5 phases : discovery → planning → execution → verification (eval gate) → iteration. Dimensions : mode `closed`/`open`, trigger `self-pace`/`stop-hook` (hook Stop déclaré au frontmatter de la skill), exécution `single`/`fleet` (orchestrateur+specialists+subagents).
Pour en lancer un : `/me:loop:<name>` (direct) ou « lance le loop <name> » → le moteur `me:run-loop` applique le protocole (lance check_command, lit la sortie réelle, continue seulement si exit_when n'est pas atteinte, stop à max_iterations).
Pour en créer un, utilise le skill `me:create-loop` : conception **sur mesure** selon le besoin, demande la portée + les dimensions si non précisées, et scaffolde la skill `me:loop:<name>` + sa commande `/me:loop:<name>` (+ hook si stop-hook).

⚠️ Ne pas confondre avec les primitives **natives** de Claude Code, qui ont leurs propres noms : `/goal` (condition de complétion jugée par un évaluateur qui **ne lit que le transcript**), `/loop` (relance sur intervalle), `/schedule` (cron cloud). Mes loops gardent leur raison d'être : leur eval gate est une **commande shell déterministe**, pas un jugement sur transcript. Mon workflow sprint s'appelle `/me:goal` (jamais `/goal`, qui est pris).
