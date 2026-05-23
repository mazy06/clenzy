# Landing page Clenzy — Refonte stratégique

> **Avant** : section "technologie" centrée sur la stack (Spring Boot, React, Kafka, PostgreSQL) — incompréhensible et hors-cible pour des conciergeries.
> **Après** : section "technologie" traduit en bénéfices business — fiabilité, vitesse, évolutivité, sécurité.

Mockup HTML fonctionnel disponible dans `landing-page-mockup.html` (ouvrir dans un navigateur).

---

## 1. Incohérences de l'ancienne landing — ce qui était à corriger

### Incohérence 1 — Section "Technologie" parle aux développeurs, pas aux clients
**Avant :** *"Architecture micro-services Spring Boot 3.2 + Java 21, base PostgreSQL, message broker Kafka KRaft, frontend React 18 / TypeScript, multi-tenant Keycloak…"*

**Problème :** une conciergerie ne sait pas ce que c'est, et s'en fout. Elle veut savoir : *"est-ce que ça marche ? est-ce que c'est rapide ? est-ce que mes données sont en sécurité ?"*

**Après :** 4 piliers traduits en bénéfices business :
- **Fiable au quotidien** — multi-tenant éprouvé, sauvegarde 6h
- **Rapide** — < 200 ms, calendrier 50 biens fluide
- **Évolutif** — nouvelle feature toutes les 2-3 semaines
- **Sécurisé** — chiffrement AES-256, hébergement souverain FR

### Incohérence 2 — Le pitch hero ne cible pas l'ICP
**Avant :** *"Système de gestion immobilière nouvelle génération"*

**Problème :** trop générique. Ça ne précise pas pour qui, ni pour quel problème.

**Après :** *"Le PMS des conciergeries françaises."* + sous-titre qui détaille le bénéfice et l'ICP.

### Incohérence 3 — Pas de mention du programme Design Partner
**Avant :** rien sur l'offre découverte.

**Problème :** le programme Design Partner est central dans la stratégie d'acquisition. Il doit être visible dès le hero.

**Après :** ribbon en haut du hero + section dédiée dans pricing avec CTA.

### Incohérence 4 — Tarification floue ou cachée
**Avant :** "Contactez-nous pour un devis" ou rien d'affiché.

**Problème :** crée une friction inutile. 70% des prospects partent quand le prix n'est pas affiché.

**Après :** 3 plans clairs avec prix par bien/mois. Le Pro mis en avant. Enterprise sur devis (seul cas légitime).

### Incohérence 5 — Section "fonctionnalités" en liste à puces interminable
**Avant :** 30 features listées en grille uniforme.

**Problème :** noie l'utilisateur. Aucune feature ne sort, pas de priorisation.

**Après :** 4 features clés en split-layout (texte + mockup visuel) :
1. Reversements multi-propriétaires (LA killer feature)
2. Channel Manager 100+ OTAs
3. App mobile équipe terrain
4. Booking Engine sans commission

### Incohérence 6 — Pas de signal de confiance / proof
**Avant :** aucun témoignage, aucun logo client.

**Problème :** vendre sans preuve sociale est très difficile.

**Après :** section "Ils nous font confiance" avec logos placeholder (à remplir avec les design partners) + section témoignage placeholder + note transparente "premiers retours à venir".

### Incohérence 7 — Aucun différenciateur clair vs concurrents
**Avant :** "le meilleur PMS pour vous".

**Problème :** la concurrence (Smoobu, Hostaway) dit la même chose.

**Après :** chaque feature porte un tag "Différenciateur principal" / "Sync temps réel" / "App native". Et la FAQ adresse explicitement les questions "Y a-t-il une commission ?", "C'est conçu pour le marché français ?".

---

## 2. Structure de la nouvelle landing — par section

### Hero (au-dessus de la ligne de flottaison)
- Ribbon programme Design Partner
- H1 : "Le PMS des conciergeries **françaises**."
- Sub : promesse en 1 phrase + l'ICP
- 2 CTAs : "Demander une démo" (primaire) + "Voir les tarifs" (secondaire)
- 3 trust signals : Trial 30j sans CB, Migration gratuite, Support FR

### Social Proof
- Bandeau gris discret avec 5 logos design partners (placeholders)
- Note transparente "premiers retours à venir"

### Problem (les douleurs)
- Eyebrow : "Le quotidien d'une conciergerie en 2026"
- H2 : "Vous jonglez entre 5 outils — et personne ne vous a fait un PMS pensé pour vous"
- 3 cards de douleurs chiffrées (12h/mois, 800€/an, 5 appels/jour)

### Solution — 3 piliers
- Eyebrow : "La solution Clenzy"
- H2 : "Un seul outil. Trois promesses tenues."
- 3 piliers numérotés (Automatiser, Centraliser, Fluidifier) avec sous-features cochées

### Feature Showcase — split layouts
- 4 features clés alternées gauche/droite
- Chaque feature : tag + titre + paragraphe + 2 KPIs + mockup visuel

### Tech (REFONDUE)
- Eyebrow : "Notre technologie au service de votre activité"
- H2 : "Du logiciel pro. Pas du jargon."
- 4 piliers tech traduits en business (Fiable / Rapide / Évolutif / Sécurisé)
- 4 trust signals (Hébergement souverain / Sécurité bancaire / Conformité légale FR / Disponibilité 99,9 %)

### Pricing
- 3 plans (Starter 19 € / Pro 39 € featured / Enterprise sur devis)
- Note Design Partner program

### Témoignage (placeholder)
- Quote large + auteur

### FAQ
- 8 questions critiques avec réponses (sécurité, migration, commission, OTAs, mobile…)

### Final CTA
- Bandeau primary background
- H2 + CTA principal

### Footer
- 4 colonnes (Logo / Produit / Ressources / Légal)
- Mention "Made in France 🇫🇷"

---

## 3. Charte graphique respectée

| Élément | Valeur |
|---------|--------|
| Primary | `#6B8A9A` (bleu-gris Clenzy) |
| Accent success | `#4A9B8E` (vert validation) |
| Accent warning | `#D4A574` (ambre) |
| Accent danger | `#C97A7A` (rose-rouge pour les stats de douleur) |
| Accent info | `#7BA3C2` (bleu doux trust signals) |
| Typographie | system stack (SF Pro / Inter feel) |
| Border radius | 6 / 10 / 16 px (sm / md / lg) |
| Shadows | 3 niveaux subtils (pas de "shadow-2xl" générique) |

### Anti-patterns Impeccable évités
- ❌ Pas de side-stripe color >1px
- ❌ Pas de gradient text
- ❌ Pas de glassmorphism par défaut (seulement le nav avec backdrop blur subtil)
- ❌ Pas de hero-metric template (les KPIs sont par feature, pas en grille)
- ❌ Pas de 3 cards égales en rang (les pillars ont des variations)
- ❌ Pas de tout-en-`fontWeight: 600` (hiérarchie via tailles + couleurs)
- ❌ Pas de box-shadow noire générique (shadows teintées)
- ❌ `tabular-nums` sur tous les nombres (KPIs, prix, dates)
- ❌ Pas de `#000` ni `#fff` pur — tints vers le hue Clenzy

### Patterns Impeccable respectés
- ✅ `text-wrap: balance` sur tous les H1/H2 (pas d'orphans)
- ✅ `font-variant-numeric: tabular-nums` sur les valeurs numériques
- ✅ Hover transitions 200-250 ms avec easing exponentiel
- ✅ `cursor: pointer` sur tout cliquable
- ✅ Focus visible (préservé par défaut)
- ✅ Contraste texte ≥ 4.5:1
- ✅ Responsive 375 / 768 / 900 / 1200

---

## 4. Implémentation côté code Clenzy

### Option A — Site marketing externe (recommandé)
Clenzy.fr (la landing) **séparée** de app.clenzy.fr (le PMS).

**Pourquoi :**
- Stack adaptée (Next.js / Astro / Webflow), SEO mieux optimisable
- Pas de chargement du bundle React PMS lourd
- Marketing peut itérer sans toucher au produit
- Pas de couplage avec Keycloak

**Stack proposée :** Astro (statique, SEO++, JS minimal) + Tailwind + déployé sur Vercel/Netlify.

### Option B — Intégré dans le projet React Clenzy
Routes publiques `/` dans le projet existant.

**Pourquoi :**
- Mono-repo, déploiement unique
- Pas de domaine séparé à gérer

**Inconvénient :**
- Bundle PMS de 3-4 Mo téléchargé même pour un visiteur landing
- SEO moins optimisé (SSR à ajouter)

### Recommandation
**Option A** — créer un repo `clenzy-website` séparé en Astro, déployé sur Vercel. L'app PMS reste sur app.clenzy.fr, le marketing va sur clenzy.fr (root).

---

## 5. Sections à ajouter dans une V2 (post-MVP landing)

À ajouter quand les design partners sont signés :

- **Page Comparatif** (`/comparatif`) — déclinable en `/vs-smoobu`, `/vs-hostaway`, `/vs-igms`
- **Page Cas client** (`/clients`) — fiches détaillées avec quotes longs + chiffres
- **Page Intégrations** (`/integrations`) — logos des 30+ intégrations (Stripe, Wise, Pennylane, Channex…)
- **Page Sécurité** (`/securite`) — détaillée pour les conciergeries qui posent la question
- **Page Statut** (`/statut`) — uptime dashboard temps réel (style status.clenzy.fr)
- **Page Roadmap** (`/roadmap`) — public ou privé selon stratégie
- **Page Changelog** (`/changelog`) — les nouveautés mensuelles
- **Page Aide / Centre d'apprentissage** (`/aide`) — onboarding pour les clients (différent du blog)

---

## 6. Métriques de succès de la landing

À mesurer via Plausible Analytics :

| Métrique | Cible 30 jours |
|----------|----------------|
| Visites / mois | 500 (M1) → 5 000 (M6) |
| Taux de rebond | < 60 % |
| Temps moyen sur page | > 1 min 30 |
| Clics CTA "Demander démo" | 5 % des visites |
| Conversions démo bookée | 30 % des clics CTA |
| Taux conversion démo → trial | 50 % |

À chaque trimestre, A/B tester :
- H1 du hero (3 variantes)
- Couleur du bouton primaire
- Position du pricing (au-dessus ou en-dessous du tech)

---

## 7. Checklist d'implémentation

- [ ] Rédiger toutes les copies en français impeccable (sans em dashes, sans "elevate / seamless")
- [ ] Créer 5 mockups visuels propres (Figma) pour les feature showcases
- [ ] Demander 3 logos placeholder aux design partners
- [ ] Configurer Plausible Analytics
- [ ] Connecter Calendly avec questions de qualification
- [ ] Set up Brevo pour le formulaire newsletter (footer)
- [ ] Tester sur mobile 375 / 768 / iPhone Safari / Android Chrome
- [ ] Vérifier accessibilité (axe, Lighthouse)
- [ ] SEO de base : meta description, OG image, sitemap.xml
- [ ] Performance : Lighthouse Performance > 90, LCP < 1.5s
- [ ] Domain mapping clenzy.fr → Vercel
- [ ] Certificat SSL Let's Encrypt
- [ ] DNS configuré (www / apex / app)

---

## 8. Fichier livré

**`landing-page-mockup.html`** (dans le même dossier `docs/strategy/`)

- 1 fichier HTML statique self-contained (1 200 lignes)
- CSS embedded (pas de framework externe)
- Responsive mobile-first
- Aucune dépendance JavaScript (sauf `<details>` natif pour la FAQ)
- Couleurs Clenzy respectées
- Anti-patterns Impeccable évités

À ouvrir dans un navigateur pour visualiser. Sert de spec pour la version production.
