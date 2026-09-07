---
name: ci-cd-patterns
description: Skill migrated from _fragments/devops/ci-cd-patterns
user-invocable: false
---

# Patterns CI/CD

## GitHub Actions Workflow
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test
      - run: npm run lint
```

## Stages Recommandés
1. **Install**: Dependencies
2. **Lint**: Format + static analysis
3. **Test**: Unit + integration
4. **Build**: Compilation/bundle
5. **Deploy**: staging → production

## Stratégies de Déploiement
| Stratégie | Usage |
|-----------|-------|
| Rolling | Updates progressifs |
| Blue-Green | Zero downtime |
| Canary | Test sur % traffic |
| Feature Flags | Activation graduelle |

## Secrets Management
- Jamais de secrets dans le code
- Variables d'environnement CI
- Vault/Secrets Manager pour prod
- Rotation régulière

