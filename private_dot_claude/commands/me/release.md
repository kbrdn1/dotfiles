---
name: release
description: "Publie une version : changelog, bump, merge dev vers main, tag après le merge, release GitHub, propagation, via la skill me:release"
argument-hint: "[X.Y.Z | patch | minor | major]"
---

# /me:release

Lis `~/.claude/skills/me/release/SKILL.md` en entier avec l'outil Read, puis applique-le à la lettre avec les arguments : `$ARGUMENTS`. Si le dépôt a son propre `/release`, il fait foi.

Commande légère : depuis Claude Code 2.1.327, une skill rangée dans `~/.claude/skills/me/<nom>/` n'est plus chargée comme skill dans une nouvelle session. Cette commande la rend invocable par `/me:release`. La skill fait foi.
