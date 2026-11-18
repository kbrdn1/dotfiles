---
name: setup
description: "Génère ou met à jour le CLAUDE.md d'un projet aligné sur mes workflows, via la skill me:setup"
argument-hint: "[init | update | refresh]"
---

# /me:setup

Lis `~/.claude/skills/me/setup/SKILL.md` en entier avec l'outil Read, puis applique-le à la lettre avec les arguments : `$ARGUMENTS`.

Commande légère : depuis Claude Code 2.1.327, une skill rangée dans `~/.claude/skills/me/<nom>/` n'est plus chargée comme skill dans une nouvelle session. Cette commande la rend invocable par `/me:setup`. La skill fait foi.
