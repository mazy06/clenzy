package com.clenzy.repository;

import com.clenzy.model.Conversation;
import com.clenzy.model.ConversationChannel;
import com.clenzy.model.ConversationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    /**
     * Conversations ouvertes dont le dernier message vient du voyageur.
     *
     * <p>Le seul signal existant est le booléen {@code unread}, effacé dès
     * qu'on ouvre la conversation : on lit, on remet la réponse à plus tard, et
     * le voyageur disparaît du système. Le silence pendant un séjour est
     * pourtant ce qui produit les mauvais avis.</p>
     */
    @Query("SELECT c FROM Conversation c WHERE c.organizationId = :orgId "
        + "AND c.status = com.clenzy.model.ConversationStatus.OPEN "
        + "AND c.lastMessageAt < :staleBefore "
        + "AND EXISTS (SELECT 1 FROM ConversationMessage m WHERE m.conversation = c "
        + "  AND m.direction = com.clenzy.model.MessageDirection.INBOUND "
        + "  AND m.sentAt = c.lastMessageAt) "
        + "ORDER BY c.lastMessageAt")
    List<Conversation> findAwaitingHostReply(@Param("orgId") Long orgId,
                                             @Param("staleBefore") LocalDateTime staleBefore);

    /**
     * Conversations CHAUDES non assignées d'un logement (scanner CONVERSATION_TAKEOVER
     * de la constellation) : ouvertes, sans opérateur assigné, dont le DERNIER message
     * est entrant et qui ont reçu ≥ {@code minInbound} messages entrants depuis
     * {@code since} — le voyageur insiste et personne n'a répondu.
     */
    @Query("SELECT c FROM Conversation c WHERE c.organizationId = :orgId "
        + "AND c.property.id = :propertyId "
        + "AND c.status = com.clenzy.model.ConversationStatus.OPEN "
        + "AND c.assignedToKeycloakId IS NULL AND c.lastMessageAt >= :since "
        + "AND (SELECT COUNT(m) FROM ConversationMessage m WHERE m.conversation = c "
        + "  AND m.direction = com.clenzy.model.MessageDirection.INBOUND "
        + "  AND m.sentAt >= :since) >= :minInbound "
        + "AND EXISTS (SELECT 1 FROM ConversationMessage m2 WHERE m2.conversation = c "
        + "  AND m2.direction = com.clenzy.model.MessageDirection.INBOUND "
        + "  AND m2.sentAt = c.lastMessageAt)")
    List<Conversation> findHotUnassignedByProperty(@Param("orgId") Long orgId,
                                                   @Param("propertyId") Long propertyId,
                                                   @Param("since") LocalDateTime since,
                                                   @Param("minInbound") long minInbound);

    /**
     * Signe de vie du voyageur (scanner no-show) : au moins un message ENTRANT sur une
     * conversation liée à la réservation depuis {@code since}.
     */
    @Query("SELECT COUNT(m) > 0 FROM ConversationMessage m "
        + "WHERE m.conversation.reservation.id = :reservationId "
        + "AND m.conversation.organizationId = :orgId "
        + "AND m.direction = com.clenzy.model.MessageDirection.INBOUND "
        + "AND m.sentAt >= :since")
    boolean hasInboundMessageSince(@Param("reservationId") Long reservationId,
                                   @Param("orgId") Long orgId,
                                   @Param("since") LocalDateTime since);


    // @EntityGraph : charge guest/property/reservation AVEC la conversation, pour que
    // ConversationDto.from() (appelé hors transaction — OSIV désactivé) n'initialise
    // aucun proxy LAZY → évite LazyInitializationException sur les conversations
    // rattachées (guest/property/reservation non nuls).

    @EntityGraph(attributePaths = {"guest", "property", "reservation"})
    Page<Conversation> findByOrganizationIdAndStatusOrderByLastMessageAtDesc(
        Long organizationId, ConversationStatus status, Pageable pageable);

    /** Fils d'un voyageur — parcours d'effacement RGPD (M9). */
    List<Conversation> findByOrganizationIdAndGuestId(Long organizationId, Long guestId);

    @EntityGraph(attributePaths = {"guest", "property", "reservation"})
    Page<Conversation> findByOrganizationIdOrderByLastMessageAtDesc(
        Long organizationId, Pageable pageable);

    @EntityGraph(attributePaths = {"guest", "property", "reservation"})
    Page<Conversation> findByOrganizationIdAndAssignedToKeycloakIdOrderByLastMessageAtDesc(
        Long organizationId, String keycloakId, Pageable pageable);

    Optional<Conversation> findByOrganizationIdAndChannelAndExternalConversationId(
        Long organizationId, ConversationChannel channel, String externalConversationId);

    Optional<Conversation> findByOrganizationIdAndReservationIdAndChannel(
        Long organizationId, Long reservationId, ConversationChannel channel);

    @Query("SELECT COUNT(c) FROM Conversation c WHERE c.organizationId = :orgId AND c.unread = true AND c.status <> com.clenzy.model.ConversationStatus.ARCHIVED")
    long countUnreadByOrganizationId(@Param("orgId") Long organizationId);

    @EntityGraph(attributePaths = {"guest", "property", "reservation"})
    Optional<Conversation> findByIdAndOrganizationId(Long id, Long organizationId);

    @EntityGraph(attributePaths = {"guest", "property", "reservation"})
    Page<Conversation> findByOrganizationIdAndChannelInOrderByLastMessageAtDesc(
        Long organizationId, List<ConversationChannel> channels, Pageable pageable);

    @EntityGraph(attributePaths = {"guest", "property", "reservation"})
    Page<Conversation> findByOrganizationIdAndChannelInAndStatusOrderByLastMessageAtDesc(
        Long organizationId, List<ConversationChannel> channels,
        ConversationStatus status, Pageable pageable);

    // Inbox active : exclut les conversations archivées (status != ARCHIVED).
    @EntityGraph(attributePaths = {"guest", "property", "reservation"})
    Page<Conversation> findByOrganizationIdAndStatusNotOrderByLastMessageAtDesc(
        Long organizationId, ConversationStatus status, Pageable pageable);

    @EntityGraph(attributePaths = {"guest", "property", "reservation"})
    Page<Conversation> findByOrganizationIdAndChannelInAndStatusNotOrderByLastMessageAtDesc(
        Long organizationId, List<ConversationChannel> channels,
        ConversationStatus status, Pageable pageable);
}
