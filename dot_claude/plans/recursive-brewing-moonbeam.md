# Plan: Portfolio Redesign kbrdn.dev

## Objectif
Implémenter le design de portfolio minimaliste avec grille de points, section profil, graphique GitHub, et support light/dark mode Catppuccin.

## Informations utilisateur
- **Nom**: Kylian Bardini
- **Titre**: Web Engineer Developer @kbrdn1
- **Réseaux sociaux**: GitHub, LinkedIn, Twitter/X
- **Thème**: Light (Latte) + Dark (Mocha) avec toggle
- **GitHub chart**: Données réelles via API

---

## Phase 1: Theme Foundation
**Fichiers à modifier:**

### 1.1 `app/assets/css/main.css`
- Ajouter palette Catppuccin Latte (light mode)
- Créer classe `.light` avec variables sémantiques inversées
- Ajouter utility `.dotted-background` pour pattern grille

### 1.2 `nuxt.config.ts`
- Changer `colorMode.preference` de `'dark'` à `'system'`
- Ajouter `runtimeConfig` pour `GITHUB_TOKEN`

---

## Phase 2: Layout Components
**Fichiers à créer:**

### 2.1 `app/components/layout/DottedBackground.vue`
- Pattern SVG de points en fond
- Responsive à la taille du viewport

### 2.2 `app/components/ui/ThemeToggle.vue`
- Bouton toggle light/dark avec icône
- Utilise `useColorMode()` de Nuxt

### 2.3 `app/components/layout/Header.vue` (update)
- Ajouter ThemeToggle
- Style minimal/transparent

### 2.4 `app/components/layout/Footer.vue` (update)
- Footer minimal avec copyright

---

## Phase 3: Home Components
**Fichiers à créer:**

### 3.1 `app/components/home/Hero.vue`
Props: name, title, handle, avatarUrl, isHirable
- Photo profil circulaire (NuxtImg)
- Badge "HIRE ME" avec flèche
- Compteur de vues (décoratif)

### 3.2 `app/components/home/Bio.vue`
- 2 paragraphes de présentation
- Texte depuis content/index.md

### 3.3 `app/components/home/Actions.vue`
- Bouton primaire: "Book an intro call" (lien Calendly/Cal.com)
- Bouton secondaire: "Send an email" (mailto:)

### 3.4 `app/components/home/Socials.vue`
- Section "Here are my socials"
- Liens: GitHub, LinkedIn, X avec icônes

### 3.5 `app/components/ui/SocialLink.vue`
- Composant réutilisable pour lien social
- Props: platform, url, label

---

## Phase 4: GitHub Integration
**Fichiers à créer:**

### 4.1 `server/api/github/contributions.get.ts`
- Server route pour API GraphQL GitHub
- Cache 1 heure
- Utilise `GITHUB_TOKEN` depuis env

### 4.2 `app/composables/useGitHubContributions.ts`
- Composable pour fetch données contributions
- useAsyncData avec clé de cache

### 4.3 `app/components/home/GitHubChart.vue`
- Grille heatmap 52 semaines x 7 jours
- Couleurs adaptées au thème (vert Catppuccin)
- Tooltip hover avec date et count
- Mois en labels (Jan-Dec)

### 4.4 `.env`
```
GITHUB_TOKEN=ghp_xxxxx
```

---

## Phase 5: Content & Polish
**Fichiers à modifier:**

### 5.1 `app/content/index.md`
```yaml
---
title: Kylian Bardini
description: Web Engineer Developer
handle: "@kbrdn1"
isHirable: true
bio:
  - "Paragraph 1..."
  - "Paragraph 2..."
socials:
  github: https://github.com/kbrdn1
  linkedin: https://linkedin.com/in/kbrdn1
  twitter: https://twitter.com/kbrdn1
---
```

### 5.2 `app/pages/index.vue`
- Remplacer les 6 composants stub par nouvelle structure
- Query content pour données profil/bio
- SEO meta depuis frontmatter

### 5.3 `public/images/avatar.jpg`
- Photo profil 400x400px (affichée 200x200)

---

## Phase 6: Responsive
- Mobile-first avec breakpoints Tailwind
- Stack vertical sur mobile
- GitHub chart scroll horizontal sur petit écran

---

## Structure finale

```
app/
├── assets/css/main.css          # UPDATE
├── components/
│   ├── home/
│   │   ├── Hero.vue             # NEW
│   │   ├── Bio.vue              # NEW
│   │   ├── Actions.vue          # NEW
│   │   ├── Socials.vue          # NEW
│   │   └── GitHubChart.vue      # NEW
│   ├── layout/
│   │   ├── Header.vue           # UPDATE
│   │   ├── Footer.vue           # UPDATE
│   │   └── DottedBackground.vue # NEW
│   └── ui/
│       ├── ThemeToggle.vue      # NEW
│       └── SocialLink.vue       # NEW
├── composables/
│   └── useGitHubContributions.ts # NEW
├── content/
│   └── index.md                 # UPDATE
├── layouts/
│   └── default.vue              # UPDATE
└── pages/
    └── index.vue                # UPDATE
server/
└── api/github/
    └── contributions.get.ts     # NEW
public/images/
└── avatar.jpg                   # NEW
.env                             # NEW
nuxt.config.ts                   # UPDATE
```

---

## Ordre d'exécution
1. CSS + Theme (Latte colors, light mode class)
2. nuxt.config.ts (colorMode, runtimeConfig)
3. ThemeToggle + Header
4. DottedBackground + Layout
5. Hero + Bio + Actions + Socials
6. Content index.md + avatar image
7. GitHub API route + composable
8. GitHubChart component
9. Footer + polish
10. Responsive adjustments

---

## Risques identifiés
| Risque | Mitigation |
|--------|------------|
| Rate limit GitHub API | Cache serveur 1h, fallback placeholder |
| Token exposé | Server route only, jamais côté client |
| Flash thème au load | Nuxt colorMode gère déjà |
