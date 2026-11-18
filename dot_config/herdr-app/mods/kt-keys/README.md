# kt-keys : l'aide des touches et les modules partagés kbrdn

`kt-keys` est la fenêtre d'aide des touches. Son dossier sert aussi de source aux modules partagés des mods kbrdn. Chacun est COPIÉ à l'identique dans les mods qui s'en servent, puis vérifié par `cmp`, parce qu'un mod ne peut pas importer depuis le dossier d'un autre :

| Module | Rôle | Règle |
|---|---|---|
| `vim.js` | keymap vim | `data/orchestrator/KEYMAP.md` |
| `motion.js` | animations natives | `ANIMATIONS.md` |
| `bus.js` | données à jour entre mods | `DATA-SYNC.md` |
| `dither.js` | bande dither aux coins arrondis, 3840 px | `DESIGN-REFERENCE.md` |
| `filters.js` | rangée de filtres pâles | `FILTERS.md` |
| `viz.js` | graphes dither (port MIT des visuels Monocode) | en-tête du fichier |
| `skeleton.js` | skeletons de chargement (barres, cartes, rangées, une pulsation par région), avec `motion.js` | `ANIMATIONS.md` (11), en-tête du fichier |
| `i18n.js` | français et anglais | `I18N.md` |

Les `*.check.mjs` se lancent avec **Bun**, pas avec Node : `bun mods/kt-keys/<nom>.check.mjs`. Ils importent `bun` pour simuler `herdr` et `gpui-kit`, si bien que Node échoue sur un faux rouge.
