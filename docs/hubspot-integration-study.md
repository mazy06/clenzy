# Étude HubSpot — Intégration dans Clenzy PMS

> Date : 3 mars 2026
> Auteur : Équipe Clenzy / SinaTech

---

## 1. Présentation de HubSpot

HubSpot est une plateforme tout-en-un organisée en 4 "Hubs" principaux :

| Hub | Fonction principale | Intérêt pour Clenzy |
|-----|---------------------|---------------------|
| **CRM (Gratuit)** | Gestion contacts, entreprises, deals | ⭐⭐⭐ Propriétaires, guests, équipes de ménage |
| **Service Hub** | Ticketing, support client, base de connaissances | ⭐⭐⭐ Interventions, réclamations, incidents |
| **Marketing Hub** | Email marketing, automation marketing | ⭐⭐ Communications guests, rapports propriétaires |
| **Operations Hub** | Sync données, webhooks, automation avancée | ⭐ Utile mais coûteux |

---

## 2. Service Hub (Ticketing) — Le plus pertinent

### 2.1 Cas d'usage pour Clenzy

| Cas d'usage Clenzy | Objet HubSpot | Pipeline |
|---------------------|---------------|----------|
| Réclamation propriétaire | Ticket | Ouvert → En cours → Résolu |
| Problème guest (check-in, clés, etc.) | Ticket | Signalé → Pris en charge → Clos |
| Incident équipe ménage (dégât, manque fournitures) | Ticket | Signalé → Intervention → Résolu → Facturé |
| Demande de maintenance | Ticket | Planifié → En cours → Terminé |

### 2.2 Fonctionnalités par tier

| Fonctionnalité | Free | Starter (15€/siège/mois) | Pro (90€/siège/mois) | Enterprise (150€/siège/mois) |
|---------------|------|--------------------------|---------------------|---------------------------|
| Ticketing basique | ✅ | ✅ | ✅ | ✅ |
| Inbox partagé (email, chat, WhatsApp) | ✅ | ✅ | ✅ | ✅ |
| Suppression branding HubSpot | ❌ | ✅ | ✅ | ✅ |
| Automation routing tickets | ❌ | ✅ | ✅ | ✅ |
| Pipelines multiples | ❌ | ✅ | ✅ | ✅ |
| SLA management | ❌ | ❌ | ✅ | ✅ |
| Base de connaissances | ❌ | ❌ | ✅ | ✅ |
| Portail client | ❌ | ❌ | ✅ | ✅ |
| Feedback surveys | ❌ | ❌ | ✅ | ✅ |
| AI agents (résolution autonome) | ❌ | ❌ | ❌ | ✅ |
| Custom Objects | ❌ | ❌ | ❌ | ✅ |

### 2.3 Fonctionnalités clés

- **Shared Inbox** : consolide les messages clients depuis email, live chat, téléphone, SMS, WhatsApp dans une seule vue
- **Ticketing** : organise et suit les demandes clients depuis plusieurs sources (emails, chats, formulaires, API)
- **Automation** : routage automatique des tickets vers les bons agents, relances, mises à jour de statut
- **AI (Breeze)** : classification automatique, routing intelligent, analyse de sentiment, réponses suggérées (Enterprise)
- **Knowledge Base** : portail self-service avec FAQ, guides, articles de dépannage (Professional+)
- **Customer Portal** : interface personnalisable pour les clients (Professional+)
- **SLA Management** : définition de SLA, suivi de conformité (Professional+)

---

## 3. CRM Gratuit — Mapping avec les entités Clenzy

### 3.1 Mapping des entités

| Entité Clenzy | Objet HubSpot CRM | Notes |
|---------------|-------------------|-------|
| Propriétaires | **Contacts** + Companies | Chaque proprio = Contact, sa société = Company |
| Guests | **Contacts** | Avec propriétés custom (dates séjour, logement, etc.) |
| Équipes ménage | **Contacts** + Companies | Individus = Contacts, entreprises de nettoyage = Companies |
| Réservations | **Deals** | Montant, dates, étapes du pipeline |
| Logements | Deals ou Custom Objects | ⚠️ Custom Objects = Enterprise uniquement (150€/siège) |
| Interventions | **Tickets** (Service Hub) | Chaque intervention = un ticket avec pipeline dédié |
| Factures | **Deals** | Suivi montants et statuts par étapes du deal |

### 3.2 Limitations du CRM Free

| Limitation | Détail |
|-----------|--------|
| Contacts | ~1 000 max (nouveaux comptes post-sept. 2024) |
| Utilisateurs | 2 maximum |
| Emails marketing | 2 000/mois total |
| A/B testing | Non disponible |
| Custom Objects | Non disponible (Enterprise uniquement) |
| Automation avancée | Non disponible |
| Permissions granulaires | Non disponibles |
| Branding HubSpot | Présent sur tous les éléments client |

---

## 4. Marketing Hub — Communications

### 4.1 Fonctionnalités

- Email marketing avec drag-and-drop builder et AI Email Writer
- Automation multicanal (email, social, chat)
- Génération de leads (formulaires, landing pages)
- Contenu multi-langue

### 4.2 Cas d'usage pour Clenzy

- **Communications guests** : emails pré-arrivée, instructions check-in, demande d'avis post-séjour
- **Rapports propriétaires** : rapports mensuels automatiques (performance, taux d'occupation, revenus)
- **Notifications équipes** : changements planning, nouvelles missions
- **Campagnes saisonnières** : marketing vers prospects propriétaires

### 4.3 Tarification Marketing Hub

| Tier | Prix | Contacts inclus | Frais onboarding |
|------|------|-----------------|------------------|
| Free | 0€ | ~1 000 | Aucun |
| Starter | 15€/siège/mois | 1 000 | Aucun |
| Professional | 800-890€/mois (3 sièges) | 2 000 | 3 000€ one-time |
| Enterprise | ~3 600€/mois (5 sièges) | 10 000 | 7 000€ one-time |

> **Attention** : contacts marketing supplémentaires = +50€/mois par tranche de 1 000 contacts (Starter). Pour un PMS avec beaucoup de guests, le coût peut monter vite.

---

## 5. Operations Hub — Sync et automation

### 5.1 Fonctionnalités

- **Data Sync** : connexion bidirectionnelle avec 90+ apps (Jira, Aircall, LinkedIn, Teams, etc.)
- **Data Quality** : nettoyage automatique (déduplication, formatage, standardisation)
- **Programmable Automation** : exécution de JavaScript dans les workflows HubSpot
- **Webhooks** : déclenchement de systèmes externes depuis les workflows
- **Datasets** : collections de données réutilisables pour le reporting

### 5.2 Tarification Operations Hub

| Tier | Prix | Fonctionnalités clés |
|------|------|---------------------|
| Free | 0€ | Sync données basique |
| Starter | 20€/mois | Data sync, email health reporting |
| Professional | 800€/mois | Programmable automation, webhooks, datasets |
| Enterprise | ~2 000€/mois | Snowflake integration, features avancées |

> **Verdict** : L'Operations Hub Professional est puissant mais trop cher (800€/mois) pour Clenzy. Il est plus judicieux de gérer la logique dans notre backend Java et d'utiliser l'API HubSpot directement.

---

## 6. Tarification complète

### 6.1 Modèle de prix (depuis mars 2024)

- Facturation **par siège (seat)** avec engagement annuel obligatoire
- **Core Seats** : accès complet en édition — c'est ce qu'on paye
- **View-Only Seats** : gratuits et illimités sur les portails payants
- Pas de minimum de sièges sur Starter et Professional (sauf Enterprise : 10 sièges minimum)

### 6.2 Grille tarifaire complète (2025-2026)

| Hub | Free | Starter | Professional | Enterprise |
|-----|------|---------|-------------|-----------|
| **CRM** | 0€ (2 users, 1K contacts) | Inclus | Inclus | Inclus |
| **Service Hub** | 0€ (ticketing basique) | **15€/siège/mois** | **90€/siège/mois** + 1 500€ onboarding | **150€/siège/mois** (10 sièges min) |
| **Marketing Hub** | 0€ (1K contacts) | **15€/siège/mois** (1K contacts) | **800-890€/mois** (3 sièges, 2K contacts) + 3 000€ onboarding | **~3 600€/mois** (5 sièges, 10K contacts) + 7 000€ onboarding |
| **Operations Hub** | 0€ (sync basique) | **20€/mois** | **800€/mois** | **~2 000€/mois** |

### 6.3 Scénarios de coût pour Clenzy (3 agents)

| Configuration | Coût mensuel | Coût annuel | Ce qu'on obtient |
|---------------|-------------|-------------|------------------|
| **CRM Free + Service Starter** | **45€/mois** | **540€/an** | CRM + ticketing + automation basique |
| **Starter Bundle (CRM+Service+Marketing)** | **45€/mois** | **540€/an** | Tout en Starter — meilleur rapport qualité/prix |
| **CRM Free + Service Pro** | **270€/mois** + 1 500€ onboarding | **4 740€ an 1** | + SLA, knowledge base, portail client |
| **Enterprise** | **1 500€/mois** (10 sièges min) | **18 000€/an** | Custom objects, AI — surdimensionné pour l'instant |

### 6.4 Programme HubSpot for Startups 🎯

| Stade de la startup | Réduction | Conditions |
|---------------------|-----------|------------|
| Pre-seed / Seed (< 2M€ levés) | **Jusqu'à 90% de réduction** | < 5 ans d'existence, ≤ 2M€ levés |
| Series A (< 10M€ levés) | **Jusqu'à 50% de réduction** | < 5 ans d'existence |
| Via partenaire HubSpot | **30% 1ère année, 15% les suivantes** | Association avec un partenaire certifié |

> **Impact pour Clenzy** : avec la réduction 90%, le Service Hub Pro passe de 90€ à **~9€/siège/mois**.

| Configuration avec réduction 90% | Coût mensuel | Coût annuel |
|-----------------------------------|-------------|-------------|
| Service Hub Pro (3 sièges) | **~27€/mois** | **~324€/an** |
| Starter Bundle (3 sièges) | **~4,50€/mois** | **~54€/an** |

---

## 7. Intégration technique avec Clenzy

### 7.1 API REST v3

| Aspect | Détail |
|--------|--------|
| **Authentification** | OAuth 2.0 ou Private App Token (API keys dépréciées depuis nov. 2022) |
| **Rate limits (non-Enterprise)** | 100 requêtes / 10 secondes, 500 000 requêtes / jour |
| **Rate limits (Enterprise)** | 190 requêtes / 10 secondes, 1 000 000 requêtes / jour |
| **Webhooks** | Jusqu'à 1 000 souscriptions — events : ticket.creation, ticket.propertyChange, ticket.deletion, etc. |
| **SDK Java officiel** | ❌ **Inexistant** — client HTTP custom nécessaire (WebClient / RestTemplate) |
| **Custom Objects** | Enterprise uniquement (150€/siège/mois) |
| **Batch operations** | Oui — bulk create/update/delete |
| **Search API** | 5 requêtes / seconde — requêtes complexes avec filtres |

### 7.2 Endpoints API principaux

| Action | Endpoint | Méthode |
|--------|----------|---------|
| Créer un contact (guest/proprio/cleaner) | `/crm/v3/objects/contacts` | POST |
| Créer un deal (réservation/facture) | `/crm/v3/objects/deals` | POST |
| Créer un ticket (intervention/support) | `/crm/v3/objects/tickets` | POST |
| Mettre à jour un ticket | `/crm/v3/objects/tickets/{ticketId}` | PUT |
| Rechercher des enregistrements | `/crm/v3/objects/{objectType}/search` | POST |
| Associer deux objets | `/crm/v3/objects/{type}/{id}/associations/{toType}/{toId}` | PUT |
| Opérations batch | `/crm/v3/objects/{objectType}/batch/create` | POST |

### 7.3 Architecture d'intégration recommandée

```
┌──────────────────────────────────────────────────┐
│                 Clenzy Backend                    │
│              (Spring Boot / Java 21)              │
│                                                   │
│  ┌─────────────────────────┐                      │
│  │  HubSpotApiService.java │ ← WebClient HTTP    │
│  │  ├─ createContact()     │    vers API v3       │
│  │  ├─ createTicket()      │                      │
│  │  ├─ updateTicket()      │                      │
│  │  ├─ createDeal()        │                      │
│  │  └─ searchObjects()     │                      │
│  └─────────┬───────────────┘                      │
│            │                                       │
│  ┌─────────▼────────────────────┐                 │
│  │  HubSpotWebhookController   │ ← Reçoit les    │
│  │  POST /api/webhooks/hubspot │   webhooks       │
│  │  ├─ ticket.creation         │                  │
│  │  ├─ ticket.propertyChange   │                  │
│  │  └─ ticket.deletion         │                  │
│  └──────────────────────────────┘                 │
└──────────────────────┬───────────────────────────┘
                       │
            Sync bidirectionnel
                       │
┌──────────────────────▼───────────────────────────┐
│               HubSpot Cloud                       │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │   CRM    │  │ Service  │  │   Marketing    │  │
│  │ Contacts │  │   Hub    │  │     Hub        │  │
│  │ Deals    │  │ Tickets  │  │   Emails       │  │
│  │Companies │  │ Inbox    │  │   Automation   │  │
│  └──────────┘  └──────────┘  └────────────────┘  │
└──────────────────────────────────────────────────┘
```

### 7.4 Flux d'intégration

| Événement dans Clenzy | Action vers HubSpot |
|------------------------|---------------------|
| Nouvelle réservation créée | Créer/MAJ Contact (guest) + Créer Deal (réservation) |
| Intervention planifiée | Créer Ticket + Associer au Contact (cleaner) et au Deal |
| Changement statut intervention | MAJ propriété du Ticket (pipeline stage) |
| Facture générée | MAJ Deal stage + montant |
| Message guest | Routage vers inbox partagé HubSpot (optionnel) |

| Événement dans HubSpot | Action vers Clenzy (via webhook) |
|-------------------------|--------------------------------|
| Ticket mis à jour par un agent | MAJ statut intervention dans Clenzy |
| Ticket fermé | Clôturer l'intervention correspondante |
| Nouveau ticket créé manuellement | Créer une intervention dans Clenzy |

---

## 8. Comparaison avec les alternatives

### 8.1 Comparaison fonctionnelle

| Critère | HubSpot Starter | Freshdesk Growth | Zendesk Suite | Intercom |
|---------|----------------|-----------------|--------------|----------|
| **Prix** | 15€/siège/mois | 15€/agent/mois | 55€/agent/mois | 39€/siège/mois |
| **CRM intégré** | ✅ Natif | ❌ Séparé (Freshsales) | ❌ Séparé (Zendesk Sell) | Basique |
| **Free tier** | Oui | Oui (2 agents) | Non | Non |
| **Knowledge base** | Pro+ seulement | Dès le Free (basique) | Suite plans | Tous plans payants |
| **API qualité** | Excellente | Bonne | Excellente | Bonne |
| **Webhooks** | Oui (1 000 subs) | Oui | Oui | Oui |
| **SDK Java officiel** | Non | Non | Communautaire | Non |
| **Onboarding fee** | 1 500€ (Pro) | Aucun | Aucun | Aucun |
| **AI intégré** | Enterprise (inclus) | Freddy AI (+29€/agent) | AI agents (1$/résolution) | Fin AI (0,99$/résolution) |

### 8.2 Coût annuel comparé (3 agents, mid-tier)

| Plateforme | Coût annuel | Notes |
|-----------|-------------|-------|
| **HubSpot Starter** | **540€** | ✅ Meilleur rapport avec CRM inclus |
| **Freshdesk Growth** | **540€** | ✅ Meilleur si ticketing seul suffit |
| **Intercom Essential** | **1 404€** | + coûts AI imprévisibles |
| **Freshdesk Pro** | **1 764€** | Meilleur mid-tier pur ticketing |
| **Zendesk Suite Team** | **1 980€** | Plus mature mais cher |
| **HubSpot Pro** | **4 740€** (an 1 avec onboarding) | SLA + knowledge base |

### 8.3 Verdict comparatif

| Si le besoin est... | Solution recommandée |
|---------------------|---------------------|
| Ticketing + CRM unifié | **HubSpot Starter** — CRM natif inclus |
| Ticketing seul, budget serré | **Freshdesk** — free tier généreux (2 agents) |
| Support conversationnel temps réel | **Intercom** — meilleur chat/messaging |
| Écosystème enterprise mature | **Zendesk** — le plus complet mais le plus cher |

---

## 9. Recommandation finale pour Clenzy

### Configuration recommandée

**HubSpot Starter Bundle — 15€/siège/mois**

### Pourquoi HubSpot

1. **Même prix que Freshdesk** (15€/siège) mais avec le **CRM natif inclus** — essentiel pour un PMS
2. **Plateforme unique** : ticketing + CRM + email marketing → pas besoin de 3 outils différents
3. **API robuste** avec webhooks → intégration bidirectionnelle avec notre backend Java
4. **Programme Startups** : potentiel **jusqu'à 90% de réduction** → ~1,50€/siège/mois
5. **Chemin de croissance** : Starter → Professional quand on aura besoin de SLA et knowledge base

### Plan d'action

| Étape | Action | Priorité |
|-------|--------|----------|
| 1 | Postuler au programme [HubSpot for Startups](https://www.hubspot.com/startups) | 🔴 Immédiat |
| 2 | Activer CRM Free + Service Hub Starter | 🔴 Semaine 1 |
| 3 | Configurer les pipelines tickets (Interventions, Support, Incidents) | 🟡 Semaine 2 |
| 4 | Développer `HubSpotApiService.java` (client HTTP → API v3) | 🟡 Semaine 2-3 |
| 5 | Implémenter `HubSpotWebhookController.java` | 🟡 Semaine 3 |
| 6 | Mapper les entités Clenzy → objets HubSpot | 🟢 Semaine 3-4 |
| 7 | Tests d'intégration + mise en production | 🟢 Semaine 4-5 |

### Coût estimé

| Scénario | Mensuel | Annuel |
|----------|---------|--------|
| Sans réduction (3 sièges Starter) | 45€ | 540€ |
| Avec réduction startup 90% | ~4,50€ | ~54€ |
| Évolution vers Pro (3 sièges) sans réduction | 270€ | 3 240€ |
| Évolution vers Pro avec réduction 90% | ~27€ | ~324€ |

---

## Sources

- [HubSpot Service Hub](https://www.hubspot.com/products/service)
- [HubSpot Ticketing System](https://www.hubspot.com/products/service/ticketing-system)
- [HubSpot Service Hub Pricing Guide](https://blog.hubspot.com/service/hubspot-service-hub-pricing)
- [HubSpot Free CRM](https://www.hubspot.com/products/crm)
- [HubSpot Marketing Hub Pricing](https://blog.hubspot.com/marketing/hubspot-marketing-hub-pricing)
- [HubSpot Operations Hub Pricing](https://blog.hubspot.com/marketing/hubspot-operations-hub-pricing)
- [HubSpot API Usage Guidelines](https://developers.hubspot.com/docs/developer-tooling/platform/usage-guidelines)
- [HubSpot Webhooks API](https://developers.hubspot.com/docs/api-reference/webhooks-webhooks-v3/guide)
- [HubSpot Custom Objects API](https://developers.hubspot.com/docs/api-reference/crm-custom-objects-v3/guide)
- [HubSpot Client Libraries](https://developers.hubspot.com/docs/api/client-libraries)
- [HubSpot for Startups](https://www.hubspot.com/startups)
- [HubSpot Pricing Changes (mars 2024)](https://www.hubspot.com/company-news/announcing-upcoming-changes-to-hubspots-pricing)
- [Freshdesk Pricing](https://www.freshworks.com/freshdesk/pricing/)
- [Zendesk vs Intercom vs Freshdesk 2026](https://www.saasgenie.ai/blogs/freshdesk-vs-zendesk-vs-intercom)
