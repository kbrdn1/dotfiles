---
name: banner-slim
description: Génère une bannière promo "slim" (presque one-line, PNG dark + light) au thème "Claude Dark" — wordmark, tagline, install, version, sur une seule rangée. Format compact à embarquer dans un README de profil ou de projet (comme le promo gwm sur kbrdn1/kbrdn1). Déclencheurs : "bannière slim", "banniere one-line", "slim banner", "promo compacte", "bannière réduite en hauteur", /me:banner-slim.
version: 1.0.0
allowed-tools: ["Bash", "Read", "Write", "SendUserFile"]
---

# Bannière slim — promo one-line

Bannière **compacte, presque une ligne** au design system **Claude Dark**, à embarquer dans un
README (profil ou projet) pour promouvoir un projet sans manger de place. C'est le format du
promo gwm affiché sur `kbrdn1/kbrdn1`. Sort dark + light.

## Quand l'utiliser
- Mettre en avant un projet dans un README de profil (`user/user`) sans bloc massif.
- Bandeau promo discret en tête/pied d'un README.

## Pipeline
Kit partagé `../_banner-kit/`.

1. **config.json** :

   ```json
   {
     "logo": "docs/_assets/logo.svg",
     "wordmark": "gwm",
     "title": "Git Worktree Manager",
     "subtitle": "One binary · CLI + TUI in Rust · zero runtime deps",
     "install": "cargo install gwm-cli",
     "version": "v1.0",
     "width": 1600,
     "height": 180
   }
   ```

   Champs (tous optionnels sauf `wordmark`) :
   - `logo` : chemin d'un fichier SVG (inliné au rendu, donc aucune requête réseau depuis le headless) **ou** markup SVG brut. `logoLight` sert la variante claire si le repo en livre une, sinon le même tracé sert aux deux thèmes. `logoSize` ajuste (défaut 52 px). Rendu avant le wordmark ; absent, rien ne bouge.
   - `wordmark` : nom mono à gauche (curseur `_` orange ; `"cursor": false` pour l'enlever).
   - `title` : ligne serif Fenix (accent orange). `subtitle` : ligne mono grise en dessous.
   - `install` : boîte terminal `$ …` à droite. `version` : badge orange.
   - `width`/`height`/`pad` : défauts 1600 × 180, pad 60.

2. **Générer** : `bun gen.ts <config.json> <outdir>` → `dark.html` + `light.html`.

3. **Rendre** (voir `../_banner-kit/render.md`), `--window-size` = width,height :
   ```bash
   CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
   "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
     --virtual-time-budget=1500 --window-size=1600,180 --screenshot="OUT/gwm-slim.png"       "file://OUT/dark.html"
   "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
     --virtual-time-budget=1500 --window-size=1600,180 --screenshot="OUT/gwm-slim-light.png" "file://OUT/light.html"
   ```

4. **Vérifier + montrer** avant push.

## Intégration
Embarquable, cliquable vers le repo promu. README profil → URLs raw absolues ; README repo → chemins relatifs.

```html
<a href="https://github.com/USER/REPO">
  <picture>
    <source media="(prefers-color-scheme: dark)"  srcset="https://raw.githubusercontent.com/USER/USER/main/gwm-slim.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/USER/USER/main/gwm-slim-light.png">
    <img alt="PROJET — pitch" src="https://raw.githubusercontent.com/USER/USER/main/gwm-slim.png" width="100%" />
  </picture>
</a>
```
