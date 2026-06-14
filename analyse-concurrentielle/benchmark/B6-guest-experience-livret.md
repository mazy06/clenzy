# B6 — Benchmark : Guest Experience & Livret d'accueil numérique

> **Domaine 7** (pondération cadrage : 7 % — « upsell + satisfaction ; marché de spécialistes »).
> **Panel :** Clenzy vs **Touch Stay, Duve, Chekin, Enso Connect, Hostfully Guidebooks** (spécialistes guest experience) + **Hostaway, Guesty** (PMS avec app voyageur).
> **Grille 0–3** (cf. cadrage §5). Concurrents : datés + sourcés + niveau de confiance. Veille web : 2025-2026.
> **Date :** 2026-06-13.
>
> **⚠️ Réutilisation explicite du benchmark existant.** Ce rapport **prolonge et corrige** le PDF
> `docs/Analyse_Concurrentielle_Livret_Accueil_Baitly_2026-06.pdf` (« Baitly » = nom marketing
> antérieur de Clenzy ; 7 juin 2026, 11 concurrents, 17 critères, grille ✓/◐/✗). On en réutilise :
> la **taxonomie** (livret, check-in, conformité, upsells, activités affiliées, sécurité du lien,
> PMS-natif), les **catégories de marché** (guidebook-first / plateforme d'expérience / check-in &
> conformité), les **constats tarifaires**, et plusieurs **scores concurrents**. On le **corrige sur
> deux points où le PDF surévaluait Clenzy** (vérité code 2026-06, cf. `inventaire/07-guest-experience.md`) :
> 1. **« Multilingue auto-traduction ✓ » et « Arabe + RTL natif ✓ »** : faux. Le livret est mono-langue
>    par instance (multi-langue **par duplication**, pas auto-traduit) et **aucun RTL** n'est rendu
>    côté guest. Le cadrage Phase 0 (§8) classe déjà « AR/RTL » comme claim marketing ≠ code.
> 2. **« Check-in en ligne ✓ » sans nuance** : le check-in capture un **n° de pièce déclaratif non
>    vérifié** ; la **vérification d'identité (KYC) réelle est absente** côté guest (providers stub).
> On **recadre aussi le panel** sur les 7 acteurs imposés (sous-ensemble du PDF + les 2 PMS Hostaway/Guesty)
> et on **ajoute la collecte de caution/dépôt** comme critère de premier plan (absent du PDF, lacune Clenzy).

---

## Section 1 — Périmètre & taxonomie du domaine

La « Guest Experience & Livret » couvre l'expérience numérique du voyageur du pré-séjour au post-départ. Sous-fonctionnalités retenues (comparables, 20 critères — détail granulaire `data/07-guest-experience.csv`) :

1. **Livret/guidebook numérique personnalisé** — guide de séjour brandé (logement, codes, règles, équipements).
2. **Carte POI structurée + photos d'accès** — points d'intérêt géolocalisés, indications d'arrivée illustrées.
3. **Multi-langue du contenu** — plusieurs langues servies au voyageur (auto-traduit ou par duplication).
4. **RTL / arabe natif** — mise en page droite-à-gauche réellement rendue.
5. **Consultation hors-ligne (PWA)** — livret accessible sans réseau.
6. **Chatbot IA ancré sur le livret** — assistant répondant sur le contexte logement/séjour.
7. **Check-in en ligne** — collecte d'infos voyageur avant arrivée.
8. **Vérification d'identité (KYC vérifié)** — OCR pièce + selfie + match biométrique (≠ saisie déclarative).
9. **Collecte de caution / dépôt** — pré-autorisation Stripe / dépôt remboursable / waiver de dommages.
10. **Upsells / boutique payante** — services additionnels payés en ligne (Stripe).
11. **Activités affiliées live + commission** — catalogue Viator/GYG/Klook avec revenu d'affiliation.
12. **Taxe de séjour** — calcul + collecte automatisés.
13. **Déclaration police / registration voyageurs** — reporting réglementaire aux autorités.
14. **Contrats / CGV signés par le voyageur** — e-signature du contrat de location/règlement.
15. **Reviews / sollicitation d'avis OTA** — push automatisé vers Airbnb/Booking.
16. **Marque blanche** — domaine/app guest sous la marque du gestionnaire.
17. **Web app vs app native voyageur** — type de diffusion (PWA web vs app store).
18. **Analytics du livret / engagement** — mesure d'ouverture/clics/usage.
19. **Livre d'or / avis interne** — recueil d'avis dans le livret.
20. **Intégration PMS native (zéro double-saisie)** — le livret vit dans le PMS, pas un add-on tiers.

**Catégories de marché (réutilisées du PDF) :** *guidebook-first* (Touch Stay, Hostfully), *plateforme d'expérience* (Duve, Enso Connect), *check-in & conformité* (Chekin), *PMS avec app voyageur* (Hostaway, Guesty), *PMS-natif transversal* (Clenzy).

---

## Section 2 — Inventaire interne Clenzy (vérité code)

*(détail complet : `inventaire/07-guest-experience.md`)*

**Forces (preuves code)**
- **Livret riche & natif au PMS** : `WelcomeGuide.java` — 1 livret/réservation (FK `reservation_id:25-28`), sections JSONB (7 thèmes), POIs structurés (lat/lng/catégorie, `:40-43`), activités curées (`:45-48`), hero carrousel, 7 thèmes visuels, message d'accueil + signature hôte, chatbot ancré (`chatbotEnabled:86`), livre d'or (`WelcomeGuideEntry`), analytics (`WelcomeGuideEvent`, 6 types d'événements).
- **Page guest `/guide/:token`** (`PublicGuide.tsx`) avec **token borné à la réservation** (`WelcomeGuideToken`) — sécurité du lien (fenêtre de validité, révocation).
- **Upsells payants Stripe Checkout** opérationnels (`UpsellService`, `UpsellOrder`, checkout dans `PublicGuide.tsx:88-108`) + **split de commission paramétrable plateforme/conciergerie/hôte** (`0212__add_contract_upsell_activity_commission.sql`) — monétisation 2 niveaux **inédite**.
- **Check-in en ligne** fonctionnel (`OnlineCheckInService`, table `online_checkins`).
- **Taxe de séjour** calculée + collectée au booking (`PublicBookingService.java:284-297`, `TouristTaxService`, FiscalEngine FR/MA/KSA).
- **Zéro add-on / zéro double-saisie** : tout intégré au PMS — le seul moat structurel face aux spécialistes.

**Faiblesses (preuves code)**
- **Caution / dépôt = 0** : grep exhaustif `securityDeposit/preAuthorization/hold` sur `server/src/main/java` + migrations = **aucun résultat**. Aucune pré-autorisation Stripe.
- **KYC réel = absent côté guest** : `integration/kyc/` = connexion org-scopée (Sumsub/Veriff/Onfido) mais **`StubKycConnectionTestStrategy` = aucun appel API réel** ; **0 référence hors du package** → non branché au check-in. Le check-in capture `idDocumentNumber/idDocumentType` en **texte libre déclaratif** (`OnlineCheckInSubmission.java`), pas de scan/biométrie.
- **Multi-langue par duplication, pas auto-traduit** : `findByPropertyIdAndLanguage` (`WelcomeGuideService.java:397`) — un livret par langue ; **pas de traduction serveur**. **RTL non rendu** côté guest (aucun `dir="rtl"` dans `PublicGuide.tsx`).
- **Activités affiliées live inertes** : `ViatorActivityClient` = **scaffold** (« inerte tant qu'aucune clé API ») ; Viator/GYG/Klook sans clé partenaire → liste vide. Seules les activités **curées manuelles** fonctionnent.
- **Déclaration police / registration voyageurs = absent** ; **avis = livre d'or interne** seulement (pas de push OTA).

**Score interne domaine : 2/3** (livret/upsell/check-in solides et différenciants par l'intégration PMS, mais en retrait des spécialistes sur caution, KYC vérifié, RTL/auto-traduction, activités live et conformité).

---

## Section 3 — Analyse concurrent par concurrent (daté & sourcé)

### Enso Connect — **2,4/3** *(plateforme d'expérience STR la plus complète + IA agentique)*
**Boarding Pass** : app guest dynamique couvrant pré-arrivée, instructions de check-in, **vérification multi-voyageurs + ID**, **signature du contrat de location**, **protection dommages (caution remboursable OU damage waiver non-remboursable, au choix du voyageur)**, **upsells e-commerce + expériences**, guidebooks numériques. **AI AutoPilot** : IA **agentique** traitant automatiquement ~80 % des demandes reconnues, **CoPilot** pour les drafts à valider — référence du marché en IA proactive. Marketplace activités. Prix **sur devis** (cap upsell ≤ 25 $/add-on). **Confiance : Confirmé** (ensoconnect.com « What is Enso Connect » / Boarding Pass, case studies upsell 2025).

### Duve — **2,4/3** *(leader hôtel + STR, primé « Best Guest App / Best Upselling »)*
Suite guest **white-label** (app sans téléchargement), **online check-in**, mobile keys, **upsells personnalisés** (data-driven), analytics temps réel, **~30 langues**. **ID document scanning + e-signature + collecte de caution/dépôt** ; **intégration PMS 2-way** (ID, détails voyageurs, mise à jour résa en temps réel). 1 050+ clients, 64 pays (2025). Modèle 120–200 $+/mois + add-ons (le prix affiché sous-estime le coût réel). **Confiance : Confirmé** (duve.com, Hotel Tech Report 2026, Hotel Tech Awards 2025).

### Guesty — **2,25/3** *(PMS enterprise + Guest Experience suite + app voyageur)*
**Guest App / Guest Communication** : check-in en ligne, **collecte de caution/dépôt**, **vérification d'identité**, upsells (Guesty marketplace), e-sign d'accords, sollicitation d'avis OTA automatisée, multi-langue. **ReplyAI** (chatbot/IA messagerie, Autopilot avr. 2026) crédibilise l'assistant guest. Marque blanche avancée (app/portail brandé). Intégration **native au PMS** = avantage vs add-ons. **Confiance : Probable** (guesty.com features « Guest Experience » / Guest App, marketplace 2025-2026 ; profondeur livret moindre qu'un spécialiste guidebook).

### Hostaway — **1,85/3** *(PMS pro, app voyageur + marketplace)*
**Guest portal / Guest App** : check-in en ligne, **collecte de caution/dépôt**, upsells (add-ons payants), templates, **review automation** (push avis OTA mature), multi-langue. **ID verification** via marketplace/partenaires plutôt que natif profond. Livret/guidebook plus léger qu'un spécialiste (orienté communication + ops). Diffusion app + web. **Confiance : Probable** (hostaway.com features « Guest Experience »/« Reviews », marketplace 2025).

### Hostfully Guidebooks — **1,6/3** *(guidebook-first, free tier, multilingue fort)*
Guidebooks web/QR, **auto-traduction 15+ langues (dont français et arabe)** — le seul du panel avec arabe confirmé en traduction. **8 % d'affiliation Viator** (activités live actives), sync PIN serrure, upsells (mid-stay cleaning, courses), free tier (1 livret) puis ≈ 8 $/mois. **Pas de check-in/ID/caution natifs profonds** (valeur liée à l'écosystème Hostfully). **Confiance : Confirmé** (hostfully.com guidebooks, comparatifs Zeevou/Operto/Touchstay 2025-2026).

### Clenzy — **1,6/3** *(granulaire ; score domaine = 2/3, cf. lecture §4)*
Voir Section 2. Livret natif PMS riche + upsells Stripe + check-in + taxe de séjour ; mais caution=0, KYC non branché, RTL/auto-traduction absents, activités live inertes.

### Chekin — **1,5/3** *(champion conformité + KYC + caution, livret en option)*
Cœur **check-in & conformité** : **KYC complet** (OCR pièce + selfie + **match biométrique**), **registration police 20+ pays** (dont EAU), **taxe de séjour** automatisée par municipalité, **caution avec pré-autorisation + remboursement 1-clic** (frais 1,5 % + 0,30 €) + protection Waivo. e-signature d'accords. **Mais le livret/guidebook n'est qu'une option** (faible côté contenu/POI/chatbot/branding) → score bas sur les critères « expérience livret », très haut sur conformité/KYC/caution. 35+ PMS intégrés. Tarif 3,95–7,95 €/logement/mois. **Confiance : Confirmé** (chekin.com features/blog 2025-2026, STR Specialist review 2026).

### Touch Stay — **1,1/3** *(guidebook-first le plus mûr en contenu/IA, mais standalone sans check-in)*
Le **guidebook de référence** : génération IA + chatbot ancré, large écosystème PMS, **review pop-up 5 étoiles** (route les voyageurs satisfaits vers les avis publics), collecte de contacts, analytics d'engagement, **upsell widget récent** (transferts, welcome packages, tours). **Pas de check-in / ID / caution / serrure / taxe de séjour** (pur livret). PWA web/QR ≈ 8–15 $/logement/mois — cher à l'échelle. **Confiance : Confirmé** (touchstay.com, comparatifs Zeevou/GuestIntro 2025-2026).

---

## Section 4 — Tableau comparatif synthétique

*(détail granulaire 20 critères : `data/07-guest-experience.csv`)*

| Fonctionnalité | Clenzy | TouchStay | Duve | Chekin | Enso | Hostfully | Hostaway | Guesty |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Livret/guidebook personnalisé | 3 | 3 | 3 | 1 | 3 | 3 | 2 | 2 |
| Carte POI + photos d'accès | 3 | 2 | 3 | 1 | 3 | 3 | 1 | 2 |
| Multi-langue du contenu | **1** | 1 | 3 | 2 | 3 | 3 | 2 | 3 |
| RTL / arabe natif | **0** | 0 | 1 | 1 | 1 | 2 | 1 | 1 |
| Hors-ligne (PWA) | 1 | 1 | 1 | 0 | 1 | 0 | 0 | 0 |
| Chatbot IA ancré | 2 | 2 | 2 | 0 | 3 | 2 | 2 | 3 |
| Check-in en ligne | 2 | 0 | 3 | 3 | 3 | 1 | 2 | 3 |
| Vérif. identité (KYC vérifié) | **1** | 0 | 3 | 3 | 3 | 0 | 2 | 2 |
| Collecte caution/dépôt | **0** | 0 | 3 | 3 | 3 | 0 | 2 | 3 |
| Upsells / boutique (Stripe) | **3** | 2 | 3 | 2 | 3 | 3 | 3 | 3 |
| Activités affiliées live + commission | **1** | 0 | 2 | 1 | 3 | 3 | 1 | 2 |
| Taxe de séjour (calcul + collecte) | 2 | 0 | 2 | 3 | 2 | 1 | 2 | 3 |
| Déclaration police / registration | **0** | 0 | 1 | 3 | 2 | 0 | 1 | 1 |
| Contrats / CGV signés (voyageur) | 1 | 0 | 3 | 2 | 3 | 1 | 2 | 2 |
| Reviews / sollicitation avis OTA | 1 | 2 | 2 | 0 | 2 | 1 | 3 | 3 |
| Marque blanche (domaine/app guest) | 1 | 2 | 3 | 1 | 2 | 2 | 2 | 3 |
| Web app vs app native | 2 | 2 | 3 | 2 | 2 | 2 | 3 | 3 |
| Analytics du livret | 3 | 3 | 3 | 1 | 3 | 3 | 2 | 2 |
| Livre d'or / avis interne | 2 | 1 | 1 | 0 | 1 | 0 | 1 | 1 |
| Intégration PMS native (0 saisie) | **3** | 1 | 2 | 1 | 2 | 2 | 3 | 3 |
| **Moyenne (20 critères)** | **1,6** | **1,1** | **2,35** | **1,5** | **2,4** | **1,6** | **1,85** | **2,25** |

> **Lecture des scores.** Le **score domaine Clenzy = 2/3** (grille 0–3 appliquée au domaine : un standard de marché solide, différenciant par l'intégration PMS). La **moyenne granulaire de 1,6** est plus basse parce qu'elle inclut des critères de **spécialistes guest experience** où Clenzy est à 0-1 : caution (0), KYC vérifié (1), RTL (0), registration police (0), activités live (1). C'est exactement l'écart à combler. Confiance globale : **Confirmé** pour Enso/Duve/Chekin/Touch Stay/Hostfully, **Probable** pour Hostaway/Guesty (profondeur livret moins documentée que les spécialistes).

---

## Section 5 — Forces & faiblesses de Clenzy (positionnement)

**Parités (au niveau du marché)**
- **Livret personnalisé + POI + photos d'accès + analytics** : Clenzy = 3, à parité avec les spécialistes (Touch Stay, Duve, Enso, Hostfully). Couverture de contenu = au standard haut.
- **Upsells / boutique payante** : Clenzy = 3, à parité avec tous (Duve, Enso, Hostfully, Hostaway, Guesty).
- **Chatbot IA ancré** : Clenzy = 2, dans la moyenne (Enso/Guesty à 3 avec l'agentique).

**Avantages différenciants**
- **Intégration PMS native (3) + monétisation 2 niveaux** : Clenzy est le seul **PMS-natif** parmi les spécialistes guest experience (Touch Stay, Duve, Chekin, Enso, Hostfully sont tous des **add-ons à brancher**). Le split de commission **plateforme/conciergerie/hôte** sur upsells/activités est **inédit** (réutilise le constat clé du PDF). Zéro double-saisie, une seule facture.
- **Token borné à la réservation (sécurité du lien)** : moat partagé seulement par les suites les plus matures.
- **Livre d'or interne (2)** : au-dessus de la moyenne du panel (la plupart à 0-1).

**Faiblesses critiques**
- **Caution / dépôt = 0** : seul acteur du panel **sans aucune collecte de caution**. Duve, Chekin, Enso, Guesty, Hostaway l'ont tous (pré-autorisation ou waiver). Lacune commerciale visible pour une conciergerie pro qui doit protéger les logements gérés.
- **KYC vérifié = 1 (déclaratif)** : Chekin/Duve/Enso à 3 (OCR + selfie + biométrie). Clenzy a la coquille org (Sumsub/Veriff/Onfido) mais **stub non branché** → check-in déclaratif non vérifié.
- **RTL / arabe (0) + multi-langue par duplication (1)** : l'argument « MENA / AR-RTL » du PDF est **non tenu par le code**. Hostfully (auto-traduction 15+ langues dont AR) et Duve (~30 langues) dominent. Pour une ambition MENA, c'est l'écart le plus contradictoire avec le discours.
- **Déclaration police / registration (0)** : Chekin (20+ pays) en fait son cœur. Sur un marché FR (déclaration en mairie) et MENA réglementé, c'est une parité réglementaire manquante.
- **Activités affiliées live inertes (1)** : Hostfully (8 % Viator) et Enso encaissent déjà ; Clenzy a câblé Viator/GYG/Klook mais sans clé partenaire → revenu dormant.

---

## Section 6 — Synthèse chiffrée & écarts

| Acteur | Score moyen (20 critères) | Positionnement |
|---|:---:|---|
| Enso Connect | **2,4** | Plateforme d'expérience STR la plus complète + IA agentique (AutoPilot) |
| Duve | **2,35** | Leader hôtel/STR, white-label, upsells primés, KYC + caution + ~30 langues |
| Guesty | **2,25** | PMS enterprise, app voyageur native, KYC + caution + avis OTA, ReplyAI |
| Hostaway | **1,85** | PMS pro, guest app + review automation + caution + upsells |
| **Clenzy** | **1,6** | Livret PMS-natif riche + upsells + monétisation 2 niveaux ; caution=0, KYC stub, RTL absent |
| Hostfully Guidebooks | **1,6** | Guidebook-first, auto-traduction 15+ langues (dont AR), 8 % Viator live |
| Chekin | **1,5** | Champion conformité/KYC/caution ; livret en option (faible côté contenu) |
| Touch Stay | **1,1** | Guidebook le plus mûr en contenu/IA ; standalone sans check-in/ID/caution |

**Top 3 gaps** (écart le plus pénalisant pour le segment conciergerie pro FR/MENA)
1. **Collecte de caution / dépôt = 0** (vs 2-3 chez Duve/Chekin/Enso/Guesty/Hostaway) — protection des logements gérés, attente forte d'une conciergerie pro ; absence totale dans le code.
2. **KYC vérifié non branché (1 vs 3 Chekin/Duve/Enso)** — la coquille org existe (providers stub) mais le check-in reste déclaratif non vérifié ; couplé à l'absence de **registration police (0 vs 3 Chekin)**, c'est le bloc « conformité/sécurité » à combler.
3. **RTL/arabe (0) + multi-langue par duplication (1 vs 3 Duve / 3 Hostfully avec AR)** — contredit directement l'argument MENA du discours commercial ; auto-traduction et RTL réels manquants côté guest.

**Top 3 avantages** (à défendre / mettre en avant)
1. **Intégration PMS-native (3) + monétisation 2 niveaux configurable (split plateforme/conciergerie/hôte)** — unique sur le panel ; aucun spécialiste (add-on) ne peut le répliquer. Zéro add-on facturé, zéro double-saisie.
2. **Livret riche complet (3) : POI structurés, photos d'accès, hero, thèmes, chatbot ancré, upsells Stripe, analytics, livre d'or** — couverture de contenu au niveau des meilleurs guidebooks.
3. **Token borné à la réservation (sécurité du lien)** — fenêtre de validité/révocation, moat partagé seulement par les suites matures.

**Parités confirmées** : livret personnalisé, carte POI + photos d'accès, upsells/boutique, analytics du livret, chatbot IA ancré (niveau moyen).

---

## Section 7 — Initiatives recommandées (priorisées)

> Format : `Titre | Type | Impact(1-3) | Effort(S/M/L) | Reach(1-3) | Confiance(0.1-1.0)`

1. **Collecte de caution / dépôt via pré-autorisation Stripe (hold) dans le check-in** | Parité critique | Impact 3 | Effort M | Reach 3 | Confiance 0,9
   *Brique totalement absente (grep = 0). Réutiliser `StripeGateway` (RequestOptions + idempotency keys, règle paiement projet) pour poser un hold à la réservation/check-in et le libérer/capturer après départ ; option « damage waiver » non-remboursable façon Enso. Coche la case n°1 attendue par une conciergerie pro et rattrape Duve/Chekin/Enso/Guesty/Hostaway d'un coup.*

2. **Brancher le KYC réel (Sumsub d'abord) au flux check-in + remplacer les stubs** | Parité conformité | Impact 3 | Effort M | Reach 2 | Confiance 0,8
   *La coquille org existe déjà (`integration/kyc/`, providers SUMSUB/VERIFF/ONFIDO) mais `StubKycConnectionTestStrategy` = aucun appel API. Implémenter l'appel réel + relier au `OnlineCheckInService` (OCR + selfie + match) pour passer du n° de pièce déclaratif à une identité vérifiée. Sumsub = leader MENA accepté par les banques saoudiennes (cohérent ambition MENA).*

3. **Activer les activités affiliées live (clé partenaire Viator) + reporting de commission** | Quick-win / revenu | Impact 2 | Effort S | Reach 2 | Confiance 0,8
   *`ViatorActivityClient` est un scaffold inerte : obtenir la clé partenaire Viator (la plus accessible), valider le mapping live, brancher `ActivityCommissionService`. Transforme une brique dormante en revenu — terrain où Hostfully (8 %) et Enso encaissent déjà. Réutilise le constat du PDF.*

4. **Multi-langue par auto-traduction + rendu RTL réel côté guest** | Différenciation MENA | Impact 2 | Effort M | Reach 2 | Confiance 0,7
   *Aujourd'hui multi-langue par duplication de livret et aucun `dir="rtl"`. Brancher `TranslationService` (DeepL/Google, déjà en place pour les templates de messagerie — cf. B5) pour auto-traduire le contenu du livret, et implémenter le rendu RTL dans `PublicGuide.tsx`. Aligne enfin le code sur l'argument commercial MENA et rejoint Hostfully/Duve.*

5. **Déclaration police / registration voyageurs (FR mairie + MENA)** | Différenciation conformité | Impact 2 | Effort L | Reach 2 | Confiance 0,6
   *Lacune n°1 vs Chekin (20+ pays). Prioriser la déclaration FR (taxe de séjour déjà calculée → étendre au reporting d'occupation) puis MENA (EAU). Effort élevé (formats par juridiction) mais différenciateur fort sur un marché réglementé, et synergie avec le KYC vérifié (init. 2).*

---

### Sources (veille datée)
- **PDF de référence réutilisé** : `docs/Analyse_Concurrentielle_Livret_Accueil_Baitly_2026-06.pdf` (7 juin 2026, 11 concurrents, 17 critères) — taxonomie, catégories de marché, scores concurrents partiels, constats tarifaires.
- **Enso Connect** — Boarding Pass (ID verification, deposit/waiver, rental agreement, upsells), AI AutoPilot/CoPilot : ensoconnect.com « what-is-enso-connect », case studies upsell (2025).
- **Duve** — Guest app white-label, online check-in, upsells, ID scan + e-sign + deposit, ~30 langues : duve.com, hoteltechreport.com (Duve App / Online Check-in, 2026), Hotel Tech Awards 2025.
- **Chekin** — KYC OCR+selfie+biometric, registration police 20+ pays, tourist tax, deposit pré-auth 1,5 % + Waivo : chekin.com/blog (security deposit, guest app, 2025), STR Specialist review (2026).
- **Touch Stay** — guidebook IA + chatbot, upsell widget, review pop-up, analytics : touchstay.com, comparatifs Zeevou / Operto / GuestIntro (2025-2026).
- **Hostfully Guidebooks** — auto-traduction 15+ langues (dont AR), 8 % Viator, sync PIN, free tier : hostfully.com (Airbnb guidebook alternatives), comparatifs Zeevou/Touchstay (2025-2026).
- **Hostaway** — guest app/portal, review automation, deposit, upsells : hostaway.com/features (Guest Experience / Reviews), marketplace (2025).
- **Guesty** — Guest App + Guest Experience suite (check-in, deposit, ID, upsells, avis), ReplyAI : guesty.com/features, marketplace (2025-2026).
- **Annuaires** : Hotel Tech Report, Capterra (recoupement capacités).
