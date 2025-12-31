# Version 0.38.0 - 2025-01-15

## Description

Refonte complète du système de mandats scolaires avec workflow dual quote/BC, intégration Stripe Quote API, génération PDF automatisée, et système de validation WebHook renforcé.

## Feat

- **Dev**: #341 ([562](https://github.com/FlippadTeam/fiches-pedagogiques-api-rest/pull/562)) Dual workflow for school mandates (quote + BC)
  > Implemented Stripe Quote generation, checkout session management, PDF generation workflow with custom templates, and automated email notifications
  > Développeur: @kbrdn1 | Temps: 12 jours (03/01 - 15/01)
  > Files: 18 modified, 450 LoC added, 120 LoC removed

- **Dev**: #340 ([560](https://github.com/FlippadTeam/fiches-pedagogiques-api-rest/pull/560)) PDF generation service for quotes and purchase orders
  > Automated PDF generation using TCPDF library with custom templates, support for multiple formats (A4, US Letter), and watermark support
  > Développeur: @kbrdn1 | Temps: 3 jours (05/01 - 08/01)
  > Files: 6 modified, 200 LoC added

- **Feat**: #338 ([558](https://github.com/FlippadTeam/fiches-pedagogiques-api-rest/pull/558)) School mandate admin interface
  > Admin dashboard for school mandate management with filters, search, and bulk operations
  > Développeur: @kbrdn1 | Temps: 4 jours (06/01 - 10/01)
  > Files: 8 modified, 280 LoC added

## Fix

- **Hotfix**: #342 ([563](https://github.com/FlippadTeam/fiches-pedagogiques-api-rest/pull/563)) Webhook signature validation
  > Fixed Stripe webhook signature verification for production environment, added retry logic and logging
  > Développeur: @kbrdn1 | Temps: 1 jour (14/01)
  > Files: 2 modified, 15 LoC changed

- **Fix**: #339 ([559](https://github.com/FlippadTeam/fiches-pedagogiques-api-rest/pull/559)) Currency formatting in PDF documents
  > Corrected euro symbol display and decimal formatting in generated PDFs
  > Développeur: @contributor2 | Temps: 1 jour (13/01)
  > Files: 3 modified, 25 LoC changed

## Chore

- **CI**: #337 ([557](https://github.com/FlippadTeam/fiches-pedagogiques-api-rest/pull/557)) Update Docker configuration
  > Optimized Docker build process, updated base image to PHP 8.2, improved dependency caching
  > Développeur: @kbrdn1 | Temps: 1 jour (03/01)
  > Files: 4 modified, 40 LoC changed

- **Docs**: #336 ([556](https://github.com/FlippadTeam/fiches-pedagogiques-api-rest/pull/556)) Add school mandate workflow documentation
  > Comprehensive documentation for school mandate feature including API endpoints, workflow diagrams, and examples
  > Développeur: @kbrdn1 | Temps: 1 jour (15/01)
  > Files: 5 added, 350 LoC added

## Détails de la version

- **Temps total**: 14 jours calendaires
- **Jours travaillés**: 9 jours ouvrables (hors weekends, jours fériés français, semaines de formation)
- **Commits**: 47
- **Efficacité**: 5.2 commits/jour
- **Contributors**:
  - @kbrdn1 (95% - 45 commits)
  - @contributor2 (5% - 2 commits)
- **Principales fonctionnalités**:
  - School mandates workflow (8 jours)
  - PDF generation service (3 jours)
  - Admin interface (4 jours)
  - Bug fixes and optimizations (2 jours)

[0.38.0]: https://github.com/FlippadTeam/fiches-pedagogiques-api-rest/compare/v0.37.2...v0.38.0
