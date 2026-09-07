---
name: lettre
description: "Rédige une lettre de motivation adaptée à une entreprise et une annonce, en PDF A4 à la charte kbrdn.dev — via la skill me:lettre"
category: utility
complexity: standard
mcp-servers: []
personas: []
argument-hint: "[URL d'annonce, texte d'annonce collé, ou nom d'entreprise] [--en]"
allowed-tools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebFetch", "Skill"]
---

# /me:lettre

Invoque la skill `me:lettre` : lit l'annonce, puise dans le même pool de faits vérifiés que le CV,
et rédige une lettre en quatre temps — preuve d'ouverture chiffrée, mapping exigence par exigence,
mobilité Luxembourg + « pourquoi vous », clôture avec disponibilité.

## Arguments

- `[cible]` (optionnel) : URL d'annonce, texte d'annonce collé, ou nom d'entreprise.
- `--en` : force l'anglais (registre business letter court). Par défaut, la langue suit l'annonce.

## Usage

```
/me:lettre https://www.moovijob.com/offres/...     # depuis l'annonce
/me:lettre « … texte de l'annonce … »              # depuis le texte collé
/me:lettre InTech --en                             # en anglais
```

## Ce qui est garanti

- **300-350 mots, quatre paragraphes.** Pas de délayage, pas de formule creuse.
- **Aucun fait inventé.** Ce qui manque est nommé franchement — c'est un argument, pas un aveu.
- **Un paragraphe 3 propre à l'entreprise.** S'il fonctionnerait pour n'importe quelle boîte, il est
  réécrit.
- **La mobilité traitée de front** : frontalier, installation prévue secteur Thionville.

## Voir aussi

- `/me:cv` — le CV, même source de vérité
- `~/.claude/skills/me/lettre/SKILL.md` — l'analyse de la lettre de référence (Mehdi → Experis) :
  ce qui s'en reprend, ce qui ne transfère pas au profil de Kylian
