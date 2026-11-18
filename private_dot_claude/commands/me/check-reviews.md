---
name: check-reviews
description: "Analyser et appliquer les reviews IA — en ligne d'abord (@codex review en commentaire PR / Codex Cloud, prioritaire, charge locale nulle), puis CLI locaux (Codex, CodeRabbit) et bots GitHub (Copilot/CodeRabbit) en fallback — et maintainers sur une PR"
category: orchestration
complexity: advanced
mcp-servers: []
personas: [reviewer, implementer]
argument-hint: "<pr-url|pr-number> [--all] [--dry-run] [--auto] [--instruction \"<texte>\"] [--local] [--copilot]"
allowed-tools: Bash(gh :*), Bash(git :*), Bash(jq :*), Bash(node :*), Bash(ls :*), Bash(which :*), Bash(sleep :*), Bash(coderabbit :*), Bash(cr :*), Read, Edit, MultiEdit, Write, AskUserQuestion
---

# /me:check-reviews

Lis `~/.claude/skills/me/check-reviews/SKILL.md` en entier avec l'outil Read, puis applique-le à la lettre avec les arguments : `$ARGUMENTS`.

Commande légère : depuis Claude Code 2.1.327, une skill rangée dans `~/.claude/skills/me/<nom>/` n'est plus chargée comme skill dans une nouvelle session. Cette commande la rend invocable par `/me:check-reviews`. La skill fait foi.
