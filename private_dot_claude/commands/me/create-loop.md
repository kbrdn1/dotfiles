---
name: create-loop
description: "Crée un nouveau loop auto-cadencé sur mesure et scaffolde la skill me:loop:<name> et sa commande, via la skill me:create-loop"
argument-hint: "<besoin du loop>"
---

# /me:create-loop

Lis `~/.claude/skills/me/create-loop/SKILL.md` en entier avec l'outil Read, puis applique-le à la lettre avec les arguments : `$ARGUMENTS`.

Commande légère : depuis Claude Code 2.1.327, une skill rangée dans `~/.claude/skills/me/<nom>/` n'est plus chargée comme skill dans une nouvelle session. Cette commande la rend invocable par `/me:create-loop`. La skill fait foi.
