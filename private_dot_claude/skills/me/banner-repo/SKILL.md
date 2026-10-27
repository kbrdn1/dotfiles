---
name: banner-repo
description: Génère une bannière promo de repo (PNG dark + light) au design des fiches de kbrdn.dev (panneau sur champ en dither) — adaptée au repo : wordmark, tagline, boutons, sa vraie capture ou illustration en vignette, fiche, features, install, chaque bloc optionnel. Pour le haut de README d'un projet. Déclencheurs : "bannière repo", "banniere projet", "repo banner", "promo repo", "banner readme projet", /me:banner-repo.
version: 2.1.0
allowed-tools: ["Bash", "Read", "Write", "SendUserFile"]
---

# Bannière repo — promo (générique & adaptable)

Bannière de promotion d'un projet au design system de **kbrdn.dev**, à mettre en tête d'un
README de repo. Générique : on l'**adapte aux particularités du repo** (nom, tagline, features,
commande d'install, langage) et surtout via la **vignette** : sa vraie capture ou illustration.
C'est le format de la promo `gwm-cli`. Sort dark + light.

## Quand l'utiliser
- Bannière/hero en tête du README d'un projet open-source.
- Visuel de promotion (README, réseaux) pour un outil/lib/CLI.

## Adapter au repo (important)
Avant de générer, se caler sur le repo : lire son README / `Cargo.toml`|`package.json` pour
récupérer le vrai nom, la vraie tagline, les features réelles, la version, la commande d'install
(**pas de valeurs inventées**). Chaque bloc de la carte est optionnel : on garde ce qui a du sens
pour **ce** repo (un site se visite et ne s'installe pas, un repo sans tag n'a pas de version) et
on montre sa **vraie illustration** — sa capture (TUI, pane, page d'accueil), son logo, son
dessin — avant de dessiner un motif.

## Pipeline
Kit partagé `../_banner-kit/` (`card.ts` : la mise en page d'après les fiches de disarto.co).
La carte : en-tête (titre, icônes), carte (logo + wordmark, tagline, boutons ; vignette + fiche ;
features ; install), pied (adresse du repo en mono, bouton), sur le champ en dither, deux lignes
de construction verticales. Rien hors du panneau.

1. **config.json** :

   ```json
   {
     "logo": "docs/_assets/logo.svg",
     "logoLight": "docs/_assets/logo-light.svg",
     "eyebrow": "Git Worktree Manager",
     "version": "v1.11.0",
     "wordmark": "gwm",
     "tagline": "One binary. Every worktree. Setup already done.",
     "image": "docs/2.tui/_assets/hero.png",
     "imageSize": "165%",
     "imagePosition": "0 0",
     "chips": ["CLI + TUI", "Create from issue", "Agent sessions"],
     "install": "cargo install gwm-cli",
     "footer": "github.com/kbrdn1/gwm-cli · Rust · MIT OR Apache-2.0"
   }
   ```

   Champs (tous optionnels sauf `wordmark`) :
   - `eyebrow` : titre de l'en-tête du panneau (défaut : le wordmark).
   - `logo` / `logoLight` : fichier SVG (inliné) ou markup SVG brut, à gauche du wordmark. `logoSize` ajuste.
   - `wordmark` (Inter 500) et `wordmarkSize` (défaut 68). `tagline` : Fenix, dans l'accent (`<br>` permis).
   - `buttons` : `[{label, icon?, filled?}]`, défaut `GitHub` (share) + `Install` (visit, plein). `[]` → aucun. Icônes : celles de `card.ts` (`share`, `visit`, `heart`, `globe`, `link`…).
   - **Vignette**, priorité `image` > `branchGraph` > `motif` > rien :
     - `image` (+ `imageLight`) : capture ou illustration du repo (png/jpg/webp/svg), embarquée. `imageSize` : `cover` (défaut), `contain` (illustration détourée, posée sur le ton du panneau) ou un zoom en % ; `imagePosition` : `object-position` CSS.
     - `branchGraph` : `[{label, color, fill?}]` → graphe de branches intégré.
     - `motif` : HTML/SVG brut, mis à l'échelle pour tenir.
     - `thumbSize` : `[w, h]`, défaut `[440, 280]` (élargir pour une capture large).
   - `facts` : `[{icon, label, value, ok?, person?}]` — `ok` = pastille verte, `person` = puce avec l'avatar. Absent → déduite de `footer` (« repo · langage · licence ») + `version` + `author`. `[]` → pas de fiche.
   - `chips` + `featuresLabel` (défaut « Features »). `install` + `installLabel` (défaut « Install ») : ligne `$ …`. Absents → section retirée.
   - `footer` : son premier segment est l'adresse du pied. `footerAction` : bouton du pied (défaut « README », `null` → aucun).
   - `width` (1600), `height` (absent → suit le panneau).

2. **Générer** (facultatif, `render.sh` le fait) : `bun gen.ts <config.json> <outdir>` → `dark.html` + `light.html`.

3. **Rendre** depuis la racine du repo (les chemins du config y sont relatifs) :
   ```bash
   ~/.claude/skills/me/_banner-kit/render.sh ~/.claude/skills/me/banner-repo/gen.ts docs/_assets/promo.config.json OUT promo.png promo-light.png
   ```
   Sans `height`, la hauteur suit le panneau (voir `../_banner-kit/render.md`).

4. **Vérifier + montrer** (Read des deux PNG) avant tout push. `oxipng -o 2 --strip safe` avant de committer.

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
