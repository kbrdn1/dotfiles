---
name: banner-repo
description: Génère une bannière promo de repo (PNG dark + light) au thème "Claude Dark" — générique et adaptable au repo (wordmark, tagline, features, install, + un motif à droite : graphe de branches intégré ou HTML/SVG custom). Pour le haut de README d'un projet. Déclencheurs : "bannière repo", "banniere projet", "repo banner", "promo repo", "banner readme projet", /me:banner-repo.
version: 1.0.0
allowed-tools: ["Bash", "Read", "Write", "SendUserFile"]
---

# Bannière repo — promo (générique & adaptable)

Bannière de promotion d'un projet au design system **Claude Dark**, à mettre en tête d'un
README de repo. Générique : on l'**adapte aux particularités du repo** (nom, tagline, features,
commande d'install, langage) et surtout via le **motif à droite**. C'est le format de la promo
`gwm-cli`. Sort dark + light.

## Quand l'utiliser
- Bannière/hero en tête du README d'un projet open-source.
- Visuel de promotion (README, réseaux) pour un outil/lib/CLI.

## Adapter au repo (important)
Avant de générer, se caler sur le repo : lire son README / `Cargo.toml`|`package.json` pour
récupérer le vrai nom, la vraie tagline, les features réelles, la version, la commande d'install
(**pas de valeurs inventées**). Choisir le **motif** qui parle du projet.

## Pipeline
Kit partagé `../_banner-kit/`.

1. **config.json** :

   ```json
   {
     "logo": "docs/_assets/logo.svg",
     "logoLight": "docs/_assets/logo-light.svg",
     "eyebrow": "Git Worktree Manager",
     "version": "v1.0",
     "wordmark": "gwm",
     "tagline": "One binary. Every worktree. Zero runtime deps.",
     "chips": ["CLI + TUI", "Declarative bootstrap", "TOFU trust", "Multi-repo", "1902 tests"],
     "install": "cargo install gwm-cli",
     "footer": "github.com/USER/REPO · Rust · MIT",
     "branchGraph": [
       { "label": "feat/#42-auth",  "color": "#c15f3c", "fill": true },
       { "label": "fix/#37-cache",  "color": "#d99a63" },
       { "label": "docs/#8-readme", "color": "#6bc97f" },
       { "label": "test/#12-e2e",   "color": "#7ab8ff" },
       { "label": "chore/#3-ci",    "color": "#888" }
     ],
     "width": 1600,
     "height": 600
   }
   ```

   Champs (tous optionnels sauf `wordmark`) :
   - `eyebrow` : petit label au-dessus du wordmark. `version` : badge orange à côté.
   - `logo` : chemin d'un fichier SVG (inliné au rendu, donc aucune requête réseau depuis le headless) **ou** markup SVG brut. `logoLight` sert la variante claire si le repo en livre une, sinon le même tracé sert aux deux thèmes. `logoSize` ajuste (défaut 96 px). Rendu à gauche du wordmark ; absent, rien ne bouge.
   - `wordmark` : gros nom mono (curseur `_` orange ajouté ; `"cursor": false` pour l'enlever). `wordmarkSize` pour ajuster (défaut 120).
   - `tagline` : accroche en serif Fenix. `chips` : features (mono). `install` : ligne terminal `$ …`. `footer` : ligne discrète en bas.

   **Motif à droite** (l'axe d'adaptabilité) — priorité `branchGraph` > `motif` > rien :
   - `branchGraph` : `[{label, color, fill?}]` → graphe de branches intégré (tronc + branches courbes labellisées, couleurs qui suivent le thème). Idéal pour un outil git/worktree.
   - `motif` : chaîne HTML/SVG brute → n'importe quel visuel (logo, capture en data-URI, SVG maison). Statique entre dark/light — utiliser des couleurs neutres ou les tokens Claude Dark (`#d4825d`, `#e8a573`, `#6bc97f`, `#7ab8ff`, `#c79bff`).
   - aucun des deux → colonne texte pleine largeur.

2. **Générer** : `bun gen.ts <config.json> <outdir>` → `dark.html` + `light.html`.

3. **Rendre** (voir `../_banner-kit/render.md`), `--window-size` = width,height :
   ```bash
   CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
   "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
     --virtual-time-budget=1500 --window-size=1600,600 --screenshot="OUT/banner.png"       "file://OUT/dark.html"
   "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
     --virtual-time-budget=1500 --window-size=1600,600 --screenshot="OUT/banner-light.png" "file://OUT/light.html"
   ```

4. **Vérifier + montrer** avant push.

## Intégration README repo
Chemins **relatifs** (chaque branche affiche sa propre image ; le swap dark/light marche en relatif) :

```html
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)"  srcset="docs/_assets/promo.png">
    <source media="(prefers-color-scheme: light)" srcset="docs/_assets/promo-light.png">
    <img alt="REPO — pitch" src="docs/_assets/promo.png" width="100%">
  </picture>
</p>
```
Ranger les PNG dans le dossier assets du repo (ex. `docs/_assets/`) et préfixer le README, au-dessus du titre.
