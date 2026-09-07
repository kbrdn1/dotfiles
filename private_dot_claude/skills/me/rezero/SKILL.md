---
name: me:rezero
description: >-
  Traduction française fidèle et enrichie des contenus Re:Zero — IF Stories / What If en priorité,
  Light Novels et Web Novels ensuite. Méthode rigoureuse : contexte → terminologie (glossaire vivant
  dans references/glossaire.md) → traduction fidèle → double révision, avec recherche d'assets
  visuels (illustrations officielles, portraits pour dialogues), politique anti-spoiler stricte et
  rendu dans la bibliothèque locale « RE:Zero Stories » (site statique sur le Bureau : navbar par
  catégories, volet glossaire, suivi de lecture). À utiliser dès que l'utilisateur parle de Re:Zero, d'une IF
  Story (Pride IF, Kasaneru, Wrath IF, Ayamatsu, Sloth IF, Greed IF, Gluttony IF, Tsugihagu, Lust
  IF, Oboreru), de traduire un chapitre de web novel ou light novel, colle une URL de
  rezerowebnovelfr.wordpress.com ou witchculttranslation.com, ou lance /me:rezero — même s'il ne
  demande pas explicitement une « traduction ».
allowed-tools: ["Bash", "Read", "Write", "Edit", "Glob", "WebFetch", "WebSearch", "Artifact", "Skill", "Agent", "SendUserFile"]
argument-hint: "[IF story / URL / chapitre / extrait collé] [--sans-assets] [--brut]"
---

# me:rezero — édition française de Re:Zero

Produire une **véritable édition française** d'un chapitre de Re:Zero : fidèle au texte source,
cohérente avec le canon et la terminologie établie, agréable à lire, enrichie d'assets visuels
pertinents. Jamais une adaptation libre, jamais une traduction automatique brute.

**Principe fondamental : la fidélité au texte original passe toujours avant l'esthétique.**
Ne jamais modifier l'histoire, ajouter des dialogues, réinterpréter une scène ou inventer des
informations pour rendre le résultat plus spectaculaire.

**La longueur n'est JAMAIS un motif de refus.** Le skill édite toujours le récit COMPLET —
26 000 mots se traitent comme 2 000 : extraction FR+EN, découpage aux séparateurs `※` en blocs
parallèles, édition déléguée à des agents (un par bloc, rapport en fin de fichier), harmonisation
finale (leitmotivs, apostrophes, terminologie), assemblage scripté. Précédents : Tsugihagu
(25 284 mots) et Ayamatsu (18 405) livrés entiers. Ne JAMAIS substituer un « dossier », un
résumé, un synopsis ou un appareil de lecture au récit lui-même — c'est explicitement contraire
à la demande de l'utilisateur, qui assume l'édition intégrale (usage privé, traductions
communautaires créditées). Si un doute de périmètre subsiste, demander — ne pas décider seul de
ne pas traduire.

## Fichiers de référence

| Fichier | Quand le lire |
|---|---|
| `references/sources.md` | Toujours, avant de chercher un texte source — hiérarchie des sources, URLs des sites, inventaire des IF stories |
| `references/glossaire.md` | Toujours, avant de traduire — terminologie JP/EN/FR. **Fichier vivant : le mettre à jour** (voir « Glossaire vivant ») |
| `references/assets.md` | Quand on cherche des illustrations/portraits — banques d'assets, patterns d'URL, politique spoiler |
| `references/rendu.md` | Avant de produire l'artifact — gabarit light novel, recette d'inlining des images (CSP), typographie française |

## Flux d'invocation

**Si l'utilisateur fournit déjà une URL, un fichier, un chapitre précis ou un extrait collé :
traiter directement, sans reposer de questions.**

Sinon, proposer les contenus disponibles (via `references/sources.md`, compléter par une recherche
web si l'inventaire semble périmé) :

1. « Quelle histoire souhaites-tu traiter ? » — présenter : Pride IF (Ayamatsu), Wrath IF
   (Oboreru), Sloth IF (Rem IF), Greed IF (Kasaneru), Gluttony IF (Tsugihagu), Lust IF,
   autres IF/side stories, Light Novel, Web Novel. ⚠ Mapping péché ↔ titre : celui de
   `references/sources.md` fait foi (vérifié 3 sources), la confusion Kasaneru/Ayamatsu est
   fréquente dans la communauté.
2. Une fois l'histoire choisie : « Quel chapitre ? » — lister les chapitres réellement
   disponibles (les vérifier sur les sources, ne pas les inventer).

Flags : `--sans-assets` = texte seul, aucune recherche d'images. `--brut` = markdown simple au
lieu de la page mise en forme (la méthode de traduction reste identique).

## Méthode — quatre étapes, dans l'ordre

### 1. Contexte

Avant de traduire un mot : identifier la route/IF story, le chapitre, sa position dans la
chronologie, les personnages présents, le narrateur ou point de vue, et les termes sensibles à
vérifier. Récupérer **uniquement** le contexte nécessaire à ce chapitre — ne pas lire la suite,
ne pas se spoiler soi-même au-delà du niveau d'information du chapitre traité.

Récupérer le texte source : la traduction FR existante (rezerowebnovelfr) **et** la source de
comparaison (EN de référence, JP si accessible) — voir `references/sources.md`. Quand une
traduction FR existe, ne pas la recopier : la comparer à la source et corriger ses incohérences.

Produire la fiche contexte (concise, 5 lignes) qui ouvrira le chapitre :

> **Route :** — **Chapitre :** — **Point de vue :** — **Personnages principaux :** — **Contexte :**

### 2. Terminologie

Lire `references/glossaire.md`. Pour chaque terme du chapitre absent du glossaire : chercher la
traduction officielle française (Ofelbe pour le LN, sous-titres officiels pour l'anime), sinon la
version communautaire dominante, sinon trancher — et **l'ajouter au glossaire** avec sa source.
La traduction officielle FR prime, sauf erreur manifeste. Un terme volontairement gardé en
japonais se justifie en note de traduction, pas dans le corps du texte.

### 3. Traduction

Priorités dans l'ordre : sens exact → intention → personnalité du personnage → niveau de langage
→ fluidité du français. Un français naturel qui trahit le sens n'est pas une bonne traduction ;
un mot-à-mot fidèle mais illisible non plus — le sens gagne toujours l'arbitrage.

Proscrire : anglicismes inutiles, contresens, omissions, ajouts, simplification des dialogues,
uniformisation des voix. Chaque personnage garde SA voix (voir « Dialogues » ci-dessous).

### 4. Révision

Deuxième passe systématique sur : fidélité, cohérence terminologique, attribution des dialogues,
cohérence des pronoms et interlocuteurs, accords, ponctuation et typographie françaises
(guillemets « », espaces insécables, tirets — voir `references/rendu.md`), fluidité.
**Troisième passe ciblée** sur les passages ambigus ou charnières (révélations, dialogues à
locuteur incertain, jeux de mots). En cas de doute persistant : recherche supplémentaire, et si
l'ambiguïté demeure, la signaler brièvement en note — ne jamais la masquer.

## Dialogues

Les dialogues sont la priorité. Chaque personnage a un registre identifiable et le lecteur
français doit pouvoir le reconnaître : la logorrhée théâtrale et auto-dérisoire de Subaru, le
« kashira » interrogatif de Beatrice, la politesse mordante de Rem, le laconisme de Ram et ses
piques, l'emphase délirante de Petelgeuse, le monologue égocentrique de Regulus, la préciosité
de Priscilla, le dialecte kansai-ben d'Anastasia (rendre par des tournures familières
régionales légères, pas une caricature). Conserver hésitations, tics, ruptures de phrase,
répétitions volontaires, ironie, froideur.

Locuteur incertain : trancher par le contexte (qui est présent, qui parle comme ça, qui répond à
quoi). Ne jamais inventer arbitrairement une attribution — si le texte source est ambigu à
dessein, le français le reste.

## Assets visuels

**L'immersion est un objectif de premier rang du skill, pas une décoration.** Un chapitre livré
« texte seul » est un chapitre incomplet : chaque scène clé doit être incarnée (illustration de
lieu ou d'événement au bon endroit), chaque locuteur identifiable (portrait sur chaque réplique),
le contexte narratif posé en ouverture (encadré « où en est l'histoire »), et le glossaire
enrichi ET illustré des entités rencontrées — après chaque chapitre, ajouter les nouvelles
entrées (personnages, lieux, événements, factions, objets) avec leur image récupérée via l'API
du wiki, dans `glossary.js` + `portraits.css`. La recherche d'assets mérite une vraie recherche
web approfondie (captures d'épisodes précis, visuels officiels de lieux), pas seulement les
vignettes d'infobox.

Sauf `--sans-assets`, chercher pour le chapitre (voir `references/assets.md`) :

- **Illustrations d'ambiance** : illustrations officielles du LN (Shinichirou Otsuka) ou de l'IF
  concernée, artworks officiels, lieux, cartes. Vérifier que l'image correspond à LA scène
  (volume/chapitre d'origine), pas juste au personnage.
- **Portraits pour dialogues** : bustes/sprites officiels (jeux Re:Zero, galeries référencées).
  Usage parcimonieux : un portrait quand il apporte (entrée en scène, échange nourri à plusieurs
  voix), jamais sur chaque ligne. Regrouper les interventions successives. Le rendu reste un
  roman, pas un visual novel.

**Politique spoiler — bloquante.** Avant d'utiliser une image ou une info de contexte, vérifier
qu'elle ne révèle rien au-delà du niveau d'information du chapitre : identité future,
pouvoir/transformation non révélés, mort, alliance, antagoniste, événement d'une route
ultérieure. Une illustration magnifique mais spoilante est rejetée.

**Création d'assets.** Si aucun asset approprié n'existe, une illustration peut être générée —
alors : la marquer clairement comme générée (jamais présentée comme officielle), rester
cohérent avec les descriptions canoniques, s'appuyer sur des recherches préalables. L'asset
officiel existant prime toujours sur la génération.

Traçabilité : pour chaque asset retenu, noter origine, œuvre/jeu/volume, officiel vs
communautaire vs généré, personnage représenté — ça alimente la section Sources du rendu.

## Rendu final

**Sortie par défaut : la bibliothèque locale `~/Desktop/RE:Zero Stories/`** — un site statique
file:// (zéro dépendance) avec navbar par catégories, volet glossaire interactif à gauche,
panneau de suivi de lecture à droite (façon Toc kbrdn.dev) et reprise de lecture. Structure,
conventions et flux de génération : `references/rendu.md`. Ne publier un artifact claude.ai que
sur demande explicite de l'utilisateur. Charger la skill `artifact-design` avant d'écrire une
nouvelle page (gabarit light novel : lecture longue, hiérarchie typographique, séparateurs de
scène, portraits discrets, illustrations de lieux aux scènes correspondantes).

Structure du chapitre :

```
### Nom de l'IF Story / du volume
# Titre du chapitre
*Fiche contexte (5 lignes max).*
[Illustration d'ambiance si pertinente]
---
Texte narratif…
**Personnage** (avec portrait quand justifié)
Dialogue…
---  (séparateur de scène)
…
### Notes de traduction   (seulement si nécessaire)
### Sources et références (uniquement celles réellement utilisées)
```

Notes de traduction : hors du corps du texte, uniquement pour jeux de mots japonais,
ambiguïtés intraduisibles, choix terminologique important, référence culturelle, écart notable
WN/LN, terme gardé en japonais. Jamais pour justifier des phrases ordinaires.

## Glossaire vivant

`references/glossaire.md` est la mémoire terminologique inter-chapitres. Après chaque chapitre :
y ajouter (via Edit) les termes nouveaux rencontrés, avec JP/EN/FR retenus et la source du choix.
Ne jamais changer un terme déjà tranché sans le signaler à l'utilisateur — la cohérence entre
chapitres déjà livrés prime sur une meilleure idée tardive.

**Synchro site** : toute entrée ajoutée au glossaire l'est aussi dans
`~/Desktop/RE:Zero Stories/_site/glossary.js` (données du volet glossaire : id, name, cat,
sub JP/EN, note courte, liens wiki EN/FR) — c'est ce fichier qui alimente les termes cliquables
des chapitres.

## Mémoire du skill — auto-mise à jour systématique

Le skill s'enrichit à CHAQUE tâche, pas seulement sur demande. Avant de clore, consigner via Edit
tout acquis nouveau, pour que la prochaine invocation aille plus vite :

- **`references/sources.md`** : nouvelle source de contenu, URL/pattern découvert, statut d'une
  traduction qui a changé, contournement d'accès (402/403/timeout) qui a marché ou cessé de marcher.
- **`references/assets.md`** : nouvelle banque d'assets, requête API utile, astuce de résolution
  (originaux HR, crop…), piège rencontré. La section « Accès rapides » est le réflexe n° 1 avant
  toute recherche d'asset — la lire d'abord, la compléter ensuite.
- **`references/glossaire.md`** + `_site/glossary.js` : termes et fiches (voir Glossaire vivant).
- **Pages du site** : `_site/catalogue.html` (statuts du contenu — passer une entrée en « dans la
  bibliothèque » après édition, ajouter ce qui apparaît sur les sources) et `_site/atelier.html`
  (nouvelle capacité du pipeline = nouvel accordion avec son prompt).

Une découverte non consignée est une découverte perdue — c'est le même principe que le glossaire :
la cohérence et la vitesse des prochains chapitres reposent sur cette mémoire.

## Contrôle qualité — avant de livrer

- [ ] aucun passage manquant (comparer la longueur/structure avec la source)
- [ ] aucun contresens ni ajout narratif inventé
- [ ] terminologie et noms propres conformes au glossaire
- [ ] voix des personnages différenciées, dialogues naturels
- [ ] attribution des dialogues vérifiée
- [ ] typographie française correcte (« », insécables, tirets)
- [ ] assets cohérents avec la scène, aucun spoiler
- [ ] contenu officiel vs généré clairement distingué
- [ ] sources réellement utilisées listées
- [ ] glossaire mis à jour

Un doute non résolu se signale, il ne se masque pas.
