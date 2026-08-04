package com.clenzy.repository;

import com.clenzy.model.ConversationChannel;
import com.clenzy.model.ConversationMessage;
import com.clenzy.model.MessageDirection;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConversationMessageRepository extends JpaRepository<ConversationMessage, Long> {

    Page<ConversationMessage> findByConversationIdAndOrganizationIdOrderBySentAtAsc(
        Long conversationId, Long organizationId, Pageable pageable);

    @Query("SELECT m FROM ConversationMessage m JOIN FETCH m.conversation " +
           "WHERE m.organizationId = :orgId AND m.channelSource = :channel " +
           "ORDER BY m.sentAt DESC")
    List<ConversationMessage> findByOrgAndChannelWithConversation(
        @Param("orgId") Long organizationId,
        @Param("channel") ConversationChannel channelSource);

    /** Dernier message d'une direction donnee (ex: INBOUND) — fenetre de service 24h WhatsApp. */
    Optional<ConversationMessage> findTopByConversationIdAndDirectionOrderBySentAtDesc(
        Long conversationId, MessageDirection direction);

    /**
     * Idempotence d'ingestion : un meme message OTA peut arriver via plusieurs chemins (adapter
     * direct + Channex) ou etre re-livre par webhook. Dedup par (org, canal, id externe).
     */
    Optional<ConversationMessage> findByOrganizationIdAndChannelSourceAndExternalMessageId(
        Long organizationId, ConversationChannel channelSource, String externalMessageId);

    /**
     * Effacement RGPD (M9) : purge le CONTENU de tous les messages des fils du
     * voyageur (les métadonnées de livraison restent — preuve d'échange sans PII) ;
     * l'expéditeur n'est anonymisé que côté INBOUND (l'OUTBOUND est l'hôte).
     */
    @org.springframework.data.jpa.repository.Modifying
    @Query("UPDATE ConversationMessage m SET m.content = :placeholder, m.contentHtml = NULL, " +
           "m.senderName = CASE WHEN m.direction = com.clenzy.model.MessageDirection.INBOUND " +
           "THEN :anonymizedName ELSE m.senderName END, " +
           "m.senderIdentifier = CASE WHEN m.direction = com.clenzy.model.MessageDirection.INBOUND " +
           "THEN NULL ELSE m.senderIdentifier END " +
           "WHERE m.conversation.id IN :conversationIds")
    int purgeContentForConversations(@Param("conversationIds") java.util.List<Long> conversationIds,
                                     @Param("placeholder") String placeholder,
                                     @Param("anonymizedName") String anonymizedName);
}
