---
name: rezero
description: "Traduction française fidèle et enrichie d'un contenu Re:Zero (IF Stories en priorité, Light Novel, Web Novel) — via la skill me:rezero"
category: utility
complexity: standard
mcp-servers: []
personas: []
argument-hint: "[IF story / URL / chapitre / extrait collé] [--sans-assets] [--brut]"
allowed-tools: ["Bash", "Read", "Write", "Edit", "Glob", "WebFetch", "WebSearch", "Skill", "Agent", "Artifact", "SendUserFile"]
---

# /me:rezero

Invoque la skill `me:rezero` : édition française d'un chapitre de Re:Zero — contexte, glossaire
vivant, traduction fidèle, double révision, assets visuels (illustrations officielles + portraits
de dialogues), politique anti-spoiler, rendu artifact façon light novel.

## Arguments

- `[cible]` (optionnel) : nom d'une IF story, URL de chapitre (rezerowebnovelfr, WCT…), fichier ou
  extrait collé. Sans cible : la skill propose les histoires puis les chapitres disponibles.
- `--sans-assets` : texte seul, aucune recherche d'images.
- `--brut` : markdown simple au lieu de la page mise en forme.

Sortie par défaut : la bibliothèque locale `~/Desktop/RE:Zero Stories/` (site statique — navbar
par catégories, volet glossaire, suivi de lecture). Artifact claude.ai uniquement sur demande.

## Usage

```
/me:rezero                                  # dialogue : quelle histoire ? quel chapitre ?
/me:rezero Kasaneru chapitre 1              # cible directe
/me:rezero https://rezerowebnovelfr.wordpress.com/...   # depuis une URL
/me:rezero « … extrait collé … » --brut     # extrait, sortie markdown
```

## Ce qui est garanti

- **Fidélité d'abord** : sens, ton, voix des personnages, terminologie canon — jamais
  d'adaptation libre, jamais d'ajout inventé.
- **Glossaire vivant** : cohérence terminologique entre chapitres
  (`skills/me/rezero/references/glossaire.md`, mis à jour à chaque chapitre).
- **Assets sans spoiler** : chaque image vérifiée contre le niveau d'information du chapitre ;
  contenu généré toujours marqué comme tel.
- **Contrôle qualité final** : checklist complète avant livraison, doutes signalés, sources
  listées.

## Voir aussi

- `~/.claude/skills/me/rezero/SKILL.md` — le protocole complet
- `references/sources.md` — hiérarchie des sources (FR, EN, JP)
- `references/glossaire.md` — terminologie JP/EN/FR
