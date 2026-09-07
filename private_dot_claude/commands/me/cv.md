---
name: cv
description: "Adapte le CV à une offre/entreprise et produit un PDF A4 une page qui passe le gate ATS (pdftotext), à la charte kbrdn.dev — via la skill me:cv"
category: utility
complexity: standard
mcp-servers: []
personas: []
argument-hint: "[URL d'annonce, texte d'annonce collé, ou nom d'entreprise] [--en] [--dark]"
allowed-tools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebFetch", "Skill"]
---

# /me:cv

Invoque la skill `me:cv` : lit l'annonce, croise avec le pool de faits vérifiés, compose un CV
adapté et le rend en PDF A4 **une page**, vérifié par le gate ATS.

## Arguments

- `[cible]` (optionnel) : URL d'annonce, texte d'annonce collé, ou nom d'entreprise.
  Sans argument → régénère le CV de base depuis `profil.fr.json`.
- `--en` : force l'anglais. Par défaut, la langue du CV suit **la langue de l'annonce**.
- `--dark` : variante sombre « portfolio ». À réserver à un envoi direct à un humain,
  jamais à une plateforme de candidature.

## Usage

```
/me:cv                                          # CV de base FR, régénéré
/me:cv --en                                     # CV de base EN
/me:cv https://www.moovijob.com/offres/...      # adapté à l'annonce
/me:cv « on cherche un dev Vue/Node, AWS… »     # adapté au texte collé
/me:cv InTech                                   # adapté à l'entreprise (demande l'annonce)
```

## Ce qui est garanti

- **Une page.** Le gate échoue si ça déborde — on coupe du contenu, on ne rétrécit pas la typo.
- **Chaque mot-clé intact.** Relecture `pdftotext` sans `-layout`, comme un parser.
- **Ordre de lecture correct.** Les rubriques ressortent dans l'ordre du document.
- **Aucun fait inventé.** Tout vient de `_candidature-kit/pool.fr.md`, sourcé.

Le rapport final liste ce qui a été remonté, ce qui a été coupé, et **les exigences de l'annonce
non couvertes** — c'est là que se trouve l'information utile.

## Voir aussi

- `/me:lettre` — la lettre de motivation, même source de vérité
- `~/.claude/skills/me/_candidature-kit/pool.fr.md` — les faits, leurs sources, les trous connus
