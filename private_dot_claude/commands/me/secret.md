---
name: secret
description: "Pose, copie, fait tourner ou vérifie un secret (clé API, token, variable d'environnement sensible, clé hôte SSH) vers un .env, gh secret, un VPS, le Trousseau ou une machine externe, sans que la valeur passe par la conversation, via la skill me:secret"
argument-hint: "[set|verify|names|rotation] [NAME] …"
---

# /me:secret

Lis `~/.claude/skills/me/creds/SKILL.md` en entier avec l'outil Read, puis applique-le à la lettre avec les arguments : `$ARGUMENTS`.

Commande légère : depuis Claude Code 2.1.327, une skill rangée dans `~/.claude/skills/me/<nom>/` n'est plus chargée comme skill dans une nouvelle session. Cette commande la rend invocable par `/me:secret`. La skill fait foi.
