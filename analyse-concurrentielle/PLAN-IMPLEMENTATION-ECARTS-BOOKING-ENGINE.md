# Plan d'implémentation — combler les écarts du Booking engine (Domaine 2)

> **Contexte** : la re-notation honnête (sur `origin/main`) place Baitly **1er du booking engine**
> (V2 **2.6** vs Guesty 2.5 / Hostaway 2.3). Ce plan traite les **écarts résiduels** qui plafonnent
> la note + les leviers pour **creuser l'avance**. Objectif : passer le domaine de 2.6 à **~2.9**
> et transformer 3 atouts en différenciateurs marketés.
> Date : 2026-06-27 · Source : inventaire code-grounded + benchmark B11 (builder).

## Position de départ (rappel)

| Atout (on mène déjà) | Note | Concurrents |
|---|---|---|
| RTL / arabe natif | 3 | **0** partout |
| Panier multi-séjours / multi-propriétés | 3 | 0-1 |
| Import multi-standards (GrapesJS) | cible | **personne** |

| Écart résiduel | Actuel | Cible | Bloqueur |
|---|---|---|---|
| Builder drag-and-drop | 2 | 3 | refonte GrapesJS sur branche `booking-engine-wip` |
| Templates prêtes | 2 | 3 | 1 seul template |
| Outils IA | 2 | 3 | pas d'auto-traduction |
| Capture leads | 2 | 3 | pas de relance panier abandonné |
| Anti-fraude | 2 | 3 | pas de scoring risque |

---

## P0 — Builder GrapesJS 2 niveaux + import (builder 2→3, active LE différenciateur)

**Objectif** : finir la refonte commencée → un builder « guidé » à la hauteur de Lodgify/Hostaway
**et** un mode « avancé/import » que **personne** n'a (benchmark B11 §5-6).

**État actuel** (inventaire) :
- `client/src/modules/booking-engine/studio/grapes/GrapesStudio.tsx` (82.5K) sur `origin/main` = builder fonctionnel (multi-page, funnels, composites) — maturité **2/3**.
- Branche **`booking-engine-wip`** (commit `273024d7`, ~1210 fichiers) = refonte majeure **non rebasée**, marquée « à reprendre ».
- Doc cible : `analyse-concurrentielle/ARCHI-IMPORT-TEMPLATES.md` (couche d'adaptation multi-standards, 1er adaptateur = HTML/Bootstrap).

**Implémentation** :
1. **Rebaser `booking-engine-wip` sur `main`** (le main a beaucoup avancé depuis le fork) — résoudre les conflits SDK/studio, par lots, en gardant le main stable comme référence. *(Risque élevé : 1210 fichiers — faire par sous-modules : `sdk/`, `studio/grapes/`, `studio/builder/`.)*
2. **Mode « guidé » (défaut)** : templates curatés + perso couleurs/typo/blocs/espacements (éditeur bridé façon Lodgify). Réutiliser `bookingComponents.ts` + `bookingWidgetDefs.ts` + le panneau de settings réactif.
3. **Mode « avancé / import »** : GrapesJS libre + **adaptateurs d'import** (HTML/Bootstrap d'abord, puis Elementor/Gutenberg/Webflow) → couche d'adaptation `ARCHI-IMPORT-TEMPLATES.md`. Normaliser vers le format interne SitePage/GrapesJS.
4. **Toggle de niveau** par config + garde-fous (le mode guidé ne casse pas le thème).

**Fichiers** : `studio/grapes/*`, `studio/builder/*`, nouveau `studio/import/<standard>Adapter.ts`, `SitePage.java`/`SiteAdminService.java` (persistance).
**Impact note** : builder 2→3. **Effort** : L (rebase) + M (import HTML) → différenciateur immédiat.

---

## P1 — Combler les écarts qui plafonnent la note

### P1.a — Galerie de templates (templates 2→3)
**État** : `SiteTemplate.java` + `SiteTemplateController/Service` + `TemplateGalleryPage.tsx` = infra OK ; repo `clenzy-site-templates` = **1 template** (`conciergerie-elegante`).
**Implémentation** : produire **5-10 templates** `template.json` (multi-page : accueil, liste, détail, contact, blog) couvrant les cibles (conciergerie haut de gamme, maison de campagne, urbain/affaires, bord de mer/MENA-RTL). Curation + preview dans la galerie ; tag globale (org=NULL) vs privée. **Accélérateur** : générer chaque template via `AiDesignService` (P2.a) puis affiner à la main.
**Impact** : templates 2→3. **Effort** : M (surtout du contenu/design, peu de code).

### P1.b — Auto-traduction IA du contenu & SEO (IA 2→3)
**État** : authoring multi-langue par locale **existe** (Studio, `c1f3f946`) mais **manuel** ; un service `translate-html` (jsoup + LLM) existe déjà pour le booking engine multilingue.
**Implémentation** : étendre `SiteContentAiService` → à la publication d'une page/blog/SEO dans la langue source, **proposer la traduction auto** des locales manquantes (réutiliser `translate-html` pour préserver le markup + traduire seoTitle/seoDescription/og). Workflow : brouillon traduit → **review humaine** (comme le blog IA) → publication. Couvrir fr/en/ar (+ RTL pour ar).
**Fichiers** : `SiteContentAiService.java`, le service `translate-html`, `BlogPanel.tsx`/Studio i18n.
**Impact** : IA 2→3 (rejoint Hostaway sur le contenu, dépasse via l'auto-traduction multi-langue + RTL).
**Effort** : M.

### P1.c — Relance de panier abandonné (leads 2→3)
**État** : `LeadCapture.ts` (exit-intent) + `LeadCaptureService` + entité **`AbandonedBooking`** déjà présente ; **pas de relance** de panier.
**Implémentation** : persister l'état du panier (CartStay[] + email si capturé) → entité/colonnes sur `AbandonedBooking` ; **scheduler de relance** (J+1, J+3) avec lien de reprise du panier (deep-link widget pré-rempli) ; respecter consentement RGPD + opt-out. Réutiliser le canal email existant (Brevo/Postal).
**Fichiers** : `AbandonedBooking*`, nouveau `AbandonedCartRecoveryScheduler`, `LeadCaptureService`, deep-link SDK (`BaitlyWidget.ts`).
**Garde-fous audit** : pas d'appel externe en transaction ; idempotence de la relance (1 email par étape) ; check-then-act interdit (verrou/flag d'envoi).
**Impact** : leads 2→3. **Effort** : M.

---

## P2 — Creuser l'avance (dépasser durablement)

### P2.a — Génération de site complet par IA (au-delà de Hostaway)
**État** : `AiDesignService` (analyse site + tokens design) + `SiteContentAiService` + `PropertyContentAiService` + assistant multi-agent.
**Implémentation** : flux **brief → site complet** : l'hôte décrit son activité → l'IA génère thème (tokens), arborescence de pages (SitePage GrapesJS), contenu + SEO + 1 article de blog, en s'appuyant sur un template de base. Review/édition dans le Studio. Différencie : Hostaway génère le **copy/SEO**, pas le **site entier**.
**Impact** : pousse Outils IA au-delà de 3 (lead marché). **Effort** : L.

### P2.b — Fraud scoring au checkout direct (anti-fraude 2→3)
**État** : caution/pre-auth (`BookingEngineDepositService`) OK, **pas de scoring**.
**Implémentation** : scoring risque léger au checkout public (vélocité IP/email, mismatch pays carte/IP, e-mail jetable, montant atypique) → seuil → exiger caution renforcée / revue manuelle. Brancher Stripe Radar (déjà dans la stack Stripe) + règles maison. `TrustedClientIpResolver` pour l'IP réelle (pattern audit existant).
**Impact** : anti-fraude 2→3. **Effort** : M.

### P2.c — Marketer les 3 différenciateurs (impact commercial, pas de note)
- **RTL / arabe natif** : argumentaire MENA / Arabie Saoudite (aligné avec l'expansion KSA + la conformité fiche de police Absher).
- **Panier multi-séjours / multi-propriétés** : argumentaire conciergerie (réserver plusieurs biens en 1 checkout).
- **Import multi-standards (GrapesJS)** : argumentaire agences/conciergeries qui reprennent un site existant — **personne ne le fait**.

---

## Séquencement recommandé

| Vague | Items | Effet note Domaine 2 | Effet marché |
|---|---|---|---|
| **1 (P0)** | Rebase WIP + builder 2 niveaux + import HTML | builder 2→3 | différenciateur import |
| **2 (P1)** | Templates ×5-10 · auto-traduction IA · relance panier | templates/IA/leads 2→3 | parité + dépassement IA |
| **3 (P2)** | Génération site IA · fraud scoring · marketing | IA>3 · anti-fraude 2→3 | lead durable |

**Cible** : Domaine 2 de **2.6 → ~2.9** (quasi-plafond) ; consolidation du **1er rang** booking engine ;
3 différenciateurs uniques sur le marché STR/conciergerie.

> **Note** : `processeur de paiement propriétaire` (0) volontairement **hors périmètre** — seuls
> Guesty/Hospitable l'ont, Stripe Connect couvre le besoin ; ROI négatif pour une conciergerie.
