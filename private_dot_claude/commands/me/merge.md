---
name: merge
description: "Merge la PR de la branche courante sur dev, ferme l'issue, met le checkout principal à jour et écrit la note vault, via la skill me:merge"
argument-hint: "[PR#]"
---

# /me:merge

Lis `~/.claude/skills/me/merge/SKILL.md` en entier avec l'outil Read, puis applique-le à la lettre avec les arguments : `$ARGUMENTS`.

Commande légère : depuis Claude Code 2.1.327, une skill rangée dans `~/.claude/skills/me/<nom>/` n'est plus chargée comme skill dans une nouvelle session. Cette commande la rend invocable par `/me:merge`. La skill fait foi.
