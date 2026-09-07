# Rendu dark + light → PNG (partagé par les 3 skills banner)

Chaque skill génère `dark.html` + `light.html` (fonts embarquées en base64, aucun
réseau requis). On les rasterise en PNG via **Chrome headless** — scriptable, pas
besoin de piloter un navigateur à la main.

## Commande (macOS)

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
# W et H = width/height de la config (mêmes valeurs que le gen). scale 2 = retina crisp.
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
  --virtual-time-budget=1500 --window-size=W,H \
  --screenshot="OUT/banner.png"       "file://OUT/dark.html"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
  --virtual-time-budget=1500 --window-size=W,H \
  --screenshot="OUT/banner-light.png" "file://OUT/light.html"
```

Notes :
- `--window-size=W,H` doit matcher exactement la config sinon le screenshot est rogné/letterboxé.
- `--force-device-scale-factor=2` sort du 2× (ex : 1600×460 → 3200×920). Mettre `1` pour du 1:1.
- Vérifier le PNG (`sips -g pixelWidth -g pixelHeight`) puis l'afficher (Read/SendUserFile) pour validation.
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
