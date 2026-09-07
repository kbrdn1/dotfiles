---
name: me:changelog-create
description: "Méta-skill : génère un /changelog adapté à un projet (façon me:skill-create), basé sur le CLI changelog-generator, avec verbosité configurable gravée à la génération (+ override flags). Range dans changelogs/. Triggers: /me:changelog-create, créer un changelog par projet, générer la commande changelog du projet."
---

# Méta-skill : générateur de `/changelog` par projet

Tu génères une commande **`/changelog` propre au projet courant**, taillée sur son format de CHANGELOG, ses branches et ses options de verbosité. Elle s'appuie sur le CLI Go existant `~/.claude/skills/changelog-generator/bin/changelog-generator` (extract / split / metrics) pour la mécanique, et sur Claude pour la **rédaction** selon la verbosité choisie.

Args : `init` (créer) | `update` (faire évoluer une `/changelog` existante).

## Modèle (rappel de l'existant)
- Pipeline : `extract` (git log base..compare) → **rédaction** (Claude, selon verbosité) → `split` vers `changelogs/` → `metrics` (optionnel, jours ouvrés FR).
- `changelogs/vX.Y.Z.md` (un fichier par version) ; pré-releases dans `changelogs/pre-releases/` ; format client dans `changelogs/client/`.
- Config projet : `changelog.config.json` (country, course_weeks, branches.default_base/compare, output.dir/pre_release_dir/client_dir).
- Pré-release = major 0 OU suffixe `-alpha/-beta/-rc/-dev`.

## Niveaux de verbosité (figés à la génération, override par flags)

**Entrées** (`Ajouté` / `Modifié` / `Corrigé`) :
| Niveau | Rendu |
|--------|-------|
| `verbose` | Titre + réf `#issue` / `[#pr]` + blockquote multi-lignes (contexte technique, choix d'implémentation), façon `gwm-cli`. |
| `normal` | Une ligne : description claire + réf `#issue`/`[#pr]`. |
| `short` | Titre court + réf seule, sans description. |

**Détails de version** (en-tête/résumé sous le numéro de version) :
| Niveau | Rendu |
|--------|-------|
| `verbose` | Résumé narratif + métriques (jours ouvrés via `metrics`). |
| `normal` | Résumé court (1-2 phrases). |
| `short` | Date seule. |
| `null` | Aucun détail : uniquement les entrées catégorisées. |

## Procédure (`init`)

1. **Vérifier le CLI** : si `~/.claude/skills/changelog-generator/bin/changelog-generator` absent → lancer `bash ~/.claude/skills/changelog-generator/scripts/setup.sh`.
2. **Analyser le projet courant** (cascade mgrep → serena → find) :
   - Format de `CHANGELOG.md` (Keep a Changelog `## [X.Y.Z]` vs Flippad `# Version X.Y.Z`).
   - Présence et structure de `changelogs/` (+ `pre-releases/`, `client/`).
   - Branches : `default_base`/`default_compare` (déduire de la config ou des branches réelles — souvent `main`/`dev`).
   - Langue du CHANGELOG, host GitHub (pour enrichissement PR/issues).
3. **Choisir la config** (AskUserQuestion si non fournie en args) :
   - Verbosité entrées : `verbose | normal | short`
   - Verbosité détails version : `verbose | normal | short | null`
   - Base / compare, dossier de sortie, format client (oui/non).
4. **Écrire/mettre à jour `<repo>/changelog.config.json`** : conserver country/course_weeks existants, ajouter/mettre à jour `branches`, `output`, et un bloc :
   ```json
   "verbosity": { "entries": "normal", "version_details": "normal", "client": false }
   ```
5. **Générer `<repo>/.claude/commands/changelog.md`** depuis le template ci-dessous, avec la config **gravée** (valeurs par défaut) et le support des flags d'override.
6. **Remplacer l'ancien** : si une commande changelog héritée traîne dans le projet → proposer de la retirer au profit de `/changelog` (AskUserQuestion avant suppression). Ne jamais supprimer sans confirmation.
7. **Résumer** : config retenue, fichiers créés, et la commande à lancer (`/changelog vX.Y.Z`).

## Procédure (`update`)
- Relire `<repo>/changelog.config.json` + `<repo>/.claude/commands/changelog.md`, ajuster la verbosité / branches / sorties selon la demande, en **préservant** les réglages non concernés. Montrer un diff résumé avant d'écrire.

## Template du `/changelog` généré (à écrire dans `<repo>/.claude/commands/changelog.md`)

````markdown
---
description: "Génère le changelog du projet (extract → rédaction → split → metrics), rangé dans changelogs/"
argument-hint: "vX.Y.Z [--entries=verbose|normal|short] [--version=verbose|normal|short|null] [--client] [--base=<branch>] [--compare=<branch>]"
allowed-tools: Bash(changelog-generator:*), Bash(git :*), Bash(make :*), Read, Write, Edit
---

# /changelog — <NOM_PROJET>

Config par défaut (gravée, surchargeable par flags) :
- Entrées : <ENTRIES_DEFAULT> · Détails version : <VERSION_DEFAULT> · Client : <CLIENT_DEFAULT>
- Base : <BASE> → Compare : <COMPARE> · Sortie : <OUTPUT_DIR>

Arguments : `$ARGUMENTS` (1er = version cible `vX.Y.Z` ; flags optionnels d'override).

## Étapes
1. **Extract** : `changelog-generator extract --base <BASE> --compare <COMPARE>` → `git-log.txt`.
2. **Rédaction** (toi) : lire `CHANGELOG.md` + `git-log.txt`, rédiger la section de la version cible au format du projet (<FORMAT>), en respectant la verbosité retenue :
   - Entrées selon le niveau `entries` (cf. table du méta-skill).
   - En-tête de version selon le niveau `version_details` (si `null` → pas d'en-tête narratif).
   - Catégoriser en Ajouté / Modifié / Corrigé, référencer `#issue` / `[#pr]`.
3. **Split** : `changelog-generator split --output-dir <OUTPUT_DIR> --clean` → `changelogs/vX.Y.Z.md` (pré-release → `pre-releases/`).
4. **Metrics** (si `version_details=verbose`) : `changelog-generator metrics` → jours ouvrés, à intégrer dans l'en-tête.
5. **Client** (si `--client`/défaut) : produire la version client dans `changelogs/client/`.

## Règles
- Evidence-based : se baser sur `git-log.txt` réel, ne rien inventer.
- Respecter le format de header existant du projet ; ne pas réécrire les versions passées.
- S'inscrit dans le workflow Release : ce `/changelog` est l'étape 1 (cf. ~/.claude/WORKFLOW.md).
````

## Exemples de référence (détecter et reproduire le style du projet)

| Projet | Convention | Header | Fichiers | Dossiers | Langue |
|--------|-----------|--------|----------|----------|--------|
| **gwm-cli** | Keep a Changelog | `## [X.Y.Z] - date` | `changelogs/X.Y.Z.md` (sans préfixe `v`) | `+ pre-releases/` | EN |
| **fiches-pedagogiques-(front\|api-rest)** | Flippad | `# Version X.Y.Z - date` + sections `## Description` / `## Sécurité` / … | `changelogs/vX.Y.Z.md` (préfixe `v`) | `+ client/` | FR |

Points communs : entrées riches en mode `verbose` (titre + `#issue`/`[#pr]` + blockquote multi-lignes de contexte technique, souvent terminé par `DD/MM/YYYY - @author`). **Toujours s'aligner sur le format déjà présent dans le repo** (préfixe `v` ou non, header, langue, sous-dossiers) — ne jamais imposer un format étranger au projet.

## Lien
- CLI sous-jacent : [[changelog-generator]]. Workflow release : `~/.claude/WORKFLOW.md`. Bootstrap projet : [[me:setup]].
