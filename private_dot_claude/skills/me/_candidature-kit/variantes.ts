#!/usr/bin/env bun
// Génère les variantes de positionnement du CV depuis les profils de base.
//
// Une variante n'est PAS un CV différent : c'est le même pool de faits vérifiés,
// réordonné et réaccentué pour un type de poste. Rien n'est ajouté ici qui ne soit
// dans `pool.fr.md` — les bullets ci-dessous sont des reformulations d'accent de
// faits déjà sourcés, pas des nouveaux faits.
//
// Usage :
//   bun variantes.ts <dossier-de-sortie> [--only backend,devops] [--docx]
//
// Chaque variante sort en FR et en EN, et passe le même gate ATS que le CV de base.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const KIT = import.meta.dir;

// ─── Pool de bullets, par clé ─────────────────────────────────────────────────
// Chaque entrée existe en FR et en EN. Une variante en sélectionne 5 ou 6, dans
// l'ordre où elle veut qu'elles soient lues.

const B: Record<string, { fr: string; en: string }> = {
  ecommerce: {
    fr: "CMS e-commerce multi-tenant (Laravel 12, Vue 3 + Inertia, Docker Swarm) : passerelles de paiement activables par boutique (Stripe, Alma, Sogecommerce, Apple Pay, crypto), registre de feature flags, 8 versions en 6 semaines.",
    en: "Multi-tenant e-commerce CMS (Laravel 12, Vue 3 + Inertia, Docker Swarm): payment gateways switchable per shop (Stripe, Alma, Sogecommerce, Apple Pay, crypto), per-shop feature flag registry, 8 releases in 6 weeks.",
  },
  typescript: {
    fr: "Migration du dashboard en 100 % TypeScript : ratchet de typage vue-tsc en intégration continue, 1 721 erreurs ramenées à 0, allowJs désactivé, absence de any verrouillée par un contrôle automatique.",
    en: "Migrated the admin dashboard to 100% TypeScript: vue-tsc type ratchet in CI, 1,721 errors down to 0, allowJs disabled, zero any enforced by an automated check.",
  },
  fp_lead: {
    fr: "Fiches Pédagogiques, plateforme de ressources pour enseignants : project lead et architecte backend de la refonte from scratch — 17 mois, 3 développeurs, une centaine de tables, 4 528 des 5 244 commits de l'API.",
    en: "Fiches Pédagogiques, a teaching-resources platform: project lead and backend architect on the from-scratch rebuild — 17 months, 3 developers, around a hundred tables, 4,528 of the API's 5,244 commits.",
  },
  fp_prod: {
    fr: "Mise en production puis exploitation : plan de redirections 301/410 sur un site à fort trafic organique, observabilité Sentry, Google Analytics 4, conformité RGPD, 4 versions depuis le lancement.",
    en: "Took the platform to production and ran it since: 301/410 redirect plan on a site with heavy organic traffic, Sentry observability, Google Analytics 4, GDPR compliance, 4 releases since launch.",
  },
  erp_import: {
    fr: "Jewely ERP : architecture d'import extensible à plugins (drivers Shopify et Zoho, phases, reporting, CLI) pour reprendre le catalogue d'un client depuis sa plateforme d'origine.",
    en: "Jewely ERP: plugin-based, extensible import architecture (Shopify and Zoho drivers, phased runs, reporting, CLI) to migrate a new client's catalogue off their original platform.",
  },
  mentoring: {
    fr: "Encadrement technique et mentorat de deux développeurs, dont un alternant en Master accompagné sur la durée ; définition des conventions de développement de l'équipe.",
    en: "Technical guidance and mentoring for two developers, including a Master's-level apprentice supported over time; defined the team's development conventions.",
  },
  deploy: {
    fr: "Déploiement production et pré-production sur AWS et Heroku via GitHub Actions — API Gateway, Lambda, EC2, S3, CloudFront, CloudWatch — orchestration Docker Swarm derrière Traefik, service applicatif sous Nginx.",
    en: "Production and pre-production deployment on AWS and Heroku via GitHub Actions — API Gateway, Lambda, EC2, S3, CloudFront, CloudWatch — Docker Swarm orchestration behind Traefik, application served through Nginx.",
  },
  release: {
    fr: "Release engineering : 8 versions livrées en 6 semaines, source de version unique, changelog tenu sous SemVer, propagation dev → main → préproduction sur un monorepo multi-boutiques.",
    en: "Release engineering: 8 releases in 6 weeks, single source of version truth, SemVer changelog, dev → main → pre-production propagation across a multi-shop monorepo.",
  },
  payments: {
    fr: "Parcours de paiement Stripe complet — abonnements, achats à l'unité, licences établissements avec mandats administratifs et invitations, codes promotionnels — et durcissement des chemins-argent après revue de code.",
    en: "Full Stripe payment journey — subscriptions, one-off purchases, school licences with administrative mandates and invitations, promo codes — plus hardening of money paths following code review.",
  },
  applepay: {
    fr: "Intégration multi-passerelles : Apple Pay avec fichier de vérification de domaine scopé par boutique servi en route stateless, paiement fractionné Alma, Sogecommerce, crypto via Lyzi, liens de paiement avec acompte et relances transactionnelles Brevo.",
    en: "Multi-gateway integration: Apple Pay with a per-shop domain-verification file served through a stateless route, Alma instalments, Sogecommerce, crypto via Lyzi, payment links with deposits and Brevo transactional follow-ups.",
  },
  quality: {
    fr: "Outillage qualité : ratchet de typage en intégration continue, contrôle anti-any, tests de non-régression systématiques à chaque correctif, conventions de développement partagées.",
    en: "Quality tooling: type ratchet in CI, anti-any check, systematic regression tests on every fix, shared development conventions.",
  },
  pm: {
    fr: "Pilotage projet : planning, découpage en phases, priorisation avec le client, coordination d'un studio de design externe et arbitrage de la faisabilité technique des maquettes.",
    en: "Project management: planning, phasing, priority arbitration with the client, coordination of an external design studio and technical feasibility calls on their deliverables.",
  },
  migration: {
    fr: "Migration de données d'une plateforme legacy vers la nouvelle architecture : scripts sur mesure, contrôle d'intégrité à chaque étape, bascule sans interrompre la plateforme en production.",
    en: "Legacy data migration onto the new architecture: bespoke scripts, integrity checks at every step, cutover without interrupting the platform in production.",
  },
  search: {
    fr: "Conception de l'API : architecture modulaire, moteur de recherche full-text à filtres combinés, pipeline de traitement de fichiers, couche de validation, contrôle d'accès et licences établissements.",
    en: "API design: modular architecture, full-text search with combined filters, file-processing pipeline, validation layer, access control and institutional licences.",
  },
  erpsync: {
    fr: "Synchronisation ERP → e-commerce : l'ERP promu source de vérité des caractéristiques produit, exclusion de marques, backfill des existants, garde d'historique dans le job de synchro.",
    en: "ERP → e-commerce synchronisation: ERP promoted to source of truth for product attributes, brand exclusion, backfill of existing records, history guard inside the sync job.",
  },
};

// ─── Variantes ────────────────────────────────────────────────────────────────

type Variante = {
  key: string;
  titre: { fr: string; en: string };
  accroche: { fr: string; en: string };
  bullets: string[];
  skills: string[];   // ordre des groupes, libellés FR ; l'EN est mappé
  couvre: string;     // intitulés de poste que cette variante vise
};

const SKILL_MAP: Record<string, string> = {
  "Langages": "Programming", "Front-end": "Front-end", "Back-end": "Back-end",
  "Données": "Data", "Cloud & DevOps": "Cloud & DevOps", "Pratiques": "Practices",
  "Paiements": "Payments",
};

const VARIANTES: Variante[] = [
  {
    key: "backend",
    titre: { fr: "Développeur Backend — API & Architecture", en: "Backend Engineer — API & Architecture" },
    accroche: {
      fr: "Architecte backend et project lead d'une refonte de plateforme menée sur 17 mois : une centaine de tables, moteur de recherche full-text, parcours de paiement multi-cas, migration de données sans perte de référencement. 4 528 des 5 244 commits de l'API. En CDI chez Jewely x Flippad depuis décembre 2025.",
      en: "Backend architect and project lead on a 17-month platform rebuild: around a hundred tables, full-text search engine, multi-case payment journeys, data migration with no loss of search ranking. 4,528 of the API's 5,244 commits. On a permanent contract at Jewely x Flippad since December 2025.",
    },
    bullets: ["fp_lead", "search", "payments", "migration", "erp_import", "mentoring"],
    skills: ["Back-end", "Langages", "Données", "Cloud & DevOps", "Paiements", "Pratiques", "Front-end"],
    couvre: "Backend Developer · API Developer · Software Engineer · Développeur PHP/Laravel · Architecte applicatif junior",
  },
  {
    key: "frontend",
    titre: { fr: "Développeur Frontend — Vue, Nuxt, TypeScript", en: "Frontend Engineer — Vue, Nuxt, TypeScript" },
    accroche: {
      fr: "Développeur full stack orienté interface : Vue, Nuxt, Inertia et TypeScript au quotidien chez Jewely x Flippad, sur un ERP pour bijouteries de luxe, un configurateur produit multi-marques et un back-office éditorial. A ramené un dashboard de 1 721 erreurs de typage à 0. Solide côté backend, ce qui rend le dialogue avec l'API immédiat.",
      en: "Full stack developer with an interface focus: Vue, Nuxt, Inertia and TypeScript daily at Jewely x Flippad, on an ERP for luxury jewellers, a multi-brand product configurator and an editorial back-office. Took a dashboard from 1,721 type errors to 0. Solid on the backend, which makes API conversations immediate.",
    },
    bullets: ["typescript", "ecommerce", "fp_prod", "fp_lead", "quality", "mentoring"],
    skills: ["Front-end", "Langages", "Pratiques", "Back-end", "Cloud & DevOps", "Paiements", "Données"],
    couvre: "Frontend Developer · Vue/React Developer · UI Engineer · Développeur JavaScript/TypeScript",
  },
  {
    key: "cloud",
    titre: { fr: "Développeur & Ingénieur Cloud — AWS, Docker, CI/CD", en: "Software & Cloud Engineer — AWS, Docker, CI/CD" },
    accroche: {
      fr: "Développeur full stack qui possède aussi sa chaîne de livraison : production et pré-production sur AWS via GitHub Actions, orchestration Docker Swarm derrière Traefik, observabilité Sentry, 8 versions livrées en 6 semaines sous SemVer. Côté outillage, deux binaires publiés en Rust et en Go.",
      en: "Full stack developer who also owns the delivery chain: production and pre-production on AWS via GitHub Actions, Docker Swarm orchestration behind Traefik, Sentry observability, 8 SemVer releases in 6 weeks. On the tooling side, two published binaries in Rust and Go.",
    },
    bullets: ["deploy", "release", "fp_prod", "ecommerce", "quality", "fp_lead"],
    skills: ["Cloud & DevOps", "Langages", "Pratiques", "Back-end", "Données", "Front-end", "Paiements"],
    couvre: "DevOps Engineer · Cloud Engineer · Platform Engineer · SRE junior · Release Engineer · CI/CD Engineer",
  },
  {
    key: "paiements",
    titre: { fr: "Développeur — Intégration de paiements & e-commerce", en: "Payments & E-commerce Integration Engineer" },
    accroche: {
      fr: "Développeur full stack spécialisé sur les parcours de paiement : Stripe (abonnements, achats à l'unité, licences avec mandats), Alma, Sogecommerce, Apple Pay et crypto, activables par boutique sur un CMS multi-tenant. Durcissement des chemins-argent après revue de code, liens de paiement avec acompte et relances transactionnelles.",
      en: "Full stack developer specialised in payment journeys: Stripe (subscriptions, one-off purchases, licences with mandates), Alma, Sogecommerce, Apple Pay and crypto, switchable per shop on a multi-tenant CMS. Hardened money paths after code review, payment links with deposits and transactional follow-ups.",
    },
    bullets: ["applepay", "payments", "ecommerce", "erpsync", "fp_lead", "mentoring"],
    skills: ["Paiements", "Back-end", "Langages", "Front-end", "Données", "Cloud & DevOps", "Pratiques"],
    couvre: "Payment Integration Engineer · Fintech Developer · E-commerce Developer · PSP Integration · Checkout Engineer",
  },
  {
    key: "integration",
    titre: { fr: "Développeur — Intégration & migration de données", en: "Integration & Data Migration Engineer" },
    accroche: {
      fr: "Développeur full stack sur les chaînes d'intégration : architecture d'import extensible à plugins (drivers Shopify et Zoho, phases, reporting, CLI), synchronisation ERP → e-commerce, migration d'une plateforme legacy de plus de cent tables sans interrompre la production ni perdre le référencement.",
      en: "Full stack developer working on integration pipelines: plugin-based extensible import architecture (Shopify and Zoho drivers, phased runs, reporting, CLI), ERP → e-commerce synchronisation, migration of a legacy platform of over a hundred tables without interrupting production or losing search ranking.",
    },
    bullets: ["erp_import", "erpsync", "migration", "search", "ecommerce", "fp_lead"],
    skills: ["Back-end", "Données", "Langages", "Cloud & DevOps", "Pratiques", "Paiements", "Front-end"],
    couvre: "Integration Engineer · Data Migration Engineer · ETL Developer · ERP/PIM Integration · Solutions Integration Engineer",
  },
  {
    key: "lead",
    titre: { fr: "Développeur Full Stack — Lead technique & gestion de projet", en: "Full Stack Engineer — Tech Lead & Project Delivery" },
    accroche: {
      fr: "Project lead et architecte backend d'une refonte de plateforme menée sur 17 mois avec une équipe de 3 développeurs et un studio de design externe : planning, priorisation client, architecture, livraison. Encadre et mentore deux développeurs, définit les conventions de l'équipe. En CDI chez Jewely x Flippad depuis décembre 2025.",
      en: "Project lead and backend architect on a 17-month platform rebuild with a team of 3 developers and an external design studio: planning, client prioritisation, architecture, delivery. Mentors two developers and owns the team's development conventions. On a permanent contract at Jewely x Flippad since December 2025.",
    },
    bullets: ["fp_lead", "pm", "mentoring", "release", "quality", "ecommerce"],
    skills: ["Pratiques", "Back-end", "Front-end", "Langages", "Cloud & DevOps", "Données", "Paiements"],
    couvre: "Tech Lead · Lead Developer · Chef de projet technique · Technical Project Manager · Business Analyst IT · Product Owner technique",
  },
];

// ─── Génération ───────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const outDir = argv.find((a) => !a.startsWith("--"));
if (!outDir) { console.error("usage: bun variantes.ts <dossier> [--only a,b] [--docx]"); process.exit(2); }
const onlyArg = argv.indexOf("--only");
const only = onlyArg >= 0 ? argv[onlyArg + 1].split(",") : null;
const withDocx = argv.includes("--docx");

mkdirSync(resolve(outDir), { recursive: true });
const base = {
  fr: JSON.parse(readFileSync(`${KIT}/profil.fr.json`, "utf8")),
  en: JSON.parse(readFileSync(`${KIT}/profil.en.json`, "utf8")),
};

let ok = 0, ko = 0;
for (const v of VARIANTES) {
  if (only && !only.includes(v.key)) continue;
  for (const lang of ["fr", "en"] as const) {
    const p = structuredClone(base[lang]);
    p.identity.title = v.titre[lang];
    p.identity.summary = v.accroche[lang];
    // La photo est référencée relativement au kit : on absolutise, le JSON de
    // variante vivant ailleurs.
    p.identity.photo = `${KIT}/assets/photo.jpg`;
    p.sections[0].items[0].bullets = v.bullets.map((k) => {
      if (!B[k]) throw new Error(`bullet inconnu: ${k}`);
      return B[k][lang];
    });
    const groups: Record<string, unknown> = {};
    for (const g of p.sections[2].groups) groups[g.label] = g;
    p.sections[2].groups = v.skills
      .map((l) => groups[lang === "fr" ? l : SKILL_MAP[l]])
      .filter(Boolean);

    const jsonPath = resolve(outDir, `.profil.${v.key}.${lang}.json`);
    const pdfPath = resolve(outDir, `CV_Kylian_Bardini_${v.key}_${lang.toUpperCase()}.pdf`);
    writeFileSync(jsonPath, JSON.stringify(p, null, 2));
    try {
      const args = [`${KIT}/kit.ts`, jsonPath, "--out", pdfPath];
      if (withDocx) args.push("--docx");
      const out = execFileSync("bun", args, { encoding: "utf8" });
      const pages = /pages\s+(\d+)\/(\d+)/.exec(out);
      console.log(`  ✓ ${v.key}/${lang}  ${pages ? pages[1] + " page" : ""}`);
      ok++;
    } catch (e: any) {
      console.log(`  ✗ ${v.key}/${lang}  gate rouge`);
      console.log((e.stdout ?? "").split("\n").filter((l: string) => l.includes("✗")).join("\n"));
      ko++;
    }
  }
}
console.log(`\n  ${ok} variante(s) générée(s), ${ko} en échec.`);
console.log(`\n  Couverture des intitulés de poste :`);
for (const v of VARIANTES) if (!only || only.includes(v.key)) console.log(`  ${v.key.padEnd(12)} ${v.couvre}`);
