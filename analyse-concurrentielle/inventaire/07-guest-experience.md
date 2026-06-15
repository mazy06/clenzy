# Inventaire interne — Domaine 7 : Guest Experience & Livret d'accueil numérique

> **Source de vérité : le code.** Statut + preuve fichier:ligne. Date : 2026-06-13.
> Périmètre : livret/guidebook numérique, check-in en ligne, vérification d'identité (KYC),
> collecte de caution/dépôt, upsells/boutique, taxe de séjour, multi-langue, marque blanche,
> contrats/CGV, reviews/avis.
> Score interne domaine (cadrage Phase 0) : **2/3**.

---

## 1. Livret d'accueil numérique (`WelcomeGuide`) — **implémenté, riche**

**Entité** : `server/src/main/java/com/clenzy/model/WelcomeGuide.java`

- **1 livret par réservation** : FK `reservation_id` (`WelcomeGuide.java:25-28`) — un livret orphelin (sans résa) est marqué non disponible. Le livret est rattaché à `property_id` (`:21-23`) et `organization_id` (multi-tenant via `@Filter organizationFilter`, `:11`).
- **Sections de contenu** : JSONB `sections` (`:36-38`) — les 7 thèmes/sections du livret (arrivée, wifi, règles, équipements, etc.) stockés en pass-through JSON.
- **Branding** : `brandingColor` (`:50-51`) + `theme` (atelier/noir/jardin/azur/corail/brume/minuit, `:59-60`) + `logoUrl` (`:80-81`) + `heroPhotoIds` (carrousel hero à partir des `PropertyPhoto`, `:68-70`).
- **Message d'accueil personnalisé** : `welcomeMessage` (serif italique) + `hostNames` (signature) (`:72-78`).
- **POIs « autour de moi »** : JSONB `pois` `[{id, category, name, address, lat, lng, note}]` (`:40-43`) — carte de points d'intérêt structurés.
- **Activités curées par l'hôte** : JSONB `curatedActivities` `[{id, source, externalId, title, imageUrl, price, bookingUrl, ...}]` (`:45-48`).
- **Toggles d'affichage** : `chatbotEnabled`, `guestbookEnabled`, `activitiesEnabled`, `upsellsEnabled` (`:86-97`).
- Services : `WelcomeGuideService.java`, controller `WelcomeGuideController.java` (admin) + `PublicGuideController.java` (guest).
- Migrations Liquibase : 0195→0213 (création tables, thèmes, hero, POIs, activités curées, welcome message, upsells, rattachement résa).

## 2. Chatbot ancré sur le livret — **implémenté**

- Toggle `chatbotEnabled = true` par défaut (`WelcomeGuide.java:86-87`).
- Contexte chat : `WelcomeGuideService.GuestChatContext(orgId, language, content)` (`:483`) → branché à l'assistant IA interne (RAG). Le guest pose des questions, l'IA répond sur le contexte du livret/logement.
- Événement analytics `CHAT_MESSAGE` (`WelcomeGuideEventType.java`).

## 3. Page guest publique `/guide/:token` — **implémentée**

- Front : `client/src/modules/welcome-guide/PublicGuide.tsx`.
- **Token borné à la réservation** : `WelcomeGuideToken.java` + `WelcomeGuideTokenRepository.java` — lien sécurisé avec fenêtre de validité liée à la résa.
- **Langues** : la page accepte `fr | en | ar` (`PublicGuide.tsx:275-277, 315, 358`).
  - ⚠️ **Réserve forte (vérité code)** : la langue est **une valeur unique stockée par livret** (`WelcomeGuide.language`, `WelcomeGuideService.java:142` ; résolution `findByPropertyIdAndLanguage`, `:397-398`). **Pas d'auto-traduction serveur** du contenu : le multilingue se fait par **duplication de livret par langue** (un livret `fr`, un livret `en`, un livret `ar`), pas par traduction automatique d'un contenu unique. → multilingue **par duplication manuelle**, pas « auto-traduit ».
  - ⚠️ **RTL absent** : aucun `dir="rtl"` ni gestion de direction RTL dans `PublicGuide.tsx`. `ar` est une valeur acceptée mais **la mise en page RTL n'est pas implémentée** côté guest (cohérent avec le constat cadrage « AR/RTL absent »).

## 4. Check-in en ligne — **implémenté (déclaratif, non vérifié)**

- `OnlineCheckInService`, `OnlineCheckInRepository.java`, table `online_checkins` (V65 / migration).
- DTO soumission : `OnlineCheckInSubmission.java` — capture `firstName, lastName, email, phone, idDocumentNumber, idDocumentType, estimatedArrivalTime, specialRequests, numberOfGuests, additionalGuests`.
- ⚠️ **`idDocumentNumber` / `idDocumentType` = champs texte libres déclaratifs** : le voyageur saisit un numéro de pièce, **aucune vérification, aucun scan, aucun match biométrique** — ce n'est PAS du KYC vérifié.
- Événement analytics `CHECKIN_CLICK` (`WelcomeGuideEventType.java`).
- Instructions check-in : `CheckInInstructionsRepository.java`, `0230__add_guidelink_to_checkin_templates.sql` (lien livret injecté dans les templates check-in).

## 5. Vérification d'identité (KYC) — **PARTIEL : config org seulement, NON branché au flux guest**

- Package `server/src/main/java/com/clenzy/integration/kyc/`.
- `KycConnection.java` : connexion API-key org-scopée (`organization_id`, `provider_type`, `api_key_encrypted`), 1 connexion par (org, provider).
- `KycProviderType.java` : **SUMSUB / VERIFF / ONFIDO** (commentaire : pertinents MENA + EU).
- ⚠️ **Strategies de test = STUB** : `StubKycConnectionTestStrategy.java` — « acceptent toute API key non-vide en attendant le câblage des vraies APIs (Sumsub, Veriff, Onfido) ». **Aucun appel API réel.**
- ⚠️ **Aucune référence à `KycConnection` hors du package `integration/kyc/`** (grep : 0 usage externe) → **non branché au check-in en ligne ni au flux guest**. C'est une coquille de configuration (admin onglet Intégrations), pas une fonctionnalité voyageur active.
- **Verdict : KYC réel côté guest = absent.** Au mieux, capture déclarative non vérifiée d'un n° de pièce (cf. §4).

## 6. Caution / dépôt de garantie (pré-autorisation) — **ABSENT**

- ⚠️ **Aucune table, champ ou service.** Grep `securityDeposit | security_deposit | damage.?deposit | caution_amount | preAuthorization | pre_authorization | hold.?amount` sur `server/src/main/java` + migrations = **0 résultat**.
- Pas de pré-autorisation Stripe (hold), pas de dépôt remboursable, pas de SafeDeposit/Swikly-like. **Lacune complète.**

## 7. Upsells / services payants — **implémenté (Stripe Checkout)**

- Tables : `0202__create_upsell_tables.sql`, `0210/0211` (toggle + sélection par livret).
- `UpsellService.java`, `UpsellOrder.java`, `UpsellOrderStatus.java`, `UpsellOrderRepository.java`.
- DTOs : `UpsellOfferDto`, `PublicUpsellDto`, `UpsellCheckoutDto`, `UpsellOrderDto`, `UpsellOfferRequest`.
- Admin : `UpsellsAdmin.tsx`. Sélection par livret via `upsellOfferIds` (JSONB, `WelcomeGuide.java:99-106`).
- **Paiement guest** : `startUpsellCheckout()` / `confirmUpsellPayment()` dans `PublicGuide.tsx:88-108` → Stripe Checkout embarqué via `PublicGuideController.java`.
- Commission upsell paramétrable : `0212__add_contract_upsell_activity_commission.sql` (split plateforme/conciergerie/hôte sur `ManagementContract`).

## 8. Activités affiliées (Viator / GetYourGuide / Klook) — **CÂBLÉ MAIS INERTE**

- `ActivityProvider.java` : VIATOR / GETYOURGUIDE / KLOOK.
- Clients : `ViatorActivityClient.java`, décorateurs `GetYourGuideAffiliateLinkDecorator.java`, `KlookAffiliateLinkDecorator.java`, interface `AffiliateLinkDecorator.java`.
- Config : `ActivityAffiliateConfig.java` + `0197__create_activity_affiliate_configs.sql` (api_key chiffrée, `affiliate_id`, `enabled`).
- Commission : `ActivityCommission.java`, `ActivityCommissionService.java`.
- ⚠️ **`ViatorActivityClient` = SCAFFOLD inerte** : « inerte tant qu'aucune clé API n'est configurée (renvoie une liste vide). Le mapping DOIT être validé contre l'API live — pas de sandbox public ». Sans clé partenaire → liste vide. → **Recherche live d'activités = non activée** (clé partenaire à obtenir). Les activités **curées manuellement** (§1) fonctionnent, elles.

## 9. Taxe de séjour — **collectée au booking (pas au livret)**

- `FiscalEngine.java` + calculateurs `FranceTaxCalculator` / `MoroccoTaxCalculator` / `SaudiTaxCalculator`.
- `TouristTaxService` + `TouristTaxConfig` (`TouristTaxConfigRepository.java`, DTOs config/calcul).
- **Collectée au moteur de réservation** : `PublicBookingService.java:284-297` calcule la taxe si `config.isShowTouristTax()`, l'ajoute au total et la persiste sur la résa (`reservation.setTouristTaxAmount`, `:387`).
- ⚠️ C'est une fonctionnalité du **booking engine direct** (domaine 2), pas du livret/check-in guest. Pour ce benchmark : capacité **présente** mais pas « déclaration police automatisée » (registration des voyageurs auprès des autorités = absent — cf. constat cadrage).

## 10. Analytics du livret — **implémenté**

- `WelcomeGuideEvent.java`, `WelcomeGuideEventType.java` (GUIDE_OPENED, ACTIVITY_CLICK, CHAT_MESSAGE, GUESTBOOK_SUBMIT, CHECKIN_CLICK, DOOR_UNLOCK).
- `WelcomeGuideAnalyticsService.java`, `WelcomeGuideStatsDto.java`, `WelcomeGuideEventRepository.java`.
- Append-only, statistiques côté hôte.

## 11. Livre d'or / avis — **implémenté (interne)**

- `WelcomeGuideEntry.java`, `WelcomeGuideEntryService.java`, `WelcomeGuideEntryRepository.java`, `0196__create_welcome_guide_entries.sql`.
- Événement `GUESTBOOK_SUBMIT`. ⚠️ **Livre d'or interne** (avis déposés dans le livret) — **pas de gestion/sollicitation d'avis OTA** (Airbnb/Booking reviews) ni de push automatisé vers les plateformes.

## 12. Code d'accès serrure connectée — **implémenté**

- Événement `DOOR_UNLOCK` (`WelcomeGuideEventType.java`) : ouverture de porte depuis le livret (serrure connectée Nuki/KeyNest — cf. domaine 10 IoT). Le code/déverrouillage est exposé dans le livret guest.

## 13. Marque blanche — **partiel (branding livret, pas domaine custom guest)**

- Branding par livret : couleur, thème, logo, hero, signature hôte (§1). → expérience visuelle personnalisable.
- ⚠️ Pas de **domaine custom / white-label complet** documenté pour la page guide (`/guide/:token` sur le domaine Clenzy). Marque blanche = **niveau « branding »**, pas « domaine propre ».

## 14. Contrats / CGV signés (côté guest) — **hors livret**

- La signature électronique existe (SES interne `CLENZY_CUSTOM`, `/sign/{token}`, migration 0225) **pour le mandat de gestion propriétaire↔conciergerie** (domaine 12), **pas pour des CGV/contrat de location signés par le voyageur** dans le flux check-in. → côté guest : **absent**.

---

## Synthèse forces / faiblesses (domaine 7)

**Forces (preuves code)**
- Livret riche & natif au PMS : 1 livret/résa auto-rempli (logement, codes), POIs structurés, activités curées, hero, thèmes, message d'accueil, chatbot ancré, livre d'or, analytics — couverture fonctionnelle large.
- Upsells payants Stripe Checkout opérationnels + split de commission paramétrable (plateforme/conciergerie/hôte) — monétisation 2 niveaux **inédite** sur le marché.
- Check-in en ligne fonctionnel, token borné à la résa (sécurité du lien).
- Taxe de séjour calculée/collectée au booking (FR/MA/KSA).
- **Zéro add-on / zéro double-saisie** : tout est intégré au PMS (vs concurrents = add-ons branchés sur un PMS tiers).

**Faiblesses (preuves code)**
- **Caution / dépôt = 0** (aucune pré-autorisation Stripe, aucune table) — lacune complète vs Chekin/Charge/Duve.
- **KYC réel = absent côté guest** : config org stub (Sumsub/Veriff/Onfido non câblés), check-in capture un n° de pièce **déclaratif non vérifié**. Pas de registration police automatisée.
- **Multilingue par duplication, pas auto-traduit** ; **RTL non implémenté** côté guest (le claim « AR/RTL natif » du PDF est overclaim — cf. cadrage §8).
- **Activités affiliées live inertes** (Viator/GYG/Klook scaffold sans clé partenaire) → seules les activités curées manuelles fonctionnent.
- **Avis = livre d'or interne** seulement (pas de sollicitation/gestion d'avis OTA).
- Marque blanche = branding livret, pas domaine guest custom.

**Score interne domaine : 2/3** (livret/upsell/check-in solides et différenciants par l'intégration PMS ; mais caution absente, KYC non branché, RTL/auto-traduction absents, activités inertes vs spécialistes guest experience).
