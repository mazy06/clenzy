# Backlog priorisé — Booking Engine (post-Studio, 2026-06-15)

> Inventaire issu des 5 audits de code + [REFONTE-BOOKING-ENGINE.md](../REFONTE-BOOKING-ENGINE.md).
> Échelle effort : S (jours) · M (1-2 sem) · L (3-5 sem) · XL (>5 sem). Impact : ⭐→⭐⭐⭐.
> État (gap d'origine) : ❌ manquant · 🟡 trop simple.
> **Statut (avancement)** : ⬜ à faire · 🔄 en cours / partiel · ✅ fait · ⏸️ bloqué (décision/infra/vérif externe).
> Convention : à chaque item terminé, mettre à jour ce fichier + valider ✅/🔄.

## Principe de priorisation
1. **Lever les verrous** (ce qui débloque plusieurs features).
2. **Réparer les promesses cassées** (offert mais 404 / non câblé).
3. **ROI conversion** avant profondeur builder.
4. **In-repo d'abord** ; l'infra SSR (XL) en parallèle.

---

## P0 — Démarrables maintenant (in-repo, fort impact)

| # | Item | État | Impact | Effort | Dépend | Statut |
|---|------|------|--------|--------|--------|--------|
| **0.1** | **Rendu public de la page composée** : route `/booking/:key` (hors auth) qui réutilise `PagePreview` + expose `pageLayout` au DTO public. Répare l'URL hébergée qui 404. | ❌ | ⭐⭐⭐ | M | — | ✅ **fait** — route `/booking/:apiKey` + page bookable (widget monté). SEO=P1, blocs interactifs (PropertyGrid réel) = finition différée. |
| 0.2 | Avis publics sur le site + JSON-LD `AggregateRating` (backend reviews existe) | 🟡 | ⭐⭐ | M | 0.1 | ✅ **fait** — endpoint public `/reviews` (agrégat org + récents, `isPublic=true`) + section preuve sociale sur la page. JSON-LD différé au SSR (P1, exige le nom métier). |
| 0.3 | Caution Stripe (HP-19) : `SecurityDeposit` → pré-autorisation `capture_method=manual` (hors-tx + afterCommit + idempotency) | 🟡 | ⭐⭐⭐ | M | — | 🔄 **code complet** — backend `SecurityDeposit`/`SecurityDepositService` (CAS) + `SecurityDepositPaymentService` (hold/capture/release Stripe) existaient déjà (Phase 4, PMS). **Intégration booking engine ajoutée** : champ `securityDepositAmount` (config + DTO admin/public, migration 0252), checkout enregistre la carte (`customer_creation=always` + `setup_future_usage=off_session`), webhook crée le dépôt + pose un **hold off-session** `capture_method=manual` (`BookingEngineDepositService`, afterCommit + idempotency + CAS), libération auto J+2 après check-out (`BookingCautionScheduler`). `mvn package` vert. **⏸️ vérif Stripe test-mode requise** + champ UI Studio (montant caution) à câbler. |
| 0.4 | Annulation / modification self-service voyageur (`/cancel` + `/modify`, remboursement serveur) | ❌ | ⭐⭐⭐ | M | — | 🔄 **code complet** — aperçu `/cancellation-preview` + action `/cancel` (libère calendrier, refund Stripe **partiel** selon politique, afterCommit + idempotency + CAS) + page guest `/booking/:key/cancel`. **⏸️ vérif Stripe test-mode requise** (refund non exécutable par moi). Modification de séjour = non couverte (annulation seule). |
| 0.5 | Multi-devise au checkout (câbler `CurrencyConverterService`, devise choisie) | 🟡 | ⭐⭐ | S/M | — | 🔄 **affichage déjà couvert** — `BookingDisplayCurrencyService` convertit les réponses publiques (calendar/availability/detail) + endpoint `/currencies` + sélecteur widget. Reste **différé** : charge Stripe dans la devise choisie (règlement multi-devise) — non fait (risque settlement). |
| 0.6 | Anti-fraude : Stripe Radar (règles défaut) + 3DS/SCA | ❌ | ⭐⭐ | S | — | ⏸️ **config dashboard** — 3DS/SCA + Radar déjà automatiques via Stripe Checkout ; pas de code (règles Radar = dashboard Stripe). |
| 0.7 | Acompte / paiement partiel (% ou fixe, échéancier) | ❌ | ⭐⭐ | M | — | 🔄 **code complet** — config `depositPercent` + `balanceDueDays` (migration 0253, DTO admin/public) ; le checkout ne charge QUE l'acompte (`deposit_balance` en metadata) ; webhook → `PARTIALLY_PAID` + `amountPaid`/`amountDue`/`balanceDueDate` (effets ledger/facture **différés** au solde) ; **solde via lien de paiement** voyageur (endpoint `/booking/{code}/pay-balance` + `BookingBalanceService` → session Checkout dédiée `type=booking_engine_balance` ; webhook `confirmBookingEngineBalance` → `PAID` + ledger/facture complets via `confirmReservationPayment`). `mvn package` vert. **⏸️ vérif Stripe test-mode requise** ; reste : email/relance automatique du solde + champs UI Studio (% acompte, délai solde) + pages frontend success/cancel solde. |

## P1 — Fondation SSR (infra — débloque SEO / site / blog)

| # | Item | État | Impact | Effort | Dépend |
|---|------|------|--------|--------|--------|
| 1.1 | Service SSR **Next.js « Clenzy Sites »** + modèles `Site`/`SitePage`/`SiteDomain` + domaines custom + TLS (Cloudflare for SaaS) | 🔄 | ⭐⭐⭐ | XL | infra clenzy-infra | 🔄 **backend in-repo FAIT** : (socle) entités `Site`/`SitePage`/`SiteDomain` + enums + repos + migration 0254 ; (a) **CRUD admin** `/api/sites` (sites/pages/domaines, `SiteAdminService`/`SiteAdminController`, org-scopé) ; (b) **API de livraison publique** `/api/public/sites/resolve` + `/{id}/page` (`SiteDeliveryService` : hostname→site PUBLISHED→pages+SEO, sous-domaine `{slug}.clenzy.site` ou domaine custom ACTIVE) = **contrat consommé par le SSR**. `mvn package` + ArchUnit verts. (c) **service Next.js « Clenzy Sites » CRÉÉ** (repo voisin `clenzy-sites` : résolution hostname, rendu blocs `bkly-*`, blog, sitemap/robots/rss, SEO) + infra additive `clenzy-infra` (`docker-compose.sites.yml`, `nginx/sites.conf.template`, runbook). **Sites bookables** : clé widget exposée dans `resolve` (`bookingEngineApiKey`) + build SDK standalone (`vite.config.sdk.ts` → `clenzy-booking.min.js`) + `ReservationWidget` monte le widget. (d) **bridge Cloudflare CODÉ** (gated) : `CloudflareCustomHostnameService` (Custom Hostnames API : create/status/delete) + wiring `addDomain`/`removeDomain` (afterCommit, hors-tx) + `SiteDomainReconcileScheduler` (poll statut → ACTIVE/FAILED). Inerte sans `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ZONE_ID`. **Reste (infra utilisateur)** : zone `clenzy.site` + for SaaS (console) + déploiement + fournir le token CF pour activer/tester les domaines custom. |
| 1.2 | SEO complet : meta/OG par page, JSON-LD (`LodgingBusiness`/`Offer`/`FAQPage`), sitemap multilingue, `hreflang` fr/en/ar, canonical, robots | 🔄 | ⭐⭐⭐ | M | 1.1 | 🔄 **backend partiel** : champs SEO par page/article (`seoTitle`/`seoDescription`/`seoOgImageUrl`) exposés dans les DTO de livraison + endpoint **`/api/public/sites/{id}/sitemap`** (pages + articles publiés, avec locale/lastmod). **Reste (SSR, service Next.js)** : rendu `<title>`/meta/OG, JSON-LD, hreflang, canonical, robots.txt, ajout des URLs propriétés dynamiques au sitemap. |
| 1.3 | Blog / CMS (`BlogPost` SSR + RSS + schema `Article`) | 🔄 | ⭐⭐ | M | 1.1 | 🔄 **backend FAIT** : entité `BlogPost` (markdown/MDX, tags, SEO, publishedAt) + repo + migration 0255 + **CRUD admin** `/api/sites/{id}/posts` + **livraison** `/api/public/sites/{id}/posts` & `/posts/by-slug`. `mvn package` + ArchUnit verts. **Reste (SSR)** : rendu article + flux RSS + schema `Article` (service Next.js). |

## P2 — Profondeur builder & conversion

| # | Item | État | Impact | Effort | Dépend |
|---|------|------|--------|--------|--------|
| 2.1 ✅ | Médiathèque + champ image (logo, galerie, avatars) | ✅ | ⭐⭐⭐ | M | — | **FAIT** : médiathèque org-scopée. Backend `MediaAsset` (migration 0258) + `MediaLibraryService` (upload validé image ≤5 Mo via `PhotoStorageService` S3/BYTEA, liste, suppression) + `MediaLibraryController` (`/api/booking-engine/media`, auth+org) + `PublicMediaController` (`GET /api/public/media/{id}`, keyless, cache 1 h). Front `mediaApi` + `MediaPicker` (dialog upload + grille + suppression) câblé sur le champ `image` du `BlockInspector` (URL absolue stockée → marche canvas/page/widget/SSR). *Tout champ `type:'image'` en hérite ; multi-pick galerie/logos = extension future.* |
| 2.2 ✅ | Multi-page (`SitePage[]` + nav + routing) | ✅ | ⭐⭐ | L | 1.1 | **FAIT (authoring)** : backend `POST /api/sites/ensure-for-config/{configId}` (find-or-create du site + migration `pageLayout`→page d'accueil). Front : `sitesApi` + hook `useSitePages` + `PagesBar` (onglets : ajouter/renommer/supprimer/**réordonner ◂▸**, accueil protégée) + onglet **Page** (`PageInspector` : titre/chemin/statut/SEO par page) + `DesignBuilder` édite/persiste **par page** (auto-save au changement de page ; miroir accueil→`config.pageLayout` ; repli mono-page si API sites KO). *Reste (SSR, repo `clenzy-sites`) : nav inter-pages sur le site rendu + miroir blocs 2.3/2.4.* |
| 2.3 ✅ | + de blocs (Galerie, Carte, FAQ, Table prix, Stats, Logos, Vidéo…) | ✅ | ⭐⭐ | M | — | **FAIT — 7 blocs ajoutés** : **FAQ** (Q\|R), **Galerie** (grille images), **Chiffres clés** (Valeur\|Libellé), **Vidéo** (embed YouTube/Vimeo), **Carte** (Google Maps embed par adresse), **Table de prix** (Libellé\|Prix), **Logos** (bandeau confiance). Registre + `blockStyles.css` + sélecteurs CSS, supportent align/bgColor. *Reste (mineur) : Formulaire (→ 2.12 capture leads), Détail propriété (dynamique), lightbox, + miroir SSR `clenzy-sites/blocks.tsx`.* |
| 2.4 ✅ | Édition par bloc enrichie (color/url/image/align/select) + éditeur tokens complet | ✅ | ⭐⭐ | M | — | **FAIT**. Éditeur de tokens (Thème) + **édition granulaire par bloc** : types de champ `select`/`color`/`url`/`image` (BlockInspector) + champs `align`/`bgColor`/`bgImage` (sections) + `buttonUrl` (CTA), consommés au rendu via `sectionStyle` (override inline sur la racine `bkly-*`, prime sur blockStyles.css). S'applique au canvas + aperçu + page publique React. *Reste : mirroir SSR `clenzy-sites/blocks.tsx` + médiathèque upload (2.1) pour le champ image.* |
| 2.5 | Responsive : overrides + visibilité par breakpoint | 🟡 | ⭐⭐ | M | — |
| 2.6 ✅ | **FAIT** — Templates de site par vertical : 6 designs réels (Lodge, Épuré, Bord de mer, Urbain, Riad/MENA, Nordique) = thème + composition de blocs + copy. Bouton « Modèles » dans le Studio + à la création ; « Page vierge » = custom. (Plus de blocs 2.3 enrichiront les compositions.) | 🟡 | ⭐⭐ | M | 2.3 |
| 2.7 | Drag-and-drop + conteneurs lignes/colonnes ; undo/redo + autosave + draft/live | 🟡 | ⭐ | M | — |
| 2.8 | **Book Direct & Save** (parité tarifaire, rate membre, wallet/crédit) | ❌ | ⭐⭐⭐ | L | — |
| 2.9 ✅ | Urgence & preuve sociale honnête (« 2 dates restantes », « réservé X× ») | ✅ | ⭐⭐ | M | — | **FAIT — données 100% réelles** : `PublicPropertyDto` enrichi de `totalBookings` + `availableDays30` (2 requêtes **batch**, pas de N+1 : `countByPropertyIds` + `countUnavailableByPropertyIds` sur 30 j). Widget : badges **« Réservé N× »** (si ≥3) et **« Plus que N dates en 30 j »** (si ≤8) sur les cartes (i18n fr/en/ar, CSS tokens + accent `#C97A7A`). Seuils = on n'affiche que du vrai signal. *Pas de « X personnes regardent » (refusé : pas de tracking réel = malhonnête). Note/avis par propriété = extension possible (requête à ajouter).* |
| 2.10 | Upsells productisés (bundles, conditionnel, fenêtres horaires) | 🟡 | ⭐⭐ | M | — |
| 2.11 | Comptes voyageur : wishlist, cartes enregistrées, re-booking 1-clic, fidélité/parrainage | 🟡 | ⭐⭐ | L | — |
| 2.12 ✅ | Capture leads (exit-intent/pré-checkout/form embarquable) + abandoned multi-étapes + segments Brevo | ✅ | ⭐⭐ | M | — | **FAIT** : **(1) form embarquable exit-intent** (widget `LeadCapture.ts` : modal 1×/session, consentement RGPD, `POST /leads` source EXIT_INTENT, repli 403 ; i18n fr/en/ar ; flag d'init `leadCapture`). **(2) flag `leadCaptureEnabled`** au DTO config public (org-level). **(3) relance panier abandonné MULTI-ÉTAPES** : `reminder_count` (migration 0256) + scheduler **1h / 24h / 72h** escaladé. **(4) segments Brevo** : liste `leadsListId` + `syncLeadsEnabled` (migration 0257) sur `MarketingIntegration` ; `BrevoContactService.addLead` (upsert + attribut **SOURCE** pour segmenter) appelé en **afterCommit** par `LeadCaptureService` (audit #2) ; config admin dans `BrevoConfigCard`. *Reste mineur : trigger pré-checkout (variante de l'exit-intent).* |
| 2.13 | IA contenu/SEO/blog multilingue + concierge RAG sur le site | 🟡 | ⭐⭐⭐ | L | 1.1 partiel |
| 2.14 ✅ | **Design custom (import CSS)** : classes stables + structure exposée + injection page & widget + éditeur CSS | ✅ | ⭐⭐ | M | — | **FAIT (A+B+C)**. A : 7 blocs rendent des classes namespacées `bkly-*` ; cosmétique sortie de l'inline → `blockStyles.css` surchargeable (sans `!important`). B : CSS custom injecté **dans le Shadow DOM du widget** (`customCss` sur `BaitlyBookingConfig` → `<style>` en dernier → atteint les `.cb-*`) + page. C : onglet **CSS** dans le pane droit du Studio = éditeur (persiste `config.customCss`) + palette **« Sélecteurs »** auto-générée (`selectorCatalog.ts` : blocs présents `bkly-*` + widget `cb-*`), clic = insertion d'une règle. *Polish futur : coloration syntaxique, import de fichier .css.* |
| 2.15 ✅ | **Aperçu du widget de réservation dans le Studio** (switch Page ↔ Réservation) + réservation atteignable sur la page publique | ✅ | ⭐⭐ | S | 2.14 | **FAIT**. Mode Aperçu : segmented **Page / Réservation** ; « Réservation » monte le **vrai** `BaitlyWidget` (thème + CSS custom courants, fidèle au public) via `WidgetPreview` + helper partagé `widgetThemeFromTokens`. Page publique : la barre de recherche du hero et le bouton CTA pointent vers `#reserver` (section du widget). Canvas/aperçu rendus inertes (les ancres ne naviguent pas dans le Studio). |
| 2.16 ✅ | **Studio UX** : colonnes réductibles, marges, analyse du design (réintégration) + aperçu widget sur site | ✅ | ⭐⭐ | M | — | **FAIT** : colonnes réductibles (icônes), repli auto par breakpoint (desktop replié), marges supprimées (éditeur full-bleed via `MainLayoutFull`), icône globe retirée ; **« Analyse du design »** dans la **palette ⌘K** + icône topbar → modale (`AiDesignMatcher`) appliquée en direct au widget + blocs ; **aperçu « Site »** (`SiteWidgetPreview`) : snapshot du site cible en iframe `srcDoc` (same-origin) + **widget monté DANS le site** à position choisie (bas/flottant/haut). |

## P3 — Plateforme, conformité, robustesse

| # | Item | État | Impact | Effort | Dépend |
|---|------|------|--------|--------|--------|
| 3.1 | API publique v1 + OpenAPI + portail développeur | 🟡 | ⭐⭐ | M | — |
| 3.2 | Analytics conversion/funnel + A/B + pixels (GA4/Meta/GTM) + analytics par embed | ❌ | ⭐⭐ | M | 0.1 |
| 3.3 | Consentement / cookies / RGPD (bannière + registre + DSAR) | ❌ | ⭐⭐ | M | 1.1 |
| 3.4 | Accessibilité WCAG 2.1 AA du widget (ARIA, clavier, contraste) | ❌ | ⭐⭐ | M | — |
| 3.5 | Cohérence inventaire OTA ↔ direct (anti-overbooking) | ❌ | ⭐⭐ | M | — |
| 3.6 | Unifier promo/voucher + gift cards/wallet + `FREE_NIGHTS` | 🟡 | ⭐ | M | — |
| 3.7 | Pricing dynamique yield (occupation réelle) | 🟡 | ⭐⭐ | L | sync canaux |
| 3.8 | Moyens de paiement (Apple/Google Pay, SEPA, mada/PayTabs/CMI) | 🟡 | ⭐⭐ | M | — |
| 3.9 | Instant-book vs request-to-book paramétrable par bien | 🟡 | ⭐ | S | — |

---

## Ordre d'exécution recommandé
1. **0.1 rendu public** (en cours) → débloque 0.2 / 3.2 et rend le Studio réel pour les voyageurs.
2. **0.3 caution + 0.6 anti-fraude + 0.4 annulation** (confiance/conformité paiement, in-repo).
3. **0.5 multi-devise + 0.7 acompte** (conversion).
4. **P1 SSR** lancé en parallèle dès que l'infra est prête (le verrou SEO).
5. **P2** profondeur (médias → blocs → templates → Book Direct & Save).

> Note : le rendu public **in-repo (0.1)** est client-rendered (pas de SEO) ; il rend la page composée **visible aux voyageurs** et répare l'URL hébergée. Le SEO réel arrive avec la **fondation SSR (1.1)**, le grand investissement infra.
