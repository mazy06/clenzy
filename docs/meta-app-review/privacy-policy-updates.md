# Privacy Policy Updates — Section WhatsApp

> Sections à ajouter dans `https://clenzy.fr/confidentialite` (page CGU/Privacy) **AVANT** la soumission de la review Meta. Meta vérifie que la privacy policy mentionne explicitement WhatsApp.
>
> Versions FR + EN ci-dessous. À traduire en AR par le natif speaker Clenzy.

---

## 🇫🇷 Section FR à ajouter

### À insérer dans la section "Données collectées et traitées"

#### Communication WhatsApp Business

Si vous activez l'intégration WhatsApp dans Clenzy (Settings > Messagerie > Provider WhatsApp), nous traitons les données suivantes en votre nom :

**Données stockées par Clenzy :**
- Votre WhatsApp Business Account ID (WABA ID) — identifiant public
- Votre Phone Number ID — identifiant public du numéro WhatsApp connecté
- Le contenu des messages envoyés et reçus via Clenzy
- Les métadonnées de livraison (timestamp, statut sent/delivered/read, message_id Meta)
- Les credentials d'authentification (token chiffré AES-256-GCM avec rotation tous les 6 mois)

**Sous-traitant Meta / WhatsApp** : les messages transitent par les serveurs Meta (irlandais, conformes RGPD). Meta agit en tant que sous-traitant pour le traitement de l'envoi/réception. Cf. [Politique WhatsApp Business](https://www.whatsapp.com/legal/business-policy/) et [DPA Meta](https://www.facebook.com/legal/terms/dataprocessingagreement).

**Durée de conservation** :
- Messages : 90 jours par défaut (configurable par organisation, max 1 an)
- Credentials WABA : tant que l'intégration est active ; supprimés sous 30 jours après désactivation
- Logs d'audit (timestamp, statut, sans contenu) : 12 mois

**Droit d'opposition** : vous pouvez désactiver l'intégration WhatsApp à tout moment depuis Settings > Messagerie. La désactivation supprime les credentials sous 30 jours et arrête immédiatement tout envoi automatique.

**Droit à l'effacement** : la suppression de votre compte Clenzy entraîne la suppression complète de toutes les données WhatsApp associées sous 30 jours (RGPD art. 17).

---

### À insérer dans la section "Données partagées avec des tiers"

#### Meta Platforms Ireland Limited (WhatsApp)

| Type de données | Pourquoi | Base légale |
|---|---|---|
| Contenu des messages WhatsApp envoyés | Livraison du message au destinataire | Exécution contrat (envoi de message demandé par l'utilisateur) |
| Numéro de téléphone du destinataire | Routing du message | Exécution contrat |
| WABA ID + Phone Number ID | Authentification API | Exécution contrat |

**Localisation des données** : Meta opère des serveurs en Europe (Irlande principalement) et aux États-Unis. Le transfert hors-EU est encadré par les Clauses Contractuelles Types (SCC) approuvées par la Commission Européenne, intégrées au DPA Meta.

---

### À insérer dans la section "Voyageurs (vos guests)"

#### Communication WhatsApp envoyée aux voyageurs

Lorsque vous (host) configurez Clenzy pour envoyer des messages WhatsApp à vos voyageurs (confirmations de réservation, instructions de check-in, etc.), **vous restez responsable du traitement** (au sens RGPD). Clenzy et Meta agissent en tant que sous-traitants.

**Information du voyageur** : vous devez informer vos voyageurs que leur numéro WhatsApp sera utilisé pour la communication relative à leur séjour, via vos propres CGU ou un opt-in explicite dans le flow de réservation.

**Opt-out** : le voyageur peut à tout moment répondre `STOP` à n'importe quel message Clenzy pour être désabonné. Le système le détecte automatiquement et bloque les envois futurs vers son numéro.

---

## 🇬🇧 EN section to add

### Insert in "Data we collect and process" section

#### WhatsApp Business communication

If you enable WhatsApp integration in Clenzy (Settings > Messaging > WhatsApp Provider), we process the following data on your behalf:

**Data stored by Clenzy:**
- Your WhatsApp Business Account ID (WABA ID) — public identifier
- Your Phone Number ID — public identifier for the WhatsApp number you connected
- Content of messages sent and received via Clenzy
- Delivery metadata (timestamp, status sent/delivered/read, Meta message_id)
- Authentication credentials (AES-256-GCM encrypted, rotated every 6 months)

**Sub-processor Meta / WhatsApp**: messages flow through Meta's servers (Irish, GDPR-compliant). Meta acts as sub-processor for sending/receiving. See [WhatsApp Business Policy](https://www.whatsapp.com/legal/business-policy/) and [Meta DPA](https://www.facebook.com/legal/terms/dataprocessingagreement).

**Retention**:
- Messages: 90 days default (configurable per organization, max 1 year)
- WABA credentials: as long as integration is active; deleted within 30 days after disconnection
- Audit logs (timestamp, status, no content): 12 months

**Right to opt-out**: you can disable WhatsApp integration anytime from Settings > Messaging. Disabling deletes credentials within 30 days and immediately stops all automated sends.

**Right to erasure**: deleting your Clenzy account triggers full deletion of all associated WhatsApp data within 30 days (GDPR art. 17).

---

### Insert in "Data shared with third parties" section

#### Meta Platforms Ireland Limited (WhatsApp)

| Data type | Why | Legal basis |
|---|---|---|
| WhatsApp message content (outbound) | Deliver message to recipient | Contract performance (sending requested by user) |
| Recipient phone number | Message routing | Contract performance |
| WABA ID + Phone Number ID | API authentication | Contract performance |

**Data location**: Meta operates servers in Europe (primarily Ireland) and the United States. Cross-EU transfer is covered by Standard Contractual Clauses (SCC) approved by the European Commission, embedded in Meta's DPA.

---

### Insert in "Travelers (your guests)" section

#### WhatsApp communication sent to travelers

When you (host) configure Clenzy to send WhatsApp messages to your travelers (booking confirmations, check-in instructions, etc.), **you remain the data controller** (per GDPR). Clenzy and Meta act as sub-processors.

**Informing the traveler**: you must inform your travelers that their WhatsApp number will be used for communication related to their stay, through your own ToS or an explicit opt-in in your booking flow.

**Opt-out**: travelers can reply `STOP` to any Clenzy message at any time to unsubscribe. The system automatically detects and blocks future sends to their number.

---

## Checklist pré-soumission Meta

Avant de cliquer "Submit for Review" dans App Dashboard :

- [ ] Section FR ajoutée à https://clenzy.fr/confidentialite
- [ ] Section EN ajoutée à https://clenzy.fr/en/privacy (créer la version EN si pas existante)
- [ ] Lien direct vers la section WhatsApp ajouté dans la table des matières de la page
- [ ] Mention "Cf. Politique WhatsApp Business" avec lien externe vers whatsapp.com/legal
- [ ] Date de dernière mise à jour de la privacy policy actualisée
- [ ] Vérifier que l'URL https://clenzy.fr/confidentialite est accessible publiquement (pas derrière login)
- [ ] L'URL est bien renseignée dans App Dashboard > Settings > Basic > Privacy Policy URL
