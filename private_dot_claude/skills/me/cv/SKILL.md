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
| `assets/` | photo, polices copiées du site : Inter statique (`InterOG-400/500.ttf`), Krypton, Fenix |

```bash
bun ~/.claude/skills/me/_candidature-kit/kit.ts <profil.json> --out <sortie.pdf> [--theme light|dark] [--keep-html] [--max-pages N]
```

Sortie par défaut : thème clair, une page. Le thème sombre existe pour un envoi direct à un humain
(version « portfolio ») — **jamais** pour une plateforme de candidature.

Le rendu suit le design actuel du portfolio : header en panel gris arrondi portant une card blanche
(monogramme K de `Logo.vue`, nom en Inter, titre en Fenix orange, pastille de statut), rubriques en
eyebrow mono dans une bande de panel, dates en eyebrow orange, séparateurs pointillés. Les jetons
de `THEMES` sont ceux de `app/assets/css/theme.css` (`.light` / `.dark`). Si le site change de
design, on relit le repo (lecture seule) et on reporte dans `kit.ts` — jamais l'inverse.

## Règle d'or

> **Adapter = sélectionner, réordonner, reformuler l'accent. Jamais ajouter un fait.**

Si l'offre demande une compétence absente du pool, on ne l'écrit pas. On l'omet, ou on la traite
franchement dans la lettre de motivation. Un CV gonflé se paie en entretien technique, et au
Luxembourg (banques, Big Four, SSII) les diplômes et références sont vérifiés.

Contraintes non négociables héritées du pool :
- **« Ingénieur » n'apparaît pas dans le titre FR** — le cursus Ingénierie Informatique n'a pas donné
  lieu à diplôme. En EN, « Engineer » reste un intitulé de poste valide.
- La formation MNS 2023-2025 s'écrit **sans** les mots « Master », « diplômé » ou « titre ».
- **Confidentialité** : rien de candidature dans le repo public `kbrdn.dev` — ni fichier, ni commit,
  ni PDF dans `public/`. Livrables dans iCloud `Travail/CV/`. Une seule chose part en ligne : la
  variante web du **CV de base**, sans téléphone, hébergée sur le VPS hors du repo (étape 6). Un CV
  adapté à une offre et les lettres ne quittent jamais la machine et iCloud.

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
BUILD=/tmp/cv-build-<date>   # local, hors iCloud (voir plus bas)
bun ~/.claude/skills/me/_candidature-kit/kit.ts /tmp/.../profil.<slug>.json \
  --out "$BUILD/<slug>/CV_Kylian_Bardini_FR.pdf"
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
scratchpad local, puis `ditto` vers la destination, puis vérifier les tailles (`wc -c` et non
`stat -f%z` : le `stat` du PATH est celui de coreutils, où `-f` lit le système de fichiers) :

```bash
DEST="$HOME/Library/Mobile Documents/com~apple~CloudDocs/Travail/CV"
ditto "$BUILD" "$DEST"
find "$BUILD" -type f | while read f; do r="${f#$BUILD/}"
  [ "$(wc -c < "$f")" = "$(wc -c < "$DEST/$r")" ] || echo "✗ $r"; done
```

Le CV de base se range dans `Travail/CV/FR/` et `Travail/CV/EN/` (`CV_Kylian_Bardini_<LANG>.pdf` +
`.docx`) : rendre dans `$BUILD/FR/` et `$BUILD/EN/` pour que `ditto` les pose au bon endroit.

### 5. Variante .docx si la plateforme l'exige

Workday et SuccessFactors parsent parfois mieux le `.docx`, et quelques SSII l'exigent.
Ajouter `--docx` : le fichier est généré **depuis le même JSON**, jamais depuis le PDF —
re-parser sa propre sortie réintroduirait exactement les erreurs qu'on cherche à éviter.

```bash
bun ~/.claude/skills/me/_candidature-kit/kit.ts profil.<slug>.json --out …/CV.pdf --docx
```

Sortie structurée (titres, listes), sans mise en page — parfaite pour un ATS, quelconque à l'œil.
À envoyer seulement quand la plateforme le demande.

### 6. Variante web + publication sur le VPS — CV de base seulement

Le site propose le CV de base en téléchargement (`/experience`, `/contact`). Il ne connaît que son
URL, fixée par les variables de dépôt `CV_URL_FR` / `CV_URL_EN` :
`https://kbrdn.dev/cv/CV_Kylian_Bardini_FR.pdf` et `…_EN.pdf`. Ce qui part en ligne n'est **pas** le
profil de base : c'est une variante **sans téléphone**. Le profil de base garde le numéro pour les
vraies candidatures — ne pas le retirer du kit. **Régénérer le CV de base = refaire cette étape.**
Un CV adapté à une offre ne passe jamais par ici.

**a. Rendre la variante web** — copie jq du profil, `photo` en chemin absolu (la copie vit hors du
kit), rendue dans le build local, gate vert :

```bash
K=~/.claude/skills/me/_candidature-kit; J=$(mktemp -d); mkdir -p "$BUILD/web"
PH=$(jq -r .identity.phone "$K/profil.fr.json")   # le numéro vient du profil, jamais écrit ici
for l in fr en; do L=$(echo $l | tr a-z A-Z)
  jq --arg photo "$K/assets/photo.jpg" 'del(.identity.phone) | .identity.photo = $photo' \
    "$K/profil.$l.json" > "$J/profil.web.$l.json"
  grep -qF "$PH" "$J/profil.web.$l.json" && echo "✗ numéro resté dans le JSON $l"
  bun "$K/kit.ts" "$J/profil.web.$l.json" --out "$BUILD/web/CV_Kylian_Bardini_$L.pdf" || echo "✗ gate $l"
done
# ce que lit un parser : ni ce numéro, ni un autre (doit n'afficher que des 0)
for f in "$BUILD"/web/*.pdf; do
  pdftotext "$f" - | grep -cE -e '(\+33|\b0)[1-9]([ .-]?[0-9]{2}){4}' -e "$(printf '%s' "$PH" | sed 's/[+.]/\\&/g')"; done
```

Un `⚠ photo introuvable` ne fait **pas** échouer le gate : le chercher dans la sortie. Puis `ditto`
vers `Travail/CV/web/` et comparer les tailles, comme à l'étape 4.

**b. Publier** — depuis le build local, jamais depuis la copie iCloud. `main-vps` est l'accès SSH
d'admin du VPS, via `~/.ssh/main-vps` (`~/.ssh` n'est pas lisible depuis une session Claude : ne
pas chercher à l'inspecter, l'alias suffit) ; nginx sert `/var/www/cv/` sous `/cv/` (`location ^~ /cv/ { alias
/var/www/cv/; }` dans le site `kbrdn.dev`, déjà en place : ne pas le repatcher). Rien à redéployer,
l'URL ne change pas. L'ancienne version est gardée dans `/root`, hors de la racine web — tout ce qui
est posé dans `/var/www/cv/` est public :

```bash
W="$BUILD/web"
scp -q -o ClearAllForwardings=yes -o BatchMode=yes \
  "$W/CV_Kylian_Bardini_FR.pdf" "$W/CV_Kylian_Bardini_EN.pdf" main-vps:/tmp/ &&
ssh -o ClearAllForwardings=yes -o BatchMode=yes main-vps 'bash -s' <<'REMOTE'
set -e
P=/root/cv-prev-$(date +%Y%m%d%H%M%S); install -d -m 700 "$P"
cp -p /var/www/cv/CV_Kylian_Bardini_FR.pdf /var/www/cv/CV_Kylian_Bardini_EN.pdf "$P/"
install -m 644 /tmp/CV_Kylian_Bardini_FR.pdf /tmp/CV_Kylian_Bardini_EN.pdf /var/www/cv/
rm -f /tmp/CV_Kylian_Bardini_FR.pdf /tmp/CV_Kylian_Bardini_EN.pdf
echo "ancienne version : $P"; cd /var/www/cv && sha256sum CV_Kylian_Bardini_FR.pdf CV_Kylian_Bardini_EN.pdf
REMOTE
(cd "$W" && shasum -a 256 CV_Kylian_Bardini_FR.pdf CV_Kylian_Bardini_EN.pdf)   # mêmes empreintes
```

**c. Vérifier en ligne.** Cloudflare met `/cv/` en cache (`cf-cache-status: HIT`) : juste après
l'upload, l'URL nue sert encore **l'ancien** PDF jusqu'à expiration du cache edge : **1 h au plus**,
borné par le `Cache-Control: max-age=3600` du bloc nginx (observé le 2026-10-29 : bascule en
`EXPIRED` à `age` ≈ 3600). Aucun accès API Cloudflare depuis cette machine pour purger ; à défaut,
purge à la main dans le dashboard. Côté navigateur, Cloudflare annonce `max-age=14400` : un visiteur
qui l'a déjà téléchargé peut garder l'ancien 4 h.
Télécharger l'URL nue à ce moment-là testerait l'ancien fichier : la vérification passe donc par
une URL cache-bustée, qui va à l'origine (`MISS`) :

```bash
for L in FR EN; do u="https://kbrdn.dev/cv/CV_Kylian_Bardini_$L.pdf"; v="?v=$(date +%s)"
  curl -sI "$u$v" | grep -iE '^(content-length|cf-cache-status):'   # MISS, taille = wc -c locale
  curl -s "$u$v" | pdftotext - - | grep -cE '(\+33|\b0)[1-9]([ .-]?[0-9]{2}){4}'   # 0
  curl -sI "$u" | grep -iE '^(content-length|cf-cache-status|age):'   # URL nue : l'ancien tant que HIT
done
```

Repasser `curl -sI` sur l'URL nue après expiration du cache : `content-length` doit valoir la taille
locale. Tant que ce n'est pas le cas, le dire — ne pas annoncer « en ligne » sur la foi du MISS.

### 7. Rendre compte

Dire à l'utilisateur, sobrement :
- ce qui a été remonté et pourquoi ;
- ce qui a été coupé pour tenir la page ;
- **les exigences de l'annonce non couvertes par le pool** — c'est l'information la plus utile ;
- le résultat du gate (pages, mots-clés, ordre).

## Mettre à jour la source

Nouvelle expérience, nouveau projet, nouveau chiffre, nouveau diplôme : on modifie
`profil.{fr,en}.json` **et** `pool.fr.md`, avec la source du fait. On ne bricole jamais un PDF isolé —
il serait écrasé au rendu suivant et la prochaine adaptation repartirait de données périmées.
Une fois la source modifiée, régénérer le CV de base (FR + EN, étape 4) **et** sa variante web
publiée (étape 6), sinon le site sert un CV en retard.

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
- police à ligatures sur du contenu (`font-variant-ligatures:none` est déjà posé globalement) ;
- police **variable** pour le contenu : Chrome l'écrit en Type 3, que des parseurs lisent mal. Inter
  est embarquée en TTF statique (400 et 500, comme le site) — pas de `font-weight:700`, il serait
  synthétisé. `pdffonts` doit montrer Inter en `CID TrueType` ;
- capitales sur un libellé **au milieu du contenu** (« LANGUAGES — » dans les compétences) : il se lit
  comme un titre de rubrique. Les capitales sont réservées aux titres de rubrique — le gate les y
  cherche — et aux lignes de dates ;
- décor écrit en glyphe (`▸`, `●`) : il ressort dans le texte. Points et puces sont des
  pseudo-éléments vides, le logo un SVG — le parser n'en voit rien.
