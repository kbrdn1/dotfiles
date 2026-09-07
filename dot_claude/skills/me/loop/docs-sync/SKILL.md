---
name: me:loop:docs-sync
description: Loop auto-cadencé — détecte la dérive entre la surface publique du projet (CLI, API, config) et sa documentation, met les docs à jour, et reboucle jusqu'à zéro écart, max 6 itérations. Le check_command est PAR PROJET (exemple travaillé fourni pour gwm-cli / clap). Déclencheurs : "/me:loop:docs-sync", "lance le loop docs-sync", "synchronise les docs avec le code", "docs drift".
---

# me:loop:docs-sync

Loop auto-cadencé. **mode:** closed · **trigger:** self-pace · **exécution:** single · **hardened:** true (bloc anti-triche de `me:run-loop`).

## 🔴 Ce loop n'a pas de `check_command` générique — et c'est assumé

« Les docs sont à jour » n'est pas observable dans une sortie shell **en général**. Ça le devient dès qu'on remplace la question vague par une question étroite et mécanique :

> **toute entrée de la surface publique apparaît-elle dans la doc ?**

Cette question a une réponse chiffrée **quand la surface publique est énumérable par une commande**. C'est le cas d'un CLI (`--help`), d'un schéma OpenAPI, d'une liste de routes (`php artisan route:list`), d'un fichier de config à clés connues. Ça ne l'est pas d'une prose d'architecture.

Donc : **`check_command` est un champ à remplir par projet.** L'exemple gwm-cli ci-dessous est complet et testé ; ce n'est pas un défaut à appliquer ailleurs. Un projet dont la surface n'est pas énumérable **n'est pas candidat à ce loop** — une passe de `me:rgaa`-style, ponctuelle, y vaut mieux qu'une boucle sans gate.

⛔ **Ne pas construire le gate sur les « Knowledge Gaps » de graphify.** Mesuré sur `fp-api-rest` : 4242 des 4599 nœuds isolés sont du bruit AST (`.setUp()`, `.__construct()`, dépendances Composer), et le lot restant est encore pollué (`robots.txt`, templates d'issue, entrées de changelog). Le rapport en compte 843 là où le calcul en donne 4599 — la définition diffère. C'est un mauvais gate. graphify sert ici à la **Discovery**, pas à la vérification.

## Définition

- **goal** : zéro écart entre la surface publique énumérable et la documentation.
- **max_iterations** : 6
- **exit_when** : `DOCS_MISSING=0` **et** `CLI_SURFACE` > 0.
- **check_command** : par projet. Exemple gwm-cli ci-dessous.

### Un seul sens marche. L'autre a été essayé, mesuré, et retiré.

**Sens 1 — non documenté** (surface → docs) : chaque sous-commande et chaque flag de `--help` doit apparaître dans les docs. **Fiable** : mesuré sur gwm-cli, 216 entrées de surface (41 sous-commandes + 175 flags), `DOCS_MISSING=0`, zéro faux positif.

**Sens 2 — documenté mais mort** (docs → surface) : **retiré.** Trois variantes essayées, toutes bruitées :

| variante | faux positifs sur gwm-cli | pourquoi |
|---|---|---|
| `gwm <mot>` cité dans les docs | ~15+ | remonte de la prose anglaise : `gwm can`, `gwm and`, `gwm does`, `gwm from` |
| tout token `--flag` des docs | 25 | attrape les flags des **autres** outils cités en exemple : `--prefer-dist` (composer), `--network` (docker), `--no-sandbox` (chrome), `--set-upstream-to` (git) |
| `--flag` sur une ligne mentionnant `gwm` | 12 | mieux, toujours faux : flags d'outils voisins sur la même ligne, plus des tokens charcutés par les tableaux markdown (`--limit-n---all`, `--p--split---direction-dir`) |

Un gate qui rapporte 12 écarts fantômes à chaque passe n'est pas un gate : il ne tombe jamais à zéro, donc `exit_when` n'est jamais atteinte, et on apprend à ignorer sa sortie. **Mieux vaut un check qui mesure une seule chose correctement que deux dont l'une ment.** Le flag mort se détecte à la review, pas ici.

### La garde anti-faux-propre, ici

Si le binaire n'est pas construit, pas dans le `PATH`, ou lancé depuis le mauvais dossier, `--help` ne rend rien, les greps ne trouvent rien et le verdict sort **`DOCS_MISSING=0`** — le faux-vert parfait. D'où `CLI_SURFACE` : le nombre d'entrées réellement extraites. Zéro entrée ⇒ pas un verdict.

```bash
# ── EXEMPLE TRAVAILLÉ : gwm-cli (Rust + clap). À adapter par projet. ──
set -o pipefail
BIN=${DOCS_SYNC_BIN:-gwm}
command -v "$BIN" >/dev/null || { echo "❌ '$BIN' introuvable dans le PATH — construire/installer d'abord"; exit 2; }

W=$(mktemp -d); trap 'rm -rf "$W"' EXIT

# 🔴 PIÈGE : NE JAMAIS écrire `printf '%s' "$VAR" | grep -q …` ici.
# `grep -q` sort au PREMIER match et ferme le pipe → `printf` prend un SIGPIPE (141)
# → avec `set -o pipefail`, le pipeline échoue ALORS QUE LE MOTIF A ÉTÉ TROUVÉ.
# Le check rapportait ainsi 216 écarts inexistants, dont « --help absent de --help ».
# On matérialise donc les corpus en FICHIERS et on grep les fichiers (pas de pipe,
# pas de SIGPIPE — et c'est plus rapide sur ~200 recherches dans 230 Ko).
"$BIN" --help > "$W/help.txt" 2>&1 || { echo "❌ '$BIN --help' a échoué"; exit 2; }
sed -n '/^Commands:/,/^$/p' "$W/help.txt" | sed -n 's/^  \([a-z][a-z-]*\) .*/\1/p' | sort -u > "$W/cmds.txt"
cat docs/3.cli/*.md docs/4.configuration/*.md docs/index.md README.md > "$W/docs.txt" 2>/dev/null

# (1) GARDE : la surface a-t-elle vraiment été extraite ?
SURFACE=$(grep -c . "$W/cmds.txt" || true)
if [ "${SURFACE:-0}" -eq 0 ] || [ ! -s "$W/docs.txt" ]; then
  echo "CLI_SURFACE=0"
  echo "❌ surface CLI vide ou docs illisibles — ce n'est PAS zéro écart, c'est zéro mesure"
  exit 2
fi

# (2) SENS 1 : sous-commandes et flags absents des docs.
MISS=0; : > "$W/miss.txt"
while read -r c; do
  [ -z "$c" ] && continue
  grep -qE "gwm $c\b|\`$c\`" "$W/docs.txt" || { echo "- sous-commande \`$c\`" >> "$W/miss.txt"; MISS=$((MISS+1)); }
done < "$W/cmds.txt"

# Toutes les sorties d'aide, une fois, pour les deux sens.
cp "$W/help.txt" "$W/allhelp.txt"
: > "$W/flags.txt"
while read -r c; do
  [ -z "$c" ] && continue
  "$BIN" "$c" --help >> "$W/allhelp.txt" 2>/dev/null
  "$BIN" "$c" --help 2>/dev/null | grep -oE '^[[:space:]]+--[a-z][a-z-]+' | tr -d ' ' | sort -u \
    | sed "s|^|$c |" >> "$W/flags.txt"
done < "$W/cmds.txt"

FLAGS_TOTAL=$(grep -c . "$W/flags.txt" || true); FLAGS_TOTAL=${FLAGS_TOTAL:-0}
while read -r c f; do
  [ -z "$f" ] && continue
  grep -qF -- "$f" "$W/docs.txt" || { echo "- flag \`$f\` ($BIN $c)" >> "$W/miss.txt"; MISS=$((MISS+1)); }
done < "$W/flags.txt"

# (3) Pas de « sens 2 » : la détection des flags morts a été mesurée non fiable (cf. tableau ci-dessus).

echo "CLI_SURFACE=$((SURFACE + FLAGS_TOTAL))"
echo "=== undocumented ==="; [ "$MISS" -eq 0 ] && echo "(none)" || cat "$W/miss.txt"
echo "DOCS_MISSING=$MISS"
```

**Autres surfaces énumérables**, si tu adaptes à un autre repo :

| projet | surface | commande |
|---|---|---|
| CLI Rust/Go (clap, cobra) | sous-commandes + flags | `<bin> --help`, `<bin> <cmd> --help` |
| API Laravel | routes | `php artisan route:list --json` |
| API avec OpenAPI | opérations | `jq '.paths \| keys[]' openapi.json` |
| lib TS publiée | exports publics | `jq '.exports' package.json`, ou l'API extractor du projet |
| config à clés | clés reconnues | le parseur de config du projet, ou son schéma |

## Cycle

- **Discovery** :
  1. **graphify pour trouver les docs impactées.** C'est ici que graphify sert, et seulement ici. Depuis la **racine du repo** (jamais un worktree) : le graphe existe → `graphify update .` (gratuit) ; sinon `graphify extract . --code-only` (AST local, 0 token, 0 clé). Puis interroger `graphify-out/graph.json` pour remonter, depuis les fichiers du diff, les nœuds `file_type: document` qui leur sont reliés. Ça répond à « quelles docs parlent de ce que je viens de changer », ce qu'un grep à l'aveugle ne sait pas faire.
  2. **Le diff** — `git diff --name-only origin/<base>...HEAD` borne le périmètre. Le loop porte sur ce que la PR change, pas sur l'audit de toute la doc.
- **Planning** : séparer les deux natures d'écart. Un **flag non documenté** est une ligne à ajouter dans la référence. Un flag **absent des docs** peut aussi révéler l'inverse de ce qu'on croit : il vient d'apparaître par accident (option de debug oubliée). Vérifier `git log -S '--le-flag'` avant de le documenter — documenter une option qui n'aurait pas dû sortir la rend publique.
- **Execution** :
  Step 1: lancer le `check_command`, lire `CLI_SURFACE`, le bloc `undocumented` et `DOCS_MISSING`.
  Step 2: mettre à jour la doc — dans la **langue et le format du fichier touché** (gwm-cli a `docs/fr/`, il ne faut pas y écrire en anglais), en épousant la structure existante. Commit atomique Gitmoji + Conventional référençant l'issue.
- **Verification** : relancer le `check_command`.
- **Iteration** : reboucler ; sinon stop/handback.

## Protocole self-pace (compteur à 1)

0. Lire les guardrails (`git rev-parse --path-format=absolute --git-path loop-guardrails.md`).
1. Exécuter les steps.
2. Lancer le `check_command` et **LIRE sa sortie réelle**.
3. `DOCS_MISSING=0` **et** `CLI_SURFACE` > 0 → **STOP**, annoncer le succès en citant les deux.
4. Sinon incrémenter. Si compteur ≥ 6 → **STOP**, annoncer la limite + les écarts qui résistent.
5. Même écart qu'une passe antérieure → appender un sign aux guardrails.
6. Sinon recommencer.

Status : `🔁 Itération N/6 — <docs mises à jour> → check: DOCS_MISSING=<n> (surface <n>)`.

## Garde-fous

- 🔴 Bloc anti-triche `hardened`, avec la déclinaison qui mord ici : **ne jamais élargir la liste des fichiers de docs grepés, ni assouplir le motif de recherche, pour faire tomber `DOCS_MISSING` à zéro.** C'est le cas 1 du bloc (« modifier le check pour forcer un succès »), et c'est tentant parce que ça se déguise en « le fichier X compte aussi comme de la doc ». Si le périmètre de docs est vraiment faux, on le corrige **une fois, explicitement, en le disant** — pas au milieu d'une itération qui n'avance pas.
- 🔴 **Ne jamais documenter un flag pour le faire passer sans avoir vérifié ce qu'il fait.** Une ligne de doc inventée est pire que l'absence : elle est fausse et elle a l'air vraie. Lire l'implémentation avant d'écrire.
- 🔴 **`CLI_SURFACE=0` n'est jamais un succès.**
- 🟡 `graphify` : toujours depuis la racine du repo, jamais depuis `worktrees/`. Un run long se lance détaché (`nohup … & disown`), sinon il meurt avec la session.
