package com.clenzy.service.messaging;

import com.clenzy.dto.ConversationDto;
import com.clenzy.model.*;
import com.clenzy.repository.ConversationMessageRepository;
import com.clenzy.repository.ConversationRepository;
import com.clenzy.repository.GuestRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.NotificationService;
import com.clenzy.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Service de gestion des conversations et messages de l'inbox unifie.
 */
@Service
public class ConversationService {

    private static final Logger log = LoggerFactory.getLogger(ConversationService.class);

    private final ConversationRepository conversationRepository;
    private final ConversationMessageRepository messageRepository;
    private final ConversationEventPublisher eventPublisher;
    private final NotificationService notificationService;
    private final WhatsAppChannel whatsAppChannel;
    private final ReservationRepository reservationRepository;
    private final GuestRepository guestRepository;
    private final com.clenzy.repository.UserRepository userRepository;
    private final com.clenzy.service.AssistantOutcomeTracker outcomeTracker;
    private final org.springframework.context.ApplicationEventPublisher applicationEventPublisher;

    public ConversationService(ConversationRepository conversationRepository,
                               ConversationMessageRepository messageRepository,
                               ConversationEventPublisher eventPublisher,
                               NotificationService notificationService,
                               WhatsAppChannel whatsAppChannel,
                               ReservationRepository reservationRepository,
                               GuestRepository guestRepository,
                               com.clenzy.repository.UserRepository userRepository,
                               com.clenzy.service.AssistantOutcomeTracker outcomeTracker,
                               org.springframework.context.ApplicationEventPublisher applicationEventPublisher) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.eventPublisher = eventPublisher;
        this.notificationService = notificationService;
        this.whatsAppChannel = whatsAppChannel;
        this.reservationRepository = reservationRepository;
        this.guestRepository = guestRepository;
        this.userRepository = userRepository;
        this.outcomeTracker = outcomeTracker;
        this.applicationEventPublisher = applicationEventPublisher;
    }

    /**
     * Obtient ou cree une conversation pour un canal et un identifiant externe donnes.
     */
    @Transactional
    public Conversation getOrCreate(Long orgId, ConversationChannel channel,
                                     String externalConversationId,
                                     Guest guest, Property property,
                                     Reservation reservation, String subject) {
        Optional<Conversation> existing = conversationRepository
            .findByOrganizationIdAndChannelAndExternalConversationId(orgId, channel, externalConversationId);

        if (existing.isPresent()) {
            return existing.get();
        }

        Conversation conv = new Conversation();
        conv.setOrganizationId(orgId);
        conv.setChannel(channel);
        conv.setExternalConversationId(externalConversationId);
        conv.setGuest(guest);
        conv.setProperty(property);
        conv.setReservation(reservation);
        conv.setSubject(subject);
        conv.setStatus(ConversationStatus.OPEN);
        conv.setUnread(true);

        return conversationRepository.save(conv);
    }

    /**
     * Obtient ou cree une conversation pour une reservation et un canal donnes.
     */
    @Transactional
    public Conversation getOrCreateForReservation(Long orgId, Long reservationId,
                                                   ConversationChannel channel,
                                                   Guest guest, Property property,
                                                   Reservation reservation) {
        Optional<Conversation> existing = conversationRepository
            .findByOrganizationIdAndReservationIdAndChannel(orgId, reservationId, channel);

        if (existing.isPresent()) {
            return existing.get();
        }

        Conversation conv = new Conversation();
        conv.setOrganizationId(orgId);
        conv.setChannel(channel);
        conv.setGuest(guest);
        conv.setProperty(property);
        conv.setReservation(reservation);
        conv.setSubject(property != null ? property.getName() : "Conversation");
        conv.setStatus(ConversationStatus.OPEN);
        conv.setUnread(true);

        return conversationRepository.save(conv);
    }

    /**
     * Ajoute un message entrant a une conversation.
     */
    @Transactional
    public ConversationMessage addInboundMessage(Conversation conversation,
                                                  String senderName,
                                                  String senderIdentifier,
                                                  String content,
                                                  String contentHtml,
                                                  String externalMessageId) {
        ConversationMessage msg = new ConversationMessage();
        msg.setOrganizationId(conversation.getOrganizationId());
        msg.setConversation(conversation);
        msg.setDirection(MessageDirection.INBOUND);
        msg.setChannelSource(conversation.getChannel());
        msg.setSenderName(senderName);
        msg.setSenderIdentifier(senderIdentifier);
        msg.setContent(content);
        msg.setContentHtml(contentHtml);
        msg.setExternalMessageId(externalMessageId);
        msg.setDeliveryStatus("DELIVERED");
        msg.setSentAt(LocalDateTime.now());

        msg = messageRepository.save(msg);

        // Mettre a jour la conversation
        updateConversationOnNewMessage(conversation, content, true);

        // Publier l'evenement WebSocket
        eventPublisher.publishNewMessage(conversation, msg);

        // Notification au responsable assigne (s'il y en a un)
        if (conversation.getAssignedToKeycloakId() != null) {
            notificationService.send(
                conversation.getAssignedToKeycloakId(),
                NotificationKey.CONVERSATION_NEW_MESSAGE,
                "Nouveau message de " + senderName,
                truncate(content, 100),
                "/contact?highlight=" + conversation.getId()
            );
        }

        // Concierge guest (C1) : déclenche la génération d'un brouillon IA APRÈS
        // commit (listener @Async), org-scopé. Best-effort, gaté par flag.
        applicationEventPublisher.publishEvent(new com.clenzy.service.agent.concierge.InboundGuestMessageEvent(
                conversation.getOrganizationId(), conversation.getId()));

        return msg;
    }

    /**
     * Envoie un message sortant dans une conversation.
     */
    @Transactional
    public ConversationMessage sendOutboundMessage(Conversation conversation,
                                                    String senderName,
                                                    String senderKeycloakId,
                                                    String content,
                                                    String contentHtml) {
        ConversationMessage msg = new ConversationMessage();
        msg.setOrganizationId(conversation.getOrganizationId());
        msg.setConversation(conversation);
        msg.setDirection(MessageDirection.OUTBOUND);
        msg.setChannelSource(conversation.getChannel());
        msg.setSenderName(senderName);
        msg.setSenderIdentifier(senderKeycloakId);
        msg.setContent(content);
        msg.setContentHtml(contentHtml);
        msg.setDeliveryStatus("SENT");
        msg.setSentAt(LocalDateTime.now());

        msg = messageRepository.save(msg);

        updateConversationOnNewMessage(conversation, content, false);

        eventPublisher.publishNewMessage(conversation, msg);

        // Instrumentation « reprise humaine » : sendOutboundMessage n'est appelé que par
        // l'action utilisateur du PMS (POST /conversations/{id}/messages) — jamais par les
        // envois automatiques/templates, qui passent par recordOutboundDelivered ou
        // GuestMessagingService. On compte la reprise dès l'action manuelle, indépendamment
        // du statut de livraison canal. La conversation reçue du controller peut être
        // détachée (reservation LAZY) : on relit l'id de réservation de façon managée.
        Long reservationId = conversationRepository.findById(conversation.getId())
            .map(c -> c.getReservation() != null ? c.getReservation().getId() : null)
            .orElse(null);
        outcomeTracker.recordManualMessage(conversation.getOrganizationId(), reservationId);

        // Envoi reel via WhatsApp (compte global) si la conversation est sur ce canal.
        if (conversation.getChannel() == ConversationChannel.WHATSAPP) {
            deliverViaWhatsApp(conversation.getId(), msg, senderName, content);
        }

        return msg;
    }

    /**
     * Envoi AUTONOME (concierge IA, C2) : réponse générée + envoyée par l'agent,
     * étiquetée IA. Distinct de {@link #sendOutboundMessage} : ne compte PAS une
     * « reprise humaine » (ce n'est pas une action opérateur). Même livraison
     * canal (fenêtre 24h WhatsApp gérée par {@code deliverViaWhatsApp}).
     */
    @Transactional
    public ConversationMessage sendAutonomousMessage(Conversation conversation, String content) {
        ConversationMessage msg = new ConversationMessage();
        msg.setOrganizationId(conversation.getOrganizationId());
        msg.setConversation(conversation);
        msg.setDirection(MessageDirection.OUTBOUND);
        msg.setChannelSource(conversation.getChannel());
        msg.setSenderName("Concierge IA");
        msg.setSenderIdentifier("system:concierge");
        msg.setContent(content);
        msg.setDeliveryStatus("SENT");
        msg.setSentAt(LocalDateTime.now());
        msg.setMetadata("{\"ai\":true}");

        msg = messageRepository.save(msg);
        updateConversationOnNewMessage(conversation, content, false);
        eventPublisher.publishNewMessage(conversation, msg);

        if (conversation.getChannel() == ConversationChannel.WHATSAPP) {
            deliverViaWhatsApp(conversation.getId(), msg, "Concierge IA", content);
        }
        return msg;
    }

    /**
     * Concierge IA — l'opérateur VALIDE le brouillon et l'envoie (chemin humain :
     * {@link #sendOutboundMessage}, donc compté comme reprise humaine). Le brouillon
     * est consommé. No-op si aucun brouillon.
     */
    @Transactional
    public com.clenzy.dto.ConversationDto sendAiDraft(Long orgId, Long conversationId, String operatorKeycloakId) {
        Conversation conversation = conversationRepository.findByIdAndOrganizationId(conversationId, orgId)
                .orElseThrow(() -> new IllegalArgumentException("Conversation introuvable: " + conversationId));
        String draft = conversation.getAiDraftReply();
        if (draft != null && !draft.isBlank()) {
            String senderName = userRepository.findByKeycloakId(operatorKeycloakId)
                    .map(com.clenzy.model.User::getFullName)
                    .filter(n -> n != null && !n.isBlank())
                    .orElse("Hôte");
            sendOutboundMessage(conversation, senderName, operatorKeycloakId, draft, null);
            conversation.setAiDraftReply(null);
            conversation.setAiDraftMeta(null);
            conversationRepository.save(conversation);
        }
        return com.clenzy.dto.ConversationDto.from(conversation);
    }

    /** Concierge IA — l'opérateur rejette le brouillon (sans envoi). */
    @Transactional
    public com.clenzy.dto.ConversationDto dismissAiDraft(Long orgId, Long conversationId) {
        Conversation conversation = conversationRepository.findByIdAndOrganizationId(conversationId, orgId)
                .orElseThrow(() -> new IllegalArgumentException("Conversation introuvable: " + conversationId));
        conversation.setAiDraftReply(null);
        conversation.setAiDraftMeta(null);
        conversationRepository.save(conversation);
        return com.clenzy.dto.ConversationDto.from(conversation);
    }

    /**
     * Envoi reel d'une reponse host -> guest via WhatsApp (canal WHATSAPP).
     * Recharge la conversation (managed) pour acceder au guest/property (LAZY),
     * verifie la fenetre de service 24h Meta, signe le message (host + propriete),
     * puis delegue au {@link WhatsAppChannel} (compte global). Met a jour le
     * statut de livraison du message.
     */
    private void deliverViaWhatsApp(Long conversationId, ConversationMessage msg,
                                     String senderName, String content) {
        Conversation conv = conversationRepository.findById(conversationId).orElse(null);
        if (conv == null) return;

        Guest guest = conv.getGuest();
        if (guest == null || guest.getPhone() == null || guest.getPhone().isBlank()) {
            log.warn("Envoi WhatsApp impossible (guest/numero absent) pour conversation {}", conversationId);
            msg.setDeliveryStatus("FAILED");
            messageRepository.save(msg);
            return;
        }

        // Fenetre de service 24h : hors fenetre, Meta interdit le message libre
        // (template requis -> gere par l'UI, lot B3). On ne tente pas l'envoi.
        Optional<ConversationMessage> lastInbound = messageRepository
            .findTopByConversationIdAndDirectionOrderBySentAtDesc(conversationId, MessageDirection.INBOUND);
        boolean within24h = lastInbound.isPresent()
            && lastInbound.get().getSentAt() != null
            && lastInbound.get().getSentAt().isAfter(LocalDateTime.now().minusHours(24));
        if (!within24h) {
            log.info("Fenetre 24h WhatsApp expiree (conv {}) : message libre non envoye, template requis", conversationId);
            msg.setDeliveryStatus("WINDOW_EXPIRED");
            messageRepository.save(msg);
            return;
        }

        String signed = buildSignedContent(senderName, conv.getProperty(), content);
        MessageDeliveryRequest request = new MessageDeliveryRequest(
            null, guest.getPhone(), guest.getFullName(), null, null, signed, guest.getLanguage());
        MessageDeliveryResult result = whatsAppChannel.send(request);

        msg.setDeliveryStatus(result.success() ? "SENT" : "FAILED");
        if (result.providerMessageId() != null) {
            msg.setExternalMessageId(result.providerMessageId());
        }
        messageRepository.save(msg);
        if (!result.success()) {
            log.warn("Echec envoi WhatsApp (conv {}): {}", conversationId, result.errorMessage());
        }
    }

    /** Signature cote guest : "Jean (Villa Azur) : message". */
    private String buildSignedContent(String senderName, Property property, String content) {
        String propName = (property != null) ? property.getName() : null;
        boolean hasSender = senderName != null && !senderName.isBlank();
        boolean hasProp = propName != null && !propName.isBlank();
        if (hasSender && hasProp) return senderName + " (" + propName + ") : " + content;
        if (hasSender) return senderName + " : " + content;
        return content;
    }

    @Transactional
    public void markAsRead(Long conversationId, Long orgId) {
        Conversation conv = conversationRepository.findByIdAndOrganizationId(conversationId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Conversation introuvable: " + conversationId));
        conv.setUnread(false);
        conversationRepository.save(conv);
    }

    @Transactional
    public Conversation assignConversation(Long conversationId, Long orgId, String keycloakId) {
        Conversation conv = conversationRepository.findByIdAndOrganizationId(conversationId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Conversation introuvable: " + conversationId));
        // Securite : l'assigne doit appartenir a l'organisation (anti-assignation cross-org).
        com.clenzy.model.User assignee = userRepository.findByKeycloakId(keycloakId)
            .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable: " + keycloakId));
        if (!orgId.equals(assignee.getOrganizationId())) {
            throw new org.springframework.security.access.AccessDeniedException(
                "L'utilisateur n'appartient pas a l'organisation");
        }
        conv.setAssignedToKeycloakId(keycloakId);
        conv = conversationRepository.save(conv);

        notificationService.send(
            keycloakId,
            NotificationKey.CONVERSATION_ASSIGNED,
            "Conversation assignee",
            "Vous avez ete assigne a une conversation" + (conv.getSubject() != null ? " : " + conv.getSubject() : ""),
            "/contact?highlight=" + conv.getId()
        );

        return conv;
    }

    @Transactional
    public Conversation updateStatus(Long conversationId, Long orgId, ConversationStatus status) {
        Conversation conv = conversationRepository.findByIdAndOrganizationId(conversationId, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Conversation introuvable: " + conversationId));
        conv.setStatus(status);
        return conversationRepository.save(conv);
    }

    /**
     * Rattache une conversation orpheline (« à trier ») à une réservation : la
     * relie au guest / logement / réservation, la déplace dans l'org du host et
     * l'assigne au propriétaire. Si {@code memorizePhone}, le numéro WhatsApp est
     * enregistré sur le guest (phone_hash) pour que les futurs messages de ce
     * numéro soient reconnus automatiquement par {@link WhatsAppInboundRouter}.
     *
     * <p>Charge la conversation sans scope d'org (findById) car les conversations
     * « à trier » vivent dans l'org SYSTEM et l'appelant (SUPER_ADMIN/MANAGER)
     * bypasse le filtre tenant.</p>
     */
    @Transactional
    public ConversationDto attachToReservation(Long conversationId, Long reservationId, boolean memorizePhone) {
        Conversation conv = conversationRepository.findById(conversationId)
            .orElseThrow(() -> new IllegalArgumentException("Conversation introuvable: " + conversationId));
        Reservation res = reservationRepository.findById(reservationId)
            .orElseThrow(() -> new IllegalArgumentException("Réservation introuvable: " + reservationId));

        Guest guest = res.getGuest();
        Property property = res.getProperty();

        conv.setReservation(res);
        conv.setGuest(guest);
        conv.setProperty(property);
        conv.setOrganizationId(res.getOrganizationId());
        if (property != null) {
            conv.setSubject(property.getName());
        }
        conv.setStatus(ConversationStatus.OPEN);
        if (property != null && property.getOwner() != null
                && property.getOwner().getKeycloakId() != null) {
            conv.setAssignedToKeycloakId(property.getOwner().getKeycloakId());
        }

        // Mémorise le numéro WhatsApp sur le guest → auto-rattachement futur.
        if (memorizePhone && guest != null
                && conv.getChannel() == ConversationChannel.WHATSAPP
                && conv.getExternalConversationId() != null) {
            String number = conv.getExternalConversationId().replaceAll("@.*$", "");
            String phoneHash = StringUtils.computePhoneHash(number, guest.getCountryCode());
            if (phoneHash != null) {
                guest.setPhone(number);
                guest.setPhoneHash(phoneHash);
                guestRepository.save(guest);
            }
        }

        Conversation saved = conversationRepository.save(conv);
        log.info("Conversation {} rattachée à la réservation {} (org {})",
            conversationId, reservationId, res.getOrganizationId());
        // Mapping DANS la transaction (OSIV off) → relations LAZY initialisables.
        return ConversationDto.from(saved);
    }

    /**
     * Enregistre un message SORTANT déjà délivré (ex: template WhatsApp envoyé par
     * {@code WhatsAppTemplateSender}) : crée le ConversationMessage, met à jour la
     * conversation et publie l'événement temps réel. Ne RE-déclenche PAS l'envoi
     * (contrairement à {@link #sendOutboundMessage}) ni la signature ni la
     * fenêtre 24h — l'envoi a déjà eu lieu.
     */
    @Transactional
    public ConversationMessage recordOutboundDelivered(Conversation conversation, String senderName,
                                                       String senderKeycloakId, String content,
                                                       String externalMessageId, String deliveryStatus) {
        ConversationMessage msg = new ConversationMessage();
        msg.setOrganizationId(conversation.getOrganizationId());
        msg.setConversation(conversation);
        msg.setDirection(MessageDirection.OUTBOUND);
        msg.setChannelSource(conversation.getChannel());
        msg.setSenderName(senderName);
        msg.setSenderIdentifier(senderKeycloakId);
        msg.setContent(content);
        msg.setDeliveryStatus(deliveryStatus);
        msg.setExternalMessageId(externalMessageId);
        msg.setSentAt(LocalDateTime.now());
        msg = messageRepository.save(msg);
        updateConversationOnNewMessage(conversation, content, false);
        eventPublisher.publishNewMessage(conversation, msg);
        return msg;
    }

    public Page<Conversation> getInbox(Long orgId, ConversationStatus status, Pageable pageable) {
        if (status != null) {
            return conversationRepository.findByOrganizationIdAndStatusOrderByLastMessageAtDesc(orgId, status, pageable);
        }
        // Inbox active : exclut les conversations archivées (elles vivent dans "Messages archivés").
        return conversationRepository.findByOrganizationIdAndStatusNotOrderByLastMessageAtDesc(
            orgId, ConversationStatus.ARCHIVED, pageable);
    }

    /**
     * Inbox filtre par liste de channels (ex: AIRBNB, BOOKING).
     */
    public Page<Conversation> getInboxByChannels(Long orgId, List<ConversationChannel> channels,
                                                   ConversationStatus status, Pageable pageable) {
        if (status != null) {
            return conversationRepository.findByOrganizationIdAndChannelInAndStatusOrderByLastMessageAtDesc(
                orgId, channels, status, pageable);
        }
        // Inbox active : exclut les conversations archivées.
        return conversationRepository.findByOrganizationIdAndChannelInAndStatusNotOrderByLastMessageAtDesc(
            orgId, channels, ConversationStatus.ARCHIVED, pageable);
    }

    public Page<Conversation> getMyConversations(Long orgId, String keycloakId, Pageable pageable) {
        return conversationRepository.findByOrganizationIdAndAssignedToKeycloakIdOrderByLastMessageAtDesc(
            orgId, keycloakId, pageable);
    }

    public Optional<Conversation> getById(Long id, Long orgId) {
        return conversationRepository.findByIdAndOrganizationId(id, orgId);
    }

    public Page<ConversationMessage> getMessages(Long conversationId, Long orgId, Pageable pageable) {
        return messageRepository.findByConversationIdAndOrganizationIdOrderBySentAtAsc(
            conversationId, orgId, pageable);
    }

    public long getUnreadCount(Long orgId) {
        return conversationRepository.countUnreadByOrganizationId(orgId);
    }

    private void updateConversationOnNewMessage(Conversation conversation, String content, boolean markUnread) {
        conversation.setLastMessagePreview(truncate(content, 200));
        conversation.setLastMessageAt(LocalDateTime.now());
        conversation.setMessageCount(conversation.getMessageCount() + 1);
        if (markUnread) {
            conversation.setUnread(true);
        }
        if (conversation.getStatus() == ConversationStatus.CLOSED) {
            conversation.setStatus(ConversationStatus.OPEN);
        }
        conversationRepository.save(conversation);
    }

    private String truncate(String text, int maxLength) {
        if (text == null) return "";
        return text.length() > maxLength ? text.substring(0, maxLength) + "..." : text;
    }
}
