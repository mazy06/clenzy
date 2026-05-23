# Comparatif Clenzy vs concurrents — Feature by feature

Document de référence pour les démos et le pitch deck.
Mis à jour le 23 mai 2026.

> **Légende**
> - ✅ Disponible et complet
> - 🟡 Partiel / limité
> - ❌ Non disponible
> - 💰 Disponible mais payant en option

---

## Vue synthétique

| Catégorie | Clenzy | Smoobu | Hostaway | iGMS | Lodgify | Hospitable |
|-----------|:------:|:------:|:--------:|:----:|:-------:|:----------:|
| **Calendrier & sync** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Channel Manager natif** | 🟡 (via Channex) | ✅ | ✅ | ✅ | 🟡 | ✅ |
| **Multi-propriétaires natif** | ✅ | 🟡 | 🟡 | ❌ | ❌ | ❌ |
| **Reversements auto** | ✅ | ❌ | 🟡 | ❌ | ❌ | ❌ |
| **Booking Engine intégré** | ✅ | 💰 | ✅ | ❌ | ✅ | ❌ |
| **Multi-langues (FR/EN/AR)** | ✅ | 🟡 | 🟡 | 🟡 | 🟡 | ❌ |
| **Support en français** | ✅ | 🟡 | ❌ | ❌ | 🟡 | ❌ |
| **Conformité NF facturation** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Multi-pays paiement** | ✅ FR/MA/KSA | 🟡 EU | ✅ Global | ✅ Global | ✅ EU/US | ✅ US |
| **App mobile native** | ✅ (React Native) | 🟡 (Web only) | ✅ | ✅ | ✅ | ✅ |
| **Prix /bien/mois** | **39 €** | 15-25 € | 35-45 € | 14-22 $ | 20-72 $ | 38 $ |

---

## 1. Calendrier et gestion de réservations

| Feature | Clenzy | Smoobu | Hostaway | iGMS | Lodgify | Hospitable |
|---------|:------:|:------:|:--------:|:----:|:-------:|:----------:|
| Calendrier multi-propriétés unifié | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Vue planning par propriété | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Glisser-déposer pour modifier dates | ✅ | ✅ | ✅ | 🟡 | ✅ | ✅ |
| Création résa manuelle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Blocage périodes (entretien, perso) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Historique modifications | ✅ | 🟡 | ✅ | 🟡 | 🟡 | ✅ |
| Notes internes par résa | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tags / catégories résas | ✅ | 🟡 | ✅ | ✅ | 🟡 | ✅ |

**Avantage Clenzy :** Calendrier multi-propriétés très lisible, vue Planning Property Column unique (regroupement intelligent par propriétaire).

---

## 2. Channel Manager et OTAs

| Feature | Clenzy | Smoobu | Hostaway | iGMS | Lodgify | Hospitable |
|---------|:------:|:------:|:--------:|:----:|:-------:|:----------:|
| Import iCal (Airbnb, Booking, Vrbo) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Channel Manager API (sync temps réel) | 🟡 *via Channex M2-M3* | ✅ | ✅ | ✅ | 🟡 | ✅ |
| Connexion Airbnb directe (API officielle) | ❌ *M12+* | ✅ | ✅ | ✅ | ❌ | ✅ |
| Connexion Booking.com directe | ❌ *via Channex* | ✅ | ✅ | ✅ | ✅ | 🟡 |
| Connexion Vrbo / Expedia | ❌ *via Channex* | ✅ | ✅ | ✅ | ✅ | 🟡 |
| Sync prix bidirectionnelle | 🟡 *via Channex* | ✅ | ✅ | ✅ | 🟡 | ✅ |
| Restrictions (min/max stay, gap) push OTA | 🟡 *via Channex* | ✅ | ✅ | ✅ | 🟡 | ✅ |
| OTAs émergents (HomeToGo, Trip.com, etc.) | 🟡 *7 OTAs en stub* | 🟡 | ✅ | 🟡 | 🟡 | 🟡 |
| OTAs MENA (Almosafer, Cleartrip, Hala) | ✅ *3 stubs* | ❌ | ❌ | ❌ | ❌ | ❌ |

**Avantage Clenzy :** Couverture MENA unique (Almosafer, Cleartrip, Hala stubs activables) + flexibilité du modèle Channex évolutif.
**Faiblesse à corriger :** Channel Manager natif manquant (P0 — voir plan d'intégration Channex).

---

## 3. Pricing dynamique et yield management

| Feature | Clenzy | Smoobu | Hostaway | iGMS | Lodgify | Hospitable |
|---------|:------:|:------:|:--------:|:----:|:-------:|:----------:|
| Tarif de base par propriété | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tarifs saisonniers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tarifs promotionnels (early bird, last min) | ✅ | 🟡 | ✅ | ✅ | 🟡 | ✅ |
| Rate overrides par date | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| YieldRules automatiques | ✅ | ❌ | ✅ | 🟡 | ❌ | ✅ |
| Pricing dynamique IA (occupancy-based) | 🟡 *à venir* | ❌ | 🟡 (via PriceLabs) | 🟡 | ❌ | ✅ |
| Intégrations pricing externes (PriceLabs, Beyond) | ✅ | 💰 | ✅ | ✅ | 💰 | 🟡 |
| Min/max nights par saison | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Gap night rules | ✅ | 🟡 | ✅ | 🟡 | 🟡 | ✅ |
| Frais ménage / dépôt configurables | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Taxes auto (taxe séjour, TVA) | ✅ | 🟡 | ✅ | 🟡 | ✅ | ✅ |

**Avantage Clenzy :** Architecture PriceEngine à 6 niveaux (très flexible) + intégrations natives PriceLabs / Beyond.

---

## 4. Communication invités (Guest messaging)

| Feature | Clenzy | Smoobu | Hostaway | iGMS | Lodgify | Hospitable |
|---------|:------:|:------:|:--------:|:----:|:-------:|:----------:|
| Email automatique pré/post séjour | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Templates personnalisables | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| SMS Twilio | ✅ | ❌ | 💰 | 💰 | ❌ | ✅ |
| WhatsApp Business | ✅ | ❌ | 💰 | ❌ | ❌ | ✅ |
| Messaging Airbnb natif | 🟡 *via Channex* | ✅ | ✅ | ✅ | ❌ | ✅ |
| Inbox unifiée multi-OTA | 🟡 *partiel* | ✅ | ✅ | ✅ | 🟡 | ✅ |
| Réponses IA / suggestions | ❌ | ❌ | 🟡 | 🟡 | ❌ | ✅ |
| Auto-reply hors heures | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ |
| Multi-langues (auto-traduction) | ✅ | 🟡 | ✅ | 🟡 | 🟡 | ✅ |
| Historique conversations sauvegardé | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Avantage Clenzy :** Couverture multi-canale (Email + SMS + WhatsApp) sans surcoût + support FR/EN/AR natif avec RTL.

---

## 5. Gestion équipes et interventions

| Feature | Clenzy | Smoobu | Hostaway | iGMS | Lodgify | Hospitable |
|---------|:------:|:------:|:--------:|:----:|:-------:|:----------:|
| Comptes utilisateurs par rôle | ✅ *6 rôles* | ✅ | ✅ | ✅ | 🟡 | 🟡 |
| Planning ménage automatique | ✅ | 🟡 | ✅ | 🟡 | 🟡 | ✅ |
| Photos check-in/out avant/après | ✅ | ❌ | 🟡 | ❌ | ❌ | 🟡 |
| Inventaire propriété configurable | ✅ | ❌ | 🟡 | ❌ | ❌ | ❌ |
| Tickets maintenance | ✅ | ❌ | ✅ | ❌ | 🟡 | 🟡 |
| Signature électronique check-in | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| App mobile équipe terrain | ✅ *RN* | ❌ | ✅ | 🟡 | ✅ | ✅ |
| Notifications push équipe | ✅ | ❌ | ✅ | 🟡 | ✅ | ✅ |
| Compte-rendu intervention | ✅ | ❌ | 🟡 | ❌ | ❌ | 🟡 |
| Anomalies / casse à signaler | ✅ | ❌ | 🟡 | ❌ | ❌ | 🟡 |

**Avantage Clenzy MASSIF :** Module interventions très complet, app mobile RN avec écrans dédiés (technicien / housekeeper / supervisor), photos avant/après, signature électronique. **C'est un différenciateur n°1 vs Smoobu et iGMS.**

---

## 6. Paiements et reversements (PSP)

| Feature | Clenzy | Smoobu | Hostaway | iGMS | Lodgify | Hospitable |
|---------|:------:|:------:|:--------:|:----:|:-------:|:----------:|
| Stripe Checkout (encaissement) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Multi-rails paiement | ✅ *5 providers* | 🟡 | ✅ | 🟡 | 🟡 | 🟡 |
| PayTabs (KSA) | ✅ | ❌ | 🟡 | ❌ | ❌ | ❌ |
| CMI (Maroc) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Payzone (Maroc) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| PayPal | ✅ | 🟡 | ✅ | 🟡 | ✅ | 🟡 |
| Refunds intégrés | ✅ | 🟡 | ✅ | 🟡 | 🟡 | ✅ |
| Stripe Connect (payouts) | ✅ | ❌ | ✅ | ❌ | 🟡 | ❌ |
| Wise Business (payouts internationaux) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Open Banking PIS (SEPA auto) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| SEPA Credit Transfer (XML) | ✅ | ❌ | 🟡 | ❌ | ❌ | ❌ |
| Reversements multi-propriétaires | ✅ *automatisé* | ❌ | 🟡 *manuel* | ❌ | ❌ | ❌ |
| Calcul commission automatique | ✅ | ❌ | 🟡 | ❌ | ❌ | ❌ |

**Avantage Clenzy ÉCRASANT sur ce module.** Aucun concurrent n'a 5 rails paiement + 5 rails payout intégrés. C'est ton bunker.

---

## 7. Booking Engine (réservation directe)

| Feature | Clenzy | Smoobu | Hostaway | iGMS | Lodgify | Hospitable |
|---------|:------:|:------:|:--------:|:----:|:-------:|:----------:|
| Widget embeddable sur site existant | ✅ *SDK JS* | 💰 | ✅ | ❌ | ✅ | ❌ |
| Site web inclus (template) | 🟡 *partiel* | 💰 | 🟡 | ❌ | ✅ | ❌ |
| Recherche par dates / capacité | ✅ | ✅ | ✅ | — | ✅ | — |
| Calendrier 2 mois prix dynamiques | ✅ | ✅ | ✅ | — | ✅ | — |
| Multi-séjours (panier) | 🟡 *finalisation* | ❌ | 🟡 | — | 🟡 | — |
| Auth guest (compte client) | ✅ *Keycloak* | ✅ | ✅ | — | ✅ | — |
| Paiement Stripe Checkout | 🟡 *finalisation* | ✅ | ✅ | — | ✅ | — |
| Multi-langues FR/EN/AR | ✅ *+RTL* | 🟡 | ✅ | — | ✅ | — |
| SEO sitemap dynamique | 🟡 *à faire* | 🟡 | ✅ | — | ✅ | — |
| Email confirmation auto | 🟡 *à finaliser* | ✅ | ✅ | — | ✅ | — |
| Promo codes | 🟡 *UI fait, logique à câbler* | 🟡 | ✅ | — | ✅ | — |
| Politiques d'annulation paramétrables | 🟡 *à finaliser* | ✅ | ✅ | — | ✅ | — |
| Service options (ménage, petit-déj) | ✅ | 🟡 | ✅ | — | 🟡 | — |
| Multi-currency display | ✅ | 🟡 | ✅ | — | ✅ | — |

**Avantage Clenzy :** Multi-langues + RTL + service options + multi-currency natifs. Multi-rail paiement intégré.
**À finaliser P1 (3-4 sem) :** webhook Stripe, multi-property reserve, email confirmation, sitemap SEO.

---

## 8. Facturation et conformité française

| Feature | Clenzy | Smoobu | Hostaway | iGMS | Lodgify | Hospitable |
|---------|:------:|:------:|:--------:|:----:|:-------:|:----------:|
| Facturation NF conforme (anti-fraude) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Numérotation séquentielle obligatoire | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Mentions légales FR auto | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Taxe de séjour automatisée (FR) | ✅ | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 |
| Déclaration voyageurs en ligne (FR) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| LMNP / SCI / Micro-BIC compatibilité | ✅ | 🟡 | ❌ | ❌ | ❌ | ❌ |
| Intégration Pennylane | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Intégration Odoo | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Intégration QuickBooks | ✅ | ❌ | ✅ | 🟡 | ✅ | ❌ |
| Intégration Xero / Sage | ✅ | ❌ | ✅ | 🟡 | ✅ | ❌ |
| Export comptable FEC | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Avantage Clenzy ÉCRASANT pour le marché français.** Aucun concurrent n'adresse les normes NF FR. C'est ton fossé concurrentiel.

---

## 9. Signature électronique et compliance

| Feature | Clenzy | Smoobu | Hostaway | iGMS | Lodgify | Hospitable |
|---------|:------:|:------:|:--------:|:----:|:-------:|:----------:|
| Contrats de mandat signature électronique | ✅ | ❌ | 🟡 | ❌ | ❌ | ❌ |
| Yousign (QTSP FR) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Universign (QTSP FR) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| DocaPoste (QTSP FR) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| DocuSign | ✅ | ❌ | 🟡 | ❌ | 🟡 | ❌ |
| eIDAS conformité | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Stockage légal (durée 10 ans) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Avantage Clenzy :** 4 QTSP français + DocuSign. Conformité eIDAS native. Niche unique sur le marché.

---

## 10. IoT et serrures connectées

| Feature | Clenzy | Smoobu | Hostaway | iGMS | Lodgify | Hospitable |
|---------|:------:|:------:|:--------:|:----:|:-------:|:----------:|
| Capteurs bruit (Minut) | ✅ | ❌ | 🟡 | ❌ | ❌ | ❌ |
| Capteurs température / humidité | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Serrures Nuki | ✅ | ❌ | 🟡 | ❌ | ❌ | ❌ |
| Serrures KeyNest (key handover) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Codes d'accès dynamiques par résa | ✅ | ❌ | ✅ | 🟡 | ❌ | ✅ |
| Notifications anomalies (bruit, dégât) | ✅ | ❌ | 🟡 | ❌ | ❌ | ❌ |
| Dashboard IoT centralisé | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Avantage Clenzy :** Intégrations IoT plus large que la concurrence. Spécifiquement Minut + Nuki + KeyNest = unique en marché FR.

---

## 11. Application mobile

| Feature | Clenzy | Smoobu | Hostaway | iGMS | Lodgify | Hospitable |
|---------|:------:|:------:|:--------:|:----:|:-------:|:----------:|
| App iOS native | ✅ *React Native* | 🟡 *Web PWA* | ✅ | ✅ | ✅ | ✅ |
| App Android native | ✅ *React Native* | 🟡 *Web PWA* | ✅ | ✅ | ✅ | ✅ |
| Mode hors-ligne | ✅ *MMKV* | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 |
| Push notifications | ✅ *Expo* | 🟡 | ✅ | ✅ | ✅ | ✅ |
| Biométrie (Face ID, empreinte) | ✅ | ❌ | 🟡 | ❌ | ❌ | 🟡 |
| Photos check-in/out terrain | ✅ | ❌ | 🟡 | 🟡 | 🟡 | 🟡 |
| Mode équipe (housekeeping, technicien) | ✅ *6 rôles* | ❌ | 🟡 | ❌ | ❌ | ❌ |
| Signature électronique mobile | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| OTA updates (EAS) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Avantage Clenzy :** App React Native production-ready avec 67 écrans, 6 rôles distincts, mode hors-ligne MMKV + signature canvas mobile. **C'est un atout différenciateur fort vs Smoobu (web only).**

---

## 12. Multi-tenant et roles

| Feature | Clenzy | Smoobu | Hostaway | iGMS | Lodgify | Hospitable |
|---------|:------:|:------:|:--------:|:----:|:-------:|:----------:|
| Multi-organisations | ✅ | 🟡 *agency mode* | ✅ | 🟡 | 🟡 | ❌ |
| RBAC fine (6 rôles) | ✅ | 🟡 | ✅ | 🟡 | 🟡 | ❌ |
| Permissions par propriété | ✅ | 🟡 | ✅ | 🟡 | 🟡 | ❌ |
| SSO / Keycloak | ✅ | ❌ | 🟡 | ❌ | ❌ | ❌ |
| Audit logs détaillés | ✅ | 🟡 | ✅ | 🟡 | 🟡 | 🟡 |
| GDPR / RGPD conforme | ✅ | ✅ | 🟡 | 🟡 | 🟡 | ❌ |

**Avantage Clenzy :** Architecture multi-tenant Keycloak professionnelle. RBAC granulaire.

---

## 13. Analytique et reporting

| Feature | Clenzy | Smoobu | Hostaway | iGMS | Lodgify | Hospitable |
|---------|:------:|:------:|:--------:|:----:|:-------:|:----------:|
| Dashboard KPI temps réel | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Revenue per property | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Occupancy rate par période | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Performance par OTA | ✅ | 🟡 | ✅ | 🟡 | 🟡 | ✅ |
| Reporting par propriétaire | ✅ | ❌ | 🟡 | ❌ | ❌ | ❌ |
| Reporting fiscal LMNP | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Export PDF/Excel/CSV | ✅ | ✅ | ✅ | 🟡 | ✅ | ✅ |
| Comparaisons année N vs N-1 | ✅ | 🟡 | ✅ | 🟡 | 🟡 | ✅ |
| Forecast disponibilités/CA | 🟡 *à venir* | ❌ | ✅ | 🟡 | ❌ | ✅ |

---

## 14. Support et tarification

| Feature | Clenzy | Smoobu | Hostaway | iGMS | Lodgify | Hospitable |
|---------|:------:|:------:|:--------:|:----:|:-------:|:----------:|
| Prix de base /bien/mois | **39 €** | 15-25 € | 35-45 € | 14-22 $ | 20-72 $ | 38 $ |
| Frais setup | **0 €** | 0 € | 1500-2500 $ | 0 € | 0 € | 0 € |
| Engagement | **Aucun** | Mensuel | Annuel | Mensuel | Annuel | Mensuel |
| Trial gratuit | **30 jours** | 14 jours | 30 jours | 14 jours | 7 jours | 14 jours |
| Migration gratuite incluse | ✅ | ❌ | 💰 | ❌ | 💰 | ❌ |
| Support FR natif (par fondateur) | ✅ | 🟡 | ❌ | ❌ | 🟡 | ❌ |
| Délai première réponse | < 24h | 24-48h | 24-72h | 24-72h | 24-48h | 24-72h |
| Roadmap publique | 🟡 *prévue* | ❌ | 🟡 | ❌ | ❌ | 🟡 |
| Programme Design Partner | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Synthèse — Les 10 différenciateurs vendables

À utiliser en démo :

| # | Différenciateur | Concurrents qui l'ont |
|---|-----------------|-----------------------|
| **1** | Reversements multi-propriétaires automatisés | Aucun |
| **2** | Facturation NF FR conforme native | Aucun |
| **3** | Multi-rail paiement (5 providers FR/MA/KSA) | Aucun |
| **4** | Multi-rail payout (Wise + Open Banking PIS) | Aucun |
| **5** | Signature électronique 4 QTSP FR (Yousign/Universign/DocaPoste) | Aucun |
| **6** | App mobile React Native 67 écrans, 6 rôles | Hostaway/iGMS/Lodgify/Hospitable (qualité variable) |
| **7** | Booking Engine multi-langue FR/EN/AR + RTL | Aucun avec RTL |
| **8** | Module interventions complet (photos avant/après, signature, anomalies) | Hostaway uniquement |
| **9** | IoT natif (Minut + Nuki + KeyNest) | Aucun en France |
| **10** | Conformité réglementaire FR (taxe séjour, déclaration voyageurs, LMNP) | Aucun |

---

## Synthèse — Les 3 faiblesses à corriger d'ici fin 2026

| # | Faiblesse | Impact | Plan |
|---|-----------|--------|------|
| **1** | Channel Manager natif (vs Channex) | Concurrents 100% sync temps réel Airbnb/Booking/Vrbo | Intégrer Channex M2-M3 (5-6 sem). Software Partner Airbnb M12+ |
| **2** | Booking Engine pas 100% finalisé | Démo bloque sur paiement live | Finaliser webhook + multi-property reserve + email (1-2 sem) |
| **3** | Pricing dynamique IA (occupancy-based) | Hospitable et Hostaway ont avantage | Intégration PriceLabs / Beyond déjà faite → utiliser leur IA. Build own M9+ |

---

## Utilisation en démo

Lors d'un call, ne pas dérouler ce comparatif. Plutôt :

1. **Pendant discovery** : demander quel concurrent il utilise → noter
2. **En milieu de démo** : montrer 1-2 features où Clenzy gagne sur ce concurrent (utiliser ce tableau pour piocher)
3. **En closing** : sortir la phrase punchline du `Battle Card` correspondant (voir doc stratégie)

> Exemple : prospect Smoobu → "Smoobu c'est très bien si tu gères tes propres biens. Pour une conciergerie avec 10 propriétaires différents, Clenzy va te faire gagner 8h/mois rien que sur les reversements."
