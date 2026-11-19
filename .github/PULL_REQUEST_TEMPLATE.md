## Resume

<!-- Description courte des changements -->

## Configs modifiees

- [ ] herdr (Herdr 2, mods kbrdn)
- [ ] claude (`~/.claude` : skills, commandes, hooks, settings)
- [ ] docs (README, CONTRIBUTING, docs générées)
- [ ] aerospace
- [ ] sketchybar
- [ ] karabiner
- [ ] zed
- [ ] ghostty
- [ ] svim
- [ ] nix
- [ ] zsh
- [ ] tmux

## Changements

<!-- Liste des changements -->

-

## Tests

- [ ] `chezmoi diff <chemins>` verifie
- [ ] `chezmoi apply --dry-run <chemins>` sans erreur (jamais d'apply sans chemin)
- [ ] `CHANGELOG.md` : une ligne sous `[Unreleased]`
- [ ] Checks des mods touches : chaque `<mod>/*.check.mjs` lancé un par un avec `bun` (il n'en lance qu'un par appel), et `bun test <mod>` pour tous ses `*.test.mjs` (bun:test comme node:assert) ; un mod sans l'un ni l'autre : le dire
- [ ] Config testee localement
- [ ] Pas de regression sur les autres configs
