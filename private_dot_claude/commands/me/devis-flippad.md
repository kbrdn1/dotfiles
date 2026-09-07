---
name: devis-flippad
description: "Génère le devis commercial final en PDF à la charte FLIPPAD/JEWELY (en-tête doré, tableau de lots, récapitulatif HT/TVA/TTC, page CGV + signature + paiement, pied légal paginé) à partir de données arrêtées, via la skill me:devis-flippad"
category: utility
complexity: standard
mcp-servers: []
personas: []
argument-hint: "[chemin du JSON de devis ou données à mettre en forme]"
allowed-tools: ["Bash", "Read", "Write", "Skill"]
---

# /me:devis-flippad

Slash command qui invoque la skill `me:devis-flippad` pour produire le **devis commercial PDF** à la charte FLIPPAD/JEWELY (livrable client), à partir de données déjà arrêtées (jours par lot + TJM figés).

## Arguments

- `[devis]` (optionnel) : chemin d'un fichier JSON conforme au schéma **ou** les données à mettre en forme. Si absent, la skill part de `references/exemple_jewely.json` (devis de référence) et le remplit avec les données fournies dans la conversation.

## Usage

```
/me:devis-flippad ./mon_devis.json
/me:devis-flippad « lot SAV horlogerie 14j à 800€, lot intégrations 10j… »
/me:devis-flippad        # met en forme l'estimation déjà arrêtée dans le fil
```

## Comportement

1. Invoquer la skill `me:devis-flippad` via le tool Skill
2. La skill lit `references/data_schema.md`, choisit la **variante de marque** (`"brand": "jewely"` doré + logo JEWELY, ou `"brand": "flippad"` orange `#fc6c25` + logo Flippad) et copie l'exemple correspondant (`exemple_jewely.json` / `exemple_flippad.json`) comme base, ne change que `meta` / `client` / `projet` / `lots` (+ `cgv` au besoin), garde l'émetteur stable
3. Générer le PDF : `python scripts/build_devis_pdf.py <data.json> <sortie.pdf>` (moteur Chromium/Playwright + overlay du pied reportlab/pypdf)
4. **Vérifier visuellement** : rasteriser via `pdftoppm` et contrôler en-tête, totaux (HT = Σ lots, TVA, TTC), pied (mentions + pagination i/n)
5. Présenter le PDF produit

## Règles (cohérentes avec /me:devis-xlsx)

- **Jours × prix unitaire** ; le `prix_unitaire` (TJM) est une donnée saisie, jamais inventée. Aucun montant codé en dur
- **Totaux calculés** par le script (HT par lot, HT global, TVA, TTC), jamais recopiés
- **Honnêteté pro** : pas de marketing dans les libellés, pas de chiffre fantaisiste
- Les `jh` par ligne sont **informatifs** et peuvent ne pas sommer au total du lot (mutualisation) — conforme au modèle, ne pas les « corriger »

## Where it fits

- `/me:devis-xlsx` = **estimation interne** (charge en jours, fourchette, TJM en cellule) — outil de calcul/négociation
- `/me:devis-flippad` (ici) = **livrable client** formaté une fois les jours et le TJM arrêtés

## Prerequisites

- **Python libs** : `jinja2`, `reportlab`, `pypdf` (installées en `--user`)
- **Moteur PDF** : Chromium via **Playwright** (`python3 -m playwright install chromium`)
- **Vérif visuelle** : `pdftoppm` (poppler)

## Voir aussi

- Skill complète : `~/.claude/skills/me/devis-flippad/SKILL.md`
- Schéma de données : `~/.claude/skills/me/devis-flippad/references/data_schema.md`
- Devis de référence : `~/.claude/skills/me/devis-flippad/references/exemple_jewely.json`
- Template charte : `~/.claude/skills/me/devis-flippad/assets/devis_template.html.j2`
- Estimation amont : `/me:devis-xlsx`
