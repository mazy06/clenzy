package com.clenzy.service.messaging;

import com.clenzy.model.*;
import com.clenzy.repository.ConversationMessageRepository;
import com.clenzy.repository.ConversationRepository;
import com.clenzy.service.NotificationService;
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

    public ConversationService(ConversationRepository conversationRepository,
                               ConversationMessageRepository messageRepository,
                               ConversationEventPublisher eventPublisher,
                               NotificationService notificationService) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.eventPublisher = eventPublisher;
        this.notificationService = notificationService;
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
                null
            );
        }

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

        return msg;
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
        conv.setAssignedToKeycloakId(keycloakId);
        conv = conversationRepository.save(conv);

        notificationService.send(
            keycloakId,
            NotificationKey.CONVERSATION_ASSIGNED,
            "Conversation assignee",
            "Vous avez ete assigne a une conversation" + (conv.getSubject() != null ? " : " + conv.getSubject() : ""),
            null
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

    public Page<Conversation> getInbox(Long orgId, ConversationStatus status, Pageable pageable) {
        if (status != null) {
            return conversationRepository.findByOrganizationIdAndStatusOrderByLastMessageAtDesc(orgId, status, pageable);
        }
        return conversationRepository.findByOrganizationIdOrderByLastMessageAtDesc(orgId, pageable);
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
        return conversationRepository.findByOrganizationIdAndChannelInOrderByLastMessageAtDesc(
            orgId, channels, pageable);
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
