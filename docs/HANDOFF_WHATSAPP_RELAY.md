# Design — Relais WhatsApp (numéro central Baitly)

> Document de conception (architecture cible) — **à valider avant implémentation**.
> Auteur : session 2026-06-06. Statut : PROPOSITION.

## 1. Objectif

Un **seul numéro WhatsApp Baitly** (compte global, cf. « Chantier A ») par lequel transitent
toutes les conversations voyageurs. Le **Guest** écrit à ce numéro ; **Baitly** identifie la
réservation et **relaie au Host** via une **inbox unifiée** ; le Host répond depuis Baitly, et sa
réponse repart du numéro central vers le Guest.

**Ce n'est pas un groupe WhatsApp** (la Groups API de Meta est verrouillée pour Baitly :
pastille verte + 100k conv/mois requis, + exposition des numéros). Le relais via numéro central
est le modèle des PMS établis (Guesty, Hostaway) : numéros masqués, pas de contrainte Meta.

```
   Guest  ──WhatsApp──►  [ Numéro central Baitly ]  ──webhook──►  Baitly
                                                                    │  identifie réservation/host
                                                                    ▼
                                                            Inbox unifiée (Host)
                                                                    │  le host répond
   Guest  ◄──WhatsApp──  [ Numéro central Baitly ]  ◄──envoi────────┘
```

Côté Guest = conversation 1:1 avec « Baitly » (représentant la propriété). Côté Host = inbox in-app.

## 2. Ce qui existe déjà (réutilisé — ~80 %)

| Brique | Fichier | Rôle |
|---|---|---|
| `Conversation` / `ConversationMessage` | `server/.../model/` | Multi-canal (**WHATSAPP** déjà un `ConversationChannel`), direction IN/OUT, liens guest/property/reservation, `assignedToKeycloakId`, `unread` |
| `ConversationService` | `server/.../service/messaging/ConversationService.java` | `getOrCreate`, `addInboundMessage`, `sendOutboundMessage`, `getInbox`, `assignConversation`, notif + WebSocket |
| `WhatsAppWebhookService` | `server/.../service/messaging/WhatsAppWebhookService.java` | Reçoit **déjà** les messages entrants Meta, crée une conversation, log le message |
| `MessageChannel` / `WhatsAppChannel` | `server/.../service/messaging/` | Envoi sortant WhatsApp (Meta/OpenWA via resolver) |
| `ChannelInboxTab` | `client/src/modules/channels/ChannelInboxTab.tsx` | Inbox unifiée OTA (Airbnb/Booking) — drawer conversation, réponse, mark-as-read, archive |
| `conversationApi` | `client/src/services/api/conversationApi.ts` | `getInbox(channels,status)`, `getMessages`, `sendMessage`, `getUnreadCount` |
| Composants chat | `modules/contact/InternalChatTab`, `modules/assistant/MessageBubble` | Timeline/bulles réutilisables |

## 3. Lacunes à combler (le vrai travail de B)

### 3.1 Identifier le guest depuis le numéro entrant — **manquant**
- `Guest.phone` est **chiffré** (AES-256) ; il n'y a **ni `phone_hash` ni `findByPhone`**
  (`GuestRepository` ne cherche que par `channelGuestId` / `id`).
- À construire :
  - Colonne **`phone_hash`** sur `guests` (hash déterministe, comme l'`email_hash` existant), + index.
  - **Normalisation E.164** : Meta envoie `33612345678` (sans `+`) ; le `phone` stocké peut varier
    (`+33…`, `0033…`, `06…`). Normaliser des deux côtés avant hash/comparaison.
  - Migration de peuplement (`phone_hash` des guests existants) + normalisation à l'import (Airbnb/iCal/Booking).
  - `GuestRepository.findByPhoneHashAndOrganizationId(...)` — mais en **global**, on cherche **cross-org**
    (le numéro central reçoit tout) → `findByPhoneHash(...)` sans filtre org, puis on déduit l'org via la réservation.

### 3.2 Envoi sortant réel — **non câblé**
- `ConversationService.sendOutboundMessage` log le message + WebSocket, mais **n'envoie rien**.
- À faire : quand `conversation.channel == WHATSAPP`, appeler `WhatsAppChannel.send(configGlobale, guest.phone, content)`,
  récupérer `externalMessageId` + `deliveryStatus`. (Pour les canaux OTA, le comportement actuel reste.)

## 4. Architecture détaillée

### 4.1 Flux ENTRANT (Guest → Host)
1. Guest → message au numéro central. Webhook Meta → `WhatsAppWebhookService`.
2. Config résolue = **config globale** (un seul numéro ; plus de lookup par `phoneNumberId`→org).
3. **Lookup** : `from` (E.164) → `phone_hash` → `Guest` → **réservation active/imminente**
   (chevauchant `now`, sinon la plus proche) → `Property` → **Host = `property.owner`** → `organizationId`.
4. `getOrCreateForReservation(org, reservationId, WHATSAPP, …)` rattache la conversation (guest, property, reservation).
5. **Assignation** au host : `assignConversation(conv, org, owner.keycloakId)`.
6. `addInboundMessage(...)` → notif in-app **CONVERSATION_NEW_MESSAGE** au host (déjà câblé) + WebSocket.

### 4.2 Flux SORTANT (Host → Guest)
1. Host ouvre l'inbox Baitly, sélectionne la conversation WhatsApp, répond.
2. `ConversationController.sendMessage` → `sendOutboundMessage` **étendu** : si canal WHATSAPP →
   `WhatsAppChannel.send(configGlobale, guest.phone, content)`.
3. Stocke `externalMessageId` / `deliveryStatus`. Le Guest reçoit le message du numéro central.

### 4.3 Fenêtre de service 24h (contrainte Meta)
- Hors des 24h après le dernier message du guest, Meta **interdit le message libre** → **template approuvé** requis.
- L'inbox doit : détecter `now - lastInboundAt > 24h` → bloquer le texte libre et proposer un **template**
  (réutiliser `whatsapp_template_content`). Dans la fenêtre → message libre OK.

### 4.4 Cas limites
- **Numéro inconnu** (aucun guest) : conversation non rattachée → file « à trier » (org plateforme / non assignée), ou ignorée. **→ décision §7.**
- **Plusieurs réservations** pour un même guest : prendre la réservation active, sinon la prochaine, sinon la dernière.
- **Guest multi-propriétés / multi-hosts** : la réservation tranche le host.

## 5. Lien avec le compte global (Chantier A)
- Avec un numéro unique, le routage **par org** ne se fait plus via `phoneNumberId` mais via le **guest**
  (numéro → réservation → org/host). Donc : **A (config globale) + lookup guest = routage complet.**
- Le webhook entrant cesse de scanner toutes les orgs (`findAll().filter`) → lookup direct par `phone_hash`.

## 6. Confidentialité / UX
- Numéros **masqués** : ni le guest ni le host ne voient le numéro de l'autre.
- Le Guest voit « Baitly » comme interlocuteur. **Option** : signer les messages sortants
  (« *Jean (Villa Azur)* : … ») pour clarifier qui répond. **→ décision §7.**

## 7. Décisions (VALIDÉES 2026-06-06)
1. **Architecture** : **VALIDÉE** — démarrage implémentation (Lot A → B1 → B2 → B3).
2. **Signature de l'expéditeur** côté guest : **SIGNÉE** — messages sortants préfixés du host + propriété
   (ex. « *Jean (Villa Azur)* : … »). Le numéro reste celui de Baitly.
3. **Numéro inconnu** : **FILE « À TRIER »** — conversation non assignée, visible plateforme, pour
   rattachement manuel. Aucun message perdu.
4. **Fenêtre 24h** : hors fenêtre → passage obligatoire par template approuvé Meta (contrainte non négociable).

## 8. Découpage en lots
- **Lot A** — ✅ **FAIT** (2026-06-06). Config WhatsApp globale (singleton) + UI. Migration 0192.
- **Lot B1** — ✅ **FAIT** (2026-06-06). `phone_hash` (migration 0193, libphonenumber, backfill runner) +
  normalisation E.164 + lookup guest (`WhatsAppInboundRouter`) + webhook (rattachement réservation/host
  + assignation + file « à trier »). 56 tests WhatsApp verts.
- **Lot B2** — ✅ **FAIT** (2026-06-06). Envoi sortant réel : `ConversationService.sendOutboundMessage` →
  `deliverViaWhatsApp` → `WhatsAppChannel` (compte global). **Signature** « Host (Propriété) : … » +
  **fenêtre 24h** (hors fenêtre → statut `WINDOW_EXPIRED`, pas d'envoi libre). Repo : dernier inbound.
- **Lot B3** — ✅ **FAIT** (2026-06-06). Inbox front : WHATSAPP ajouté à `OTA_CHANNELS` (visible dans
  `ChannelInboxTab`, déjà stylé) + calcul fenêtre 24h côté client (dernier message INBOUND) → bandeau
  d'avertissement + réponse libre désactivée hors fenêtre.

---

**RELAIS WHATSAPP COMPLET** (A + B1 + B2 + B3) — 2026-06-06. Vérifié : `tsc -b` OK, `mvn package`
BUILD SUCCESS, ~85 tests verts. Non commité (en attente feu vert).

## 9. Risques / points d'attention
- **PII** : `phone_hash` doit utiliser le même sel/algo que l'`email_hash` existant (cohérence sécurité). Ne pas exposer le hash.
- **E.164** : qualité des numéros à l'import (sources hétérogènes) — un numéro mal normalisé = guest non identifié.
- **Multi-tenant** : en compte global, le webhook résout l'org **après** le lookup guest (le filtre Hibernate ne s'applique pas au webhook public).
- **Templates Meta** : nécessitent approbation Meta (~24h) — prérequis pour le hors-fenêtre.
