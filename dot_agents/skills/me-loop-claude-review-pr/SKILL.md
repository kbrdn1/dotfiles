---
name: me-loop-claude-review-pr
description: "Port Codex de /me:loop:claude-review-pr. Relance une review par reviewers Claude frais sur la PR de la branche courante et corrige jusqu'à 0 finding bloquant pertinent (P0/P1/P2), max 8 itérations, avec analyse de convergence. Charge la skill Claude canonique, qui fait foi."
---

# $me-loop-claude-review-pr (port Codex de /me:loop:claude-review-pr)

Source canonique, qui fait foi : `~/.claude/skills/me/loop/claude-review-pr/SKILL.md`, appliquée selon le protocole de `$me-run-loop`. La lire en entier avant d'agir ; l'analyse de convergence est dans `~/.claude/skills/me/loop/_shared/convergence.md`. L'appliquer avec la table « Traduction Claude → Codex » de `~/.codex/AGENTS.md`.

Adaptations propres à cette procédure :
- Codex n'a pas l'outil `Agent`. Les deux reviewers en contexte frais de la source deviennent deux processus `claude` lancés en même temps depuis le worktree de la PR : deux workers `hc` (voir `$me-dispatch`) dans Herdr, sinon deux `claude -p` en arrière-plan. Chacun reçoit le prompt de review de la source, avec `--model opus`, et écrit dans son propre fichier, comme la source le demande.
- Depuis une session Codex, ces reviewers Claude sont un vrai regard tiers sur le code écrit par Codex.

Limite : il faut du quota Claude. Sans quota, le dire à Kylian et proposer `$me-loop-codex-review-pr`, en notant qu'un reviewer Codex sur du code écrit par Codex n'est pas un tiers.
