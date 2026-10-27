---
name: banner-slim
description: Génère une bannière promo "slim" (presque one-line, PNG dark + light) au design de kbrdn.dev (panneau sur champ en dither) — wordmark, tagline, install, version, sur une seule rangée. Format compact à embarquer dans un README de profil ou de projet (comme le promo gwm sur kbrdn1/kbrdn1). Déclencheurs : "bannière slim", "banniere one-line", "slim banner", "promo compacte", "bannière réduite en hauteur", /me:banner-slim.
version: 2.1.0
allowed-tools: ["Bash", "Read", "Write", "SendUserFile"]
---

# Bannière slim — promo one-line

Bannière **compacte, presque une ligne** au design system de **kbrdn.dev**, à embarquer dans un
README (profil ou projet) pour promouvoir un projet sans manger de place. C'est le format du
promo gwm affiché sur `kbrdn1/kbrdn1`. Sort dark + light.

## Quand l'utiliser
- Mettre en avant un projet dans un README de profil (`user/user`) sans bloc massif.
- Bandeau promo discret en tête/pied d'un README.

## Pipeline
Kit partagé `../_banner-kit/` : le champ en dither, les lignes verticales, un panneau d'une ligne.

1. **config.json** :

   ```json
   {
     "logo": "docs/_assets/logo.svg",
     "wordmark": "gwm",
     "title": "Git Worktree Manager",
     "subtitle": "One binary · CLI + TUI in Rust · create from an issue",
     "install": "cargo install gwm-cli",
     "version": "v1.11.0"
   }
   ```

   Champs (tous optionnels sauf `wordmark`) :
   - `logo` / `logoLight` (SVG fichier ou markup), `logoSize`.
   - `wordmark` (Inter 50). `title` : Fenix, accent. `subtitle` : ligne grise dessous.
   - `install` : `$ …` en mono à droite. `version` : pastille verte.
   - `width` (1600), `height` (240).

2. **Générer** (facultatif) : `bun gen.ts <config.json> <outdir>`.

3. **Rendre** depuis la racine du repo (les chemins du config y sont relatifs) :
   ```bash
   ~/.claude/skills/me/_banner-kit/render.sh ~/.claude/skills/me/banner-slim/gen.ts gwm-slim.config.json OUT gwm-slim.png gwm-slim-light.png
   ```
   Sans `height`, la hauteur suit le panneau (voir `../_banner-kit/render.md`).

4. **Vérifier + montrer** (Read des deux PNG) avant tout push. `oxipng -o 2 --strip safe` avant de committer.

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
