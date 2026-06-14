package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.Conversation;
import com.clenzy.model.ConversationChannel;
import com.clenzy.model.ConversationMessage;
import com.clenzy.model.ConversationStatus;
import com.clenzy.model.MessageDirection;
import com.clenzy.repository.ConversationMessageRepository;
import com.clenzy.repository.ConversationRepository;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Optional;

/**
 * Service de messagerie OTA via Channex Messages App (paid).
 *
 * <p><b>Strategie d'integration</b> : on persiste les threads/messages Channex
 * dans la table {@code conversations} Clenzy existante avec
 * {@code channel = AIRBNB | BOOKING} + {@code externalConversationId = channex_thread_id}.
 * Du coup l'UI existante ({@code ChannelInboxTab}) les voit transparently sans
 * modification frontend.</p>
 *
 * <p><b>Flow</b> :</p>
 * <ul>
 *   <li>Webhook Channex {@code message} → {@link #onChannexMessage} upsert
 *       Conversation + ConversationMessage</li>
 *   <li>L'admin click "Send" cote UI → endpoint Clenzy existant
 *       {@code POST /api/conversations/{id}/messages} → {@link #sendOutgoingMessage}
 *       qui forward vers Channex + persiste la copie locale</li>
 * </ul>
 *
 * <p><b>Pre-requis</b> : Messages App achetee + activee cote dashboard Channex.
 * Sans l'app, tous les calls renvoient empty Optional + on log un warn.</p>
 */
@Service
public class ChannexMessagingService {

    private static final Logger log = LoggerFactory.getLogger(ChannexMessagingService.class);

    private final ChannexClient channexClient;
    private final ChannexPropertyMappingRepository mappingRepository;
    private final ConversationRepository conversationRepository;
    private final ConversationMessageRepository messageRepository;

    public ChannexMessagingService(ChannexClient channexClient,
                                     ChannexPropertyMappingRepository mappingRepository,
                                     ConversationRepository conversationRepository,
                                     ConversationMessageRepository messageRepository) {
        this.channexClient = channexClient;
        this.mappingRepository = mappingRepository;
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
    }

    /**
     * Handler webhook Channex {@code message} : nouveau message OTA recu.
     *
     * <p>Le payload Channex contient le thread_id + message + auteur. On
     * upsert la Conversation Clenzy (idempotent par
     * {@code (org, channel, external_conversation_id)}) puis on persiste le
     * ConversationMessage.</p>
     */
    @Transactional
    public Optional<ConversationMessage> onChannexMessage(JsonNode payload) {
        if (payload == null || payload.isMissingNode()) return Optional.empty();
        String threadId = payload.path("thread_id").asText(null);
        String channexPropertyId = payload.path("property_id").asText(null);
        String channelName = payload.path("channel").asText("AIRBNB");
        String content = payload.path("message").asText(null);
        String authorType = payload.path("author_type").asText("guest");
        String authorName = payload.path("author_name").asText(null);
        String messageId = payload.path("id").asText(null);
        if (threadId == null || channexPropertyId == null || content == null) {
            log.warn("ChannexMessaging: payload incomplet, skip (thread={} property={} content={})",
                threadId, channexPropertyId, content != null ? "ok" : "null");
            return Optional.empty();
        }

        // Resoudre le mapping pour avoir l'org + clenzy property
        Optional<ChannexPropertyMapping> mappingOpt = mappingRepository
            .findByChannexPropertyIdAnyOrg(channexPropertyId);
        if (mappingOpt.isEmpty()) {
            log.warn("ChannexMessaging: mapping introuvable pour property={}, skip", channexPropertyId);
            return Optional.empty();
        }
        ChannexPropertyMapping mapping = mappingOpt.get();
        Long orgId = mapping.getOrganizationId();
        ConversationChannel channel = mapToConversationChannel(channelName);

        // Idempotence reelle : un meme message OTA peut arriver via plusieurs chemins (adapter
        // direct + Channex) ou etre re-livre par webhook. On dedup par (org, canal, id externe).
        if (messageId != null) {
            Optional<ConversationMessage> existing = messageRepository
                .findByOrganizationIdAndChannelSourceAndExternalMessageId(orgId, channel, messageId);
            if (existing.isPresent()) {
                log.debug("ChannexMessaging: message {} deja ingere (idempotence), skip", messageId);
                return existing;
            }
        }

        // Upsert Conversation (idempotent par external_conversation_id)
        Conversation conversation = conversationRepository
            .findByOrganizationIdAndChannelAndExternalConversationId(orgId, channel, threadId)
            .orElseGet(() -> {
                Conversation c = new Conversation();
                c.setOrganizationId(orgId);
                c.setChannel(channel);
                c.setExternalConversationId(threadId);
                c.setStatus(ConversationStatus.OPEN);
                c.setSubject("Thread OTA " + channelName);
                return c;
            });
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        conversation.setLastMessagePreview(truncate(content, 200));
        conversation.setLastMessageAt(now);
        conversation.setUnread(true);
        conversation = conversationRepository.save(conversation);

        // Persiste le message (idempotence deja verifiee ci-dessus via external_message_id)
        ConversationMessage msg = new ConversationMessage();
        msg.setOrganizationId(orgId);
        msg.setConversation(conversation);
        msg.setContent(content);
        msg.setSenderName(authorName != null ? authorName : authorType);
        msg.setDirection("host".equalsIgnoreCase(authorType)
            ? MessageDirection.OUTBOUND : MessageDirection.INBOUND);
        msg.setChannelSource(channel);
        msg.setExternalMessageId(messageId);
        msg.setSentAt(now);
        msg = messageRepository.save(msg);
        log.info("ChannexMessaging: message persiste conversation={} direction={} content_len={}",
            conversation.getId(), msg.getDirection(), content.length());
        return Optional.of(msg);
    }

    /**
     * Envoi d'un message sortant via Channex (host → guest).
     *
     * <p>A appeler depuis le service Conversation existant quand l'admin envoie
     * un message dans une Conversation Clenzy de channel AIRBNB/BOOKING dont
     * l'externalConversationId est un thread Channex.</p>
     *
     * @return true si le push Channex a reussi (le ConversationMessage local
     *         est persiste independamment cote service caller)
     */
    public boolean sendOutgoingMessage(Conversation conversation, String text) {
        if (conversation == null || conversation.getExternalConversationId() == null) {
            return false;
        }
        if (conversation.getChannel() != ConversationChannel.AIRBNB
            && conversation.getChannel() != ConversationChannel.BOOKING) {
            // Pas un thread Channex → pas de push (autre canal)
            return false;
        }
        // Channex API : POST /bookings/{id}/messages OU /message_threads/{id}/messages
        // On utilise /message_threads/{id}/messages qui fonctionne pour les threads
        // initialises sans booking attache (inquiry pre-resa).
        String threadId = conversation.getExternalConversationId();
        Optional<JsonNode> response = channexClient.fetchThreadMessages(threadId);
        if (response.isEmpty()) {
            log.warn("ChannexMessaging: thread {} introuvable cote Channex, skip push", threadId);
            return false;
        }
        // Note : le wrapper sendBookingMessage utilise /bookings/{id}/messages.
        // Pour un message_thread on aurait besoin d'un endpoint dedie ; ici on
        // delegue au booking_id si present dans le thread.
        String bookingId = response.get().path("data").size() > 0
            ? response.get().path("data").get(0).path("attributes").path("booking_id").asText(null)
            : null;
        if (bookingId == null) {
            log.warn("ChannexMessaging: pas de booking_id dans thread {}, skip", threadId);
            return false;
        }
        return channexClient.sendBookingMessage(bookingId, text).isPresent();
    }

    /**
     * Liste les threads d'une property avec sync depuis Channex.
     * Endpoint mainly read-through pour debugging — la source de verite UI
     * reste la table conversations Clenzy.
     */
    public Optional<JsonNode> listThreadsForProperty(Long clenzyPropertyId, Long orgId) {
        Optional<ChannexPropertyMapping> mapping = mappingRepository
            .findByClenzyPropertyId(clenzyPropertyId, orgId);
        if (mapping.isEmpty()) return Optional.empty();
        return channexClient.fetchMessageThreads(mapping.get().getChannexPropertyId());
    }

    /** Map le channel Channex (string libre) vers l'enum ConversationChannel Clenzy. */
    private ConversationChannel mapToConversationChannel(String channelName) {
        if (channelName == null) return ConversationChannel.AIRBNB;
        String upper = channelName.toUpperCase();
        if (upper.contains("AIRBNB")) return ConversationChannel.AIRBNB;
        if (upper.contains("BOOKING")) return ConversationChannel.BOOKING;
        // Fallback : on tag AIRBNB par defaut (les autres OTAs sont rares en messaging direct)
        return ConversationChannel.AIRBNB;
    }

    private static String truncate(String s, int max) {
        if (s == null || s.length() <= max) return s;
        return s.substring(0, max) + "…";
    }
}
