---
name: report
description: "Rapport HTML local et live de la branche courante (faits par script, texte par section, refresh des sections en retard), ou page de plan avec --plan <slug>, via la skill me:report"
argument-hint: "[--plan <slug>]"
---

# /me:report

Lis `~/.claude/skills/me/report/SKILL.md` en entier avec l'outil Read, puis applique-le à la lettre avec les arguments : `$ARGUMENTS`.

Commande légère : depuis Claude Code 2.1.327, une skill rangée dans `~/.claude/skills/me/<nom>/` n'est plus chargée comme skill dans une nouvelle session. Cette commande la rend invocable par `/me:report`. La skill fait foi.
