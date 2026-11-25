---
name: me-report
description: "Port Codex de /me:report. Rapport HTML local et live d'une branche à l'entrée en review (faits collectés par script, texte dans notes.json), ou mode plan avec kanban. Charge la skill Claude canonique, qui fait foi."
---

# $me-report (port Codex de /me:report)

Source canonique, qui fait foi : `~/.claude/skills/me/report/SKILL.md`. La lire en entier avant d'agir ; ses scripts et fichiers cités en relatif (dont `collect.py`) se résolvent depuis `~/.claude/skills/me/report/`. L'appliquer avec la table « Traduction Claude → Codex » de `~/.codex/AGENTS.md`. Les arguments sont le texte écrit après `$me-report`.

Adaptations propres à cette procédure :
- Lancer depuis la branche ou le worktree réel, jamais depuis le checkout principal resté sur `dev`.
- `notes.json` s'écrit avec `apply_patch`, comme tout fichier.
