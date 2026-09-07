---
name: devis-xlsx
description: "Transforme une estimation de charge en jours-homme en classeur de devis .xlsx paramétrable (TJM en cellule, totaux par formule, fourchettes bas/haut, scénarios, buffer, Notes), via la skill me:devis-xlsx"
category: utility
complexity: standard
mcp-servers: []
personas: []
argument-hint: "[chemin du rapport/estimation ou estimation collée]"
allowed-tools: ["Bash", "Read", "Write", "Skill"]
---

# /me:devis-xlsx

Slash command qui invoque la skill `me:devis-xlsx` pour transformer une **estimation de charge en jours-homme** (rapport Claude Code, audit de repos, journal de charge, tableau de charge) en **classeur de devis `.xlsx` paramétrable** que Google Sheets ouvre à l'import.

## Arguments

- `[estimation]` (optionnel) : chemin d'un fichier d'estimation (`.md`, `.txt`, rapport…) **ou** l'estimation collée directement. Si absent, la skill demande/utilise l'estimation fournie dans la conversation.

## Usage

```
/me:devis-xlsx ./audit-repo.md
/me:devis-xlsx « back: module CRUD 2-4j, front: page admin 2-3j… »
/me:devis-xlsx        # reprend l'estimation déjà fournie dans le fil
```

## Comportement

1. Invoquer la skill `me:devis-xlsx` via le tool Skill avec l'estimation en argument
2. Laisser la skill assembler le classeur avec `scripts/devis_xlsx.py` (params jaunes, `estimation_sheet`, `notes_sheet`, Synthèse câblée par formules)
3. Dérouler `references/checklist.md` avant présentation : **recalc à 0 erreur**, TJM en cellule, totaux = formules, Notes remplies
4. Présenter le `.xlsx` produit et signaler que Google Sheets l'ouvre via Fichier → Importer

## Règles

- **Jours uniquement en entrée.** Le TJM est une cellule paramètre, jamais inventé : valeur d'exemple étiquetée « à remplacer », pas une recommandation de prix
- **Totaux = formules** (`SUM`, références), jamais des nombres recopiés
- **Intégrité arithmétique** : saisir les lignes détaillées, laisser la formule recalculer ; documenter tout écart avec la source dans Notes plutôt que recopier un total faux
- **Fourchette bas/haut** partout ; séparer back/front et catégories ; périmètres optionnels = sélecteurs (1/0) ou scénarios ; buffer de risque explicite et justifié
- **Evidence-based** : chaque ligne cite un fichier observé ou nomme son hypothèse ; pas de marketing ni de métrique inventée

## Prerequisites

- **`openpyxl`** (Python) — requis pour générer le classeur
- **Skill `xlsx` + LibreOffice** (optionnel) — pour le gate `recalc.py` (vérif 0 erreur de formule). À défaut, les formules sont écrites correctement et recalculées à l'ouverture dans Excel/Google Sheets

## Voir aussi

- Skill complète : `~/.claude/skills/me/devis-xlsx/SKILL.md`
- Conventions détaillées : `~/.claude/skills/me/devis-xlsx/references/conventions.md` (multi-TJM §5, scénarios §6, matrice §7)
- Exemple exécutable : `~/.claude/skills/me/devis-xlsx/scripts/example_build.py`
- Recalc 0 erreur : skill `xlsx` (`~/.claude/skills/xlsx/scripts/recalc.py`)
