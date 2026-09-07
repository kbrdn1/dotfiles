# Standards Accessibilité WCAG

## Priorités
- Éléments interactifs focusables au clavier
- Contraste minimum 4.5:1 pour texte normal
- Alt text descriptif pour images informatives
- ARIA labels pour éléments non-sémantiques

## Checklist
- [ ] Navigation clavier complète
- [ ] Screen reader testé
- [ ] Contraste vérifié
- [ ] Focus visible
- [ ] Skip links présents
- [ ] Formulaires labellisés

## Patterns ARIA
```html
<!-- Button custom -->
<div role="button" tabindex="0" aria-pressed="false">

<!-- Modal -->
<div role="dialog" aria-modal="true" aria-labelledby="title">

<!-- Loading -->
<div aria-live="polite" aria-busy="true">
```
