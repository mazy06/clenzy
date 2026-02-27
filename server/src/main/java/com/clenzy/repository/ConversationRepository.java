package com.clenzy.repository;

import com.clenzy.model.Conversation;
import com.clenzy.model.ConversationChannel;
import com.clenzy.model.ConversationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    Page<Conversation> findByOrganizationIdAndStatusOrderByLastMessageAtDesc(
        Long organizationId, ConversationStatus status, Pageable pageable);

    Page<Conversation> findByOrganizationIdOrderByLastMessageAtDesc(
        Long organizationId, Pageable pageable);

    Page<Conversation> findByOrganizationIdAndAssignedToKeycloakIdOrderByLastMessageAtDesc(
        Long organizationId, String keycloakId, Pageable pageable);

    Optional<Conversation> findByOrganizationIdAndChannelAndExternalConversationId(
        Long organizationId, ConversationChannel channel, String externalConversationId);

    Optional<Conversation> findByOrganizationIdAndReservationIdAndChannel(
        Long organizationId, Long reservationId, ConversationChannel channel);

    @Query("SELECT COUNT(c) FROM Conversation c WHERE c.organizationId = :orgId AND c.unread = true")
    long countUnreadByOrganizationId(@Param("orgId") Long organizationId);

    Optional<Conversation> findByIdAndOrganizationId(Long id, Long organizationId);
}
