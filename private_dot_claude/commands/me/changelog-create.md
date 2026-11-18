---
name: changelog-create
description: "Génère un /changelog adapté au projet, basé sur changelog-generator, avec verbosité configurable, via la skill me:changelog-create"
argument-hint: "[init | update]"
---

# /me:changelog-create

Lis `~/.claude/skills/me/changelog-create/SKILL.md` en entier avec l'outil Read, puis applique-le à la lettre avec les arguments : `$ARGUMENTS`.

Commande légère : depuis Claude Code 2.1.327, une skill rangée dans `~/.claude/skills/me/<nom>/` n'est plus chargée comme skill dans une nouvelle session. Cette commande la rend invocable par `/me:changelog-create`. La skill fait foi.
