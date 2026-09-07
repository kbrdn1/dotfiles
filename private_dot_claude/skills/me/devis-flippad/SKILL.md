---
name: me:devis-flippad
description: >-
  Génère le devis commercial final en PDF à la charte FLIPPAD/JEWELY (en-tête
  émetteur/client doré, logo, tableau de lots « DÉVELOPPEMENT » avec sous-lignes
  détaillées par référence, détails TVA, récapitulatif HT/TVA/TTC avec encadré
  doré, page CGV + signature + coordonnées de paiement, pied de page légal +
  pagination). À utiliser dès que l'utilisateur veut produire, générer ou éditer
  un devis client/commercial au format de sa charte, parle de « faire un devis »,
  « devis PDF », « document de devis », « devis pour le client », « bon de devis »,
  ou veut mettre en forme une estimation chiffrée en devis présentable. Différent
  de la skill devis-xlsx (qui produit l'estimation de charge interne paramétrable
  en jours) : ici on produit le LIVRABLE client formaté à partir de données déjà
  arrêtées. Utiliser cette skill plutôt que d'inventer une mise en page de devis,
  même si l'utilisateur ne dit pas « skill » ou « PDF ».
---

# devis-flippad — devis commercial PDF (charte FLIPPAD/JEWELY)

## Ce que produit la skill

Un **devis PDF** prêt à envoyer au client, reproduisant fidèlement la charte du
modèle de référence : logo, blocs « Émetteur ou Émettrice » / « Client ou Cliente »
en doré, métadonnées (numéro, dates, type de vente), titre de projet, tableau des
lots avec sous-lignes détaillées, « Détails TVA », « Récapitulatif » avec Total TTC
encadré en doré, et page 2 (CGV, mention « Bon pour accord » + zone signature,
coordonnées de paiement). Pied de page : mentions légales + pagination sur chaque page.

## Où elle s'insère

- `devis-xlsx` (autre skill) = **estimation interne** : charge en jours, fourchette
  bas/haut, evidence-based, TJM en cellule. Outil de calcul/négociation.
- `devis-flippad` (cette skill) = **livrable client** : une fois les jours et le TJM
  arrêtés, on met en forme le devis commercial.

Enchaînement typique : estimer avec `devis-xlsx` → figer une valeur ferme de jours
par lot + le TJM → regrouper par lot fonctionnel → remplir le JSON → générer le PDF.

## Comment générer

1. Choisir la **variante de marque** et copier l'exemple correspondant comme point
   de départ (devis de référence déjà fonctionnel) :
   - **Jewely** (doré + logo JEWELY) → `references/exemple_jewely.json`
   - **Flippad** (orange `#fc6c25` + logo Flippad) → `references/exemple_flippad.json`

   La variante se pilote par le champ racine `"brand": "jewely" | "flippad"`, qui fixe
   l'accent, le logo et le fond de l'encadré TTC. Toute valeur explicite (`accent`,
   `emetteur.logo_img`, `emetteur.logo_bg`) **prime** sur le preset. Voir aussi
   `references/data_schema.md`.
2. Garder l'**émetteur** stable (coordonnées, mentions légales, paiement, logo) ;
   ne changer que `meta`, `client`, `projet`, `lots`, et au besoin `cgv`.
3. Chaque **lot** = `intitule` + `sous_titre` + `jours` + `prix_unitaire` + `lignes`
   (réf. / description / acteurs / j·h). Le total HT du lot, le HT global, la TVA et
   le TTC sont **calculés** par le script — ne jamais les saisir.
4. Générer :

   ```bash
   python scripts/build_devis_pdf.py mon_devis.json /mnt/user-data/outputs/Devis_XXX.pdf
   ```

5. **Vérifier visuellement** : rasteriser et regarder le rendu avant de présenter —

   ```bash
   pdftoppm -png -r 150 -f 1 -l 1 /mnt/user-data/outputs/Devis_XXX.pdf /tmp/v
   ```

   contrôler en-tête, totaux (HT = Σ lots, TVA, TTC), et le pied (mentions +
   pagination). Puis présenter via `present_files`.

## Règles (cohérentes avec devis-xlsx)

- **Jours × prix unitaire** ; le `prix_unitaire` (TJM) est une donnée saisie, jamais
  inventée. Aucun montant codé en dur : tout se déduit des jours et du TJM.
- **Totaux calculés** par le script (HT par lot, HT, TVA, TTC), jamais recopiés.
- **Honnêteté pro** : pas de marketing dans les libellés, pas de chiffre fantaisiste.
- Les `jh` par ligne sont **informatifs** et peuvent ne pas sommer au total du lot
  (mutualisation) — conforme au modèle ; ne pas les « corriger » de force.

## Moteur de rendu (déjà géré par le script)

Le rendu HTML→PDF utilise **Chromium en headless via Playwright** (`page.pdf`,
format A4, marges **T 12mm / B 20mm / L 12mm / R 12mm pilotées par l'API** —
`prefer_css_page_size=False` pour qu'elles priment sur le `@page { margin: 0 }` du
template, `print_background=True` pour rendre les fonds dorés). Le bas de 20mm
réserve la zone du pied.

Le **pied** (mentions légales + pagination i/n) est ensuite **incrusté via un
overlay reportlab/pypdf** sur chaque page : ce mécanisme est indépendant du moteur
et garantit un pied identique partout. Ne pas tenter de remettre le pied dans le
HTML : utiliser l'overlay du script.

Dépendances : `playwright` (+ navigateur : `python -m playwright install chromium`),
`jinja2`, `reportlab`, `pypdf`. Vérif visuelle : `pdftoppm` (poppler).

> Note : l'implémentation d'origine utilisait `wkhtmltopdf` (build « unpatched qt »
> qui ignore `--footer-*` et `position:fixed`, d'où l'overlay). Le moteur a été
> remplacé par Chromium/Playwright — fiable, maintenu, sans binaire système non
> signé ni Rosetta. L'architecture (corps + overlay du pied) est inchangée.

## Variantes de marque & personnalisation

- **`brand`** (racine) : `jewely` (doré `#BC8B2C` + `logos/jewely.jpeg`) ou `flippad`
  (orange `#fc6c25` + `logos/flippad.jpg`). Presets définis dans
  `scripts/build_devis_pdf.py` (`BRANDS`). Le fond de l'encadré TTC reste **sombre**
  dans les deux cas (label = accent sur fond sombre, montant blanc).
- **`accent`** : couleur des titres, du thead du tableau et du container Paiement.
- **`logo_img`** : chemin d'image. Relatif → résolu depuis `assets/` (ex.
  `"logos/flippad.jpg"`) ; absolu / `http(s)` / `data:` / `file://` acceptés ; sinon
  logo CSS « carré + nom ». Logos fournis : `assets/logos/{jewely.jpeg,flippad.jpg}`.
- **`ttc_bg`** : héritage, plus utilisé (l'encadré TTC est noir, coins arrondis).

Le template est `assets/devis_template.html.j2` (modifiable pour la mise en page).
