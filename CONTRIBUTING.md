# Contributing

## Branches

| Branche | Rôle |
|---|---|
| `main` | Releases uniquement. Protégée : on n'y arrive que par une PR depuis `dev`. `install.sh` installe depuis `main`. |
| `dev` | Branche par défaut, l'intégration. Les petits changements y sont commités directement. |
| `feature/<desc>`, `fix/<desc>`, `docs/<desc>`, `chore/<desc>` | Les changements plus gros, dans un worktree gwm, mergés dans `dev` par PR. |

Avec une issue, le numéro entre dans le nom : `docs/#77-flux-dev-releases`.

## Commits

Gitmoji + Conventional Commits : `<gitmoji> <type>(<scope>): <description>`.

| Type | Usage |
|---|---|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `docs` | Documentation |
| `style` | Apparence, sans changement de comportement |
| `refactor` | Refactoring sans changement de comportement |
| `perf` | Performance |
| `chore` | Maintenance, nettoyage |
| `sync` | Synchronisation des configs locales |

Scopes : `herdr`, `claude`, `skills`, `aerospace`, `sketchybar`, `karabiner`, `zed`, `ghostty`, `nix`, `zsh`, `tmux`, `scripts`, `readme`.

Un commit qui fait avancer une issue la cite dans son corps : `Closes #N` quand il la termine, `Refs #N` sinon. `dev` étant la branche par défaut, `Closes #N` ferme l'issue dès que le commit y arrive.

```
✨ feat(herdr): Kanban, tiroir d'une carte

Closes #29
```

## Workflow

**Petit changement** (un correctif, un lot de mods vérifié) : directement sur `dev`.

1. `chezmoi add <chemins explicites>` (jamais de `chezmoi apply` sans chemin : `~/.claude` doit rester en `0700`)
2. `git add` des mêmes fichiers, puis commit
3. `git push origin dev`

**Changement plus gros** : une branche et une PR vers `dev`.

1. Une issue, depuis `.github/ISSUE_TEMPLATE/`
2. Un worktree depuis la source chezmoi : `gwm create --name docs/#N-<desc>` (basé sur `dev`)
3. Commits atomiques dans le worktree, puis `git push -u origin <branche>`
4. PR vers `dev`, remplie depuis `.github/PULL_REQUEST_TEMPLATE.md`
5. Merge, puis `gwm remove <dossier du worktree>`

La source chezmoi (`~/.local/share/chezmoi`) reste sur `dev` : c'est elle que `chezmoi add` et `chezmoi apply` lisent.

## Releases

Les versions sont datées : `vAAAA.MM.JJ`, et `vAAAA.MM.JJ.1` pour une deuxième release le même jour.

1. Sur `dev` : déplacer le contenu de `[Unreleased]` de [`CHANGELOG.md`](CHANGELOG.md) dans `changelogs/AAAA.MM.JJ.md`, et ajouter la version à l'index « Past releases »
2. PR `dev` → `main`, mergée en merge commit
3. Tag **après** le merge, sur le merge commit de `main` (la source reste sur `dev`, donc on vise `origin/main`, pas `HEAD`) : `git fetch origin && git tag vAAAA.MM.JJ origin/main && git push origin vAAAA.MM.JJ`
4. Release GitHub : `gh release create vAAAA.MM.JJ --title vAAAA.MM.JJ --notes-file changelogs/AAAA.MM.JJ.md`

`dev` n'a pas à être réaligné sur `main` ensuite : le merge commit de `main` n'apporte rien de neuf, et la PR `dev` → `main` suivante se fusionne sans conflit. Ouvrir cette PR juste après le commit du changelog évite qu'un lot arrivé entre-temps parte sans être listé.

Une release est un instantané : la corriger après coup passe par `gh release edit --notes-file`.

## Docs générées

`KEYBINDINGS.md` et `CLAUDE-CODE.md` ne s'éditent pas à la main :

```bash
python3 scripts/gen-keybindings.py   # relit les configs de la machine
python3 scripts/gen-claude-doc.py    # relit ~/.claude
```

## Chezmoi

```bash
chezmoi add ~/.config/<app>/<file>    # ajouter ou mettre à jour un fichier
chezmoi diff <chemin>                 # voir les différences
chezmoi apply --dry-run <chemin>      # tester sans appliquer
chezmoi apply <chemin>                # appliquer un chemin précis
```
