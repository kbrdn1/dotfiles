# Conventions & patterns avancés — devis-xlsx

À lire quand tu construis un classeur de devis non trivial (multi-TJM, matrice
temporelle, scénarios, écart arithmétique dans la source).

## 1. Code couleur (appliqué par `style()`)

| Rôle | Couleur police | Fond | Quand |
|---|---|---|---|
| Saisie (jours, nombres) | bleu `0000FF` | — | valeurs d'entrée que l'utilisateur peut changer |
| Paramètre à remplir | bleu (ou noir si formule) | jaune `FFFF00` | TJM, TVA, buffer, sélecteurs |
| Formule de calcul | noir `000000` | — | € , totaux, sous-totaux |
| Lien inter-feuille | vert `008000` | — | une cellule Synthèse qui pointe sur un sous-total Estimation |
| Titre de section | blanc | navy `1F3864` | en-têtes de bloc |
| En-tête de tableau | noir gras | light `D9E1F2` | ligne d'en-têtes |

Formats nombres : `EUR` (€, zéro→tiret), `DAY` (`0.0`), `PCT` (`0.0%`), `INT`.
Police Arial 10 par défaut. Onglets sans quadrillage (`showGridLines=False`).

## 2. Règles non négociables (rappel)

- **Jours uniquement en entrée.** Le TJM est une cellule paramètre jaune ;
  ne jamais coder un montant en dur, ne jamais inventer de TJM.
- **Totaux = formules** (`SUM`, références), jamais des nombres recopiés.
- **Fourchette bas/haut** systématique ; `médian = (bas + haut)/2`.
- **Séparer back / front** (et catégories) ; ne pas fusionner.
- **Sélecteurs / scénarios** pour tout périmètre optionnel (backend, support,
  évolutions, reversement A/B, lots V2).
- **Buffer de risque explicite**, justifié par des zones grises nommées.
- **Onglet Notes** : écarts source↔code + hypothèses + décisions ouvertes.

## 3. Intégrité arithmétique — le réflexe clé

Les estimations sources (rapports Claude Code, docs client) contiennent souvent
des **incohérences d'addition** : un sous-total qui ne correspond pas à la somme
de ses propres lignes (lot oublié, double comptage, maxima cumulés à tort).

Règle : **on saisit les lignes détaillées (source granulaire fiable) et on laisse
la formule recalculer le total.** Si le résultat diffère du total affiché par la
source, on **documente l'écart dans l'onglet Notes** — on ne recopie jamais un
total faux pour « coller » au document.

Exemples réels rencontrés :
- Devis maintenance : la somme des bornes hautes donnait 30–44 j, le doc affichait
  30–41 (maxima non cumulés) et « évolution 7–11.5 » contre 7–10.5 réels.
- Devis contributeurs : « Back V1 = 31–53 » correspondait à B1→B11, le lot **B12**
  (2–3 j) ayant été omis ; la somme correcte B1→B12 = 33–56.

Phrase-type pour les Notes : « La somme des lignes donne X ; la source affichait Y
(raison probable : …). Le classeur calcule X par formule ; ajuster si l'hypothèse
de la source est retenue. »

## 4. Piège Excel : libellé commençant par `=`

Un libellé texte qui commence par `=` (ex. « = Total ») est interprété comme une
**formule** → `#N/A`. Le helper `_safe_label()` remplace le `=` de tête par `Σ `.
Si tu écris une cellule de libellé à la main, n'ouvre jamais par `=` (utilise
`Σ`, `Total`, etc.).

## 5. Multi-TJM (TJM distincts par catégorie)

Quand back, front, support ou évolutions ont des TJM différents : passe un `tjm`
par ligne dans `estimation_sheet` (`{"...":..., "tjm": "Synthese!$B$6"}`), et
définis chaque TJM comme un paramètre. Astuce : un TJM secondaire dont le défaut
renvoie au principal se déclare en formule — `{"key":"tjm_back","value":"=B5", ...}`
(cellule modifiable, jaune, mais pré-remplie à la valeur du TJM principal).

Pour un projet « 1 dev full-stack », garde **un seul TJM** : c'est plus simple et
plus fidèle. Ne multiplie les TJM que si les intervenants diffèrent réellement.

## 6. Sélecteurs vs scénarios

Deux façons de gérer un périmètre variable :

- **Sélecteurs** `1/0` (toggles) — pour inclure/exclure un bloc indépendant
  (support, évolutions, backend, buffer). Le total multiplie le sous-total par le
  toggle : `=Estimation!D{sub}*Synthese!$B${tog}`. Idéal quand les blocs se
  combinent librement. (cf. devis tracking & maintenance)

- **Scénarios** (lignes pré-construites) — pour des périmètres discrets et
  mutuellement exclusifs (V1 seule / V1+V2 / +reversement A / +reversement B). Plus
  lisible quand le client doit choisir UNE offre, et quand des options s'excluent
  (reversement A **ou** B). (cf. devis contributeurs)

Modèle « projet complet » d'un scénario :
`projet_bas = (dev_bas + transverse_bas) × (1 + buffer_bas)` ;
`projet_haut = (dev_haut + transverse_haut) × (1 + buffer_haut)`.

## 7. Estimation en matrice (temporelle)

Certaines estimations ne sont pas « sections × lignes » mais une **matrice**
(ex. maintenance : semaines × catégories correctif/support/évolution). Dans ce cas,
n'utilise pas `estimation_sheet` : construis le tableau à la main avec `style()` —
en-têtes fusionnés (`ws.merge_cells`), une colonne par (catégorie × borne), totaux
`SUM` par colonne, total par ligne = somme des catégories. La Synthèse référence
ensuite les sous-totaux de colonnes. Le reste des conventions (couleurs, formules,
Notes) s'applique à l'identique.

## 8. Livraison

- Toujours finir par `recalc(path)` et **viser 0 erreur** avant de présenter.
- Le livrable est un `.xlsx` ; Google Sheets l'ouvre/convertit à l'import
  (Fichier → Importer) en conservant formules et mise en forme.
- Présenter le fichier avec `present_files`, sans long laïus.
- Laisser le TJM sur une **valeur d'exemple explicitement étiquetée** (ex. 500 €
  « à remplacer »), jamais présentée comme une recommandation de prix.
