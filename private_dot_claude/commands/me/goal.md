---
name: goal
description: "Workflow sprint : découpe un objectif en issues avec dépendances, plan me:report vivant, chaque issue débloquée menée en worktree jusqu'au merge progressif dans dev, via la skill me:goal"
argument-hint: "[objectif du sprint, issues et dépendances]"
---

# /me:goal

Lis `~/.claude/skills/me/goal/SKILL.md` en entier avec l'outil Read, puis applique-le à la lettre avec les arguments : `$ARGUMENTS`.

Commande légère : depuis Claude Code 2.1.327, une skill rangée dans `~/.claude/skills/me/<nom>/` n'est plus chargée comme skill dans une nouvelle session. Cette commande la rend invocable par `/me:goal` (à ne pas confondre avec la commande native `/goal`). La skill fait foi.
