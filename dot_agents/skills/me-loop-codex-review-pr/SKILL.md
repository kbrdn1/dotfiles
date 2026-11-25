---
name: me-loop-codex-review-pr
description: "Port Codex de /me:loop:codex-review-pr. Relance la review Codex CLI locale sur la PR de la branche courante et corrige jusqu'à 0 finding bloquant pertinent (P0/P1/P2), max 8 itérations, avec analyse de convergence. Charge la skill Claude canonique, qui fait foi."
---

# $me-loop-codex-review-pr (port Codex de /me:loop:codex-review-pr)

Source canonique, qui fait foi : `~/.claude/skills/me/loop/codex-review-pr/SKILL.md`, appliquée selon le protocole de `$me-run-loop`. La lire en entier avant d'agir ; l'analyse de convergence est dans `~/.claude/skills/me/loop/_shared/convergence.md`. L'appliquer avec la table « Traduction Claude → Codex » de `~/.codex/AGENTS.md`.

Adaptations propres à cette procédure :
- Le reviewer est le CLI `codex`, lancé comme process séparé depuis le worktree de la PR.
- Si la PR a été écrite par une session Codex, ce reviewer n'est plus un tiers : il partage les angles morts de l'auteur. Pour une PR sensible, le regard tiers est alors `$me-loop-claude-review-pr`.
