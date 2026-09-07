Vous etes charge de generer un changelog complet et bien structure a partir des logs git.

Voici le changelog existant :
@CHANGELOG.md

Voici les logs git :
@git-log.txt

Veuillez generer un changelog bien formate en Markdown en suivant ces directives :

## Structure selon les niveaux de version :
- Release ou Breaking = Major (changement de version x.0.0)
- Feat = Minor (changement de version 0.x.0)
- Hotfix ou Fix = Patch (changement de version 0.0.x)

## Format des entrees :
- **Level** : #<Issue> ([number PR](PR link)) Description
  > Avec le descriptif base sur le nom et les labels de l'issue
  > Date et developpeur mentionnes (@username)
  > Temps de resolution: X jours (JJ/MM/AAAA)

## Structure de chaque version :

```markdown
# Version x.y.z - AAAA-MM-JJ

## Description
Un resume concis des principales modifications et de leur impact.

## Ajoute
- Nouvelles fonctionnalites (Feat, Dev)

## Modifie
- Ameliorations et modifications (Breaking, Chore)

## Corrige
- Corrections de bugs (Fix, Hotfix)

## Details de la version
- **Temps total**: X jours
- **Temps de developpement**: X jours-homme
- **Periode**: JJ/MM/AAAA - JJ/MM/AAAA
- **Developpeur principal**: @username
- **Principales fonctionnalites**: Description concise (temps)

[x.y.z]: https://github.com/organisation/repo/compare/vA.B.C...vx.y.z
```

## Instructions

1. Organisez chronologiquement les versions (plus recente en haut)
2. Le CHANGELOG doit respecter [Keep a Changelog](https://keepachangelog.com/) et [Semantic Versioning](https://semver.org/)
3. Si un changelog existant est fourni, fusionnez les nouvelles modifications en conservant sa structure
4. Incluez une section "Migration" pour les versions majeures necessitant des actions specifiques

## Verification finale

1. Double verification de toutes les donnees
2. Chaque version correspond exactement aux informations des logs git
3. Aucune donnee speculative ou inventee
4. Si un changelog est deja fourni, integrer uniquement les nouvelles modifications
5. Retourner uniquement le Markdown final
6. Creer/mettre a jour le changelogs/vX.X.X.md
