---
name: dispatch
description: "Orchestre des issues en parallèle avec Herdr Core (hc) : un worker Claude par issue dans son worktree gwm, reprise du travail en cours, plan me:report en direct, merge progressif dans dev, via la skill me:dispatch"
argument-hint: "[issues ou objectif]"
---

# /me:dispatch

Lis `~/.claude/skills/me/dispatch/SKILL.md` en entier avec l'outil Read, puis applique-le à la lettre avec les arguments : `$ARGUMENTS`.

Commande légère : depuis Claude Code 2.1.327, une skill rangée dans `~/.claude/skills/me/<nom>/` n'est plus chargée comme skill dans une nouvelle session. Cette commande la rend invocable par `/me:dispatch`. La skill fait foi.
