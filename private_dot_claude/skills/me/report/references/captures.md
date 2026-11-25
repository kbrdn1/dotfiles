# Captures du rendu : format

Contrat entre le modèle (qui écrit `captures.json`), `capture.mjs` (qui produit les images) et `collect.py` / la page
(qui les montrent). Tout vit dans le dossier du rapport de la branche, `~/Reports/<owner>-<repo>/<branche>/`, jamais
dans `/tmp` ni dans le dépôt.

## Fichiers

```
captures.json                 manifeste, écrit par le modèle
captures/<id>.png             après : le rendu de la branche (baseUrl)
captures/<id>.before.png      avant : le même plan sur la base (beforeUrl, en général la preprod = dev déployé)
captures/sha                  sha court de HEAD à la dernière capture complète (une ligne)
```

## captures.json

```json
{
  "baseUrl": "http://localhost:3001",
  "beforeUrl": "https://pre-prod.kbrdn.dev",
  "css": "#cc-main{display:none!important}",
  "shots": [
    {
      "id": "home-chart-desktop-dark",
      "title": "Calendrier des contributions en graphe dither",
      "route": "/",
      "selector": "#contributions",
      "viewport": "desktop",
      "theme": "dark",
      "actions": [{ "click": "button[aria-label='…']" }, { "wait": 400 }],
      "files": ["app/components/home/GitHubChart.vue", "app/components/ui/DitherChart.vue"],
      "note": "une phrase : ce qu'il faut regarder"
    }
  ]
}
```

- `id` : `a-z0-9-`, unique. C'est aussi le nom du fichier.
- `viewport` : `desktop` (1440 × 900, DPR 2) ou `mobile` (390 × 844, DPR 3, tactile).
- `theme` : `light`, `dark` ou un thème du site (`blur` sur kbrdn.dev). Appliqué comme le site le fait : préférence
  stockée avant le chargement (`localStorage[themeKey]`) et `prefers-color-scheme` émulé, jamais par l'OS. Si
  `<html>` ne porte pas le thème après chargement (classe ou `data-theme`), la capture échoue au lieu de mentir.
- `selector` : capture de l'élément seul, avec une marge de 24 px ; absent, la fenêtre visible. Un élément plus haut
  que la fenêtre l'agrandit (le fond fixe reste derrière lui ; pas de `fullPage`).
- `actions` : jouées dans l'ordre avant la capture. Une clé par objet : `click`, `hover`, `focus`, `scroll`
  (sélecteur centré), `press` (touche : `Enter`, `Escape`…), `wait` (ms). Pour ouvrir une modale, montrer un survol, un
  focus clavier.
- `files` : les fichiers dont dépend ce rendu. Si l'un d'eux change après `captures/sha`, la capture est en retard
  (STALE), comme une section de `notes.json`. `[]` : jamais en retard.
- `beforeUrl` absent, route en 404 sur la base, élément ou action introuvables : pas d'image avant (un ancien
  `.before.png` est retiré).

Champs optionnels (ajoutés par `capture.mjs`, sans rien changer aux précédents) :

| champ | où | défaut | effet |
|---|---|---|---|
| `midway` | plan | — | ms : fige à cet instant les animations **lancées par les actions** (entrée d'une modale), celles déjà présentes (trame, boucles) sont seulement mises en pause. Capture à mi-course |
| `css` | manifeste ou plan (le plan l'emporte, `""` l'annule) | — | feuille injectée après chargement : masquer un bandeau cookies, un widget de chat |
| `storage` | manifeste | `{}` | entrées `localStorage` posées avant chargement (réglages figés du site) |
| `themeKey` | manifeste | `nuxt-color-mode` | clé `localStorage` qui reçoit le thème ; `null` = aucune, seul `prefers-color-scheme` joue |
| `settle` | manifeste ou plan | `2000` | ms d'attente après chargement (entrées animées, données client), avant les actions |
| `reducedMotion` | manifeste ou plan | `false` | `prefers-reduced-motion: reduce` : un graphe qui s'anime arrive d'un coup à son état final |

## Ce qu'on capture

Tout diff qui touche au rendu (`.vue`, `.css`, `.tsx`/`.jsx`, `app/`, `components/`, `pages/`, `layouts/`,
`public/` images, `i18n/`, config UI) : chaque écran ou composant modifié, au minimum en desktop et mobile, dans les
thèmes du site, et dans les états que la PR introduit (ouvert, survol, focus, erreur, vide). On vise le minimum qui
montre tout ce qui a changé, pas une matrice complète : en général 4 à 12 plans. Animations : une capture à l'état
final, plus une capture à mi-course (`midway`) si le mouvement est le sujet.

`collect.py` réclame les captures (`CAPTURES absentes`) quand un fichier du diff répond à ses motifs « front »
(`FRONT` : extensions de vues et de styles, `components/`, `pages/`, `layouts/`, `i18n/`, images de `public/`… mais
pas `app/`, qui est du back en Laravel ou Rails). Par projet, `~/Reports/<owner>-<repo>/front-patterns.txt` les
remplace : un motif fnmatch par ligne (`*` traverse les dossiers, `#` commente) ; un fichier vide ne réclame jamais
rien. kbrdn.dev en a un (Nuxt : tout `app/` est rendu).

## capture.mjs

```bash
cd <worktree>                                   # le serveur de la branche tourne sur baseUrl
node ~/.claude/skills/me/report/capture.mjs     # tous les plans
node ~/.claude/skills/me/report/capture.mjs --stale        # en retard ou sans image, lus dans facts.json
node ~/.claude/skills/me/report/capture.mjs --only id1,id2
```

- Aucune dépendance dans le dépôt. `playwright-core` : `$PLAYWRIGHT_CORE`, sinon `node_modules` du cwd, sinon le cache
  npx de `@playwright/mcp` (le plus récent ; `npx -y @playwright/mcp@latest --help` le remplit). Chromium : celui
  qu'attend playwright-core, sinon le `chromium_headless_shell-*` le plus récent de `~/Library/Caches/ms-playwright`
  (`$PLAYWRIGHT_CHROMIUM` force un exécutable). Chromium seul : pas de WebKit.
- STALE n'est calculé qu'à un endroit, `collect.py`. `--stale` lit donc `facts.json` et refuse s'il ne décrit pas
  HEAD : `collect.py` d'abord.
- `captures/sha` n'avance que si, après le run, plus aucun plan n'est en retard ni sans image : un `--only` ne
  rajeunit pas les autres. Un plan en échec garde son ancienne image.
- Sortie : une ligne par plan (`ok`, `sans avant (raison)`, `ÉCHEC`), puis `CAPTURES n/m faites · sha …`. Code 1 si un
  plan a échoué, 2 si rien n'a pu tourner (baseUrl injoignable, manifeste invalide, pas de Playwright).
- Des fichiers suivis non commités : il prévient, la capture les montre alors que `captures/sha` dira HEAD.
