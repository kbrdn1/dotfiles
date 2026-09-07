# Checklist de livraison — devis-xlsx

À vérifier avant de présenter le classeur.

## Données & intégrité
- [ ] Toutes les charges sont en **jours** ; aucun montant codé en dur.
- [ ] Le **TJM est une cellule paramètre** jaune, valeur d'exemple clairement étiquetée « à remplacer ».
- [ ] Tous les totaux et sous-totaux sont des **formules** (`SUM`, références) — aucun nombre recopié.
- [ ] Fourchette **bas/haut** présente partout ; médian = moyenne.
- [ ] Si la source avait une **incohérence d'addition** : recalcul par formule + écart **documenté dans Notes**.
- [ ] Chaque ligne d'estimation cite un **fichier/élément observé** (evidence-based) ou indique l'hypothèse.

## Structure
- [ ] Onglet **Synthese** en première position : paramètres + récap/scénarios + HT/TVA/TTC.
- [ ] Onglet **Estimation** : sections, sous-totaux, back/front (ou catégories) séparés.
- [ ] **Sélecteurs** (toggles) ou **scénarios** pour les périmètres optionnels.
- [ ] **Buffer de risque** explicite, justifié par des zones grises nommées.
- [ ] Onglet **Notes** : écarts source↔code, hypothèses, décisions ouvertes.
- [ ] Onglets annexes si pertinent (Transverse, Support/volumes, Contexte).

## Forme
- [ ] Code couleur respecté (bleu saisie, noir formule, vert lien, jaune paramètre, navy titres).
- [ ] Aucun libellé ne commence par `=` (sinon `#N/A`).
- [ ] Formats € / jours / % appliqués ; quadrillage masqué.

## Validation
- [ ] `recalc(path)` exécuté → **0 erreur**.
- [ ] Vérification d'un scénario à la main (ex. total jours = somme attendue au TJM d'exemple).
- [ ] Fichier copié dans le dossier de sortie et présenté via `present_files`.
- [ ] Mention que Google Sheets l'ouvre à l'import (Fichier → Importer).
