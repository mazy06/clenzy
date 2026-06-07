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

import java.util.List;
import java.util.Optional;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    // @EntityGraph : charge guest/property/reservation AVEC la conversation, pour que
    // ConversationDto.from() (appelé hors transaction — OSIV désactivé) n'initialise
    // aucun proxy LAZY → évite LazyInitializationException sur les conversations
    // rattachées (guest/property/reservation non nuls).

    @EntityGraph(attributePaths = {"guest", "property", "reservation"})
    Page<Conversation> findByOrganizationIdAndStatusOrderByLastMessageAtDesc(
        Long organizationId, ConversationStatus status, Pageable pageable);

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
