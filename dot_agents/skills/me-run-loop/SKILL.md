---
name: me-run-loop
description: "Port Codex de /me:run-loop. Lance une boucle qui répète une action jusqu'à une condition de sortie observable (sortie réelle d'un check_command), en routant vers le bon $me-loop-<name>. Charge la skill Claude canonique, qui fait foi."
---

# $me-run-loop (port Codex de /me:run-loop)

Source canonique, qui fait foi : `~/.claude/skills/me/run-loop/SKILL.md`. La lire en entier avant d'agir ; les loops qu'elle route vivent sous `~/.claude/skills/me/loop/<name>/SKILL.md` (et `_shared/` à côté). L'appliquer avec la table « Traduction Claude → Codex » de `~/.codex/AGENTS.md`. Les arguments sont le texte écrit après `$me-run-loop`.

Adaptations propres à cette procédure :
- `/me:loop:<name>` devient `$me-loop-<name>`. Un loop par projet vit dans `<repo>/.claude/skills/me/loop/<name>/SKILL.md` : le lire de la même façon.
- Trigger `self-pace` : itérer dans la session (lancer le `check_command`, lire sa sortie réelle, corriger, relancer) jusqu'à `exit_when` ou `max_iterations`.
- Exécution `fleet` : les specialists sont des workers `hc` (voir `$me-dispatch`), pas des sous-agents.

Non porté, à savoir :
- Trigger `stop-hook` : il repose sur un hook `Stop` déclaré dans le frontmatter d'une skill Claude. Les skills Codex n'ont pas de hooks : un loop `stop-hook` tourne ici en `self-pace`, avec le même `check_command` et le même `max_iterations`. Le dire au lancement.
