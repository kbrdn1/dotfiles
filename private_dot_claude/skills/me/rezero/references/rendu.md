# Rendu — bibliothèque locale « RE:Zero Stories »

Sortie par défaut : le site statique local `~/Desktop/RE:Zero Stories/` (ouvrable en double-clic,
file:// pur, zéro dépendance, aucun serveur). L'artifact claude.ai n'est produit que sur demande
explicite. Charger `artifact-design` avant d'écrire une nouvelle page — le gabarit reste « light
novel édité » : lecture longue, colonne ~42rem, serif système, séparateurs de scène en pointillés
de couture, accent « fil rouge ».

**Charte (exigence utilisateur) : angles droits partout — jamais de `border-radius`** sur
boutons, cartes, encadrés, player, vignettes. **Une seule exception : les portraits de
personnages restent ronds (50 %)**. Chrome en mono façon kbrdn.dev (labels 9-10px uppercase
letterspacing, tabular-nums). Le fond d'ambiance flouté est débrayable par le lecteur (toggle
dans le popover réglages, persisté `rz-bg`).

## Structure du dossier

```
~/Desktop/RE:Zero Stories/
├── index.html                    # bibliothèque : logo, fond d'ambiance flouté (Lugnica), recherche
│                                 #   à 2 modes (plein texte / titre d'histoire), compteurs par
│                                 #   catégorie, cartes avec métadonnées + % de lecture
├── _site/
│   ├── site.css                  # tokens (papier/encre/fil, 3 états de thème) + chrome + prose chapitre
│   ├── site.js                   # navbar (depuis MANIFEST), drawer glossaire, suivi de lecture, thème
│   ├── glossary.js               # données du volet glossaire — à enrichir avec references/glossaire.md
│   ├── portraits.css             # portraits partagés en data URI (.p-<perso>) — texte ET glossaire
│   ├── atelier.html              # page « Générer du contenu » (footer uniquement) : catalogue des
│   │                             #   éléments générables, accordions avec prompt à copier, recherche
│   │                             #   + filtres — À TENIR À JOUR quand le pipeline gagne une capacité
│   ├── manifest.js               # arbre du contenu — GÉNÉRÉ, ne pas éditer à la main
│   └── build_site.py             # scan des dossiers → manifest.js ; relancer après chaque ajout
└── <Catégorie>/<Titre du chapitre>/index.html
```

**Responsive (breakpoint 1080px, navbar compacte à 700px)** : en mobile/tablet le body perd son
padding (le cumul body+colonne était excessif), la colonne passe en pleine largeur
(`width: 100%` explicite — sans lui, le grid item déborde de son track à cause du min-content
des lignes à insécables de la fiche ; `overflow-wrap: anywhere` sur `.context` en renfort) ;
le suivi de lecture devient une **barre fixe en bas** (façon MobileToc kbrdn.dev : scène
courante + % + ligne de progression, dépliable en liste de scènes) ; la barre de titre gagne
les boutons **♪** (ambiance) et **↓** (EPUB), visibles seulement ≤1080px ; le player se pose
au-dessus de la barre de suivi ; la navbar ≤700px garde le logo seul et des boutons compacts.

Comportement du volet glossaire : il reste ouvert pendant la lecture (pas de fermeture au clic
extérieur) — ≥1560px il flotte dans la marge gauche sans décaler le texte, 1400-1559px le contenu
se décale, <1400px overlay avec scrim. État open/closed persisté (`rz-gloss`). Le volet ouvre en
tête une section « Dans ce chapitre » (le cast, via `PAGE.cast`) et filtre les entrées au-delà du
niveau de spoiler de la page (`PAGE.arc` vs champ `arc` des entrées de glossary.js).

Autres capacités du chrome (site.js) : logo officiel partagé (`_site/logo.png`) dans la navbar
et le footer ; footer dynamique pleine largeur sur toutes les pages (description, stats calculées
du manifest + glossaire, bibliothèque groupée par catégorie, sources, mention légale non
commerciale) ; tooltip au survol de toute référence `data-g` (portrait, nom, sub, note du
glossaire — fermé au scroll, jamais dans le drawer) ; navigation précédent/suivant entre chapitres (générée du
manifest + flèches clavier), popover réglages de lecture « Aa » (taille/interligne/largeur,
persisté `rz-reader`), temps de lecture restant (`PAGE.words`, 250 mots/min) sous la barre de
progression, recherche plein texte sur la page bibliothèque (index `_site/search-index.js`
généré par build_site.py — texte par scène, liens directs `#scene-N`).

Par chapitre, le générateur produit aussi : une **galerie** en fin de page au format canonique
OBLIGATOIRE (styles communs dans site.css — l'ancien format `gth-link`/`gth-cap` d'Ayamatsu a
été migré, ne plus l'utiliser) : `<figure class="gitem"><span class="gth i-<clé>" role="img"
aria-label="nom" data-cap="légende complète sourcée" tabindex="0"></span><figcaption><span
class="gname">nom</span><a class="gjump" href="#ancre">scène N →</a></figcaption></figure>` —
chaque vignette a sa légende visible ET sa légende complète (reprise par la lightbox au clic) ;
jamais de vignette muette. Un
**EPUB** pandoc (`pandoc chapitre.md -o "<Titre>.epub" --epub-cover-image=cover` ; lien
« Télécharger » en fin de page + ligne dans la fiche + bloc du volet droit — build_site expose
l'epub au manifest pour le bouton ↓ des cartes). L'**OST d'ambiance** : re-scanner le HTML brut
du post source pour TOUTES les iframes `w.soundcloud.com` (pas seulement la première) ; chaque
piste = un `.ost-btn` `data-ost`/`data-label` — dans la fiche contexte, et en `<p class="ost-scene">`
juste sous le séparateur de la scène où le post la place (bonne pratique née d'Ayamatsu).
`site.js` collecte tous les boutons (dédup URL) : le volet droit liste chaque piste, et le player
fixed (NowPlaying kbrdn.dev : pochette, equalizer, seek avec trackline qui s'épaissit au survol +
curseur, temps) affiche ‹ › pour changer de piste quand il y en a plusieurs. Piège connu :
l'iframe cachée du widget doit garder une taille réelle (480×166 hors écran), il crashe sur un
canvas 0px. Rien n'est chargé avant le clic. Personnages IF sans asset officiel : avatar SVG de
substitution (silhouette + initiale) dans portraits.css, note « avatar de substitution » dans le
glossaire.

Catégories = dossiers de premier niveau (« IF Stories », « Histoires annexes », « Web Novel »…).
Un chapitre = un dossier contenant un `index.html` autonome (images inline). Le titre vient de
`<title>` (partie avant « · »), le sous-titre de `<meta name="description">`. Après tout ajout :
`python3 "_site/build_site.py"` régénère la navbar de toutes les pages (elle lit manifest.js au
runtime).

## Conventions d'une page chapitre

Modèle vivant : `IF Stories/Tsugihagu — Gourmandise/index.html` (généré par le build du
scratchpad de session — copier son approche). Points de contrat avec `_site/site.js` :

- **`window.PAGE`** avant les scripts : `{ root: "../..", path: "<Catégorie>/<Chapitre>/",
  title, sections: [{id, label}] }`. `sections` = « Ouverture » (id `top` sur le header),
  `scene-N` sur chaque séparateur, « Final » (id `fin`). C'est ce qui alimente le panneau de
  lecture (droite, façon Toc kbrdn.dev : label + %, barre 1px, item actif ▸, reprise de
  lecture via localStorage `rz-pos:<path>`). ⚠ `build_site.py` lit `words: (\d+)`, `arc: (\d+)`
  et compte la chaîne littérale `"id": "scene-` : écrire `sections` avec des clés entre
  guillemets et une espace après les deux-points, sinon le compteur de scènes tombe à 0.
- **Rupture de scène** : `<div class="scene-break" role="separator" id="scene-N"><span>Scène
  N</span></div>`. Le `<span>` affiche le libellé entre les pointillés ; `.scene-break:empty`
  donne un simple trait. Rester sur la variante avec libellé (convention des chapitres publiés).
- **Scripts communs** en chemins relatifs : `_site/glossary.js`, `_site/manifest.js`,
  `_site/site.js` + `_site/site.css`.
- **Termes glossaire cliquables — deux couches** : (1) à la rédaction, le build marque ses
  références (`<span class="gt" data-g="<id>" role="button" tabindex="0">`, table TERMS —
  patterns précis y compris minuscules ambiguës type « oni ») et les locuteurs
  (`<button class="dlg-name-btn" data-g>`) ; (2) au runtime, `_site/autolink.js` lie
  automatiquement TOUT terme du glossaire trouvé dans la prose — alias à initiale majuscule
  uniquement (évite les mots communs), entrées ≤ `PAGE.arc` seulement (jamais de lien vers une
  fiche masquée par le filtre spoiler), première occurrence par scène, `.gt` existants
  conservés. Un chapitre profite donc des enrichissements du glossaire sans rebuild. Tout
  `data-g` ouvre le volet sur l'entrée ciblée. Le volet a une recherche + des chips de filtre
  par catégorie (perso/lieu/concept/faction/evenement/objet/race).
- **Portraits de dialogue** : définis UNE fois pour tout le site dans `_site/portraits.css`
  (`.p-<perso> { background-image: url(data:...) }`, noms ascii sans accents) et référencés par
  `<span class="dlg-portrait p-<perso>" data-g="<id>" tabindex="0">` — jamais un `<img>` répété
  (leçon du premier run : ×25 répétitions = page ×2). Affichés sur **chaque réplique** dont le
  locuteur a un asset (demande utilisateur — pattern visual novel) ; le portrait est cliquable
  vers le glossaire comme le nom. 96px source, 44px affiché. Un nouveau personnage = pipeline
  curl/sips → régénérer portraits.css → ajouter `img: "p-<nom>"` à son entrée de glossary.js
  (le volet glossaire affiche le portrait à gauche du nom). Locuteur `???` : jamais de portrait
  (anonymat voulu par le texte) ; personnage sans asset correct : aucun portrait plutôt qu'un
  crop médiocre.
  - ⚠ **Récit à incises intégrées** (première personne, « … », dis-je — cas de Re:Zero Académie,
    par opposition aux IF à étiquettes `Nom : « … »`) : le format d'étiquette ne s'applique pas.
    Retirer « dis-je » / « répondit-elle » pour fabriquer une étiquette serait supprimer du texte
    source. Gabarit retenu : le paragraphe entier dans `.dlg.with-p` **sans** `.dlg-name` —
    `<div class="dlg with-p"><span class="dlg-portrait p-x" role="img" aria-label="Nom"
    data-g="id" tabindex="0"></span><div class="dlg-body"><p>…</p></div></div>` — sur les seuls
    paragraphes qui sont une réplique à locuteur explicite. Le CSS le supporte tel quel.
- **Fond d'ambiance du chapitre** : chaque histoire reçoit un background haute résolution
  (≥1600px, visuel officiel évocateur du récit — décor, lieu central) affiché flouté dans les
  marges : `<div class="chapter-bg" style="background-image:url({{BG}})">` + `body.has-bg`
  (styles génériques dans site.css : blur 16px, voile 72 % du token --bg, colonne de texte
  opaque bordée par-dessus). Les originaux `revision/latest` du CDN wikia sont souvent en
  1920×1080 quand les vignettes plafonnent à 900. JPEG q70.
- **Illustrations de lieux/événements** : 2-4 par chapitre, insérées juste après le séparateur de
  la scène correspondante (identifier le lieu de chaque scène avant de placer). Sources : visuels
  officiels anime/LN via les pages du wiki (l'API `rezero.fandom.com/api.php?action=query&
  prop=pageimages&pithumbsize=900` marche même quand les pages HTML renvoient 402). Légende
  systématique avec statut (officiel / fan-art) et provenance. Filtre spoiler bloquant.
- **Typographie FR** : « » avec insécables fines (U+202F avant ; ! ? » et après «, U+00A0 avant :
  — l'usage typographique français réserve l'insécable pleine aux deux-points),
  apostrophes ('), … en caractère unique, ―― → tiret cadratin. Le build applique ça
  mécaniquement (fonction `fr_nbsp`).
- **Favicon** : emoji 📖 en SVG data URI (voir les pages existantes).
- **Chiffres et durées** de la fiche contexte : espace fine insécable comme séparateur de
  milliers (`18 405 mots`, jamais `18,405`) et durée en `1 h 14` au-delà de l'heure.
- ⚠ `Tsugihagu — Gourmandise`, premier chapitre publié, **précède ces deux règles** : sa prose
  n'a aucune insécable et sa fiche annonce 19 scènes là où elle en compte 20 (le compteur
  `build_site.py` était décalé d'une unité, corrigé depuis). Ne pas s'en servir comme référence
  typographique — c'est le spec ci-dessus qui fait foi.

## Images — recette

```bash
curl -sL -A "Mozilla/5.0 …" "<url>" -o img      # le CDN wikia renvoie du WebP même en .png
sips -s format png img --out img.png            # convertir AVANT tout crop/resize
sips -c <s> <s> img.png --out sq.png            # crop carré centré (portraits)
sips -Z 96 sq.png --out p-96.png                # portrait ; illustrations : -Z 900, jpeg q80
base64 -i fichier | wc -c                       # contrôler le poids avant d'inliner
```

Cibles : portrait ≤ 20 Ko, illustration ≤ 250 Ko. Local = pas de limite dure de page, mais rester
raisonnable (~1-2 Mo par chapitre).

## Dossier de lecture (récit non hébergé)

⚠ **Variante sans modèle vivant depuis le 2026-08-15** : elle avait été introduite le matin même
pour **Oboreru**, et le dossier a été supprimé le soir quand l'utilisateur a fourni sa propre
traduction et demandé le récit entier (voir « Texte fourni par l'utilisateur » plus bas). La
catégorie `Dossiers/` n'existe plus ; le statut catalogue `s: "dossier"` reste câblé mais n'est
plus porté par aucune entrée. Ne pas proposer cette variante quand l'utilisateur demande un
récit — il a tranché : la longueur n'est pas un motif, et un dossier ne remplace pas le texte.

Description conservée pour référence. Catégorie `Dossiers/`, ancien modèle :
`Dossiers/Oboreru — Colère/index.html`.

Contient : fiche contexte + encadré « où en est l'histoire » (identiques au gabarit chapitre),
un encadré `.notice` qui dit explicitement que le récit n'est pas hébergé et pointe la source,
une section « ce qu'est ce récit », la distribution en `ul.cast` (portraits `.dlg-portrait`
cliquables vers le glossaire), et la **carte des scènes** — un `<details class="acte">` par acte,
le premier `open`, les suivants repliés avec un avertissement `.sp-warn` : les spoilers deviennent
opt-in, ce qu'un chapitre ne permet pas. Réutilise tout le chrome (`PAGE.sections` pointe les
`scene-N` des résumés, donc panneau de lecture et navigation fonctionnent tels quels) ; pas d'EPUB.

Statut catalogue dédié : `s: "dossier"` (badge « dossier de lecture », réutilise la classe `done`),
et `promptFor` ne propose pas de prompt d'édition dessus. Le CSS spécifique vit dans le `<style>`
de la page, pas dans `site.css` — seule `.mono` a dû être redéfinie localement.

## Chapitres longs (novella)

Au-delà de ~8 000 mots, déléguer l'édition par blocs de scènes à des agents parallèles (plages de
lignes FR/EN alignées sur les séparateurs ※). Leçons du premier run : demander le rapport
(contresens corrigés, termes nouveaux, ambiguïtés, locuteurs) **en fin du même fichier** que le
bloc, dans une section délimitée `<!-- RAPPORT -->` — les agents ne livrent pas un second fichier
de façon fiable ; harmoniser ensuite en passe finale les leitmotivs répétés (l'EN est identique à
chaque occurrence → le FR doit l'être), les apostrophes et la terminologie inter-blocs.

Leçons du run Ayamatsu (8 blocs, 18 k mots) — **à mettre dans le brief AVANT de lancer**, ces
points-là ne se rattrapent pas après coup :

1. **Le temps.** L'EN de WCT est au présent, la bibliothèque au passé littéraire. Sans consigne
   explicite, les agents dérivent au présent en traduisant depuis l'EN.
2. **Les attributions de dialogue.** Quand l'EN n'en a pas (Ayamatsu), celles de la base FR sont
   une invention : imposer la revérification une par une, et **deux règles** — `???` si l'anglais
   ne tranche pas, `???` aussi tant que la narration n'a pas révélé l'identité (le WN joue des
   révélations différées, une étiquette les grille).
3. **Un format de sortie mécanique** : `@@Nom@@ « … »` en tête de ligne, `===SCENE===` aux `※`,
   prose nue ailleurs. Le HTML se génère ensuite (portraits, `data-g`, typographie FR).
4. **Vérifier le ratio mots FR/EN par scène** avant de découper : hors ~1,05–1,25, une scène a
   perdu ou gagné du texte. Un ratio bas en fin de fichier = les notes du traducteur EN, pas un
   manque.
5. **Donner la liste complète des étiquettes autorisées** (glossaire) : un agent à qui il manque
   `Felt` mettra `Émilia` ou `???` faute de mieux.
6. **La grille tu/vous se décide au niveau du récit, pas du bloc** : sinon un personnage vouvoie
   dans une scène et tutoie dans la suivante. Une évolution *voulue* (distance → complicité)
   reste légitime, mais elle doit être arbitrée en passe finale.
7. **Les répliques qui se répondent d'un bout à l'autre** (une phrase que le même personnage
   redit au climax) atterrissent dans deux blocs : les repérer dans l'EN avant de découper et
   figer la formulation, sinon l'écho disparaît.
8. **Le contenu réel de chaque bloc se vérifie dans le fichier, pas dans le résumé qu'on en a en
   tête** — deux briefs sur huit décrivaient une scène qui débordait sur le bloc suivant.

Leçons du run Kasaneru (12 blocs, 20 k mots, EN de WCT + base FR en regard) — elles complètent
celles d'Ayamatsu, elles ne les remplacent pas :

1. **Vérifier si l'EN porte ses étiquettes de locuteur avant d'écrire le brief.** Ayamatsu n'en a
   pas (WCT dit les avoir supprimées) ; Kasaneru en a (`[Subaru: …]`, `[???: …]`). Quand elles
   existent, **l'EN fait autorité** et la consigne s'inverse : c'est la base FR qu'on revérifie
   contre l'anglais, pas l'inverse — et un `???` de l'EN reste `???` même si le FR nomme.
2. **Grep les échos AVANT de découper** — deux minutes de `n`-grammes répétés sur le fichier EN
   suffisent. Ici, la réplique météo de Pétra est identique au mot près entre les scènes 2 et 10
   (c'est la preuve textuelle de la boucle) et la base FR l'avait traduite **deux fois
   différemment**. Figer la formulation dans le brief des deux blocs concernés est le seul moyen
   de sauver l'écho ; après coup, ça se rattrape mais ça se voit.
3. **La grille tu/vous se vérifie sur le texte, pas sur le canon.** Dans ce récit Ram *vouvoie*
   Subaru — une rupture voulue par l'auteur. Un brief écrit de mémoire l'aurait effacée. À
   l'inverse, Reinhard tutoie (précédent Tsugihagu) : la cohérence inter-chapitres tranche quand
   le texte ne dit rien.
4. **Harmoniser dans le script de build, pas à la main sur la page.** Les blocs divergent sur les
   termes que la source elle-même hésite à nommer (ici *Magic/Magical Hour Crystal*) et sur les
   guillemets de concept `『 』` → « » : une table `HARMO` appliquée à la lecture des blocs rend
   la passe rejouable, une correction manuelle sur `index.html` est perdue au rebuild suivant.
5. **Faire lire le récit par un agent-lecteur pendant que les éditeurs travaillent.** Sa carte de
   scènes (lieu, cast, `???`, arc canonique, pièges) sert la fiche, le placement des images et le
   réglage `arc:` — et elle sort en parallèle, donc elle ne coûte rien en temps.
6. ⚠ **Plusieurs sessions peuvent éditer la bibliothèque en même temps.** `_site/glossary.js` et
   `_site/catalogue.html` sont des fichiers partagés : une autre session qui les réécrit efface
   les ajouts. Rendre les patchs **idempotents et rejouables** (un script qui teste la présence
   avant d'insérer), et **revérifier après coup** que ses propres entrées sont toujours là.

## Texte fourni par l'utilisateur (Oboreru, 2026-08-15)

Quand l'utilisateur fournit **sa propre traduction** d'un récit (fichier `.md` sur le Bureau), la
passe n'est **pas** l'édition déléguée par blocs : il n'y a pas de source EN/JP en main pour
arbitrer, donc toute « fluidification » serait de l'invention. Le pipeline devient **un script
déterministe** + des agents en **rapport seul**. Ce qui a marché, à rejouer tel quel
(`scratchpad/build_oboreru.py` du run, gabarit `template.html` + placements `art.json`) :

1. **Le découpage vient du post source, pas du `.md`.** Le fichier fourni avait fusionné le
   prologue et la scène 1 (14 rangées de `※` pour 16 blocs réels). Vérifier en `curl`ant le post
   et en comparant le nombre de `※　※` avant de numéroter — sinon toute la carte des scènes et
   le placement des fan-arts glissent d'un cran.
2. **Numéroter les ids sur les noms de scène**, pas sur l'ordre des séparateurs : prologue en
   ouverture (pas de `scene-break`, il vit sous `#top`), puis `scene-1`…`scene-15`. 15 ruptures →
   `build_site.py` affiche 16 (il compte `+1`), ce qui est le bon total. L'ancien dossier
   numérotait `scene-1` = prologue : ses libellés de galerie étaient décalés d'un cran, **ne
   jamais recopier une galerie, la régénérer** depuis la table de placement.
3. **Typographie mécanique seulement** : `――`/`―` → `—`, `“…”` extérieur → `«…»` (fines
   insécables U+202F, les `“…”` imbriqués restent), U+202F devant les groupes `!?;` (une seule
   fine devant `?!`, pas une par signe — le recollage doit accepter **la fine déjà insérée** comme
   séparateur, `([!?;])[ U+202F]*([!?;])`, sinon « ?! » ressort en « ? ! » ; vécu sur l'Académie),
   U+00A0 devant `:` **suivi d'une espace** — `(?=\s)` plutôt que `(?!//)` : sans cette condition,
   « Re:Zero » devient « Re :Zero » dans la prose.
4. **Artefacts à extraire du `.md` avant rendu** : les `(Note de Traduction : …)` inline →
   section « Notes de traduction » de l'endmatter ; la ligne de légende du lecteur SoundCloud
   (« Akira · … By RyeBread935 ») → `<p class="ost-scene">` sous la scène où le post la place ;
   les lignes de titre du post en tête de fichier.
5. **Étiquettes descriptives = pas de portrait.** Le récit désigne ses locuteurs selon le point de
   vue (« Femme », « Humain », « Homme aux cheveux bleus », « Jeune homme », « Vieil homme ») et
   ne nomme Subaru qu'à la scène 7 : coller un portrait dessus grille la révélation. Vérifier la
   **première occurrence de chaque nom** (`grep -n '\bRam\b'`) avant de décider — dans Oboreru,
   « Ram » n'apparaît qu'à la scène 3, dans la bouche de Roswaal.
6. **Attribuer le texte honnêtement** dans Sources : « traduction personnelle de l'utilisateur,
   mise en page sans réécriture », et lister à part le post FR d'où viennent découpage, fan-arts
   et OST.
7. **L'EPUB se génère depuis la page, pas depuis le `.md`** (`scratchpad/build_epub.py` du run) :
   une fois le chapitre livré, l'utilisateur supprime son fichier source — la page devient la
   seule vérité, et toute correction ultérieure se fait dedans. Le script relit `index.html`,
   décode les data URI vers `media/`, retire ce qui n'a pas de sens en liseuse (portraits,
   `data-g`, bouton OST) et garde l'appareil : fiche, encadré contexte, illustrations légendées,
   notes, sources. `pandoc book.html --css=epub.css --epub-cover-image --split-level=2` →
   un fichier par scène. Un EPUB illustré pèse ~1,3 Mo : dire « illustré » dans le lien de
   téléchargement, et ne pas laisser traîner la mention « sans images de scène » de Tsugihagu.

## Deux réglages du volet + cohérence portrait/fiche (2026-08-15)

**Plafond du volet de suivi.** `.toc-wrap` avait déjà `max-height: calc(100vh - 6rem)` et
`.toc-items` son `overflow-y: auto` — donc rien ne débordait *techniquement*. Mais sans plafond
sur la **liste**, un chapitre à 40+ scènes (Re:IF, 42) la laissait s'étirer : **994 px sur 1090**,
le volet tapissait toute la marge. Correctif : `max-height: min(24rem, 42vh)` sur `.toc-items`
→ 91 % du viewport ramenés à 50 %, la liste scrolle dedans, et un chapitre court n'est pas touché
(4 scènes = 118 px, aucune troncature). Le pendant mobile `.mtoc-list` avait déjà `max-height: 46vh`.

**Portrait de dialogue ≠ portrait de la fiche.** Symptôme signalé : « image dans le glossaire mais
pas dans les dialogues ». Le `data-g` du portrait et la classe `.p-` du portrait sont deux
pointeurs indépendants — rien ne garantit qu'ils désignent le même personnage. Sur Mimagau,
154 répliques de Subaru portaient `.p-mi-subaru` (avatar de substitution, silhouette grise)
tandis que `data-g="subaru"` ouvrait la fiche avec le **vrai** portrait. Balayage à relancer après
tout ajout :

```python
GIMG = dict(re.findall(r'id: "([^"]+)"[^\n]*?img: "(p-[a-z0-9\-]+)"', glossary_js))
for cls, label, gid in re.findall(r'class="dlg-portrait (p-[\w-]+)"[^>]*aria-label="([^"]*)"[^>]*data-g="([^"]*)"', page):
    if GIMG.get(gid) and GIMG[gid] != cls: print(label, cls, "vs", GIMG[gid])
```

⚠ **Tous les écarts ne sont pas des bugs** : Re:IF utilise volontairement `.p-subaru-if`,
`.p-rem-if`, `.p-halibel-if` — de **vrais** portraits de la variante, avec la fiche canonique.
C'est la convention pour « variante d'un personnage connu ». Ne corriger que les cas où le
dialogue tombe sur une **silhouette** alors que la fiche a une vraie image ; discriminer avec
`"svg+xml" in regle` sur `portraits.css`.

⚠ **Le cache navigateur ment sur les correctifs CSS.** Après édition de `site.css`, la page
rechargée servait toujours l'ancienne règle (`maxHeight: "none"`) — j'ai cru que le correctif ne
mordait pas. Vérifier la règle réellement chargée, et forcer :
`link.href = link.href.split('?')[0] + '?v=' + Date.now()`.

## Portraits inline — la page doit être vraiment autonome (2026-08-15)

**Symptôme** : « certaines pages n'affichent pas les images hors-ligne » (vu sur Mimagau).

**Cause** : les pages n'étaient autonomes qu'à moitié. Illustrations, couverture et fond
d'ambiance sont en data URI **dans** la page, mais les **portraits de dialogue** venaient du seul
fichier externe restant — `_site/portraits.css`, **3,7 Mo pour 194 portraits**, chargé en entier
par chaque page pour n'en utiliser que 7 à 24. C'est la seule source d'images capable de manquer
sans casser la mise en page : si le `<style>` local échouait, c'est toute la page qui tomberait,
pas juste les images. **Ce raisonnement par élimination est ce qui a identifié le coupable** —
aucune vérification statique ne montrait quoi que ce soit (0 URL externe, data URI tous valides,
classes toutes définies, chemins tous relatifs, HTML équilibré).

**Correctif** : `build_site.py` recopie désormais dans le `<style>` de chaque page les seules
règles `.p-` qu'elle utilise (portraits de dialogue + `cast` du volet glossaire), entre les
marqueurs `/* portraits inline … */` — **idempotent**, le bloc précédent est retiré avant d'en
poser un neuf. Le `<link>` vers `portraits.css` reste : le volet glossaire peut afficher
n'importe quelle fiche. Règles identiques ⇒ aucun changement visuel quand les deux se chargent.
Coût : +60 à +520 Ko par page.

**Vérification qui prouve le correctif** (à rejouer, elle ne coûte rien) — charger la page et
neutraliser la feuille externe à chaud :

```js
const ext = [...document.styleSheets].find(s => (s.href||'').includes('portraits.css'));
ext.disabled = true;
[...document.querySelectorAll('.dlg-portrait')].filter(p => getComputedStyle(p).backgroundImage === 'none').length
// doit valoir 0 — avant le correctif, c'etait la totalite (279 sur Mimagau)
```

⚠ **Les deux outils navigateur refusent le protocole `file:`** (claude-in-chrome ET playwright) :
impossible d'observer une panne hors-ligne directement. Reproduire via le serveur local en
désactivant la ressource suspecte, comme ci-dessus.

⚠ Un build de page (`build_<histoire>.py`) réécrit l'`index.html` **sans** le bloc de portraits :
toujours relancer `build_site.py` après, il le repose.

## Acquis du run Azamuku (2026-08-15) — 2e passe « texte fourni »

Deuxième instance du chemin Oboreru : le `.md` fourni était déjà propre et **aligné 1:1 sur le post
source** (15 `△▼△▼△▼△` des deux côtés — le contrôle croisé de la leçon 1 a confirmé le découpage au
lieu de le corriger).

> 🔴 **La leçon principale du run : lire une page de référence EN ENTIER avant de construire.**
> Le premier build a été fait à partir de **fragments de `grep`** sur `site.css` et sur les pages
> existantes. Résultat : une page qui passait tous mes contrôles automatiques et qui était pourtant
> **hors charte**, rejetée à vue par l'utilisateur. Six classes inventées (`.illus`, `.cover`,
> `.foreword`, `.kicker`, `.chapter-head`, `.dl`) — **aucune n'existe dans `site.css`** — et le
> squelette entier faux. Un `grep -c` qui trouve `.dlg` ne dit pas dans quoi `.dlg` est imbriqué.
> Le réflexe : `Read` intégral d'`Oboreru — Colère/index.html` (structure) **et** de
> `Mimagau — Genres inversés/index.html` (variantes) avant d'écrire une ligne de gabarit.

**Le squelette réel, non négociable** (identique sur Oboreru / Mimagau / Kasaneru) :

```
body.has-bg > div.chapter-bg[aria-hidden] + div.shell
  div.side-l · div.page · div.side-r
    header.chapter#top
      p.eyebrow ("IF Stories · <span class=gt>")  ·  h1 (ROMAJI SEUL)  ·  p.subtitle
      div.context      → lignes "<b>Label :</b> texte<br>", dont Longueur ET Télécharger (EPUB)
      div.recap        → span.lbl + prose + div.ed          (« Contexte — où en est l'histoire »)
      div.recap        → span.lbl + prose + div.ed          (« Mot de l'auteur », si le post en a un)
    figure > div.fig-img.i-<clé> + figcaption               (illustration de tête, hors <main>)
    main.prose         → prose + div.scene-break#scene-N + figure
    p.fin#fin
    div.endmatter      → h2 Postface · h2 Notes · h2 Galerie · h2 Télécharger · h2 Sources
```

`<h1>` = **le romaji seul** (`Azamuku`), pas le titre de dossier `Azamuku — Tromper`. Le
« mot de l'auteur » n'a pas de classe dédiée : c'est un **second `.recap`** (précédent Mimagau).

**Les illustrations ne sont pas des `<img>`.** Ce sont
`<figure><div class="fig-img i-<clé>" role="img" aria-label="…"></div><figcaption>…</figcaption></figure>`,
le data URI vivant dans le `<style>` local en `.i-<clé> { background-image: url(…); aspect-ratio: W/H; }`.
**C'est ce qui permet à la galerie de réutiliser la même classe** (`span.gth.i-<clé>`) : chaque image
est inlinée **une seule fois**. En `<img src="data:…">` + vignette séparée, tout est inliné deux fois —
1 197 Ko contre 829 Ko pour la même page.

Ce qui a mordu ensuite :

1. **L'appel de note peut se poser APRÈS le crochet fermant** : `Subaru: [… calamité ?] [3]`. Un
   `^(\w+): \[(.*)\]$` greedy avale le `] [3` dans la réplique et rend `« … ?] [3 »` — c'est
   **silencieux**, la ligne reste bien formée. Tester le motif à **tail obligatoire d'abord**,
   fallback sur le motif nu :
   ```python
   DLG_TAIL = re.compile(r"^([^:\[]{1,40}): \[(.*)\]\s*(\[[1-4]\])$")
   DLG      = re.compile(r"^([^:\[]{1,40}): \[(.*)\]$")
   ```
   Contrôle : `len(re.findall('class="noteref"'))` doit égaler `len(re.findall('id="note-\d"'))`.
2. **Les étiquettes de locuteur passent aussi à la moulinette typographique.** `esc(label)` seul
   laisse `L'homme suspect` avec une apostrophe droite bien visible dans le nom rendu, alors que
   toute la prose est en `’`. Contrôle : compter `'` **dans le corps seul** (`s[s.find('<main'):]`)
   — le favicon SVG du `<head>` en contient légitimement 8 et fausse un comptage global.
3. **La banque de portraits est maintenant assez profonde pour qu'un run n'en produise aucun.**
   Les 14 locuteurs nommés (dont tout le casting vollachien : Chisha, Vincent, Cecilus, Arakiya,
   Ubilk, Berstetz, Madelyn, Kafma, Gustav) étaient déjà dans `portraits.css`, et une seule entrée
   manquait au glossaire — l'IF elle-même. Vérifier l'existant **avant** de lancer le pipeline
   curl/sips : `grep -oE '^\.p-[a-z0-9-]+' portraits.css` et les `id:` de `glossary.js`.
4. **Fond d'ambiance sans décor dédié** : le wiki n'a aucune image de lieu pour Lupugana
   (`prop=images` sur `Lupugana`/`Vollachian Empire`/`Crystal Palace` ne rend que 2 illustrations de
   LN). Solution : **recadrer le décor** d'une illustration de personnages (ici la skyline entre
   Garfiel et Kafma dans `Re Zero Light Novel 32 2.png`, crop `(640,20,1250,363)`). Sous
   `blur(16px)` + voile 72 %, un crop upscalé ×3 passe sans problème — et ça évite de mettre au fond
   des personnages absents du récit.
5. **EPUB — découper sur `.page`, pas sur `<main>`.** Dans la vraie structure, `<main class="prose">`
   n'enveloppe **que le récit** : un slice `s[s.find("<main"):s.find("</main>")]` livre un EPUB
   amputé de la fiche, des encadrés, des notes et des sources — et ça ne se voit pas, le fichier
   s'ouvre normalement. Prendre `<div class="page">` → `<div class="side-r">`.
6. **EPUB — déballer les conteneurs avant pandoc.** `--split-level=2` ne coupe qu'aux titres de
   **premier niveau du body**. Tant que les `<h2>` restent imbriqués dans `<header>` / `<main>` /
   `.endmatter`, pandoc rend **un seul `ch001.xhtml`** sans avertir. Supprimer ces trois balises
   ouvrantes/fermantes (garder le contenu) → 20 fichiers au lieu de 1.
7. **EPUB — les images sont dans le CSS, pas dans `src=`.** Corollaire du `.fig-img` ci-dessus : un
   script qui ne cherche que `src="data:…"` extrait **0 image**. Parser
   `\.i-([a-z0-9-]+)\s*\{\s*background-image:\s*url\((data:image/[^)]+)\)` dans le `<style>`, puis
   remplacer chaque `<div class="fig-img i-clé">` par un vrai `<img>` (l'`aria-label` fait l'`alt`).
   Contrôle : `sum(1 for f in zip.namelist() if '/media/' in f)` doit égaler le nombre de figures.
8. **Swap d'apostrophes en passe finale.** Les blocs écrits à la main (fiche, `.recap`, sources) ne
   passent pas par `typo()` et gardent des `'` droites au milieu d'une page en `’`. Un
   `HTML.replace("'", "’")` global est sûr **à condition de l'assertion** `not re.search(r"='", HTML)`
   — la page n'utilise que des attributs en guillemets doubles, et le favicon est en `%22`.

## Acquis du run Lust IF (2026-08-15) — 3e passe « texte fourni », récit sans étiquettes

Le Rêve du papillon — Luxure : `.md` fourni par l'utilisateur, **aligné ligne à ligne sur l'anglais**
qu'il avait aussi sous la main (`lust-fr.md` / `lust-en.md`, mêmes numéros de scène aux mêmes
lignes — le contrôle de découpage se fait alors en deux `grep -n '^[0-9]\+$'`, pas en `curl`ant le
post). Aucune note de traduction, aucun lecteur SoundCloud, aucune ligne de crédit à extraire.

1. **Récit sans aucune étiquette de locuteur** (ni `Nom :`, ni incise systématique) mais en huis
   clos à deux voix : la table d'attribution tient dans **une chaîne de codes par scène, un
   caractère par paragraphe** (`"-P--PSP-SP-…"`, `-` = narration). C'est relisable d'un coup d'œil,
   ça se corrige sans toucher au script, et `assert len(codes) == len(paras)` fait sauter le build
   au moindre décalage — le mode de défaillance qu'on ne voit pas autrement. Gabarit de sortie :
   `.dlg.with-p` **sans** `.dlg-name` (règle « récit à incises intégrées »), le texte n'est pas
   touché. Avant d'écrire la table, **vérifier scène par scène qu'aucun tiers ne parle** : ici
   Roswaal (scène 3) et Ferris (scène 8) sont nommés mais muets, l'alternation tient.
2. **`build_epub.py` ne gérait pas ce gabarit** : sa regex n'attrapait que la variante avec
   `dlg-name`, et les `<div class="dlg with-p">` traversaient tels quels. Corrigé sur place (une
   regex de plus, `<div class="dlg…"><div class="dlg-body"><p>…` → `<p class="dlg">`). Concerne
   aussi Re:Zero Académie.
3. ⚠ **Le dossier de travail de `build_epub.py` garde les accents** (`re.sub(r'\W+', '-')` est
   unicode-aware) : c'est `/tmp/epub-Le-Rêve-du-papillon-Luxure`, pas `-Le-R-ve-`. Un
   `pandoc book.html -t native | grep -c 'Header 2'` lancé sur un chemin deviné renvoie 0 et fait
   croire au bug du `</div>` orphelin. Vérifier le vrai chemin (`ls -d /tmp/epub-*`), et de toute
   façon **le contrôle qui fait foi est `unzip -p <epub> EPUB/nav.xhtml`**.
4. **Scène 1 numérotée dans la source** → elle vit sous `#top` avec le libellé « Scène 1 » (le
   libellé est du texte libre, seul l'id compte pour le compteur), puis `scene-2`…`scene-8` :
   7 ruptures, `build_site.py` affiche bien 8.
5. **Périmètre quand la justification est « je mets en page, je n'écris pas »** : pas de chasse aux
   illustrations, pas d'asset généré — fond d'ambiance **réutilisé** de la bibliothèque (le
   « Kingdom of Lugunica — Night » d'Oboreru), portraits pris dans `portraits.css`. Le dire dans les
   Sources (« Illustrations de scène : aucune ») plutôt que de livrer une page plus maigre sans
   explication. Voir aussi le bloc ⛔ de `sources.md` : ce qui a débloqué cette IF, c'est la nature
   de la demande, pas une réévaluation du contenu.

## Acquis du run Mimagau (2026-08-15) — EPUB, avatars, écriture concurrente

**EPUB découpé par scène.** `pandoc … --split-level=2` ne découpe **que** sur les titres de
premier niveau du *document*. Deux pièges, tous deux silencieux :

1. un `<h2>` imbriqué dans `<header>`, `<main>` ou `<div class="endmatter">` n'est pas un titre de
   premier niveau → dépouiller ces conteneurs avant d'appeler pandoc ;
2. **un seul `</div>` orphelin** (celui de `.endmatter` ou de `.page`, quand on retire l'ouvrante
   sans la fermante) fait que pandoc **cesse de reconnaître tous les `<h2>`** — `pandoc book.html
   -t native | grep -c 'Header 2'` renvoie 0, le livre sort en un seul fichier, aucun message
   d'erreur. Rééquilibrer en supprimant les `</div>` excédentaires par la fin.

Recette : convertir `<div class="scene-break"><span>Scène N</span></div>` en
`<h2 class="scene-break">Scène N</h2>`, dépouiller les conteneurs, rééquilibrer, puis
`pandoc book.html -o "<Titre>.epub" --css=epub.css --epub-cover-image=media/cover.jpg
--split-level=2`. Contrôle : `unzip -p <epub> EPUB/nav.xhtml` doit lister les scènes.
Ne pas ajouter de `<h1>` de titre : le `<h1>` du header de la page en fait déjà un.

**Avatars de substitution en masse (cast d'une IF gender-swap).** Aucun personnage aux genres
inversés n'a de visuel officiel, et réutiliser le portrait canonique du personnage d'origine
(Émilia pour Émilio, le Subaru masculin pour une Subaru femme) est un **faux** — pas une
approximation. Générer un `.p-<prefixe>-<perso>` par personnage sur le modèle de `.p-sigrum`
(silhouette + initiale, couleur de cheveux distincte), le dire dans les Sources et dans chaque
fiche du glossaire. ⚠ **Piège vécu** : un générateur qui écrit `p-mi-subaru { … }` au lieu de
`.p-mi-subaru { … }` produit un CSS syntaxiquement avalé sans erreur — les portraits ne
s'affichent simplement pas. Contrôle : `grep -c '^\.p-' portraits.css` avant/après.

**Écriture concurrente sur les fichiers partagés.** Plusieurs sessions éditent la même
bibliothèque : `_site/glossary.js`, `_site/portraits.css` et `_site/catalogue.html` se font
écraser. Règles :

- **jamais de réécriture complète** de `glossary.js` — relire l'état courant, n'ajouter que les
  ids absents, script idempotent (un second passage ne fait rien) ;
- **garder une copie** du fichier avant d'écrire (`scratchpad/glossary.js.bak`) : c'est la seule
  façon de diagnostiquer ensuite ce qu'une autre session a perdu, et de le restaurer par le même
  mécanisme d'append (21 fiches récupérées ainsi ce jour-là) ;
- **re-vérifier après coup**, pas seulement après sa propre écriture :
  `node -e "global.window={};require('…/glossary.js'); …"` pour le compte, les doublons et les
  `img:` qui pointent vers une classe absente de `portraits.css` ;
- un dossier de chapitre qui ne contient qu'un `_assets.json` est une **session en cours**, pas
  une page cassée : `build_site.py` l'ignore, ne pas écrire dedans.

## Acquis du run Sasageru (2026-08-15) — récit sans attributions, leitmotiv, typo

Troisième « texte fourni » de la journée (30 008 mots, 15 scènes), et le premier récit **sans
aucune étiquette de locuteur** dans la source. Ce que ce cas apprend :

1. **`build_azamuku.py` a deux règles de `fr_nbsp` fausses — ne pas le copier tel quel.**
   `re.sub(r"\s*:(?!//)", …)` transforme `Re:Zero`/`Re:Se` en `Re :Zero` (la condition
   `(?=\s|$)` de la leçon Oboreru est la bonne, avec le `|$` pour les lignes qui finissent par
   `:`), et `s.replace("’", "'")` va **à l'envers** de la convention : les 8 chapitres livrés
   sont tous en apostrophe courbe (contrôle : `body.count("'")` doit valoir 0). Ce script
   appartient à une autre session — l'ignorer, écrire le sien.
2. **Compter les blocs, pas les séparateurs.** Ici 28 `△▼△▼△▼△` pour 15 scènes : les serments
   sont **encadrés** par une paire, et 2 ruptures sont nues. Le parseur robuste regroupe toute
   suite `sep|serment` en **une seule frontière**, puis assertionne le nombre de blocs
   (1 avant-propos + 15 scènes + 1 clôture = 17). Aucune arithmétique de losanges.
3. **Le leitmotiv se rend en bloc dédié, et il faut le sortir de l'autolink.** 14 serments
   ouvrant chacun une scène ⇒ `autolink.js` liait « Od Lagna » 14 fois (première occurrence *par
   scène*). `.oath` est désormais dans son `SKIP`. CSS : `.prose p` de `site.css` bat `.oath`,
   donc `margin: auto` ne centre pas — écrire `.prose p.oath`.
4. **Le serment ouvre la scène : il passe AVANT l'illustration**, pas après. Ordre :
   `scene-break` → serment → figure → prose.
5. **Pas d'étiquettes de locuteur ⇒ pas de portraits en cours de texte, et une `ul.cast` en
   endmatter** (portrait 44px cliquable + nom `dlg-name-btn` + rôle d'une ligne). C'est le
   substitut honnête : l'immersion sans inventer d'attribution. Locuteur volontairement masqué
   (ici ■■■■■) : case `.cast-noimg` en pointillés, jamais de portrait.
6. **La typographie des textes éditoriaux est un second passage.** Légendes, rôles, notes et
   sources ne passent pas par la fonction de prose : sans ça, 33 apostrophes droites et des
   `;` sans fine restent dans la page. Une fonction `ed()` = même règles **moins celle des
   deux-points** (sinon `image/jpeg;base64` récolte une fine et les images meurent), plus une
   passe finale `page.replace("'", "’")` **assertée** vide dans les blocs `<style>`/`<script>`.
7. **Vérification navigateur quand playwright-mcp est pris par une autre session** :
   `python3 -m http.server` dans la bibliothèque + `claude-in-chrome` (il refuse les `file://`).
   ⚠ `site.js` restaure la position de lecture et **annule les `scrollTo` scriptés** — pour
   photographier l'endmatter, masquer `main.prose` en JS plutôt que se battre avec le scroll.
8. **`pandoc` perd les classes portées par un `<p>`** — `Para` n'a pas d'`Attr` dans son AST.
   `build_epub.py` avait donc déjà une règle `p.dlg` morte depuis toujours (contrôle :
   `unzip -p <epub> 'EPUB/text/*' | grep -o 'class="[a-z-]*"' | sort | uniq -c` — les classes de
   `<span>` et de `<div>` survivent, celles de `<p>` non). Tout style d'epub qui doit tenir se
   pose sur un `<div class="x"><p>…</p></div>` et se cible en `div.x p` : c'est ce qui a été fait
   pour `.oath`. Une règle CSS ajoutée sans ce contrôle ne s'applique à rien, en silence.
9. **`autolink.js` enregistre aussi le PREMIER MOT d'un nom** (≥4 lettres, initiale majuscule).
   Avant d'ajouter une fiche, se demander quel premier mot elle réclame : « Épée Maudite Aeon »
   revendique « Épée », « Natsuki Rigel » revendiquait « Natsuki » — le nom de famille du
   protagoniste. Contrôle rejouable, à faire après tout ajout au glossaire : reconstruire la table
   d'alias en node exactement comme le fait `autolink.js` (arc ≤ `PAGE.arc`, premier arrivé
   gagne), la passer sur la prose de la page et lire les cibles obtenues — c'est le seul moyen de
   voir un lien qui pointe vers la mauvaise fiche, aucun contrôle d'intégrité ne l'attrape.
10. **Fond d'ambiance sans lieu canonique** : le Glacier Sans Pareil n'a aucun visuel. Le sceau
   gelé de la forêt d'Elior (`Elior Forest Seal (2).png`, 1920×1080) rend l'ambiance *et* le
   motif — chercher l'écho thématique plutôt que le lieu exact, et le dire dans la légende.
   Recadrer une skyline dans une planche de LN se fait en PIL (disponible), pas en `sips`
   (crop centré seulement) : vérifier le crop à l'œil, les personnages débordent d'un cheveu.

## Passe « ambiance + visuels » sur des chapitres déjà livrés (2026-08-15)

Rattrapage sur les 10 chapitres de la bibliothèque : 6 n'avaient aucune OST, 1 (Kochō no Yume)
aucune illustration de scène. Ce que ça apprend :

1. **Auditer avant de corriger, en une commande.** `for f in "IF Stories"/*/index.html; do
   printf "%s ost:%s fig:%s gal:%s\n" … ; done` sur `ost-btn`, `<figure>`, `class="gitem"`.
   L'utilisateur a signalé les manques un par un ; l'audit les donne tous d'un coup.
2. **Un chapitre livré n'a pas toujours de builder.** Kochō no Yume n'en avait aucun : la
   modification s'écrit alors comme un **script de patch idempotent** (`_site/patches/`), avec
   `.bak` avant la première écriture, et pas comme une édition à la main — sinon rien ne trace
   ce qui a été fait. Pour un chapitre **qui a** un builder (Sasageru), l'ajout va **dans le
   gabarit du builder**, sinon le prochain rebuild l'efface (leçon Kasaneru 4).
3. **Une page peut porter des ids décalés d'un cran.** Kochō no Yume n'a pas de `#scene-1` :
   sa scène 1 vit sous `#top`. Le `gjump` de la première vignette doit donc pointer `#top` tout
   en affichant « scène 1 → ». Contrôle systématique : comparer l'ensemble des `href="#…"` à
   l'ensemble des `id="…"` de la page, et vérifier que chaque ancre de galerie précède bien sa
   figure dans le document.
4. **Ne pas réutiliser en illustration l'image déjà employée comme fond d'ambiance** — la
   section Sources de la page le dit (ici « Kingdom of Lugunica — Night » était déjà le fond).
   Lire les Sources de la page avant de choisir.
5. **Deux personnages du casting sont mineurs dans le canon** (Pétra, Felt) alors que le récit
   les vieillit explicitement : aucune illustration pleine largeur de personnage, uniquement
   des **lieux**. Argument suffisant et non contradictoire : la page porte déjà 248 portraits de
   dialogue, ce qui lui manquait n'était pas le personnage mais le décor.
6. **Vérifier une piste SoundCloud = la charger, pas lire son id.** Le widget affiche `0:00 /
   0:00` et `playing: false` même sur une piste connue bonne (contrôle fait sur Tsugihagu) —
   l'autoplay est bloqué dans le navigateur piloté. La preuve que l'id est valide, c'est que
   **le titre et l'artiste s'affichent** dans `.rz-player` : le widget a résolu la piste.
   Comparer systématiquement avec un chapitre qui marchait déjà avant de conclure à un bug.

## Mode artifact (sur demande uniquement)

Même gabarit en une page autonome : la CSP bloque toute ressource externe (images ET webfonts) —
tout passe en data URI, budget 16 Mo, thème 3 états obligatoire. Pas de volet glossaire ni de
manifest (page seule).
