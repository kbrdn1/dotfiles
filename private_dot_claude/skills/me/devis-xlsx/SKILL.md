---
name: me:devis-xlsx
description: >-
  Construit un classeur de devis .xlsx paramétrable à partir d'une estimation de
  charge en jours-homme : onglet paramètres (TJM, TVA, sélecteurs en cellules
  jaunes), onglet d'estimation détaillée avec sous-totaux par formule, fourchettes
  bas–haut, scénarios ou toggles de périmètre, buffer de risque, et onglet Notes
  documentant les écarts et hypothèses. À utiliser dès que l'utilisateur veut
  transformer une estimation de charge en devis chiffré (xlsx / Google Sheets), ou
  qu'il emploie « deviser », « chiffrage », « devis », « TJM », « jours-homme »,
  « classeur de devis », ou demande « la même chose » après avoir fourni une
  estimation Claude Code, un audit de repos ou un journal de charge. Couvre les
  prestations de dev (back/front), la maintenance/support, les évolutions et les
  projets multi-lots avec reversements. Utiliser cette skill plutôt que d'inventer
  un format de devis ou un TJM, même si l'utilisateur ne dit pas explicitement
  « skill » ou « template ».
---

# devis-xlsx — classeur de devis paramétrable (jours → €)

## Ce que produit la skill

Un classeur `.xlsx` (que Google Sheets ouvre à l'import) qui transforme une
estimation de charge **en jours-homme** en devis chiffré. Le TJM est une **cellule
paramètre** : on le saisit une fois, tout se recalcule. Structure type :

- **Synthese** (1ʳᵉ position) : paramètres jaunes (TJM, TVA, buffer, sélecteurs) +
  tableau récapitulatif ou scénarios + totaux HT / TVA / TTC en bas / médian / haut.
- **Estimation** : détail ligne à ligne, regroupé en sections (back / front /
  catégories), sous-totaux **par formule**, fourchette bas–haut, € calculés au TJM.
- **Notes** : écarts source ↔ code, hypothèses, décisions ouvertes.
- Onglets annexes selon le cas : **Transverse** (QA/recette/coord), **Support**
  (volumes : tickets, commits), **Contexte**.

## Où elle s'insère (workflow en 3 temps)

1. **Audit evidence-based** — Claude Code inspecte les repos en lecture seule et
   produit une estimation en jours, ancrée dans les fichiers réels (pas de
   supposition). *Hors périmètre de cette skill, mais c'est sa source d'entrée.*
2. **Estimation en jours** — fourchette bas/haut par lot, back/front séparés,
   classe extension/greenfield, fichiers cités.
3. **Classeur de devis** — *c'est ici qu'intervient cette skill.*

Si l'utilisateur fournit directement une estimation (rapport Claude Code, journal,
tableau de charge), passe directement à l'étape 3.

## Règles non négociables

Ces règles font la valeur du devis ; ne pas les contourner « pour aller vite ».

- **Jours uniquement en entrée. Le TJM est une cellule paramètre, jamais inventé.**
  On chiffre la charge ; le prix se déduit par `jours × TJM`. Laisser une valeur
  d'exemple explicitement étiquetée « à remplacer », jamais présentée comme une
  recommandation de prix.
- **Totaux = formules** (`SUM`, références), jamais des nombres recopiés. C'est ce
  qui rend le classeur vivant et auditable.
- **Intégrité arithmétique.** Les sources contiennent souvent des incohérences
  d'addition (lot oublié, double comptage, maxima cumulés). Saisir les **lignes
  détaillées** et laisser la formule recalculer ; si le total diffère de la source,
  **documenter l'écart dans Notes** au lieu de recopier un total faux. *(Voir
  `references/conventions.md` §3 pour des exemples réels.)*
- **Fourchette bas/haut** partout ; `médian = (bas + haut)/2`.
- **Séparer back / front** (et catégories) ; ne pas fusionner.
- **Périmètres optionnels = sélecteurs (1/0) ou scénarios** (cf. §6 des
  conventions). Reversement A vs B, support inclus ou non, V1 vs V2…
- **Buffer de risque explicite**, justifié par des zones grises nommées (dépendance
  tierce, arbitrage produit non tranché, spec manquante).
- **Evidence-based** : chaque ligne cite un fichier observé ou nomme son hypothèse.
- **Honnêteté pro** : pas de marketing, pas de métrique inventée, énoncer les
  trade-offs.

## Construire avec la bibliothèque

Le module `scripts/devis_xlsx.py` fournit le style et les briques d'assemblage.
**Toujours** lire d'abord la skill publique `xlsx` (conventions de base + script
`recalc.py`), puis assembler ainsi :

```python
import devis_xlsx as dx
from openpyxl import Workbook

wb = Workbook(); syn = wb.active; syn.title = "Synthese"
est = wb.create_sheet("Estimation"); notes = wb.create_sheet("Notes")

dx.title(syn, "Devis — …", "… · jours-homme · HT sauf mention")
refs, _ = dx.params_block(syn, [
    {"key": "tjm", "label": "TJM (€/jour)", "value": 500, "fmt": dx.EUR,
     "note": "Exemple — remplacer par ton TJM"},
    {"key": "tva", "label": "TVA (%)", "value": 0.20, "fmt": dx.PCT, "note": "0 si non assujetti"},
])
TJM = f"Synthese!${refs['tjm']}"

subs = dx.estimation_sheet(est, [
    {"section": "BACK (Laravel)", "subtotal": "Sous-total Back", "lines": [
        {"cat": "Back", "poste": "Module CRUD X", "cls": "Extension", "low": 2, "high": 4,
         "files": "CRUDController, Repository"},
    ]},
    {"section": "FRONT (Nuxt)", "subtotal": "Sous-total Front", "lines": [
        {"cat": "Front", "poste": "Page admin", "cls": "Extension", "low": 2, "high": 3,
         "files": "useAdminTablePage"},
    ]},
], tjm_ref=TJM)
# subs == {"Sous-total Back": <row>, "Sous-total Front": <row>}  -> câbler la Synthèse

dx.notes_sheet(notes, [
    {"title": "Hypothèses", "items": ["1 dev senior connaissant le repo.", "…"]},
])
dx.move_first(wb, "Synthese")
wb.save("/mnt/user-data/outputs/Devis_….xlsx")
print(dx.recalc("/mnt/user-data/outputs/Devis_….xlsx"))   # viser 0 erreur
```

L'exemple complet et exécutable est dans **`scripts/example_build.py`** (params +
estimation back/front/option + Synthèse câblée par formules + sélecteur + Notes,
terminé par un recalc). L'exécuter ou le copier comme point de départ.

API : `style`, `title`, `params_block`, `estimation_sheet`, `notes_sheet`,
`move_first`, `recalc`. Constantes de format : `EUR`, `DAY`, `PCT`, `INT`.

## Cas qui sortent de l'ossature standard

- **Multi-TJM** (back/front/support à TJM distincts) → passer un `tjm` par ligne.
  Voir `references/conventions.md` §5.
- **Estimation en matrice** (ex. maintenance : semaines × catégories) →
  `estimation_sheet` ne convient pas ; construire à la main avec `style()` +
  `merge_cells`. Voir §7.
- **Scénarios discrets** (V1 / V1+V2 / +reversement A / +reversement B) → tableau
  de scénarios plutôt que toggles. Voir §6 et le modèle « projet complet ».

## Avant de présenter

Dérouler **`references/checklist.md`**. En particulier : recalc à **0 erreur**,
TJM en cellule, totaux = formules, Notes remplies. Présenter via `present_files`
sans long laïus, et signaler que Google Sheets l'ouvre à l'import (Fichier →
Importer).
