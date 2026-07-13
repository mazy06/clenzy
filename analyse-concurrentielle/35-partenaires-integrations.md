# Partenaires & intégrations à contacter

> Liste des sociétés dont Baitly **intègre** (ou **doit intégrer**) les services. Le but : savoir **qui contacter** et **pour quel type d'accord**.
>
> **Statut** (indicatif, à reconfirmer avec l'équipe technique avant toute prise de contact) : **✅ Actif** = intégration en production · **🟡 Amorcé** = code présent, à finaliser / brancher / certifier · **⬜ À contacter** = peu ou pas de code, partenariat à ouvrir.
>
> **Type d'accord** : `Clé API` (simple compte développeur) · `Partenariat` (accord API / statut partenaire à négocier) · `Réglementaire` (immatriculation / agrément).

---

## 1. Canaux de distribution (OTA)

| Partenaire | Ce qu'il apporte | Statut | Type d'accord / action |
|---|---|:---:|---|
| **Airbnb** | Distribution + sync 2-way (API officielle) | ✅ | Partenariat — viser/consolider le statut partenaire API |
| **Booking.com** | Distribution n°1 en Europe | 🟡 | Partenariat — **Connectivity Partner** (via Channex), reporting no-show/carte invalide déjà géré |
| **Expedia / Vrbo (HomeAway)** | Distribution US + EU | 🟡 | Partenariat — via Channex, finaliser le mapping |
| **Agoda** | Distribution Asie | 🟡 | Partenariat — via Channex |
| **Google Vacation Rentals** | Visibilité recherche Google | 🟡 | Partenariat — *readiness checker* en place, viser l'éligibilité |
| **TripAdvisor** | Distribution + avis | 🟡 | Partenariat — via Channex |
| **Hotels.com** | Distribution | 🟡 | Partenariat — via Channex |
| **HomeToGo** | Méta-moteur / distribution | ⬜ | Partenariat — pré-partenariat identifié (API two-way, pas d'iCal) |
| **Holidu / Vacasa / autres longue traîne** | Distribution niche | ⬜ | Partenariat — activer 3-5 canaux longue traîne |

## 2. Channel manager (agrégateur de canaux)

| Partenaire | Ce qu'il apporte | Statut | Type d'accord / action |
|---|---|:---:|---|
| **Channex** | Connexion mutualisée à des dizaines d'OTA | ✅ | Clé API — **certification en cours à finaliser** |
| **NextPax** | Alternative / redondance channel manager | ⬜ | Partenariat — à évaluer comme second rail |

## 3. Paiement & encaissement

| Partenaire | Ce qu'il apporte | Statut | Type d'accord / action |
|---|---|:---:|---|
| **Stripe** | Encaissement, Checkout, **Connect** (reversements), caution | ✅ | Clé API — money-path ménage à valider en test-mode |
| **Wise** | Payouts internationaux (80+ pays) | ✅ | Clé API |
| **Prestataire Open Banking / PIS** | Virements SEPA (pain.001), initiation de paiement | 🟡 | Partenariat — choisir un PSP d'initiation (ex. GoCardless, Bridge, Tink) |

## 4. Conformité & facturation électronique

| Partenaire | Ce qu'il apporte | Statut | Type d'accord / action |
|---|---|:---:|---|
| **PDP immatriculée** (Plateforme de Dématérialisation Partenaire) | Émission/réception **Factur-X** (réforme FR 2026) | ⬜ | **Réglementaire — à choisir en priorité** (ex. Docaposte, Pennylane PDP, Sellsy, Tiime) |
| **PPF / Chorus Pro** | Portail public de facturation FR | ⬜ | Réglementaire — raccordement |
| **ZATCA (Fatoora)** | E-invoicing Arabie Saoudite | 🟡 | Réglementaire — chaîne PIH amorcée, viser l'émission live |
| **DGI Maroc** | Facturation électronique Maroc | ⬜ | Réglementaire — cadrage |

## 5. Déclaration voyageurs / police

| Partenaire | Ce qu'il apporte | Statut | Type d'accord / action |
|---|---|:---:|---|
| **Chekin** | Déclaration voyageurs + check-in en ligne (FR) | ✅ | Clé API |
| **Shomoos / DGSN** | Déclaration voyageurs KSA / MENA | ⬜ | Réglementaire — pour le go-live MENA |

## 6. Comptabilité

| Partenaire | Ce qu'il apporte | Statut | Type d'accord / action |
|---|---|:---:|---|
| **Pennylane** | Compta FR + potentiel PDP | 🟡 | Clé API — sync à finaliser |
| **QuickBooks** | Compta (US/international) | 🟡 | Clé API — sync à finaliser |
| **Xero** | Compta (UK/international) | 🟡 | Clé API — sync à finaliser |
| **Sage** | Compta (FR/UK) | 🟡 | Clé API — sync à finaliser |

## 7. Signature électronique

| Partenaire | Ce qu'il apporte | Statut | Type d'accord / action |
|---|---|:---:|---|
| **Signature interne Baitly (SES)** | Signature simple des mandats via lien public | ✅ | — (natif) |
| **Yousign** | Signature qualifiée FR (QTSP) | 🟡 | Clé API — codé, à brancher |
| **DocuSeal** | Signature open-source auto-hébergeable | 🟡 | Clé API — codé, à brancher |
| **DocuSign** | Signature (standard mondial) | 🟡 | Clé API — codé, à brancher |

## 8. Serrures connectées (accès sans contact)

| Partenaire | Ce qu'il apporte | Statut | Type d'accord / action |
|---|---|:---:|---|
| **Nuki** | Serrures connectées EU | ✅ | Clé API |
| **KeyNest** | Remise de clés (points relais + boîtes) | ✅ | Clé API |
| **Tuya** | Écosystème d'objets connectés | 🟡 | Clé API |
| **Igloohome** | Serrures à code hors-ligne | 🟡 | Clé API — à finaliser |
| **TTLock** | Serrures low-cost | 🟡 | Clé API — à finaliser |
| **Salto / Igloo Home / August** | Serrures pro | ⬜ | Partenariat — à évaluer selon demande |

## 8bis. Capteurs bruit & confort (IoT maison)

| Partenaire | Ce qu'il apporte | Statut | Type d'accord / action |
|---|---|:---:|---|
| **Minut** | Capteur bruit / température / occupation | ✅ | Clé API |
| **Netatmo** | Capteurs maison (bruit, air, thermostat) | 🟡 | Clé API — à finaliser |
| **NoiseAware / Party Squasher** | Détection de fêtes | ⬜ | Partenariat — à évaluer (marché US) |

## 9. Tarification & revenue (yield)

| Partenaire | Ce qu'il apporte | Statut | Type d'accord / action |
|---|---|:---:|---|
| **PriceLabs** | Tarification dynamique (référence marché) | 🟡 | Clé API — connecteur à finaliser |
| **Beyond Pricing** | Tarification dynamique | 🟡 | Clé API — connecteur à finaliser |
| **Wheelhouse** | Tarification dynamique (alternative) | ⬜ | Clé API — à évaluer |
| **Key Data / AirDNA** | Données de marché & benchmarking | ⬜ | Clé API — pour la suite revenue management |

## 10. Vérification d'identité (KYC / anti-fraude)

| Partenaire | Ce qu'il apporte | Statut | Type d'accord / action |
|---|---|:---:|---|
| **Sumsub** | KYC / vérification d'identité | 🟡 | Clé API — à finaliser (onboarding Stripe Connect, fraude) |
| **Onfido** | KYC (alternative) | 🟡 | Clé API — à évaluer vs Sumsub |

## 11. Messagerie & communication voyageurs

| Partenaire | Ce qu'il apporte | Statut | Type d'accord / action |
|---|---|:---:|---|
| **Brevo** | Email transactionnel | ✅ | Clé API |
| **Postal** | Email auto-hébergé | ✅ | Auto-hébergé |
| **Meta WhatsApp Business** | Messagerie WhatsApp officielle | ✅ | Partenariat — compte Meta Business (templates approuvés) |
| **Fournisseur SMS** | SMS natif (Twilio retiré) | ⬜ | **Clé API — à choisir** (ex. Vonage, OVH SMS, LinkMobility, Sinch) |

## 12. Automatisation & écosystème

| Partenaire | Ce qu'il apporte | Statut | Type d'accord / action |
|---|---|:---:|---|
| **Zapier** | Connecte Baitly à 6 000+ apps | ⬜ | Partenariat — **publier une app** sur les webhooks existants |
| **Make (Integromat)** | Automatisation no-code | ⬜ | Partenariat — publier des modules |

## 13. Activités & upsells (revenus additionnels)

| Partenaire | Ce qu'il apporte | Statut | Type d'accord / action |
|---|---|:---:|---|
| **Viator** | Catalogue d'activités (affiliation) | 🟡 | Affiliation — liens affiliés en place |
| **GetYourGuide** | Catalogue d'activités (affiliation) | 🟡 | Affiliation — liens affiliés en place |
| **Klook** | Catalogue d'activités Asie (affiliation) | 🟡 | Affiliation — liens affiliés en place |

## 14. Infrastructure & données (sans démarche commerciale)

| Partenaire | Ce qu'il apporte | Statut | Type d'accord / action |
|---|---|:---:|---|
| **Cloudflare** | Hébergement des sites directs (hostnames) | ✅ | Clé API |
| **Open-Meteo** | Météo & géocodage | ✅ | Gratuit, sans clé |
| **OpenStreetMap / Overpass** | Points d'intérêt autour du logement | ✅ | Gratuit |

## 15. Assurance & caution (optionnel)

| Partenaire | Ce qu'il apporte | Statut | Type d'accord / action |
|---|---|:---:|---|
| **SUPERHOG / Truvi** | Assurance dépôt de garantie / screening | ⬜ | Partenariat — à évaluer selon demande |
| **Chargeholder** | Gestion de caution | ⬜ | Partenariat — à évaluer |

---

## À contacter en priorité (débloque la roadmap)

1. **PDP immatriculée** (Factur-X) — *réglementaire, échéance 2026, fossé stratégique.*
2. **Fournisseur SMS** — *combler le canal SMS natif absent.*
3. **Zapier & Make** — *faible effort, gros déblocage d'écosystème.*
4. **PriceLabs / Beyond** — *finaliser le connecteur yield (dernier trou core).*
5. **Sumsub** — *finaliser le KYC (onboarding prestataires + anti-fraude).*
6. **Booking.com Connectivity Partner** + **statut partenaire Airbnb** — *crédibilité canal.*
7. **HomeToGo** — *pré-partenariat déjà identifié.*

> **Note.** Trois natures d'accord à ne pas confondre : une simple **clé API** (Stripe, PriceLabs, Sumsub, Brevo) se met en place en autonomie ; un **partenariat** (Airbnb, Booking, Google, Zapier) demande une négociation et parfois une validation technique ; une démarche **réglementaire** (PDP, ZATCA, DGSN) implique une immatriculation ou un agrément et des délais plus longs.
