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

## Loops
Les loops auto-cadencés sont des skills `loop:<name>` (`~/.claude/skills/loop/<name>/SKILL.md` ou `<repo>/.claude/...` en per-project), chacune portant sa définition (goal, max_iterations, check_command, exit_when) et un cycle closed-loop en 5 phases : discovery → planning → execution → verification (eval gate) → iteration. Dimensions : mode `closed`/`open`, trigger `self-pace`/`stop-hook` (hook Stop scopé au frontmatter de la skill), exécution `single`/`fleet` (orchestrateur+specialists+subagents).
Pour en lancer un : `/loop:<name>` (direct) ou « lance le loop <name> » → le moteur `me:run-loop` applique le protocole (lance check_command, lit la sortie réelle, continue seulement si exit_when n'est pas atteinte, stop à max_iterations).
Pour en créer un, utilise le skill `me:create-loop` : conception **sur mesure** selon le besoin, demande la portée + les dimensions si non précisées, et scaffolde la skill `loop:<name>` + sa commande `/loop:<name>` (+ hook si stop-hook).
