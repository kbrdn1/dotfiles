---
name: me-merge
description: "Port Codex de /me:merge. Merger la PR de la branche courante sur sa base (dev), fermer l'issue liée, remettre le checkout principal à jour sans écraser ses commits locaux, écrire la note vault du merge. Charge la skill Claude canonique, qui fait foi."
---

# $me-merge (port Codex de /me:merge)

Source canonique, qui fait foi : `~/.claude/skills/me/merge/SKILL.md`. La lire en entier avant d'agir, puis l'appliquer avec la table « Traduction Claude → Codex » de `~/.codex/AGENTS.md`. Les arguments sont le texte écrit après `$me-merge` (le `$ARGUMENTS` de la source).

Adaptations propres à cette procédure :
- Jamais de merge sans demande explicite de Kylian ou d'une procédure qui l'autorise (AGENTS.md).
- La note vault passe par le MCP `tolaria` configuré dans `~/.codex/config.toml`, selon l'`AGENTS.md` du vault visé.
