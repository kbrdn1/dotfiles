# Style des compagnons : ce que le portfolio fait déjà

Mesuré dans `~/Projects/Perso/kbrdn.dev-v2` (branche `dev`) et `brand/mascot/`. C'est la
référence de tout ce que `src/build.py` dessine.

## Deux familles de pixel art sur le site

| | Silhouettes plates | Caméos peints |
|---|---|---|
| Où | `utils/invaders.ts`, `layout/FooterCritter.vue`, `ui/PixelCursor.vue`, `utils/pixelScenes.ts` | `utils/cameos/*.ts` (19 scènes), peintes par `utils/cameos/art.ts` |
| Grille native | envahisseurs 8×8 à 16×7 ; nourriture et obstacles 4×4 à 9×6 ; scènes 64×48 | 72×56 pour une scène (`pencil`) ; objets 31×7 (crayon), 5×5 (police) |
| Taille du pixel | `CELL = 2` px CSS (pied de page), `CELL = 3` (curseur) | 1,5 px CSS par pixel d'art, arrondi au pixel écran entier : `floor(1.5 × dpr) / dpr` (3 px écran sur Retina) |
| Couleurs | 1 couleur par forme, une classe du thème (`fill-yellow-600 dark:fill-yellow-500`) | palette `PAL` : 14 teintes, chacune déclinée en 3 tons |
| Contour | aucun | 1 px, `#0f0f0f` sur page sombre, `#242424` sur page claire (`outlineOf`) |
| Ombrage | aucun | 3 tons (ombre = teinte × noir 30 %, base, lumière = teinte × blanc 35 %), éclairage en haut à gauche, damier de tramage (+0,08) là où deux tons se touchent |
| Animation | 2 images en alternance (marche des envahisseurs, nourriture `FOOD_FRAME = 280` ms), CSS `steps(3 à 6)` sur 0,24 à 0,5 s, `bob 0.9s steps(1)` | une pose toutes les `FRAME = 85` ms (cadence reprise d'Ichigo), apparition et repli en 320 ms, scènes de 110 ms (`SCENE_TICK`) |
| Rendu | rects SVG ou canvas, `image-rendering: pixelated`, échelle entière | canvas peint à la taille d'art puis agrandi, `imageSmoothingEnabled = false` ; halo `drop-shadow(0 0 2px neutral-700)` en sombre |

## La palette (`art.ts` `PAL`, `theme.css`)

`orange #d4825d` (primary-500), `rust #a64d2e` (primary-700), `cream #f8ddb8` (primary-200),
`red #e06060`, `pink #ff9aa8`, `yellow #ffdf61`, `gold #e6c654`, `green #6bc97f`,
`blue #7ab8ff`, `purple #c79bff`, `cyan #8abfb8`, `steel #999999`, `paper #f5f5f5`,
`wood #a0673d`. Les neutres du thème : `#1a1a1a` (950), `#242424` (900), `#3a3a3a` (700),
`#d0d0d0` (200).

## Ce qui n'est pas du pixel art

- `brand/mascot/*.png` (31 fichiers) : 384×384, entre 13 000 et 25 000 couleurs, illustration
  vectorielle lissée (le singe à casquette) avec un trait sombre épais et des aplats ombrés.
  Ce n'est pas une grille de pixels, donc pas une référence de résolution ; elle donne le ton
  (trait sombre qui détache la forme, orange chaud, expression lisible).
- `public/images/lowpoly/*` : scènes low-poly, hors sujet.
- Ichigo (`ui/Ichigo.vue`) : sprites d'un jeu Nintendo, ni repris ni imités ; seule sa cadence
  de 85 ms et son échelle de 1,5 px sont des conventions du site.

## Ce que les compagnons en retiennent

- La famille des caméos : volumes 3 tons éclairés en haut à gauche, tramage en damier, contour
  1 px (deux jeux de PNG, `dark` et `light`), la palette `PAL`, rien d'autre.
- Une grille de 21×16 pixels d'art pour le corps et de 10×10 pour un accessoire, ancré à un
  emplacement (`hand` en 11,6 ; `head` en 11,0), comme une couche au-dessus du corps.
- L'échelle du site : 1,5 px CSS par pixel d'art, soit 3 px écran sur Retina, ce qui donne
  31,5 × 24 px CSS (une tuile de 32 px) ; 1 px CSS, soit 2 px écran, donne 21 × 16 (une tuile de
  24 × 20). Les PNG sont livrés déjà agrandis au plus proche voisin (×1 à ×4), affichés à 1 pixel
  d'image pour 1 pixel écran : aucun rééchantillonnage, donc aucun flou.
- Des cadences multiples de 85 ms ; 2 à 4 images par animation ; 2 images en boucle pour ce qui
  dure (respiration, saisie), une courte séquence jouée une fois pour ce qui arrive (fête, salut),
  comme les envahisseurs et les caméos.
