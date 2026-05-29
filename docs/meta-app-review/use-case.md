# Clenzy — Use Case WhatsApp Business Platform

> Description envoyée à Meta lors de la review pour justifier l'usage des permissions `whatsapp_business_management`, `whatsapp_business_messaging`, `business_management`.

---

## Qu'est-ce que Clenzy ?

**Clenzy** est un PMS (Property Management System) SaaS multi-tenant pour les gestionnaires de location courte durée (Airbnb, Booking, Vrbo). Il permet aux hosts et gestionnaires professionnels de :

- Gérer leurs propriétés (appartements, maisons, chambres)
- Synchroniser leurs réservations multi-canaux (channel manager)
- Automatiser leur communication voyageurs (briefings check-in, instructions accès, demandes review)
- Gérer leurs équipes (ménage, maintenance, check-in)
- Suivre leurs finances et leur fiscalité

**Site web** : https://clenzy.fr
**App** : https://app.clenzy.fr
**Sociétés cibles** : 1 à 500 propriétés (PME du secteur location courte durée)
**Pays** : France principalement, expansion EU/Maghreb en cours

---

## Pourquoi WhatsApp ?

Pour les hosts de location courte durée, **WhatsApp est LE canal de communication voyageur n°1** :

1. **Adoption universelle** : 95% des voyageurs internationaux ont WhatsApp installé
2. **Langue préférée des guests** : email = formel, SMS = limité, WhatsApp = naturel et instantané
3. **Médias riches** : envoi des codes d'accès, photos du logement, vidéos d'instructions
4. **Multilingue** : Clenzy traduit auto les messages selon la langue du guest

**Sans WhatsApp**, les hosts perdent en moyenne :
- 15% de réservations confirmées (guests qui ne lisent pas les emails)
- 30% de notes 5 étoiles (problèmes check-in non remontés à temps)
- 8h/semaine en SAV téléphonique manuel

---

## Use case détaillé : envois automatisés

Clenzy envoie pour chaque réservation **5 messages WhatsApp clés** au guest, **uniquement après opt-in explicite** :

| # | Quand | Type | Template Meta | Permissions requises |
|---|---|---|---|---|
| 1 | J-7 avant arrivée | Utility | `clenzy_booking_confirmation_v1` | messaging |
| 2 | J-1 avant arrivée | Utility | `clenzy_checkin_instructions_v1` | messaging |
| 3 | Jour J 14h | Utility | `clenzy_arrival_code_v1` | messaging |
| 4 | Jour de checkout 9h | Utility | `clenzy_checkout_reminder_v1` | messaging |
| 5 | J+1 après départ | Utility | `clenzy_review_request_v1` | messaging |

Tous les templates sont **soumis à Meta pour approval** via `whatsapp_business_management.message_templates.create`. Aucun template marketing dans cette v1.

---

## Use case détaillé : messagerie 2-way

Au-delà des envois automatisés, Clenzy fournit une **messagerie inbox unifiée** où l'host répond aux questions des guests :

- Messages reçus via webhook Meta → poussés dans le PMS
- L'host répond depuis l'interface Clenzy
- Suggestions IA basées sur la knowledge base du logement (wifi, accès, recommandations resto)
- Conversation logguée pour audit + amélioration continue

---

## Pourquoi Embedded Signup ?

Aujourd'hui (avant Embedded Signup), un host Clenzy doit :
1. Créer un Meta Business Manager (10 min)
2. Ajouter un numéro WhatsApp Business + vérification (24-72h)
3. Créer une App Meta (15 min)
4. Générer un Permanent Access Token (10 min)
5. Copier-coller `apiToken`, `phoneNumberId`, `businessAccountId` dans Clenzy (5 min)

**Total : 1 à 3 jours, taux d'abandon ~70%**.

Avec Embedded Signup :
1. L'host clique "Connecter avec Facebook" dans Clenzy
2. Popup s'ouvre, login FB, sélection/création WABA + numéro, vérif SMS
3. Tout est provisionné automatiquement, l'host est prêt en **~5 min**

**Réduction du time-to-first-message de 99%**, taux d'adoption WhatsApp attendu : 25% → 80% des hosts.

---

## Justification des permissions

### `whatsapp_business_management`

**Usage** : Après le signup, Clenzy appelle :
- `GET /me/businesses` pour lister les Business Accounts de l'host
- `GET /{waba_id}/phone_numbers` pour récupérer le `phoneNumberId` du numéro qu'il vient d'ajouter
- `POST /{waba_id}/message_templates` pour soumettre les 5 templates Clenzy à approval

**Données accédées** : uniquement les WABAs et phone numbers du host connecté (jamais les WABAs d'autres entreprises). Scope limité par le `On Behalf Of` token.

**Stockage** : `whatsapp_configs.business_account_id` (WABA ID, ID public, non sensible) en base PostgreSQL chiffrée TLS.

### `whatsapp_business_messaging`

**Usage** : Envoyer les 5 messages auto + les réponses 2-way de l'host via `POST /{phone_number_id}/messages`.

**Données accédées** : aucune lecture de message en dehors des webhooks entrants (initiés par le guest).

**Volume** : ~10-30 messages/mois/propriété en moyenne. Une org avec 50 propriétés = ~500-1500 conversations/mois.

### `business_management`

**Usage** : Lire les Business Accounts liés à l'utilisateur pour faire le matching WABA ↔ phone number lors du callback OAuth.

**Données accédées** : Liste des Business Accounts de l'host, leurs IDs, et leur statut de vérification. Aucune écriture.

---

## Sécurité et conformité

- **Stockage tokens** : chiffrement Jasypt AES-256-GCM au niveau application (clé `JASYPT_ENCRYPTOR_PASSWORD` per-env, jamais en code)
- **Transport** : HTTPS TLS 1.3 obligatoire (HSTS strict-transport-security)
- **RGPD** : DPA disponible avec Clenzy, droit à l'oubli implémenté (`DELETE /api/users/me` purge tout y compris les conversations WhatsApp)
- **Audit** : tous les envois loggés dans `guest_message_log` (table dédiée) avec timestamp, status, error message
- **Rate limiting** : 80 msg/seconde par phone_number_id (limite Meta respectée + monitoring Prometheus)
- **Multi-tenant isolation** : chaque org a son propre `whatsapp_configs` row, isolation via Hibernate `@Filter` sur `organization_id`

---

## Volume estimé (12 mois)

| Métrique | Estimation Y1 |
|---|---|
| Nombre d'orgs activées sur WhatsApp | 200-500 |
| Conversations utility/mois | 50 000-150 000 |
| Conversations marketing/mois | 0 (pas de marketing en v1) |
| Pic horaire | ~500 msg/min (jamais en burst, lissé par scheduler) |

---

## Contact

- **Email technique** : tech@clenzy.fr
- **Email business** : contact@clenzy.fr
- **Site** : https://clenzy.fr
- **Adresse** : [À compléter — siège social Clenzy]
- **SIRET** : [À compléter]
