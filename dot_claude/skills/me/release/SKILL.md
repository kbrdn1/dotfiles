---
name: me:release
description: "Publier une version : migration du changelog vers changelogs/<version>.md, bump des fichiers de version, merge dev → main, tag APRÈS le merge, release GitHub (CI sur tag ou gh release create), propagation post-release. Protocole générique, extrait du /release de bijouterie-julian et du flow réel de gwm-cli. À utiliser dès qu'il s'agit de sortir/publier une version, taguer, faire une release, propager dev vers main, ou préparer un changelog de release. Remplace l'ancien /generate-changelog. Triggers: /me:release, release, publier une version, sortir une version, cut a release, tag, bump version, propager dev main, changelog de release."
---

# Release — protocole générique

Publie une version du repo courant. Étape 1 (rédaction du changelog) = la commande **`/changelog`** du projet (générée par [[me:changelog-create]]) ; ce skill couvre **tout ce qui vient après**.

Argument `$ARGUMENTS` = la version (`1.5.0`, `v1.5.0`) ou `patch` / `minor` / `major`.
- Version explicite → normaliser (fichiers de version sans `v`, tag avec `v`).
- `patch|minor|major` → incrémenter depuis la **dernière version publiée** (`gh release list --limit 1`, recoupée avec le fichier de version).
- Rien → déduire de `## [Unreleased]` (feature → minor, correctifs seuls → patch), **annoncer la version retenue et sa justification avant d'agir**.

## ⛔ La contrainte qui dicte tout l'ordre

Un commit naît **toujours** sur `dev`, puis remonte :

```
feature ──► dev ──► main ──► (preprod ──► prod)
```

**Jamais l'inverse.** Le bump de version et la migration du changelog **sont des commits** : ils se préparent sur `dev`, pas sur `main`. Et le **tag vient APRÈS le merge sur `main`** — il doit pointer le commit qui porte déjà le bump et le changelog de la version, sinon la publication n'est pas reproductible depuis le tag.

## Étape 0 — Pré-vol

1. **Un `/release` propre au repo existe** (`.claude/commands/release.md`) ? → **il fait foi**, applique-le, arrête-toi ici. Ce skill n'est que le défaut. (Réf : `bijouterie-julian`.)
2. `git status` clean, `dev` synchro avec `origin` — sinon **stop et demande**.
3. `## [Unreleased]` non vide — sinon **stop et demande**.
4. Relever les **knobs du repo** (table ci-dessous) et les afficher en une ligne avant d'agir.

### Knobs à détecter (rien n'est universel)

| Knob | Où le lire | `gwm-cli` | `bijouterie-julian` |
|---|---|---|---|
| Fichier(s) de version | `Cargo.toml`, `package.json`, `config/version.php`, `pyproject.toml`… | `Cargo.toml` + `Cargo.lock` | `config/version.php` (vérité) + `package.json` (aligné) |
| Nom du fichier de version | `ls changelogs/` | `changelogs/X.Y.Z.md` (sans `v`) | `changelogs/vX.Y.Z.md` |
| Branches | `git branch -r`, `.gwm.toml` | `dev` → `main` | `jewely/dev` → `jewely/main` |
| `main` protégée | `gh api repos/<o>/<r>/branches/<main>/protection` | **oui** → merge par PR | non |
| Qui publie la release | `.github/workflows/*` sur tag `v*` | **la CI** (`release.yml`, `--notes-file changelogs/X.Y.Z.md`) | **manuel** (`gh release create`) |
| Gate de vérif | `Makefile`, `justfile`, CI | `cargo test` + CI | `make build` + tests **via Docker** (CI désactivée) |
| Post-release | — | homebrew-tap / scoop (CI), sync docs+ROADMAP | propagation preprod, Project board |

⚠️ Se tromper sur « qui publie » **double-publie** ou ne publie rien. Vérifier le workflow avant de taper `gh release create`.

## Étape 1 — Préparer sur `dev`

```bash
git checkout <dev> && git pull --ff-only origin <dev>
```

1. **Changelog** : `/changelog <version>` s'il existe (il fait `extract → rédaction → split`). Sinon migrer à la main : `## [Unreleased]` → `changelogs/<version>.md`, au **format déjà présent dans le repo** (heading, langue, préfixe `v` ou non).
2. Vider l'`[Unreleased]` racine et ajouter la ligne sous `## Past releases`.
3. **Bumper les fichiers de version** relevés à l'étape 0 — tous, y compris les lockfiles (`cargo build` / `npm i` régénèrent `Cargo.lock` / `package-lock.json`). Un `package.json` figé pendant que la plateforme avance est un bug historique réel.
4. Sync doc si le repo le fait (README, ROADMAP, docs d'install qui citent la version) — **commit séparé**.
5. Commit : `🔖 chore(release): v<version>` (le commit de release ne touche que changelog + fichiers de version).

## Étape 2 — Vérifier (gate)

Lance le gate réel du repo et **affiche la sortie**, pas un résumé :

```bash
<make test | cargo test | make test-light>
<make build | cargo build --release>
git diff | grep -iE "(password|secret|key|token)" | grep -v test   # doit être vide
```

Si la CI du repo est désactivée ou ne couvre pas ça, ces vérifs sont le **seul filet** — ne pas les sauter, ne pas les maquiller.

## Étape 3 — Propager `dev` → `main`

```bash
git push origin <dev>
```

- **`main` non protégée** : merge commit, jamais un ff (`main` n'est jamais ancêtre de `dev`).
  ```bash
  git checkout <main> && git pull --ff-only origin <main>
  git merge origin/<dev>
  git push origin <main>
  ```
- **`main` protégée** (PR + status checks requis) : passer par une **PR** `dev → main`, attendre les checks **verts**, merger en **merge commit**. Avec `enforce_admins`, `git push origin main` est rejeté — il n'y a aucun plan B en urgence.

## Étape 4 — Tag + release, depuis `main`, APRÈS le merge

```bash
git checkout <main> && git pull --ff-only origin <main>
git tag -a v<version> -m "v<version>"
git push origin v<version>
```

Puis, **selon le knob « qui publie »** :
- **CI sur tag** (`gwm-cli`) : le push du tag déclenche `release.yml` qui build les artefacts et crée la release avec `--notes-file changelogs/<version>.md`. **Ne rien créer à la main.** Surveiller le run (`gh run watch`) et vérifier la release produite.
- **Manuel** (`bijouterie-julian`) :
  ```bash
  gh release create v<version> --target <main> \
    --title "v<version>" --notes-file changelogs/<version>.md
  ```

Titre = **`vX.Y.Z` seul**, sans texte additif. Le descriptif vit dans le fichier de version.

## Étape 5 — Post-release

Selon le repo : propagation vers les branches preprod (une à la fois, `main` toujours source), package managers, board de projet, annonce. **Le push git ne déploie rien** tant que le pipeline de déploiement du projet n'a pas tourné — ne pas annoncer une version « en prod » avant.

## Garde-fous

- ⛔ **Tag après le merge sur `main`**, jamais avant.
- ⛔ Jamais de merge `main`/preprod/prod → `dev`. Direction unique.
- ⛔ Jamais de `--force` / `rebase` sur `main` ou une branche de prod.
- ⛔ Titre de release avec du texte en plus de `vX.Y.Z`.
- ⛔ Ne pas publier une release à la main si un workflow le fait sur le tag (et inversement).
- ⚠️ La release GitHub est un **snapshot** : corriger `changelogs/<version>.md` après coup ne la met pas à jour → `gh release edit v<version> --notes-file changelogs/<version>.md`.
- ⚠️ **Rien d'invérifié dans la note de release** : compter et grep contre le **code**, pas contre `CLAUDE.md` (vu faux de plus du double sur un compte de tests). Marquer `(à vérifier)` plutôt qu'affirmer.
- ⚠️ Ne pas considérer une issue livrée parce qu'une PR mentionne son numéro — vérifier que le code est réellement sur `main`.

## Récap attendu

| Étape | À afficher |
|:--|:--|
| 0 | Version retenue + justification + knobs détectés (1 ligne) |
| 1 | Fichiers bumpés + commit de préparation |
| 2 | **Sortie réelle** des tests et du build |
| 3 | `main` mergé + poussé (ou URL de la PR + checks) |
| 4 | Tag poussé + URL de la release (et qui l'a créée) |
| 5 | Propagations faites, et celles volontairement laissées de côté |

## Liens

Étape 1 = [[me:changelog-create]] / `/changelog` du projet. Workflow global : `~/.claude/WORKFLOW.md`. Bootstrap projet : [[me:setup]].
