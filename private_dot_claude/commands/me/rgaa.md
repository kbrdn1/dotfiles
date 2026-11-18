---
name: rgaa
description: "Accessibilité RGAA 4.1.2 / WCAG 2.2 : audit, correction des non-conformités ou pattern accessible, via la skill me:rgaa"
argument-hint: "<audit|fix|apply> [type <page|form|list|media|dynamic|content> | theme <1-13|nom> | components <nom>[,<nom>]] [chemins…] [--serve | --url <u>[,<u>] | --no-runtime] [--all] [--dsfr|--no-dsfr] [--base <ref>] [--report <chemin>]"
---

# /me:rgaa

Lis `~/.claude/skills/me/rgaa/SKILL.md` en entier avec l'outil Read, puis applique-le à la lettre avec les arguments : `$ARGUMENTS`.

Commande légère : depuis Claude Code 2.1.327, une skill rangée dans `~/.claude/skills/me/<nom>/` n'est plus chargée comme skill dans une nouvelle session. Cette commande la rend invocable par `/me:rgaa`. La skill fait foi.
