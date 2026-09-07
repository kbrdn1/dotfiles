# Assets visuels — banques, patterns, politique

## Accès rapides (acquis vérifiés — à lire AVANT toute recherche)

L'API MediaWiki du wiki passe toujours, même quand les pages HTML renvoient 402 :

```
BASE = https://rezero.fandom.com/api.php   (FR : rezero.fandom.com/fr/api.php)
?action=query&titles=A|B|C&prop=pageimages&pithumbsize=480&redirects=1&format=json
    → vignette d'infobox par lot (480 portraits / 900 illustrations)
?action=query&titles=A|B|C&prop=extracts&exintro&explaintext&format=json
    → résumés texte par lot (rédaction de fiches)
?action=query&titles=Page&prop=images&imlimit=100&format=json
    → tous les fichiers d'une page (galeries d'épisodes/lieux)
?action=query&titles=File:X.png&prop=imageinfo&iiprop=url|size&format=json
    → URL directe CDN + dimensions d'un fichier
?action=query&list=allimages&aiprefix=Xxx&format=json
    → fichiers par préfixe de nom (CharMug, logos…)
?action=query&parse&page=X&prop=wikitext&format=json
    → wikitext brut : la section ==Gallery== y liste les fichiers même quand extracts est vide
```

- ⚠ **Un `extract` vide ne veut pas dire une page vide** (vécu sur `Re:IF` et sur tous ses
  personnages). Passer à `action=parse&prop=wikitext` : c'est là qu'on trouve l'infobox (titre
  JP, date, pagination), la liste des chapitres, le casting complet et la galerie.
- **`allimages&aiprefix=<titre de l'œuvre>` est le réflexe n° 1 pour une IF** : deux requêtes
  (`Re IF`, `Rem IF`) ont sorti tout l'inventaire visuel du Rem IF, dont la pépite ci-dessous —
  que ni la page wiki ni les pages personnages ne référencent.
- 🏆 **Planches de character designs des artbooks** — `Re_IF_LN_character_designs_2nd_ReZero_Artbook.png`
  (1448×2047, Otsuka, *Re:Zero Art Works 2nd* p. 140-141) : Subaru, Rem, Rigel, Spica, Tia
  (versions noire ET blanche) et Halibel sur une seule planche, en pied et en buste. C'est **la**
  source de portraits pour une IF : l'apparence y est celle *du récit* (dans le Re:IF, Subaru et
  Rem ont les cheveux longs — les portraits canoniques de la bibliothèque sont donc faux pour
  cette histoire). Chercher `*_character_designs_*` avant de bricoler des crops d'illustrations.
  Convention retenue : suffixer les classes `-if` (`p-subaru-if`, `p-rem-if`, `p-halibel-if`)
  pour ne pas écraser les portraits canoniques partagés par les autres chapitres.

- CDN images : `static.wikia.nocookie.net/...` curl-able avec UA navigateur ; renvoie du **WebP
  même en .png** → `sips -s format png` AVANT tout crop. Retirer `/scale-to-width-down/N` (ou
  utiliser `revision/latest` nu) pour l'**original** — souvent 1920×1080 quand la vignette
  plafonne à 900. `Special:FilePath` est derrière Cloudflare : passer par imageinfo.

- **CDN Eminent Translations** `cdn.eminenttranslations.com/images/<slug>-…webp` — curl direct, pas
  de blocage, WebP haute résolution (1625×2170 pour une couverture, 2048 de large pour une
  illustration) ; `sips -s format jpeg -Z …` derrière. Les scans des IF y sont **non officiels** :
  la « couverture » d'une IF chez eux est un **fan-art monté en fausse couverture LN** (Académie et
  Lust : illustrateur *RealBarto* / *ZeroBarto*) — la créditer comme telle, jamais comme un visuel
  officiel d'Otsuka. ⚠ Leurs illustrations de scène sont souvent **incrustées de texte anglais** ;
  quand le post FR héberge le **même fan-art sans texte** (cas de l'Académie), prendre la version
  française : elle est propre et cohérente avec l'édition.

- ⚠ **GIF animés des posts FR : ne JAMAIS prendre l'image 0** (piège vécu deux fois sur Oboreru —
  livré avec un rectangle noir et deux rectangles blancs en page). Ces fan-arts animés ouvrent sur
  un fondu : image 0 = noir plat (luminance ~1) ou blanc plat (~250). `sips` et les convertisseurs
  par défaut extraient exactement cette image-là. Choisir l'image au **plus fort écart-type de
  luminance** (= le plus de contenu réel ; le maximum de luminance, lui, tombe sur un flash blanc) :

  ```python
  from PIL import Image, ImageStat            # PIL dispo sur cette machine
  im = Image.open(p); best = max(range(im.n_frames),
      key=lambda i: (im.seek(i), ImageStat.Stat(im.convert("RGB").convert("L")).stddev[0])[1])
  im.seek(best); im.convert("RGB").save(out, "JPEG", quality=85)
  ```

  Garder la **résolution native** du GIF (320×180 ou 640×360 chez rezerowebnovelfr) : upscaler à
  900 ne fait qu'alourdir. Et déclarer l'`aspect-ratio` réel — un ratio faux + `background-size:
  cover` recadre salement. Contrôle : décoder le data URI et regarder l'image avant de livrer.
- Pages épisodes `Episode NN` : previews officielles 1920×1080 (68-73 = arc 6) ; fichiers
  descriptifs type `Episode 68 Distant Pleiades Watchtower at Night.png` = décors d'ambiance.
- `Xxx_CharMug.png` = portrait de tête propre (Garfiel…).
- spriters-resource : 403 sans UA navigateur ; fiches sous `/fullview/<ID>/`.
- OST : chercher `w.soundcloud.com` dans le **HTML brut** du post source (tavily ne rend pas les
  iframes) ; track id → player du site.
- **Quand le post source n'embarque rien** (cas de WCT, d'Eminent, et de la plupart des posts FR
  hors Kasaneru/Ayamatsu/Oboreru) : la communauté FR héberge deux comptes SoundCloud publics qui
  sont la banque de référence de la bibliothèque —
  `soundcloud.com/rezerowebnovel45` (**OST fan-made par Hazark**, une par IF : Rem IF, Ayamatsu,
  Tsugihagu, Oboreru/Kasaneru, Agony, + le thème Sirius de PocketPaper) et
  `soundcloud.com/rezerofr` (**morceaux officiels** : Bouya no Yume yo, Subaru-Emilia,
  Quiet Richt, Yuki no Hate Kimi no Na wo, Yuki no Furu Machi, Long Shot, Believe in You,
  Paradisus-Paradoxum). Toujours préférer l'OST fan-made dédiée au récit quand elle existe.
  Recette pour lister et résoudre (aucune clé d'API nécessaire) :
  ```bash
  # 1. lister les pistes d'un compte (le HTML de la page /tracks porte les permaliens)
  curl -sL -A "Mozilla/5.0 … Chrome/120" https://soundcloud.com/<compte>/tracks \
    | grep -oE "/<compte>/[a-z0-9-]+" | sort -u
  # 2. permalien → id numérique attendu par le player (data-ost)
  curl -s "https://soundcloud.com/oembed?format=json&url=https%3A//soundcloud.com/<compte>/<slug>"
  #    → le champ html contient api.soundcloud.com%2Ftracks%2F<ID>
  ```
  ⚠ Le `<script>` d'hydratation de SoundCloud ne contient **pas** les ids (`soundcloud://sounds:`
  et `"id":` sont absents de la page /tracks) : passer par oembed, pas par un regex sur le HTML.
  Un choix éditorial (piste non attachée au récit par sa source) **se dit dans les Sources** —
  « choix éditorial, le post source n'embarque aucun lecteur ».
- Wikimedia Commons : logo officiel `Re_Zero_kara_Hajimeru_Isekai_Seikatsu_logo.png`.
- **Décors officiels de Lugnica** (page wiki `Kingdom of Lugunica`, `prop=images`) : `Kingdom of
  Lugunica - Night.jpg` (1922×1080, la Capitale de nuit — excellent fond d'ambiance),
  `Rom's Loothouse.jpg` (1920×1080, l'Entrepôt de Marchandises Volées), `Lugnician Slums.png`,
  `Royal Castle.png`, `Karsten Mansion.png`, `Arlam Village.png`. Tous en 1920×1080 sur le CDN.
- **Les fan-arts du post FR sont placés à leur scène** et valent mieux que des visuels génériques :
  scraper les `<img>` du HTML brut, puis retrouver la scène de chacun en cherchant les ~50
  derniers caractères de texte qui les précèdent dans le `.txt` extrait (normaliser apostrophes
  et espaces avant de comparer). Retirer le `?w=NNN` de l'URL pour la pleine résolution. Les
  fichiers nommés `NN-a-remplacer.png` sont des placeholders **de la team FR**, pas des images
  cassées : les regarder, ils sont souvent bons.
- Pipeline images : curl UA → sips format png → crop carré (`-c s s`) → `-Z 96` (portraits) /
  `-Z 900` + jpeg q70-80 (illustrations) / ≥1600 (fonds d'ambiance).

Vérifié 2026-08-14. Priorité systématique : asset **officiel** (Otsuka, jeux, promo) > communauté
référencée > génération (marquée comme telle, en dernier recours).

## IF sans aucun asset de personnage (gender-swap, AU) — acquis Mimagau 2026-08-15

Quand le cast n'existe nulle part en visuel (genres inversés, univers alternatif), la question
n'est pas « quel portrait approchant prendre » : **réutiliser le portrait canonique du personnage
d'origine est un faux**, pas une approximation — le lecteur voit Émilia là où le texte décrit
Émilio. Conduite tenue :

- **avatars de substitution pour tout le cast** (recette `.p-sigrum` : silhouette + initiale,
  une couleur de cheveux par personnage), déclarés comme tels dans les Sources **et** dans chaque
  fiche du glossaire ;
- **tout le budget visuel part sur les lieux**, qui eux ne changent pas d'un récit à l'autre et
  restent au niveau de spoiler du chapitre. Pour un récit d'arc 1 dans la Capitale, les trois qui
  suffisent (page wiki `Kingdom of Lugunica`, `prop=images`, tous 1920×1080 sur le CDN) :
  `Fountainarea.png` (la place de la fontaine — la rue où Subaru débarque), `Lugnician Slums.png`
  (les bas-fonds), `Rom's Loothouse.jpg` (l'intérieur de l'Entrepôt), plus
  `Kingdom of Lugunica - Night.jpg` en fond d'ambiance. ~150-180 Ko chacune en base64 après
  `-Z 900` + JPEG q80 (fond : `-Z 1600` + q70).

## Illustrations light novel (Shinichirou Otsuka) — ambiance de scène

- **Wiki fandom, pages volume** : `https://rezero.fandom.com/wiki/Re:Zero_Light_Novel_Volume_<N>`
  (aussi `Re:Zero_Ex_Light_Novel_Volume_<N>`, `Re:Zero_Tanpenshuu_Volume_<N>`, `Re:IF`,
  `Re:IF_Kasaneru`, `Re:IF_Ayamatsu`). Chaque page a une section Gallery : c'est LA source
  d'attribution volume/chapitre. Pages souvent en 402 → passer par tavily-extract ; les images
  elles-mêmes se récupèrent en curl sur `static.wikia.nocookie.net/rezero/images/...`
  (retirer le suffixe `/scale-to-width-down/<n>` de l'URL pour la pleine résolution).
- **Galeries par personnage** : `https://rezero.fandom.com/wiki/<Personnage>/Image_Gallery` —
  sections séparées par médium (Light Novel / Anime / Manga / Jeux), utile pour vérifier à quel
  volume appartient une illustration.
- **Artbooks Re:BOX 1 & 2** (Otsuka, arcs 1-4) : physiques uniquement — référence
  d'attribution, pas une source d'images.

## Portraits / bustes pour les dialogues

- **The Spriters Resource** — PNG transparents extraits des jeux officiels, le meilleur matériau
  portrait :
  - `https://www.spriters-resource.com/mobile/rezerolostinmemories/` (~21 persos, bustes)
  - `https://www.spriters-resource.com/playstation_4/rezerodeathorkiss/` (haute résolution)
  - `https://www.spriters-resource.com/mobile/rezeroinfinity/` (2024, + costumes alternatifs)
  - 403 au fetch naïf → `curl -A "Mozilla/5.0 …"` ; les fiches sont sous `/fullview/<ID>/`.
- **Galeries fandom par personnage** (voir ci-dessus) — fallback si pas de sprite.
- Statut : sprites = extraits de jeux **officiels** (le mentionner dans Sources : « sprite du jeu
  Re:Zero Lost in Memories »). Un buste de jeu reste utilisable pour un chapitre WN/IF tant que
  l'apparence correspond à la période (pas de tenue/forme spoilante).

## Artworks promo, cartes, divers

- **Zerochan** : `https://www.zerochan.net/Official+Art,Re:Zero+Kara+Hajimeru+Isekai+Seikatsu` —
  agrégateur taggé « Official Art », attribution faible (pas de volume/chapitre) : à recouper
  avant usage.
- **Carte du monde** : `https://witchculttranslation.com/re-zero-world-map/` (version officielle
  du jeu The Forbidden Book and the Mysterious Spirit + versions fan améliorées, crédit u/worel —
  distinguer les deux) ; miroir FR : `https://rezerowebnovelfr.wordpress.com/la-carte-du-monde-de-rezero/`.
- Pinterest/HiClipart/PNGEgg : découverte seulement — provenance opaque, jamais cités comme source.

## Workflow par chapitre

1. Identifier les scènes candidates (ouverture + ruptures majeures) et les personnages parlants
   principaux (2-4 max).
2. Chercher d'abord une illustration liée au volume/à l'IF exacte (page volume du wiki) ; à
   défaut, un artwork du personnage dans un état cohérent avec le chapitre.
3. **Filtre spoiler** (bloquant) : l'image ne doit rien montrer au-delà du niveau d'information du
   chapitre — identité, pouvoir, transformation, mort, alliance, antagoniste, événement d'une
   route ultérieure. Exemples de pièges : Satella/la Sorcière pour un chapitre d'arc 1-3, la forme
   adulte d'un personnage, les tenues Vollachia pour un chapitre Lugunica, une illustration de
   Rem endormie pour un lecteur pré-arc 3.
4. Télécharger, redimensionner, inliner — recette dans `rendu.md`. Jamais de hotlink dans
   l'artifact (CSP).
5. Tracer chaque asset retenu : origine, œuvre/volume, officiel/communautaire/généré, personnage.
   Ça part dans la section « Sources et références » du chapitre.

Si rien de convenable n'existe : pas d'image (le texte se suffit), ou génération explicitement
marquée « Image générée » — jamais présentée comme officielle.

## Acquis du run Kasaneru (2026-08-15)

- **Illustrations officielles des IF en light novel** : la page wiki `Re:IF_Kasaneru` (et son
  équivalent `Re:IF`) porte les planches Otsuka du tirage limité —
  `Re_IF_Kasaneru_Greyscale_Illustration.png` (2048×1460, double page du cast),
  `ReZero_IF_Kasaneru_Cover.png`, `Re_IF_Kasaneru_Table_of_Contents.png`. Ce sont les **seuls
  visuels officiels** disponibles pour une IF : les chercher avant de se rabattre sur les fan-arts
  (`prop=images` sur la page `Re:IF_<titre>`).
- **Décors officiels du manoir Roswaal** : page wiki `Roswaal Manor`, `prop=images` — la série
  `Roswaals Mansion - <pièce>.png` en 1280×720 (Forbidden Library, Garden, Dining Room, Entry,
  Guest Room, Kitchen, Bathroom), plus `Roswaals Mansion HQ.jpg` (vue d'ensemble de jour) et
  `Roswaal's mansion ep.30.png` (1920×1080, ciel rouge — spectaculaire mais très connoté).
- **Le salon de thé d'Echidna** : `Echidna_and_Subaru_ep.28.png` (1920×1080, prairie, parasol
  blanc, ciel bleu) — le meilleur fond d'ambiance pour tout récit qui passe par le monde des rêves.
- **OST par scène** : le post FR de Kasaneru embarque **12 iframes SoundCloud** (un thème + une
  piste PocketPaper par scène), dont 4 en *milieu* de bloc et non en tête. Les mapper depuis les
  marqueurs `[[IFRAME:]]` du texte extrait (leur position est conservée), pas depuis les légendes :
  la ligne `PocketPaper · 0N – TITRE` qui suit l'iframe est un `data-label`, jamais de la prose.
