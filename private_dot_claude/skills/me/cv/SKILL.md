---
name: me:cv
description: >-
  Génère et adapte le CV de Kylian Bardini à une offre ou une entreprise précise, puis
  produit un PDF A4 une page à la charte kbrdn.dev qui passe le contrôle ATS (`pdftotext` :
  chaque mot-clé intact, ordre de lecture correct, une seule page). Part d'une source de
  vérité unique (`_candidature-kit/profil.{fr,en}.json` + `pool.fr.md`) : adapter = choisir,
  réordonner, réaccentuer — jamais inventer un fait. À utiliser dès que l'utilisateur parle
  de « mon CV », « adapte mon CV à cette offre », « CV pour <entreprise> », « CV en anglais »,
  « CV ATS », « regénère mon CV », colle une annonce d'emploi en demandant une candidature,
  ou lance `/me:cv`. Couvre aussi la mise à jour de la source (nouvelle expérience, nouveau
  projet, nouveau diplôme) : on modifie le profil et le pool, jamais le PDF.
allowed-tools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebFetch"]
---

# me:cv — CV adapté, une page, parsable par un ATS

## Pourquoi cette skill existe

Le CV précédent de Kylian était un export d'outil de design. Le texte y était posé glyphe par
glyphe : un ATS en extrayait `W orpress`, `T ailwindCSS`, et `WAMP` sortait en `A P W M`, lettres
dans le désordre. La colonne de labels à gauche entrelaçait les rubriques. Autrement dit, la moitié
des plateformes lisait de la bouillie.

D'où la règle centrale : **un CV n'est livré que s'il passe le gate.** Le gate relit le PDF produit
exactement comme un parser (`pdftotext` sans `-layout`) et vérifie trois choses : chaque mot-clé
ressort intact, les rubriques sont dans l'ordre, et le document tient sur une page.

## Le kit

Tout vit dans `~/.claude/skills/me/_candidature-kit/`, partagé avec `me:lettre` :

| Fichier | Rôle |
|---|---|
| `profil.fr.json` / `profil.en.json` | **CV de base**, prêt à rendre, une page, gate vert |
| `pool.fr.md` | **Réservoir vérifié** : tous les faits sourcés, variantes de titre et d'accroche, état du marché lux, trous connus |
| `kit.ts` | Rendu HTML → PDF (Chrome headless) + gate ATS |

```bash
bun ~/.claude/skills/me/_candidature-kit/kit.ts <profil.json> --out <sortie.pdf> [--theme light|dark] [--keep-html] [--max-pages N]
```

Sortie par défaut : thème clair, une page. Le thème sombre existe pour un envoi direct à un humain
(version « portfolio ») — **jamais** pour une plateforme de candidature.

## Règle d'or

> **Adapter = sélectionner, réordonner, reformuler l'accent. Jamais ajouter un fait.**

Si l'offre demande une compétence absente du pool, on ne l'écrit pas. On l'omet, ou on la traite
franchement dans la lettre de motivation. Un CV gonflé se paie en entretien technique, et au
Luxembourg (banques, Big Four, SSII) les diplômes et références sont vérifiés.

Contraintes non négociables héritées du pool :
- **« Ingénieur » n'apparaît pas dans le titre FR** — le cursus Ingénierie Informatique n'a pas donné
  lieu à diplôme. En EN, « Engineer » reste un intitulé de poste valide.
- La formation MNS 2023-2025 s'écrit **sans** les mots « Master », « diplômé » ou « titre ».
- **Confidentialité** : l'employeur actuel n'est pas au courant de la recherche. Rien dans le repo
  public `kbrdn.dev`, rien de publié en ligne. Livrables dans iCloud `Travail/CV/`.

## Déroulé

### 1. Lire la cible

Si l'utilisateur fournit une URL d'annonce → `WebFetch`. S'il colle le texte → le prendre tel quel.
S'il donne juste un nom d'entreprise → demander l'annonce, ou à défaut travailler sur le secteur.

En extraire, littéralement :
- l'**intitulé exact** du poste (il devient le titre du CV s'il est compatible avec le pool) ;
- les technos citées, **dans leur formulation** (« Vue.js » et non « Vue » si l'annonce écrit Vue.js) ;
- les responsabilités récurrentes (architecture ? mise en prod ? relation client ? encadrement ?) ;
- la langue de l'annonce → **c'est la langue du CV**, sauf consigne contraire ;
- les contraintes dures : années d'expérience, diplôme exigé, langues, présence sur site.

### 2. Croiser avec le pool

Ouvrir `pool.fr.md`. Pour chaque exigence de l'annonce, chercher la preuve correspondante.
Trois issues possibles, et une seule est un mensonge :

| Cas | Action |
|---|---|
| Preuve présente dans le pool | la remonter, la reformuler avec le vocabulaire de l'annonce |
| Preuve absente mais adjacente | garder l'adjacent, ne pas prétendre l'équivalence |
| Preuve absente | ne rien écrire — le laisser pour la lettre |

Signaler à l'utilisateur les exigences non couvertes, avec le décompte. S'il en manque beaucoup,
le dire franchement plutôt que de fabriquer un CV qui coche des cases vides.

### 3. Composer

```bash
cp ~/.claude/skills/me/_candidature-kit/profil.fr.json /tmp/.../profil.<slug-entreprise>.json
```

Puis éditer cette copie :
- `identity.title` → variante du pool la plus proche de l'intitulé de l'annonce ;
- `identity.summary` → variante d'accroche correspondante, réécrite avec 2-3 termes de l'annonce ;
- réordonner `sections[]` — la rubrique qui répond le mieux à l'annonce passe en premier après
  l'expérience (ex. offre DevOps → « Compétences techniques » avant « Projets open source ») ;
- réordonner et **couper** les bullets : les plus pertinents en haut, les autres dégagent ;
- réordonner `stack[]` pour que les technos de l'annonce arrivent en tête de ligne ;
- `gateExtra` → y mettre les mots-clés de l'annonce qui **doivent** figurer, pour que le gate
  échoue si on les a oubliés. C'est le meilleur usage de ce champ.

Le budget est d'**une page**. Le gate le fait respecter : si ça déborde, c'est qu'il faut couper
du contenu, pas rétrécir la typo.

### 4. Rendre et vérifier

```bash
bun ~/.claude/skills/me/_candidature-kit/kit.ts /tmp/.../profil.<slug>.json \
  --out ~/Library/Mobile\ Documents/com~apple~CloudDocs/Travail/CV/<slug>/CV_Kylian_Bardini_FR.pdf
```

Le gate s'exécute automatiquement et sort en code 1 s'il échoue.
**Ne jamais livrer un PDF dont le gate est rouge.** Quatre causes possibles :

| Symptôme | Cause | Correctif |
|---|---|---|
| `pages 2/1` | trop de contenu | couper des bullets, pas réduire la typo |
| mots-clés introuvables | un terme a été fragmenté | chercher un flex / inline-block / date flottée réintroduit dans `kit.ts` |
| rubriques désordonnées | mise en page multi-colonnes | repasser en flux texte pur |
| `complétude : n trou(s)` | un `TODO` / « à confirmer » est resté dans le contenu | le remplir avec Kylian — un CV parsable qui affiche TODO est pire que pas de CV |

Tant que le gate est rouge, le fichier se nomme `BROUILLON_*` et ne quitte pas la machine.

**Ne jamais rendre directement dans un dossier synchronisé iCloud** (`~/Desktop`, `~/Documents` et
`Travail/CV` le sont tous — « Bureau et Documents dans iCloud » est activé). Chrome y écrit le PDF,
la synchro se déclenche pendant, et le fichier ressort **à 0 octet** — vécu. Rendre dans le
scratchpad local, puis `ditto` vers la destination, puis vérifier les tailles :

```bash
ditto "$BUILD" "$DEST"
find "$BUILD" -type f | while read f; do r="${f#$BUILD/}"
  [ "$(stat -f%z "$f")" = "$(stat -f%z "$DEST/$r")" ] || echo "✗ $r"; done
```

### 5. Variante .docx si la plateforme l'exige

Workday et SuccessFactors parsent parfois mieux le `.docx`, et quelques SSII l'exigent.
Ajouter `--docx` : le fichier est généré **depuis le même JSON**, jamais depuis le PDF —
re-parser sa propre sortie réintroduirait exactement les erreurs qu'on cherche à éviter.

```bash
bun ~/.claude/skills/me/_candidature-kit/kit.ts profil.<slug>.json --out …/CV.pdf --docx
```

Sortie structurée (titres, listes), sans mise en page — parfaite pour un ATS, quelconque à l'œil.
À envoyer seulement quand la plateforme le demande.

### 6. Rendre compte

Dire à l'utilisateur, sobrement :
- ce qui a été remonté et pourquoi ;
- ce qui a été coupé pour tenir la page ;
- **les exigences de l'annonce non couvertes par le pool** — c'est l'information la plus utile ;
- le résultat du gate (pages, mots-clés, ordre).

## Mettre à jour la source

Nouvelle expérience, nouveau projet, nouveau chiffre, nouveau diplôme : on modifie
`profil.{fr,en}.json` **et** `pool.fr.md`, avec la source du fait. On ne bricole jamais un PDF isolé —
il serait écrasé au rendu suivant et la prochaine adaptation repartirait de données périmées.

Les entrées marquées 🔴 dans le pool sont des trous connus à combler avec Kylian : réalisations
depuis le CDI (déc. 2025), niveau d'anglais, allemand, chiffre des 300 000 utilisateurs, projet Java.

## Pièges qui reproduisent le bug d'origine

À ne jamais réintroduire dans `kit.ts` :
- pastilles / `inline-block` sur les listes de technos → chaque boîte devient un run séparé, réordonné ;
- dates alignées à droite en `flex`/`float` → arrachées de leur ligne, regroupées en fin de document ;
- coordonnées dans un en-tête ou pied de page PDF → les ATS les ignorent ;
- pictogrammes à la place des mots (☎ au lieu de « Téléphone ») ;
- deux colonnes, tableaux, `letter-spacing` sur du texte de contenu ;
- `letter-spacing` sur un **titre de rubrique suivi de contenu inline** — vu en vrai sur la rubrique
  Langues : le titre ressortait `L A N G U E S`. Le tracking ne tient que sur un titre seul sur sa ligne ;
- police à ligatures sur du contenu (`font-variant-ligatures:none` est déjà posé globalement).
