---
name: banner-github
description: Génère une bannière de profil GitHub (hero, PNG dark + light) au design de kbrdn.dev (panneau sur champ en dither) — nom, titre, badge de statut, chips de stack, avatar optionnel. Pour le README de profil (repo user/user). Déclencheurs : "bannière github", "banniere profil", "profile banner", "hero banner profil", /me:banner-github.
version: 2.1.0
allowed-tools: ["Bash", "Read", "Write", "SendUserFile"]
---

# Bannière GitHub — profil (hero)

Bannière de profil au design system de **kbrdn.dev** (refonte #86 : champ de pixels orange
tramé sur fond quasi noir, contenu dans un panneau arrondi qui tient une carte, accent
`#d4825d`/`#c15f3c`, mono Monaspace Krypton + serif Fenix, pastilles arrondies, filets en
tirets). Sort deux PNG (dark + light) pour un `<picture>` qui swappe via
`prefers-color-scheme`. C'est le format de la bannière de `kbrdn1/kbrdn1`.

## Quand l'utiliser
- Bannière du README de profil GitHub (`user/user`).
- Refonte/mise à jour d'une bannière profil existante.
- Variante **réseaux sociaux** (X / LinkedIn) : même design, contenu **centré** → `gen-social.ts` (voir plus bas).

## Pipeline
Kit partagé `../_banner-kit/` (`card.ts`, même carte que `banner-repo`).

1. **config.json** :

   ```json
   {
     "name": "Kylian Bardini",
     "subtitle": "Web Developer Engineer",
     "badge": "Building open source",
     "handle": "kbrdn1",
     "chips": ["TypeScript", "Laravel", "Nuxt", "Rust", "AWS"],
     "footerLeft": "kbrdn.dev",
     "footerRight": "Nancy, France"
   }
   ```

   Champs (tous optionnels sauf `name`) :
   - `name` (Inter 500, `nameSize` défaut 68), `subtitle` (Fenix, accent).
   - `handle` : titre de l'en-tête (`@handle`) et ligne GitHub de la fiche.
   - `badge` : ligne Status en pastille verte. `footerRight` : Location. `footerLeft` : Site, bouton globe et adresse du pied.
   - `cta` : bouton plein (défaut « Contact »). `footerAction` : bouton du pied (défaut « Portfolio »).
   - `avatar` : portrait de la vignette (défaut `_banner-kit/assets/portrait.png`).
   - `chips` + `chipsLabel` (défaut « Stack »).
   - `width` (1600), `height` (absent → suit le panneau).

2. **Générer** (facultatif) : `bun gen.ts <config.json> <outdir>`.

3. **Rendre** depuis la racine du repo (les chemins du config y sont relatifs) :
   ```bash
   ~/.claude/skills/me/_banner-kit/render.sh ~/.claude/skills/me/banner-github/gen.ts banner.config.json OUT banner.png banner-light.png
   ```
   Sans `height`, la hauteur suit le panneau (voir `../_banner-kit/render.md`).

4. **Vérifier + montrer** (Read des deux PNG) avant tout push. `oxipng -o 2 --strip safe` avant de committer.

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
