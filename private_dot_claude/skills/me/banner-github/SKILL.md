---
name: banner-github
description: Génère une bannière de profil GitHub (hero, PNG dark + light) au thème "Claude Dark" de kbrdn.dev — nom, titre, badge de statut, chips de stack, avatar optionnel. Pour le README de profil (repo user/user). Déclencheurs : "bannière github", "banniere profil", "profile banner", "hero banner profil", /me:banner-github.
version: 1.0.0
allowed-tools: ["Bash", "Read", "Write", "SendUserFile"]
---

# Bannière GitHub — profil (hero)

Bannière de profil au design system **Claude Dark** (fond neutre quasi-noir, accent orange
chaud `#d4825d`/`#c15f3c`, coins nets, mono Monaspace Krypton + serif Fenix, zones rayées,
triangles d'angle). Sort deux PNG (dark + light) pour un `<picture>` qui swappe via
`prefers-color-scheme`. C'est le format de la bannière de `kbrdn1/kbrdn1`.

## Quand l'utiliser
- Bannière du README de profil GitHub (`user/user`).
- Refonte/mise à jour d'une bannière profil existante.
- Variante **réseaux sociaux** (X / LinkedIn) : même design, contenu **centré** → `gen-social.ts` (voir plus bas).

## Pipeline
Cette skill s'appuie sur le kit partagé `../_banner-kit/` (fonts embarquées, tokens, cadre, rendu).

1. **Rassembler les params** depuis la demande (+ portfolio si dispo). Écrire un `config.json` :

   ```json
   {
     "name": "Kylian Bardini",
     "subtitle": "Web Developer Engineer",
     "badge": "Building open source",
     "handle": "kbrdn1",
     "chips": ["TypeScript", "Laravel", "Nuxt", "Rust", "AWS"],
     "footerLeft": "kbrdn.dev",
     "footerRight": "Nancy, France",
     "avatar": "/chemin/absolu/avatar.jpg",
     "width": 1600,
     "height": 460
   }
   ```

   Tous optionnels sauf `name`/`subtitle` :
   - `badge` : pastille de statut (point + texte, uppercase). Omis → pas de badge.
   - `handle` : affiché en haut à droite `@handle`. Omis → rien.
   - `chips` : puces mono de stack. `[]` → aucune.
   - `avatar` : chemin local (jpg/png), embarqué en base64. **Omis → pas d'avatar**, texte pleine largeur, hauteur par défaut `460` (avec avatar : `560`).
   - `width`/`height`/`pad` : override du gabarit (défauts 1600 × 460, pad 90).

2. **Générer les HTML** : `bun gen.ts <config.json> <outdir>` → `dark.html` + `light.html`.

3. **Rendre en PNG** (voir `../_banner-kit/render.md`) — Chrome headless, `--window-size` = width,height :
   ```bash
   CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
   "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
     --virtual-time-budget=1500 --window-size=1600,460 --screenshot="OUT/banner.png"       "file://OUT/dark.html"
   "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
     --virtual-time-budget=1500 --window-size=1600,460 --screenshot="OUT/banner-light.png" "file://OUT/light.html"
   ```

4. **Vérifier + montrer** : `sips -g pixelWidth -g pixelHeight`, puis Read/`SendUserFile` les 2 PNG pour validation avant tout push.

## Intégration README profil (`user/user`)
URLs raw absolues (le profil se sert de la branche par défaut) :

```html
<a href="https://kbrdn.dev">
  <picture>
    <source media="(prefers-color-scheme: dark)"  srcset="https://raw.githubusercontent.com/USER/USER/main/banner.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/USER/USER/main/banner-light.png">
    <img alt="NOM — TITRE" src="https://raw.githubusercontent.com/USER/USER/main/banner.png" width="100%" />
  </picture>
</a>
```

## Variante réseaux sociaux — `gen-social.ts`
Même config JSON, layout **tout centré** sur l'axe vertical (badge → lockup logo+nom → subtitle →
chips → footer une ligne `footerLeft · @handle · footerRight`). Le type scale est dérivé de `height`,
donc les formats plats passent sans clipping. `hlineInset` auto (`≈ 0.085 × height`), overridable.

Clé de config en plus : `"logo": true` → monogramme `@kbrdn1` (le `public/favicon.svg` du
portfolio, inliné) à gauche du nom, à `0.8 × font-size` du h1, masse en `fg` du thème et chevron
en accent. En lockup avec le nom plutôt qu'en ligne propre : ça ne coûte rien au budget hauteur,
critique à 396px. Opt-in parce que le monogramme est spécifique à kbrdn1.

```bash
bun gen-social.ts config.json OUT   # width/height obligatoires dans le config selon la cible
```

Formats cibles (rendre avec `--window-size` = width,height, **sans** `--force-device-scale-factor`) :

| Cible | width × height |
|---|---|
| X / Twitter header | 1500 × 500 |
| LinkedIn cover (profil) | 1584 × 396 |

Contraintes : les deux plateformes superposent l'avatar en **bas à gauche** et croppent les côtés
en mobile → rien d'important hors de la bande centrale, et pas de footer ancré à gauche
(d'où la ligne unique centrée).

Note : le README profil `kbrdn1/kbrdn1` reste **visuels only** (bannière + badges + éventuel promo slim), pas de prose — voir la skill `me:banner-slim`.
