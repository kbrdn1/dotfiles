# Sources — hiérarchie et inventaire

Dernière vérification : 2026-08-15. Les inventaires bougent (le site FR publie encore) : en cas de
doute, re-vérifier la page d'index avant de proposer des chapitres à l'utilisateur.

⚠ **Réflexe IF récente** : WCT n'est plus la seule porte d'entrée. Les IF postées après ~2025
(Azamuku, Sasageru) se trouvent sur **Pandemonium Translations** (section EX) — vérifier les deux
index avant de conclure qu'une IF n'est pas traduite.

## Hiérarchie (de la plus autoritaire à la moins)

1. **Japonais officiel** — web novel de Tappei Nagatsuki sur Shōsetsuka ni Narō :
   `https://ncode.syosetu.com/n2267be/`. ⚠ **Corrigé le 2026-08-15** (source : page wiki
   `Re:Zero EX`) — la version antérieure de cette ligne affirmait que les IF stories n'étaient
   pas sur Narō, c'est **faux**. Les IF sont des **chapitres Re:Zero EX postés sur Narō** chaque
   1er avril à 01:00 JST (anniversaire de Subaru), ~4× la longueur d'un chapitre normal. Seules
   **certaines** ont reçu ensuite une adaptation light novel : Rem/Sloth IF (`Re:IF`, exclusivité
   BD saison 1, 2017) et Kasaneru (LN en tirage limité, 2021). Oboreru = EX du 1er avril 2018,
   posté sur Narō. Conséquence pratique : le JP d'origine est accessible librement pour la
   plupart des IF — chercher le chapitre EX correspondant avant de conclure à l'inaccessibilité.
   ⚠ **Exception vérifiée le 2026-08-15 (page wiki `Re:IF`) : le Rem/Sloth IF n'est PAS un
   chapitre EX.** C'est une **nouvelle inédite** (Ｒｅ：IFから始める異世界生活, MF Bunko J,
   24 février 2017, 290 p.) offerte aux acheteurs des neuf Blu-ray de la saison 1 — jamais
   postée sur Narō, donc **aucun japonais accessible**. Ne pas perdre de temps à le chercher :
   l'anglais de Remonwater est la seule source existante.
2. **Light novel officiel** — JP : MF Bunko J (~45 volumes en 2026, + 6 volumes Ex,
   + 14 Tanpenshuu). EN : Yen Press (`https://yenpress.com/series/rezero-light-novel`), seule
   traduction anglaise sous licence.
3. **Traductions fan reconnues (EN)** — la référence de comparaison par défaut :
   - **Witch Cult Translations** `https://witchculttranslation.com/` — WN complet + IF stories
     (index : `/table-of-content/`). Les compilations eBook (Phantaminum) sont plus relues que
     les pages web. ⚠ Son index **ne contient rien sur Sasageru** (vérifié 2026-08-15, `curl` +
     grep sur `/table-of-content/`) : ne pas y chercher les IF les plus récentes.
   - **Pandemonium Translations** `https://pandemoniumtranslations.com/` — découvert le
     2026-08-15. Re-traduction complète du WN depuis le début (arcs 1-3 en cours) **et section
     EX qui porte les IF récentes**, là où WCT s'arrête. Affilié à Eminent Translations.
     - Index série : `/translations/rezero-starting-life-in-another-world`
     - Pattern chapitre : `/reader/rezero-starting-life-in-another-world/<arc>/<slug>`
       (ex. `.../ex/rezero-ex-sacrificing-life-in-another-world-from-zero`)
     - **Légende de qualité, à lire avant de faire confiance à un texte** : `HTL` = traduction
       humaine · `EAITL` = *Edited AI Translation* (traduction machine relue) · `★` = source
       externe · `✎` = externe éditée. **Toute la section EX est en EAITL** — utilisable comme
       source de comparaison, jamais comme autorité : recouper contre le JP de Narō sur les
       passages qui comptent.
     - Contenu EX au 2026-08-15 : Pride (Ayamatsu), Wrath (Oboreru), **Sasageru**, chacun avec
       sa page *Supplementary Info* (le rapport d'activité de Tappei — notes d'auteur et
       worldbuilding, mine d'or pour le glossaire, à ne pas confondre avec le récit).
     - Accès : WebFetch renvoie **403**, `tavily-extract` passe (`extract_depth: advanced`).
   - **Eminent Translations** `https://eminenttranslations.com/` — arc 2 + side stories + IF.
     Traduction littéraire (dialogues fondus dans la narration, tournures ajoutées) : bon pour
     arbitrer le **sens**, mauvais pour l'attribution. Images propres sur
     `cdn.eminenttranslations.com/images/<slug>-N.webp` (+ `<slug>-cover-large.webp`).
     Extraction du **lecteur** (vérifié 2026-08-15 sur Re:Zero Académie) : `www.eminenttranslations.com`
     `/reader/rezero-side-content/if-stories/<slug>` — Next.js **rendu côté serveur**, `curl` + UA
     navigateur suffit, tout le texte est dans le HTML.
     - paragraphes = `<p class="my-0 min-h-4 hyphens-auto indent-[1.8rem]">…</p>` ;
     - ⚠ **les numéros de scène sont des `<p>` SANS la classe `my-0`**, contenant `<strong>N</strong>` :
       un regex ancré sur `my-0` les perd **sans erreur visible** et le découpage en scènes disparaît.
       Extraire avec `<p\b[^>]*>` et traiter les paragraphes purement numériques comme des ruptures ;
     - illustrations = `<figure class="reader-figure"><img src="https://cdn.eminenttranslations.com/…">` ;
     - la `<meta name="description">` donne souvent la **date de publication d'origine** du chapitre
       (c'est de là que vient « 1er avril 2015 » pour l'Académie) ;
     - l'index de série `/series/rezero-side-content` est un SPA sans `href` exploitable, mais le
       payload embarqué contient titres / `slug` / `release_date` : `grep` le nom de l'histoire en
       clair dans le HTML pour repérer **les suites et leur statut réel**.
   - **Heretic Translations** `https://www.heretictranslations.com/` (découvert 2026-08-15) —
     side stories + IF stories (`/if-stories/<slug>`, site Google Sites). Conserve le format
     `Nom: [réplique]` du WN japonais → **autorité sur l'attribution des dialogues** quand le JP
     est inaccessible. Annonce en tête de page ses emprunts (ex. bloc Rem repris de Remonwater).
   - **Remonwater** `https://remonwater.wordpress.com/` (lemonwater123) — **seule traduction
     existante du Rem/Sloth IF** et d'un gros lot de side stories (index :
     `/table-of-contents/`). WCT ne fait que l'**indexer** : suivre le lien, il sort du domaine.
     Structure vérifiée le 2026-08-15 (9 posts du Rem IF) :
     - corps = `<div class="post-entry">` … `<div class="sharedaddy` (⚠ **pas**
       `entry-content`, le regex habituel renvoie 0 caractère sans erreur) ;
     - **étiquettes de locuteur explicites** `[Nom: réplique]` — luxe rare, aucune attribution
       à reconstruire. Mais **coquilles fréquentes** (`[Tia I─I…]` sans deux-points,
       `[Halibel, …]` avec virgule, `[Subaru: …}` avec accolade) : un regex strict les rate et
       les transforme en prose. Les compter et rattraper à la main ;
     - **ruptures de scène = un numéro seul** dans `<p style="text-align:center;">` — et la
       numérotation **saute** (ch. 4 démarre à « 3 », ch. 5 et 6 à « 2 ») : le traducteur en a
       oublié. Numéroter sur les ruptures **réellement présentes**, ne pas en inventer ;
     - notes = `<sup><a href="#fnN">N</a></sup>` inline + `<p><sup id="fnN">N. […]<a …>↩</a></sup></p>`
       en fin de post. Les extraire **avant** de strip les balises, sinon elles se collent au
       mot (`Wafuu3`) et un agent traduit « Wasou2 » comme un terme ;
     - artefacts à purger : une ligne « google docs » en tête, le bloc `__ATA` de la régie pub ;
     - qualité : traduction amateur rugueuse (fautes d'accord, `spreaded`, incohérences
       lexicales à deux paragraphes d'écart). Sans japonais pour arbitrer, **corriger et
       signaler en note** plutôt que reproduire.
   - **TranslationChicken** `https://translationchicken.com/` — arcs précoces.
4. **Traduction FR communautaire** — `https://rezerowebnovelfr.wordpress.com/` (voir inventaire
   ci-dessous). C'est la traduction FR de comparaison, PAS la vérité : elle traduit depuis l'EN
   de WCT — toujours comparer à l'EN, corriger ses incohérences sans les recopier.
5. **Wikis/bases communautaires** — pour recouper, jamais comme fait canonique :
   - `https://rezero.fandom.com/wiki/` (EN, riche, galeries par volume et par personnage)
   - `https://rezerodb.com/` (base structurée, partenaire WCT, parfois 403)

Toujours croiser une info importante entre ≥ 2 niveaux. Une théorie communautaire n'est jamais
présentée comme un fait.

## IF Stories — mapping péché ↔ titre (vérifié, 3 sources croisées)

| Péché | Titre JP (romaji) | Titre FR du site | Divergence | Dispo FR |
|---|---|---|---|---|
| Pride | Ayamatsu | Re:S'égarer dans un autre monde à partir de zéro | Arc 1 (spoilers arc 5) | oui |
| Wrath | Oboreru | Re:Se noyer dans un autre monde à partir de zéro | Arc 2 | oui |
| Sloth | Rem IF (« Re:IF », nouvelle exclusive BD S1, 24/02/2017, 290 p. — Subaru/Rem à Kararagi, Rigel & Spica) | — | Après l'arc 3 | non (EN : **Remonwater**, pas WCT) — ✅ **éditée le 2026-08-15**, une page, 79 062 mots |
| Greed | Kasaneru | Re:Accumuler dans un autre monde à partir de zéro | Divergence arc 4, récit situé après l'arc 5 | oui |
| Gluttony | Tsugihagu | Re:Se reconstituer dans un autre monde à partir de zéro | Arc 6+ | oui |
| Lust | 胡蝶之夢 *Kochō no Yume* (« The Butterfly Dream ») | — | EX du 1er avril **2014**, le tout premier IF | pas de FR communautaire (EN : Eminent + Heretic) — **dans la bibliothèque depuis le 2026-08-15**, via la traduction personnelle de l'utilisateur ; lire le bloc ⛔ plus bas avant toute nouvelle édition |
| — | Azamuku | Re:Tromper dans un autre monde à partir de zéro | Route Vollachia, diverge arc 7, reconverge arc 8 | ✅ **éditée le 2026-08-15** (trad. perso de l'utilisateur), 28 902 mots |
| — | Sasageru | Re:Se sacrifier dans un autre monde à partir de zéro | Divergence arc 9, récit situé 400 ans plus tard | ✅ **éditée le 2026-08-15** (trad. perso de l'utilisateur), 30 008 mots · aucun FR communautaire (EN : **Pandemonium**, EAITL, 1er avril 2026 — pas WCT) |
| — | Mimagau (gender-swap) | Re:se méprendre… (Shaura FR) | Arc 1 entier, aucun spoiler au-delà | oui (Drive, PDF) |
| — | Re:Zero Académie (univers scolaire, « Vainglory IF ») | rezero-academie | Hors continuité — Japon contemporain, aucun spoiler | oui (chapitre 1 seulement) |

**Kasaneru — dates et périmètre vérifiés le 2026-08-15** (page wiki `Re:Zero EX`, section Kasaneru) :
chapitre EX du **1er avril 2016** (et non 2019 — WCT ne l'a traduit qu'en février 2019, ce qui
induit en erreur). Le wiki précise que « the actual chapter starts some time after Arc 5 » : la
**divergence** est à l'arc 4 (Subaru accepte le contrat d'Echidna au Sanctuaire), mais le **récit**
se déroule des mois plus tard, après Priestella. Il nomme Shaula et la tour de Pléiade sans y aller
(→ `arc: 6` dans `PAGE`, ce qui évite de masquer ces deux fiches). Version light novel augmentée en
tirage limité le **19 octobre 2021**, jamais traduite : ne pas la confondre avec le chapitre web,
seul édité ici. EN de référence :
`https://witchculttranslation.com/2019/02/11/kasaneru-if-re-repeating-life-in-another-world-from-zero/`
(intitulé « Re: Kasaneru IF (**Greed Route**) » dans l'index WCT — confirmation de plus du mapping).
⚠ Contrairement à Ayamatsu, **cet EN porte ses étiquettes de locuteur** (`[Subaru: …]`, `[???: …]`) :
elles font autorité, et c'est la base FR qui doit être revérifiée contre elles, pas l'inverse.

Attention : la communauté confond souvent Kasaneru/Ayamatsu entre Pride et Greed. Le mapping
ci-dessus est celui du site FR + WCT + wiki (pages `Re:IF_Kasaneru`, `Re:IF_Ayamatsu`). En cas de
doute résiduel sur une nouvelle IF, vérifier sa page wiki avant d'affirmer. **Ayamatsu = Pride
est recoupé sur 3 sources** (site FR, wiki, et l'index WCT qui l'intitule littéralement
« Re: Ayamatsu IF (Pride Route) ») — vérifié 2026-08-14, ne pas y revenir.

**Certaines IF ne sont pas des posts mais des PDF** hébergés sur WCT — l'index `/table-of-content/`
pointe directement le fichier. Vu pour Ayamatsu :
`https://witchculttranslation.com/wp-content/uploads/2019/02/ayamatsu-april-fools-2017.pdf`
(42 p.). `curl` + `pdftotext -layout -nopgbrk` en donne un texte propre, séparateurs `※` inclus ;
le PDF garde en tête l'avertissement spoiler du traducteur et en pied ses notes numérotées
(matière à notes de traduction — les extraire avec `pdftotext` **sans** `-layout`, qui préserve
mieux les appels de note collés au mot, ex. `"—I love you."1`).

## Azamuku IF sur WCT — structure du post (relevé 2026-08-15)

**Deux posts, pas un.** Récit :
`https://witchculttranslation.com/2026/08/13/azamuku-if-re-deceiving-life-in-another-world-from-zero/`
(27 917 mots). Rapport d'activité de Tappei :
`https://witchculttranslation.com/2026/08/14/azamuku-supplement/` (4 630 mots) — fiche par
personnage, **spoile le récit dès sa première ligne** (Tappei le dit lui-même) : endmatter derrière
un `<details>`, jamais en ouverture.

- **Pas de `※` dans le récit.** Les ruptures de scène sont **15 `△▼△▼△▼△`** → **16 blocs**
  (177 / 768 / 1581 / 2792 / 2484 / 2446 / 2509 / 1334 / 3149 / 2034 / 3716 / 1805 / 753 / 1362 /
  535 / 457 mots). Le supplément a bien des `※`, mais comme séparateurs de sections de commentaire,
  pas de scènes.
  ⚠ **Corrigé le 2026-08-15 (2e passe) : ce ne sont PAS les `<hr>`.** Le fichier en compte 11, et
  **zéro** entre le premier et le dernier séparateur narratif — 3 avant le récit, 8 après (chrome
  de page WordPress : en-tête de crédits, pied de post). Se découper sur `<hr>` donne 12 faux blocs.
  Vérification qui tranche en une commande — compter les marqueurs **dans les bornes du récit**,
  pas dans le fichier :
  ```python
  hr=[m.start() for m in re.finditer(r'<hr[^>]*>',s)]; tv=[m.start() for m in re.finditer('△▼△▼△▼△',s)]
  lo,hi=tv[1],tv[-1]; sum(1 for p in hr if lo<p<hi)   # -> 0
  ```
  Le 16e `△▼` est en tête de post (bloc de crédits « Art Sources »), pas une rupture : c'est
  `tv[0]`, d'où le `tv[1]` ci-dessus. Contrôle croisé imparable : le `.md` de l'utilisateur en a
  exactement 15.
- **WCT garde les étiquettes de locuteur ici** (529 répliques au format `Nom: [réplique]`, y compris
  `???`) — contrairement au PDF Ayamatsu qui les avait toutes supprimées. La corvée « revérifier
  chaque attribution » de la leçon Ayamatsu ne s'applique donc pas : les étiquettes sont celles de
  la source.
- **Étiquettes descriptives volontaires** = anonymat voulu, aucun portrait dessus (leçon Oboreru) :
  `???` (49), `Girl`, `Woman`, `Eyepatch Girl`, `Suspicious Man`, `Masked Man`, `Handsome Man`,
  `Pale Man`, `Rough Man`, `Bandana Man`, `Both`.
- ⚠ **`Subaru` (172) et `Subaru/Schwartz` (40) sont deux étiquettes distinctes** dans la source :
  la persona travestie (Natsumi Schwartz) est marquée par le texte. Le FR doit garder les deux
  séparées — c'est un ressort du récit, pas une coquette.
- Cast par volume de répliques : Subaru 172 · **Chisha (98, second rôle réel)** · Vincent 53 ·
  Rem 32 · Cecilus 16 · Louis 10 · Arakiya 7 · Ubilk 6 · Berstetz 6 · Madelyn 4 · Kafma 3 ·
  Gustav 3 · Otto 1. L'empereur est étiqueté **`Vincent`**, jamais `Abel` — en tenir compte pour
  le glossaire et la porte anti-spoiler.
- Porte anti-spoiler : `arc: 8` sur la page (même niveau qu'Oboreru dans le manifest).

## Mimagau IF — sources et pièges (relevé 2026-08-15, chapitre édité)

**La seule IF où ni WCT ni le JP ne sont disponibles.** Ce qui a servi, dans l'ordre :

- **Base FR — la seule traduction humaine existante** : PDF `Mimagau IF I.pdf` de **Shaura FR**,
  hébergé non pas sur le site mais sur un **dossier Google Drive** lié depuis `/if-stories/`
  (bouton « LIRE MIMAGAU IF » → `drive.google.com/drive/folders/1TNyPoTM-N3M3_YbS-JduxbCia2hIDc5a`).
  44 p., 14 796 mots, **15 blocs numérotés `1`…`15`** (pas de `※`).
  ⚠ Extraire avec `pdftotext -layout` : **sans `-layout`, les paragraphes fusionnent** (2 à 7
  blocs par scène au lieu de 12 à 85) et la page rendue devient un pavé. Avec `-layout`, un
  paragraphe = une ligne d'indentation ≥ 1, les suivantes à 0.
- **Comparaison EN — traduction machine** : thread `…/threads/re-zero-ex-confusing-life-in-another-world-from-zero-mimagau-if.116/`
  sur **forbiddenlibrary.moe** (14 660 mots). Texte dans `<div class="bbWrapper">`, séparateurs
  de scène **`△▼△▼△▼△`** (14 → 15 scènes, alignées 1:1 sur le PDF FR, ratios 0,96–1,16).
  ⚠ Le site annonce lui-même « The End of MTLs » : c'est du **machine relu**. Il porte en
  revanche la **note liminaire et la postface de Tappei**, toutes deux absentes du PDF FR.
- **JP : introuvable.** Absent de `n2267be` (WN principal) **et** de `n9525ii`
  (`Ｒｅ：ゼロから始める異世界生活　外典`, 6 chapitres EX, aucun Mimagau). Les April Fools ne
  sont pas tous conservés sur Narō — ne pas repartir en chasse, c'est vérifié.

**Accès à un dossier Google Drive public** (acquis réutilisable pour toute compilation du site FR) :
l'API `www.googleapis.com/drive/v3/files` refuse les deux clés publiques du client web
(`first-party authentication` / `API_KEY_HTTP_REFERRER_BLOCKED`), et le HTML du dossier est vide
(rendu JS). Ce qui marche :

```
https://drive.google.com/embeddedfolderview?id=<FOLDER_ID>#list   → listing HTML statique
   (titres dans .flip-entry-title, ids dans id="entry-<FILE_ID>")
https://drive.google.com/uc?export=download&id=<FILE_ID>          → le fichier
```

## ⛔ Lust IF « 胡蝶之夢 / The Butterfly Dream » — non traduit par le skill (constaté 2026-08-15)

> **Suite, le soir même (2026-08-15).** L'utilisateur a fourni **sa propre traduction française
> intégrale** (`lust-fr.md` + `lust-en.md` en regard sur le Bureau) et n'a demandé que
> l'**intégration dans la bibliothèque**. Ce qui a changé n'est pas l'analyse du contenu
> ci-dessous — elle reste exacte — mais la **demande** : produire de la prose vs mettre en page
> un texte écrit par l'utilisateur. Livré sous ce cadrage : `IF Stories/Le Rêve du papillon —
> Luxure/`, mise en page seule (typographie mécanique, portraits, EPUB), **aucune illustration de
> scène ajoutée**, sources attribuées honnêtement. Le raisonnement d'origine est conservé tel
> quel : il vaut toujours pour une demande de **traduction** de ce récit.

Sources repérées et lues (inutile de refaire la recherche) :
- EN littéraire : `https://eminenttranslations.com/rezero/side-stories/lust-if-the-butterfly-dream/`
  (8 559 mots, 8 sections numérotées 1-8, image `cdn.eminenttranslations.com/images/lust-1.webp`
  + `lust-cover-large.webp` — fan-art harem non attribué, monté en fausse couverture LN).
- EN littérale (étiquettes de locuteur) : `https://www.heretictranslations.com/if-stories/the-butterfly-dream`
  (9 551 mots ; le bloc Rem est repris de Remonwater).
- JP : **supprimé**. Chapitre 270 de Narō, posté le 1er avril 2014, **vidé par l'auteur deux jours
  plus tard** et remplacé par un court texte sur le rêve du papillon (Zhuangzi). Le megalodon
  `2014-0402-0128-42` est introuvable, Wayback n'a aucun snapshot, seul le miroir
  `megalodon.jp/2014-0403-2139-11/…/270` existe et montre déjà la page vidée. Arbitrage possible
  uniquement entre les deux EN.

Structure du récit (relevée) : Subaru roi de Lugnica, une section par partenaire —
1 Pétra · 2 Crusch · 3 Ram · 4 Priscilla · 5 Anastasia · 6 Felt · 7 Rem · 8 Émilia.

**Pourquoi l'édition s'arrête là** : le récit est intégralement bâti sur des scènes intimes, et
deux des sept partenaires sont des mineures canoniques — **Pétra Leyte, 12 ans (arcs 1-4), 13 ans
(arc 5+), 140 cm** (wiki EN, fiche Petra Leyte) et **Felt, 15 ans** (arc 1). Le texte ne leur donne
aucun âge, il se contente d'un vague « now old enough that her maid uniform suited her quite
nicely », et met Pétra au lit avec Subaru dès la section 1. Ce n'est pas un détail marginal : c'est
2 sections sur 8 et la prémisse même de l'histoire. Aucune version tronquée n'est proposée non plus
— amputer trahirait la règle de fidélité intégrale du skill sans régler le fond.

Ce que le skill **peut** faire sur cette IF, si l'utilisateur le demande : une fiche
encyclopédique non narrative (genèse, statut du chapitre supprimé, référence au 胡蝶之夢 de
Zhuangzi, place dans la série des EX du 1er avril) — pas d'édition du récit.

## Re:Zero Académie — état des lieux (relevé 2026-08-15)

Post FR unique : `/2024/06/02/rezero-academie/` (page également servie sous `/rezero-academie/`) —
**chapitre 1 seul**, 3 scènes, ~10 000 mots, clos par « À suivre… ». Crédits en tête : traduit par
Eminent (EN) → Namba (FR), relu par Akira, fan-arts **ZeroBarto** (= *RealBarto*, l'illustrateur
crédité sur la couverture anglaise). Deux fan-arts dans le post, **en version sans texte** —
meilleurs que les versions anglaises incrustées de dialogue.

Suites (payload de `/series/rezero-side-content` chez Eminent) : *Second Period* publiée
2025-12-29 mais **hébergée sur un Google Docs**, pas dans le lecteur ; *Third / Fourth Period*
marquées `LQ, AITL` (traduction machine relue, basse qualité auto-déclarée) et publiées sur leur
**Discord** — donc pas de source exploitable au-delà du chapitre 1 sans repasser par le JP.

Le wiki (`Re:Zero EX`, section *Re:Zero Academy*) confirme **4 parties**, un cadre *slice of life*,
et le surnom **« Vainglory IF »**. Pas de titre japonais attesté trouvé — ne pas en inventer un.

⚠ **Récit à incises intégrées** (première personne, « … », dis-je), contrairement aux IF à
étiquettes : conséquences de gabarit dans `rendu.md` (portraits sans `.dlg-name`).

## rezerowebnovelfr.wordpress.com — structure

- Index : `/histoire-principale/` (arcs I à X), `/histoires-annexes/`, `/if-stories/`,
  `/la-carte-du-monde-de-rezero/`, `/notre-equipe/`.
- Pattern d'URL chapitre : `/YYYY/MM/DD/<slug>/` — les IF sont des posts uniques longs :
  - Ayamatsu : `/2023/01/31/ayamatsu-if-resegarer-dans-un-autre-monde-a-partir-de-zero/`
  - Oboreru : `/2021/06/13/oboreru-if-rese-noyer-dans-un-autre-monde-a-partir-de-zero/`
  - Kasaneru : `/2022/06/21/kasaneru-if-reaccumuler-dans-un-autre-monde-a-partir-de-zero/`
  - Tsugihagu : `/2024/10/21/tsugihagu-if-re-se-reconstituer-dans-un-autre-monde-a-partir-de-zero/`
- Format des pages : prose brute, séparateurs de scène `※ ※ ※`, tirets `――` pour les pensées,
  crédits traducteur/correcteur/artiste **en tête** de page (pas en fin), images fan-art
  disséminées **à leur scène**, et parfois plusieurs lecteurs SoundCloud (OST) — Ayamatsu en a
  deux : l'OST officielle en ouverture, la piste fan-made au climax.
- **Le site FR ajoute des étiquettes de locuteur** (`Subaru : "…"`) que l'anglais n'a pas
  forcément : le PDF Ayamatsu de WCT annonce explicitement avoir supprimé toutes les incises.
  Ces étiquettes sont donc une **invention du traducteur FR** à revérifier une par une, pas une
  donnée de la source.
- Les scènes du post FR sont **alignées 1:1** sur celles de l'EN (mêmes `※`, même ordre) : ça
  permet de découper les deux fichiers en blocs parallèles pour l'édition déléguée, et de
  contrôler qu'aucun passage n'a sauté (ratio mots FR/EN attendu ≈ 1,05–1,25 par scène).
- Le site a aussi ~60 histoires annexes (arcs 1-7) et compile les IF sur un Google Drive.

## Arcs du WN (titres FR du site)

I Un Premier Jour Tumultueux · II La Semaine Chaotique · III Retour à la Capitale Royale ·
IV Le Contrat Éternel · V Les Étoiles qui Écrivent l'Histoire · VI Le Corridor des Souvenirs ·
VII La Terre des Loups · VIII Vincent Vollachia · IX La Lumière d'une Étoile sans Nom ·
X La Terre du Roi Lion.

## Accès — pièges connus

- `rezero.fandom.com` renvoie souvent **HTTP 402** à WebFetch. Contournements dans l'ordre :
  `tavily-extract` sur l'URL (fonctionne), puis chercher l'info via WebSearch. Les **images** du
  CDN `static.wikia.nocookie.net` restent récupérables en `curl` direct même quand la page bloque.
- `spriters-resource.com` renvoie 403 au scraping simple — `curl` avec User-Agent navigateur, ou
  navigation Chrome si dispo.
- `rezerodb.com` : 403 intermittent.
- Narō (syosetu.com) : accessible, texte JP brut. ⚠ Les EX du 1er avril **n'y sont pas tous** :
  ni `n2267be` ni le recueil `n9525ii` (外典) ne portent Mimagau. Absence vérifiée, ne pas la
  rechercher à nouveau.
- `drive.google.com` : API v3 fermée aux clés publiques → passer par `embeddedfolderview` (recette
  dans la section Mimagau ci-dessus).
- `forbiddenlibrary.moe` : `curl` + UA navigateur suffit ; `tavily-extract` sur une URL de thread
  **retombe sur la page d'accueil du forum** et renvoie un contenu sans rapport, sans erreur.
