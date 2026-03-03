# Contributing

## Branches

```
feature/<scope>-<description>   # nouvelle fonctionnalite
fix/<scope>-<description>       # correction de bug
docs/<description>              # documentation
chore/<description>             # maintenance
```

## Commits

Format : `<type>(<scope>): <description>`

### Types

| Type       | Usage                          |
|------------|--------------------------------|
| `feat`     | Nouvelle fonctionnalite        |
| `fix`      | Correction de bug              |
| `docs`     | Documentation                  |
| `refactor` | Refactoring sans changement    |
| `chore`    | Maintenance, nettoyage         |
| `sync`     | Synchronisation configs locales|

### Scopes

`aerospace`, `sketchybar`, `karabiner`, `zed`, `ghostty`, `svim`, `nix`, `zsh`, `tmux`

### Exemples

```
feat(aerospace): add aero mode with F18 leader key
fix(sketchybar): fix bluetooth icon using nerd font
docs: update README with new keybindings
sync: update sketchybar and aerospace configs
```

## Workflow

1. Creer une branche depuis `main`
2. Sync les configs : `chezmoi add <fichier>`
3. Commiter par scope (grouper les changements lies)
4. Pousser et creer une PR
5. Merge dans `main` apres review

## Chezmoi

```bash
chezmoi add ~/.config/<app>/<file>    # ajouter un fichier
chezmoi diff                          # voir les differences
chezmoi apply --dry-run               # tester sans appliquer
chezmoi apply                         # appliquer
```
