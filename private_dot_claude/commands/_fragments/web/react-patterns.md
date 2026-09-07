# Patterns React

## Composants
- Privilégie les composants fonctionnels avec hooks
- TypeScript pour le typage strict
- Sépare logique (hooks custom) de présentation
- Nomme en PascalCase

## State Management
- `useState` pour état local simple
- `useReducer` pour logique complexe
- Context pour état partagé léger
- Zustand/Redux pour état global complexe

## Performance
- `React.memo` pour composants purs coûteux
- `useMemo`/`useCallback` judicieusement
- Lazy loading pour routes et composants lourds
- Virtualization pour longues listes

## Structure Fichiers
```
components/
├── ui/           # Composants réutilisables
├── features/     # Composants métier
└── layouts/      # Layouts de page
hooks/
├── useAuth.ts
└── useApi.ts
```
