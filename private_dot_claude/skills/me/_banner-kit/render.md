# Rendu dark + light → PNG (partagé par les 3 skills banner)

Chaque skill génère `dark.html` + `light.html` (fonts embarquées en base64, aucun
réseau requis). On les rasterise en PNG via **Chrome headless** — scriptable, pas
besoin de piloter un navigateur à la main.

## Commande (macOS)

```bash
# depuis la racine du repo : les chemins du config (logo, image) y sont relatifs
~/.claude/skills/me/_banner-kit/render.sh <gen.ts> <config.json> <outdir> [dark.png] [light.png]
```

`render.sh` lance Chrome headless (`--force-device-scale-factor=2`, retina) sur `dark.html` puis
`light.html`. Sans `height` dans le config, la hauteur suit le panneau : un premier rendu
(`--dump-dom`) lit `data-panel-bottom` posé par `card.ts`, la page garde sous le panneau la
marge qu'elle a au-dessus (56 px). `CHROME=…` change le binaire.

Notes :
- `--screenshot` de Chrome peut écrire le PNG sans rendre la main : le script attend le fichier puis tue Chrome.
- Vérifier le PNG (`sips -g pixelWidth -g pixelHeight`) puis l'afficher (Read) pour validation.
- Chrome introuvable ou rendu KO → fallback : servir le dossier (`python3 -m http.server 8799`),
  charger `http://localhost:8799/dark.html` via playwright MCP (`browser_resize` W×H →
  `browser_navigate` → `browser_take_screenshot scale:device`). file:// est bloqué sous playwright MCP, d'où le http local.

## Nommage des sorties

- Bannière github profil / repo : `banner.png` (dark) + `banner-light.png` (light) — le
  `<picture>` GitHub swappe via `prefers-color-scheme`.
- Slim : `<slug>-slim.png` + `<slug>-slim-light.png` si plusieurs coexistent dans un même repo.

## Bloc `<picture>` GitHub (dark/light auto)

```html
<a href="URL">
  <picture>
    <source media="(prefers-color-scheme: dark)"  srcset="RAW_OR_RELATIVE/banner.png">
    <source media="(prefers-color-scheme: light)" srcset="RAW_OR_RELATIVE/banner-light.png">
    <img alt="ALT" src="RAW_OR_RELATIVE/banner.png" width="100%" />
  </picture>
</a>
```

- README d'un repo : chemins **relatifs** (`docs/_assets/banner.png`) → chaque branche
  affiche sa propre image. GitHub gère le swap dark/light même en relatif.
- README de profil (`user/user`) : URLs raw absolues
  (`https://raw.githubusercontent.com/<user>/<user>/main/banner.png`).
