---
name: rules
description: "Crée et fait évoluer les <repo>/.claude/rules/*.md path-scoped selon le stack du projet, via la skill me:rules"
argument-hint: "[init | update]"
---

# /me:rules

Lis `~/.claude/skills/me/rules/SKILL.md` en entier avec l'outil Read, puis applique-le à la lettre avec les arguments : `$ARGUMENTS`.

Commande légère : depuis Claude Code 2.1.327, une skill rangée dans `~/.claude/skills/me/<nom>/` n'est plus chargée comme skill dans une nouvelle session. Cette commande la rend invocable par `/me:rules`. La skill fait foi.
