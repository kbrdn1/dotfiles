---
name: codebase-visualizer
description: Transforme un dépôt en carte d'architecture isométrique interactive (HTML autonome, thème Claude Dark), publiée en artifact — blocs dimensionnés aux vraies LOC, arêtes dérivées du graphe d'imports mesuré, points de données animés, drill-down "go inside", trace pas-à-pas, mode diff entre deux révisions, plus un dossier technique mesuré (couches, cycles de dépendances, hubs, manifestes, chaîne d'outils, CI, binaires appelés). Déclencheurs — "visualise ce codebase", "carte isométrique du repo", "atlas du codebase", "diagramme visuel de l'architecture", "codebase atlas", /me:codebase-visualizer. Sert aussi à mettre à jour ou étendre une carte existante. Pas pour un schéma de mécanisme isolé dans une réponse en prose (SVG inline), pas pour du Mermaid, pas pour une maquette d'UI produit.
version: 2.2.0
allowed-tools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "Artifact", "SendUserFile"]
---

# Codebase Visualizer

Produit **une seule page HTML autonome** (aucune dépendance externe, CSP-safe) qui cartographie un
dépôt en **six vues du même relevé**, avec un rail de structure à gauche et un panneau
**WHAT IT DOES / HOW IT'S BUILT** à droite. Publiée en artifact.

| Vue | Ce qu'elle montre | Ce qu'elle sert |
|---|---|---|
| **Isometric** | la ville : blocs dimensionnés aux vraies LOC, points de données animés sur les arêtes | la forme du système, le chemin d'une requête |
| **Matrix** | la DSM (Dependency Structure Matrix) triée en couches | les cycles, en un coup d'œil : une marque sous la diagonale = un retour en arrière, une cellule violette = une dépendance mutuelle. C'est la vue qui **scale** quand le graphe devient illisible en boîtes-et-flèches (NDepend, IntelliJ, Lattix) |
| **Hotspots** | churn × taille en quatre quadrants | où l'effort part : CodeScene montre que les LOC valent la complexité cyclomatique comme proxy, et que croisées au churn elles pointent les cibles de refactoring |
| **Diagram** | le graphe en flowchart en couches et la trace en diagramme de séquence, **dessinés en SVG**, avec le source mermaid derrière un bouton | lire le flux principal, et remettre la carte dans une doc, une issue ou un prompt |
| **Architecture** | couches, **cycles de dépendances** (Tarjan), **patrons de structure détectés**, ce qui traverse chaque frontière, surfaces d'entrée, fondations, hubs | la lecture structurelle : un cycle à trois blocs ou plus n'apparaît dans **aucune** autre vue (la matrice ne montre que les paires) |
| **Stack** | tuiles de synthèse, langages, manifestes, dépendances **avec les blocs qui les importent**, deps non déclarées, binaires appelés, build, CI, tests, points d'entrée, **versions**, **issues et PR ouvertes** | avec quoi c'est construit, ce qui bouge en ce moment, et le lien entre une ligne de manifeste et un endroit du dessin |

La vue **Diagram** porte trois cartes : *Entre les sections* (un nœud par section du rail sur une
couronne, arêtes épaisses comme le nombre d'imports qui franchissent la frontière — le coup d'œil
que 78 arêtes de blocs ne donnent pas), *Dependency flow* avec une bascule **Chemin principal /
Graphe complet**, et la trace en diagramme de séquence.

Les deux dernières vues sont des **documents scrollables**, pas du SVG, et **n'ont aucune prose à
tenir à jour** : Architecture est entièrement recalculée depuis `EDGES` / `STRUCTURES`, Stack est
entièrement lue dans `STACK` (produit par le scanner). Elles ne peuvent donc pas diverger de la
carte. Chaque puce de bloc renvoie à l'isométrique, épinglée sur ce bloc.

Le **rail** et le **panneau** se redimensionnent à la souris (poignée entre les colonnes, flèches au
clavier, double-clic pour revenir au défaut) ; la largeur est retenue par viewer en `localStorage`.

La **légende** n'est pas figée : elle ne montre que ce que la vue courante dessine réellement — pas
de ligne « flux à l'exécution » dans un atlas sans arête `runtime`, pas de ligne « hauteur » dans la
matrice, et une ligne diff qui n'apparaît qu'en mode diff.

Deux bascules à droite de la barre de vues : **EN/FR** et **thème**. Le thème stampe `data-theme`
(la page est dark-first mais se lit dans les deux sens, et le mermaid se régénère avec la bonne
palette).

## Bilingue

Le DATA reste **en anglais** — c'est la source. Un objet `I18N.fr` le recouvre clé par clé, et
**toute clé absente retombe sur l'anglais** : une traduction partielle reste lisible au lieu de
casser la page. Ce qu'il couvre : `ui` (tout le chrome), `topbar` (le bandeau, valeurs comprises),
`groups`, `overviewWhat` / `overviewHow`, `blocks[id].what|how`, `blocks[id].children[i].what`,
`trace[i]`, `pay["f>t"]`, plus `kicker` / `title` / `sub`.

**Les noms de blocs et les codes ne se traduisent pas** — ce sont des identifiants du domaine
(`Worktree core`, `CRUDController`). On traduit le propos, pas le code.

Vérifier la couverture avant de publier, depuis la console de la page :

```js
STRUCTURES.filter(s => !I18N.fr.blocks[s.id]).map(s => s.id)        // blocs non traduits
EDGES.filter(e => !I18N.fr.pay[`${e.f}>${e.t}`]).map(e => e.f)      // arêtes non traduites
TRACE.length - Object.keys(I18N.fr.trace).length                    // étapes non traduites
```

⚠️ **Ne pas compter sur un moteur mermaid.** Le runtime de l'artifact ne transforme pas les
`<pre class="mermaid">` insérés par script — vérifié sur une page publiée : seul le source
s'affichait. Embarquer mermaid coûterait plusieurs mégaoctets pour deux diagrammes, et la CSP
interdit de le charger depuis un CDN.

Les deux diagrammes sont donc **dessinés en SVG par le moteur**, comme l'isométrique et la matrice :
un flowchart rangé en couches (rang = plus long chemin depuis une source, cycles coupés par la
profondeur max) et un diagramme de séquence pour la trace. Même palette, même pan/zoom, zéro
dépendance. Le **source mermaid reste généré** et vit derrière le bouton `Mermaid` — c'est le format
d'export, pas le moteur de rendu.

Les diagrammes sont **navigables** (molette, drag, `+ / − / Fit`, double-clic pour recadrer) via le
même `makePannable` que le reste.

⚠️ Les vues en surimpression (`#flow`, `#doc`) vivent **dans** `#stage` : sans garde, leur molette et
leurs clics déclenchent le zoom, l'épinglage et le `go inside` de la carte isométrique. Chaque
handler du stage sort tôt si `OVERLAY.has(state.view)` — une liste **d'appartenance**, pas une liste
d'exclusion, sinon chaque nouvelle vue rouvre le bug. Et une puce qui bascule elle-même vers l'iso
doit `stopPropagation()` : sinon le clic remonte au stage, qui le lit comme un clic dans le vide et
dépingle aussitôt ce qui vient d'être épinglé.

Origine : le skill `codebase-atlas` de [@fleetingbits](https://x.com/fleetingbits/status/2088016749849682120)
(13 août 2026). Son `references/atlas-template.html` (l'atlas "CordComputer") n'a jamais été publié —
le moteur ici est une reconstruction, re-thémée sur ma charte artifacts et outillée.

## Ce que le skill embarque

| Fichier | Rôle |
|---|---|
| `references/atlas-template.html` | Le moteur **et** un atlas complet (gwm-cli). On copie, on remplace la section DATA. |
| `scripts/atlas_scan.py` | Mesure le dépôt : LOC par module, graphe d'imports **avec provenance**, dossier technique (manifestes, CI, binaires appelés), stats, méta git. Sert aussi au rafraîchissement, au mode diff et au mode workspace. |
| `scripts/atlas_check.mjs` | Valide le DATA **et** confronte chaque arête au graphe mesuré. À lancer avant toute publication. |
| `icons/atlas.svg` | Favicon du `.html` local (un cube isométrique sur tuile tramée), déjà en data URI dans le template. Glyphe dans `GLYPHS` de `~/.claude/scripts/dither-tile.py` ; après `dither-tile.py` (sans argument), `dither-tile.py --inject atlas references/atlas-template.html`. |

## Charte

**Claude Dark**, la palette maison de tous mes artifacts :
`~/.claude/skills/visual-explainer/references/claude-dark-palette.md`. Le moteur définit déjà tous
les tokens (`--bg #1a1a1a`, `--surface`, `--accent #D4825D`…) sur `:root` en dark-first, avec les
overrides light pour `prefers-color-scheme` **et** `[data-theme]`. Ne pas improviser de couleurs :
si une teinte manque, la prendre dans la palette. Le rendu iso lit la charte via des rôles dérivés
(`--top`, `--hatch`, `--line`) — re-thémer revient à changer ces rôles, jamais des valeurs en dur.

## Étape 1 — mesurer (jamais deviner)

**Tout chiffre affiché doit venir d'une commande réellement lancée.** Le mode d'échec numéro un de
ce skill est un beau moteur posé sur des LOC imaginaires et des arêtes devinées.

```bash
python3 scripts/atlas_scan.py --root <repo> > scan.json
```

Le scan sort aussi le **churn** (`git log --numstat` sur 12 mois par défaut, `--churn "6 months"`
pour changer la fenêtre) : c'est ce qui alimente la vue hotspots. Attention au nom : le churn d'un
bloc somme les commits **par fichier**, donc un commit qui touche dix fichiers du même bloc compte
dix fois. L'atlas l'affiche comme `file-commits`, pas comme `commits`.

Le scanner détecte le langage dominant, indexe les modules (`git ls-files`), compte les lignes, et
sort le graphe d'imports **résolu vers le module le plus spécifique**. Quatre choses le distinguent
d'un `grep` naïf, et chacune vient d'un bug vécu :

- il sépare le **code** des **commentaires** — sur gwm-cli, 13 % du graphe brut venait de mentions
  dans des doc-comments, ce qui n'est pas une dépendance de compilation ;
- il résout `crate::`, `super::`, `self::`, `<nom_du_crate>::` **et** la forme groupée
  `use x::{a, b as c}` — sans ça on rate l'entrée du binaire et tout l'intérieur d'un dossier de
  modules ;
- en PHP il lit la **map PSR-4 de `composer.json`** : sans elle, `use App\Models\User` ne retrouve
  jamais `app/Models/User.php` et le graphe sort **vide** (vécu sur fp-api-rest : 0 arête, puis
  5 328) ;
- `src/tui/mod.rs` devient le module `tui`, `src/tui/ui.rs` devient `tui::ui` — la granularité d'un
  grep plat mélange les deux.

Le graphe ne couvre que le langage dominant, mais la table `files` du JSON couvre **tout le code** :
sur fp-api-rest, `tools/` cache 27 500 lignes de Go dans un dépôt PHP, et un décompte au seul
langage dominant les rendait invisibles. Vérifier `langs` dans la sortie avant d'écrire le bandeau.

Langages : Rust et PHP (complets), TS/JS, Python, Go (résolution par index de fichiers). Pour un
écosystème non couvert, ajouter une entrée dans `REF` / `COMMENT` plutôt que de bricoler à côté.

Compléter avec ce que le scanner ne devine pas : nombre de commandes (`<bin> --help`), presets,
routes, tout ce qui fait le bandeau. Et **lire les doc-comments de tête** de chaque module (`//!`,
docstring, JSDoc de fichier) : c'est de là que sortent les `what` / `how`, pas d'une paraphrase du
nom de fichier.

Cibler **15 à 35 sous-systèmes**. Au-delà de ~40 modules, regrouper plutôt que tout dessiner. Le
plafond se plie quand le dépôt le justifie — l'atlas de référence en compte 41 pour 167 modules
Rust, et 36 pour les 2 216 fichiers de fp-api-rest ; ce qui compte est la lisibilité du losange.

Sur un gros dépôt, **écrire un générateur** plutôt que 36 blocs à la main : une table
`id → (code, nom, groupe, cellule, préfixes)` et le script sort les `loc` / `files` / `fanIn` /
`fanOut` / `h` depuis le scan. C'est ce qui évite le double comptage — sur gwm-cli un bloc affichait
1 276 lignes pour 870 réelles, et seul `--inject` l'a vu.

> Si l'utilisateur demande explicitement de déléguer, un agent `Explore` "very thorough" peut faire
> la partie narrative. La mesure, elle, passe toujours par le scanner.

### Patrons de structure (vue Architecture)

Quatre détecteurs, tous calculés depuis `EDGES` / `STRUCTURES` — donc jamais périmés :

| Patron | Signal mesuré | Ce que ça dit |
|---|---|---|
| **Registre** | fan-out ≥ 8 **et** ≥ 40 sorties pour 1k lignes, **et** au moins un retour | un petit bloc importe ses propres feuilles, qui le réimportent |
| **Fondation partagée** | fan-in ≥ 20 et fan-out ≤ fan-in / 6 | tout en dépend, elle ne dépend presque de rien |
| **Carrefour** | fan-in **et** fan-out à 1,5× la médiane du dépôt | tout passe par là, donc tout casse ensemble |
| **Inversion de couche** | une arête qui remonte la profondeur ; à défaut, une arête du plus grand anneau qui change de groupe | la forme concrète d'un cycle |

Vérifié sur les deux dépôts fp : sur l'API le détecteur sort `contexts` (147 sorties pour 654
lignes, 225 pour 1k) et `exceptions` (486 entrées, 2 sorties) — exactement ce qu'un lecteur humain
aurait écrit, sans risque de dérive.

### Le dossier technique (`STACK`)

Une fois les blocs posés, générer le dossier qui alimente les vues Architecture et Stack :

```bash
python3 scripts/atlas_scan.py --root <repo> --stack-for atlas.html   # → const STACK = {…}
python3 scripts/atlas_scan.py --root <repo> --stack                  # le même en JSON brut
```

`--stack-for` **lit les `mod:[…]` de l'atlas** pour relier chaque dépendance aux blocs qui
l'importent réellement. C'est toute la différence avec un `cat Cargo.toml` : « qui s'en sert » n'est
écrit dans aucun manifeste. Coller le bloc obtenu dans la section DATA, avant le marqueur END.

Ce qu'il mesure, et pourquoi chaque point vient d'un piège :

- **Tous les manifestes, pas celui de la racine.** fp-api-rest a un `composer.json` **et** trois
  `go.mod`. Les deux pires bugs de ce scanner ont été « le langage dominant seulement » (PSR-4
  ignoré → 0 arête ; Go invisible → 27 500 lignes cachées). Un dossier technique qui n'affiche
  qu'un écosystème est pire que pas de dossier.
- **Le lien dépendance → blocs** passe par les imports (`use`, `from`, `require`). En PHP, la table
  namespace → paquet est lue dans `vendor/composer/installed.json` s'il est là : sans elle,
  `laravel/framework` ne se relie jamais à `Illuminate\…`. Le dossier `vendor/` n'étant pas commité,
  c'est **best-effort** — sans lui l'import reste un namespace, toujours juste, moins précis.
- **En Rust, le chemin qualifié compte aussi** : `toml::from_str` sans `use toml` ne se distingue
  d'un module interne que par sa présence dans les dépendances déclarées. D'où la lecture des
  manifestes **avant** le scan des fichiers.
- **Une dépendance sans bloc n'est pas un bug** : `predis`, `sentry` ou `thiserror` s'utilisent par
  configuration ou par macro, jamais par `use`. La colonne affiche « aucun import direct trouvé »,
  ce qui est l'information.
- **`undeclared`** liste l'inverse — importé par le code, absent de tous les manifestes, donc
  disponible seulement par transitivité. Sur fp : `nesbot/carbon`, `stripe/stripe-php`,
  `guzzlehttp/guzzle`. Un bump ailleurs peut casser le build.
- **`bins`** relève les `Command::new("…")` / `exec.Command` / `Process` : une dépendance
  d'exécution qu'aucun manifeste ne consigne, et souvent la plus structurante (gwm ne stocke aucun
  token parce qu'il shelle `gh`).
- **`changelog`** résume un fichier par version sous `changelogs/` : date, nombre d'entrées, poids
  de chaque rubrique. On ne recopie pas le changelog — git l'a déjà ; on montre la **cadence** et la
  **forme** d'une release.
- **`forge`** lit `gh` : issues et PR ouvertes, et surtout **le rattachement aux blocs**. Une PR est
  rattachée aux blocs où tombent les fichiers qu'elle modifie (`gh pr view --json files`, un appel
  par PR — c'est le point lent, `--no-gh` le coupe) ; une issue hérite des blocs de la PR qui la
  ferme. C'est ce qui distingue la section d'un `gh pr list` habillé, et ça alimente aussi la ligne
  « travail ouvert » du panneau d'un bloc.
- **`edgeSyms`** relève ce qui traverse chaque frontière entre deux blocs — les noms réellement
  importés, gratuits au moment où la résolution coupe déjà la référence au bon endroit. Vide dans
  un langage à une classe par fichier (PHP, Java) : le nom importé **est** le module, et la section
  disparaît d'elle-même.
- **Un workflow CI entièrement commenté** sort avec `off:1` plutôt qu'en CI qui tourne.

## Étape 2 — partir du moteur

Copier `references/atlas-template.html` dans le scratchpad de session, **garder le moteur**, ne
remplacer que la section entre `// ---- ATLAS DATA START ----` et `// ---- ATLAS DATA END ----` :

- `REPO` — nom, kicker, titre, sous-titre, `repoUrl` + `sha` (liens vers le code), `prevRev`,
  `hScale:"sqrt"` quand l'échelle linéaire écraserait tout (un bloc de 37k à côté d'un de 257).
  🔴 **`prevRev` = la dernière version majeure** (`git tag --sort=-v:refname | grep '\.0\.0$' | head -1`),
  pas la version précédente : comparer à `v1.5.0` quand on est en `v1.6.0` ne montre qu'un sprint,
  et le mode diff devient du bruit. **Absente, le bouton Diff se retire tout seul.**
- `STRUCTURES` — `id`, `code` 2 caractères (uniques), `name`, `group` (= sections du rail),
  `loc` (label), `locNow` / `locPrev` (mode diff), `commits` / `churn` (vue hotspots),
  `fanIn` / `fanOut` (**mesurés**, pas comptés sur le dessin), `mod:[…]` (chemins réels : **un
  fichier, ou un dossier avec un `/` final** quand le bloc agrège des centaines de fichiers, et
  **`!prefixe` pour exclure** un sous-dossier sorti dans son propre bloc — sans ça un bloc
  fourre-tout double-compte ses enfants), position `...at(i,j)`, empreinte `w,d`, hauteur `h` selon
  `hScale`, `what`, `how`, `children[]` pour la vue intérieure, `slab:true` pour le stockage.
- `EDGES` — `{f, t, flow:1}` pour le chemin principal (points animés), `pay` = ce qui circule, et
  surtout **`src`** :

  | `src` | Sens | Rendu |
  |---|---|---|
  | `import` | dépendance de compilation vue par le scanner | trait plein |
  | `runtime` | flux réel qui ne passe pas par un `use` (socket, git config, fichier) | tirets longs |
  | `design` | relation de conception (déclaration de sous-module, contrat, résolution faite par l'appelant) | pointillé |

  `mutual:1` marque une paire mutuellement dépendante — le moteur la colore en violet plutôt que de
  doubler le trait.
- `EXTERNALS` — étiquettes hors-carte (APIs, CLIs externes). `fit()` mesure la bbox réelle du
  contenu, **étiquettes comprises**, donc un external ne se fait plus couper : viser |dx| ≳ 170 pour
  qu'il sorte du losange, sans plafond haut.
- `PATTERNS` — **optionnel** : `{registry|foundation|crossroads|inversion: "une phrase"}`. Les
  schémas de la vue Architecture sont **détectés** ; cette clé n'ajoute que la phrase que le chiffre
  ne dit pas. Une clé absente = pas de note, le schéma se suffit. C'est la **seule** couche écrite à
  la main de cette vue — ne pas y remettre de la description, elle périmerait.
- `TRACE` — 10 à 14 étapes `[structId, phrase]` suivant **une requête canonique réelle**.
- `STACK` — le dossier technique, **jamais écrit à la main** : sortie de `--stack-for`. Un id de
  bloc inconnu dedans veut dire qu'il a été généré contre une autre version de l'atlas (le
  validateur le dit).
- Stats du bandeau, `OVERVIEW_WHAT`, `OVERVIEW_HOW`.

⚠️ Deux champs d'un bloc ne se lisent **jamais** avec un `?? 0` :

- `loc` d'une **dalle** est une étiquette, pas un nombre (« 3 keys », « .git/gwm »). Ancrer la fin du
  motif et sauter les dalles — sinon « 3 keys » se lit 3000 et « .git/gwm » sort `NaN` dans le total
  d'une couche.
- `fanIn` / `fanOut` sont **absents** des dalles et des pseudo-blocs (`tests`, `ci`) : `?? 0`
  transforme « jamais mesuré » en « personne ne l'importe », et la vue Architecture annonce alors un
  fichier de config ou une socket comme *surface d'entrée*. Vécu : **7 des 8 « entrées » de gwm et 8
  des 11 de fp** étaient des dalles. Gate sur `Number.isFinite(s.fanIn)`, comme le fait déjà
  `paint()` pour la ligne de portée.

### Règles de mise en page

- Projection iso : `x=(gx-gy)*26, y=(gx+gy)*16.5 - h*16`. Ne pas la redériver. ⚠️ Le rapport
  `KY/KX` fixe l'aspect du losange : à 14.3/26 (0.55) une grille carrée sort **1,8× plus large que
  haute**, alors qu'un stage 16:9 moins ses deux panneaux fait ~1,5 — le fit était donc toujours
  borné par la largeur et la ville rétrécissait sans qu'on comprenne pourquoi. 16.5/26 (~32°) reste
  isométrique à l'œil et remplit le cadre.
- `at(i,j)` pose les blocs sur une grille de cellules : empreintes disjointes par construction.
  L'ordre du peintre trie par `gx+gy`, aucun z-index nécessaire.
- 🔴 **Viser une grille carrée.** 7×5 produit un losange très large que le fit rétrécit ; 6×6 pour
  36 blocs, 6×5 pour 27, remplit le cadre. Compter les blocs, prendre la racine, arrondir.
- **Un groupe du rail = une bande contiguë** du losange (une ligne `j`, ou une ligne et le début de
  la suivante). Un groupe éparpillé dans le losange ne se lit pas comme un quartier.
- Zones : entrées sur la bande du haut (j=0), cœur applicatif juste en dessous, domaine et services
  au milieu, opérations et preuve en bas, dalles de stockage sur la dernière bande.
- ⚠️ **L'air ne vient pas d'un `CELL` plus grand.** La vue se recadre sur le contenu : écarter les
  blocs les rétrécit d'autant, gain net nul. L'air vient d'une **empreinte plus petite à pas de
  grille constant** — `CELL 3.2` avec `w`/`d` à **1.7** (2.0 pour les blocs qu'on veut lire de
  loin), pas 2.0–2.4.
- Le plus gros sous-système = le bloc le plus haut. Le stockage = des dalles plates.
- `EXTERNALS` : viser au-delà du bord du losange (|dx| ≳ 170). Depuis que `fit()` mesure la bbox
  réelle (étiquettes comprises), il n'y a plus de plafond haut — mais un external très éloigné
  élargit la bbox et rétrécit la ville, donc rester dans les ~250.
- **Ne pas générer le placement automatiquement.** Un tri topologique produit des couches, pas une
  ville ; le placement à la main est ce qui rend la carte lisible. Un petit script qui réécrit
  `...at(i,j), w:, d:` depuis une table id → cellule est en revanche la bonne façon de le refaire.

## Étape 3 — valider

```bash
node scripts/atlas_check.mjs atlas.html --scan scan.json
```

Sort 1 sur erreur. Il vérifie l'identité (ids et codes uniques, champs présents), la géométrie
(**empreintes qui se chevauchent**), le graphe (cibles existantes, doublons, provenance déclarée),
la trace, les externals, la cohérence hauteur/LOC (selon `hScale`), et la structure de la page :
`<script>` fermé (un script non fermé n'est **jamais** exécuté par le parser), `<meta charset>`
présent (sinon mojibake dès que la page est servie en HTTP), aucune ressource externe (bloquée par
la CSP de l'artifact), et **tout `getElementById` a son `id` dans le HTML** (retirer un bouton du
bandeau sans toucher au script casse toute la page, sans erreur visible).

Avec `--scan`, il **confronte chaque arête au graphe mesuré** : une arête déclarée `import` qui
n'existe pas dans le code est une erreur, une arête `design` qui masque un import réel est un
avertissement, et il compte les paires mutuelles mesurées qu'aucune arête ne montre.

Il vérifie aussi le `STACK` : présence (sinon les deux dernières vues sont vides), manifestes non
vides, et **tout id de bloc cité y existe** — un `STACK` généré contre une version antérieure de
l'atlas se voit là, pas à l'écran.

## Étape 4 — vérifier en headless

Le moteur expose des hooks de debug par hash : `#view=<iso|matrix|hotspots|flow|arch|stack>`,
`#s=<id>`, `#inside=<id>`, `#trace=<n>`. **Capturer les six vues**, pas seulement l'isométrique.
**Le MCP playwright refuse `file:`** — servir le fichier :

```bash
cd <scratchpad> && (python3 -m http.server 8787 >/dev/null 2>&1 &)
```

Capturer en 1800×1000 au minimum : vue par défaut, un `#inside=`, un `#trace=`, le mode diff. Un
`?v=N` dans l'URL force le rechargement (un changement de hash seul ne relance pas le script).
Vérifier **dark et light** — `document.documentElement.dataset.theme='dark'` via `browser_evaluate`,
le runner étant en light par défaut. Et vérifier le rendu sous 980 px (le rail se masque, le
panneau passe sous le canvas).

À chercher : étiquettes qui se chevauchent, externals coupés, blocs orphelins, arêtes qui tranchent
un cluster, accents illisibles dans un des deux thèmes, **boutons qui s'empilent** (piège de
spécificité : `#top .cell` bat `#acts`), et sur les vues documentaires un `NaN` ou une section vide
là où une section devrait disparaître.

Vérifier aussi la **navigation** : cliquer une puce d'Architecture ou de Stack doit basculer sur
l'isométrique **et laisser le bloc épinglé** (`state.pin`, `location.hash`). Épinglé puis dépinglé
dans le même clic est le symptôme du `stopPropagation()` manquant.

## Étape 5 — share-safety (toujours)

L'atlas peut sortir de l'entreprise. Garder la structure du code (noms de modules, LOC, stack) ;
purger tout ce qui décrit l'infra vivante : noms concrets de services/queues cloud, chemins
d'endpoints publics, préfixes ou formats de clés, emplacement des credentials, IDs de projet.
Grep final sur le préfixe cloud de la boîte, `@`, `secret`, `token`, les chemins de montage.

🔴 **Les titres d'issues ouvertes sont le nouveau point sensible.** Depuis que `STACK.forge` existe,
un atlas ne publie plus seulement de la structure : il publie *la liste des bugs non corrigés*, avec
leurs titres. Vu en vrai sur fp-front — une issue ouverte y décrit une session qui n'est jamais
invalidée. Sortir un atlas de l'entreprise avec cette section, c'est publier une surface d'attaque
datée. **Décider avant de partager** : `--no-gh` coupe la section, ou on la garde en assumant que
l'artifact reste privé. Le dire à l'utilisateur, la décision est la sienne.

⚠️ **Passer le grep sur le bloc `STACK` aussi**, pas seulement sur le DATA écrit à la main : il est
généré, donc il publie du texte que personne n'a relu — cibles de Makefile, noms de workflows et de
jobs, points d'entrée, binaires appelés, et désormais titres d'issues et de PR. Sur fp ça sort `aws-sso-login`, `ecr-login`,
`aws-profile-project` : c'est de la **stack** (« ce projet déploie sur ECR via AWS SSO »), pas une
identité d'infra — ni compte, ni ARN, ni registre, ni endpoint — donc ça reste. Le dire à
l'utilisateur avant de partager, la décision est la sienne. Un faux positif classique : le job de CI
nommé `secret-scan`.
⚠️ `REPO.codeUrl` pointe vers le dépôt : sur un repo privé, les liens ne servent qu'à ceux qui y ont
accès — les laisser est sans risque, mais le dire.

## Publication

`Artifact` : favicon 🗺️ **stable** entre les republications, `<title>` court et distinctif
(`"<repo> Atlas"`). Redéployer = republier **le même chemin de fichier**. Envoyer aussi le `.html`
avec `SendUserFile`.

## Garder l'atlas vivant

```bash
python3 scripts/atlas_scan.py --root <repo> --inject atlas.html                 # rafraîchit les LOC
python3 scripts/atlas_scan.py --root <repo> --inject atlas.html --diff v1.0.0   # + le mode diff
python3 scripts/atlas_scan.py --root <repo> --stack-for atlas.html              # regénère STACK
```

L'injection réécrit `loc` / `locNow` / `locPrev` de chaque bloc à partir des chemins déclarés dans
`mod:[…]` et **ne touche jamais** la couche jugée (`what`, `how`, layout). C'est ce qui empêche
l'atlas de pourrir : la mesure se recalcule, le jugement se réécrit à la main.

`STACK` se regénère de la même façon — il se remplace en bloc, jamais à la main. Le refaire à chaque
changement de dépendance ou de `mod:[…]`, sinon les vues Architecture et Stack décrivent un état
antérieur du dépôt. Il porte aussi les issues/PR ouvertes : **il périme en quelques jours**, pas en
quelques mois.

🔴 **Après un `--inject`, rapatrier les chiffres dans le fichier DATA source.** L'injection écrit
dans le **HTML construit** ; si l'atlas est assemblé depuis des fichiers DATA séparés, le prochain
build réécrit silencieusement `loc`/`locNow`/`locPrev`/`churn`/`commits` avec les valeurs tapées à
la main — sans erreur, et le validateur passe dans les deux cas. C'est le seul mode d'échec de ce
skill qui ne se voit nulle part. Un petit script qui relit les lignes `{ id:"…"` du HTML et
réinjecte ces clés dans le source suffit ; le faire **avant** toute autre édition.

`--workspace <dir>` sort un résumé par dépôt sous une racine — la base pour une carte multi-repo
(un bloc par repo, taille = LOC).

## Section optionnelle — « Opportunités d'approfondissement »

L'atlas **décrit** un système. Il ne dit pas où il fait mal. Cette section, à ajouter dans la vue
**Architecture** quand l'utilisateur la demande (elle n'est pas générée par défaut), propose des
**approfondissements** : des refactos qui transforment un module **peu profond** en module profond.
Elle se calcule **entièrement depuis les mesures déjà collectées** — aucune passe supplémentaire.

### Le vocabulaire, tenu

Six mots, employés exactement, sans dériver vers « composant », « service », « API » ou « couche » :
**module** (une unité qui cache une décision) · **interface** (ce qu'il expose) · **profondeur**
(rapport entre ce qu'il fait et ce qu'il expose) · **seam** (la frontière où on l'observe sans entrer)
· **adaptateur** · **localité** (la propriété d'avoir sous les yeux tout ce qui décide d'un comportement).

### Le signal, mesuré

Un module est **peu profond** quand son interface est presque aussi complexe que son implémentation.
Le scanner a déjà les deux chiffres : symboles exportés et LOC. Un bloc à 40 exports pour 200 lignes
est suspect ; un bloc à 3 exports pour 900 lignes est profond, et c'est ce qu'on veut.

🔴 **Le test de suppression, qui tranche.** Pour tout bloc suspect : *si je supprimais ce module et
recollais ses appelants directement à ce qu'il enveloppe, la complexité se **concentrerait**-elle
quelque part, ou se **déplacerait**-elle simplement ?* « Elle se concentre » = vrai candidat.
« Elle se déplace » = le module ne fait rien, ou il fait déjà son travail. C'est le seul filtre qui
sépare une vraie opportunité d'un ressenti esthétique — l'appliquer **avant** d'écrire une carte.

### Le périmètre, borné par le churn

**YAGNI d'abord.** Approfondir un module ne paie que sur ses changements **futurs** — donc on regarde
d'abord ce qui a **récemment bougé**. La vue **Hotspots** (churn × taille) porte déjà le chiffre :
s'en servir pour **cadrer le scan**, pas seulement pour l'afficher. Un module parfaitement stable
depuis deux ans n'est pas un candidat, même s'il est peu profond.

### La carte

Une carte par candidat, dans le style de la page (pas de CDN, pas de Tailwind, SVG inline, thème
Claude Dark) : **blocs concernés** · **friction** (une phrase, ce qui fait mal) · **approfondissement**
(une phrase, ce qui change) · **avant / après** (deux petits schémas côte à côte — c'est la pièce
centrale) · **gains** en termes de localité et de surface de test, puces de ≤ 6 mots · **force de
recommandation** en badge : `Fort` · `À explorer` · `Spéculatif`.

> **Si un schéma a besoin d'un paragraphe pour être compris, redessiner le schéma.**

Terminer par **une** recommandation en tête, avec la raison du classement.

### Ce que la section ne fait pas

- **Elle ne propose pas d'interface.** Elle nomme la friction et l'approfondissement, elle s'arrête là.
  Dessiner l'interface est une conversation, pas une sortie de générateur.
- **Elle ne re-litige pas ce qui est tranché.** Si un candidat contredit une décision déjà enregistrée
  (`docs/adr/`, une note `decisions/` du vault), ne le sortir que si la friction est réelle — et le
  marquer comme tel (« contredit ADR-0007, mais vaut d'être rouvert parce que… »). Pas de liste
  exhaustive des refactos que les décisions passées interdisent.
- **Elle n'invente pas de vocabulaire.** Si le `CLAUDE.md` du repo a une section **Langage**, les
  blocs se nomment avec **ses** termes : « le module d'admission des Commandes », pas
  « le OrderIntakeHandler », pas « le service Order ».

## Vérifier après coup

En plus des six vues, contrôler :

- la **légende** change bien avec la vue (elle est conditionnée à ce qui est dessiné) ;
- les **poignées** de redimensionnement : glisser, double-cliquer pour réinitialiser, flèches au
  clavier ; la largeur doit survivre à un rechargement ;
- la vue **Diagram** : trois cartes, et la bascule *Chemin principal / Graphe complet* qui redessine ;
- la vue **Architecture** : les schémas de patrons sortent des blocs attendus, et aucune boîte n'en
  chevauche une autre (la géométrie s'adapte au nombre de boîtes) ;
- la vue **Stack** : les tuiles en tête, les barres de version, et les liens d'issues/PR lisibles
  dans les deux thèmes.

Mesurer plutôt que juger à l'œil quand c'est possible — la console de la page expose `patterns()`,
`contentBBox()` et `state.s`, ce qui répond à « pourquoi le zoom tombe » en un appel.

## Ce que ce skill ne fait pas

- D'autres modes de rendu (force-directed, Mermaid, C4) — `visual-explainer diagram` et
  `excalidraw-diagram` couvrent ça, celui-ci a un seul métier.
- Du build ou un serveur : une page, un fichier, zéro dépendance. C'est la moitié de sa valeur.
