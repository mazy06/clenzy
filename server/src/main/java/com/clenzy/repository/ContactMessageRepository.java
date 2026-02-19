package com.clenzy.repository;

import com.clenzy.model.ContactMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ContactMessageRepository extends JpaRepository<ContactMessage, Long> {

    Page<ContactMessage> findByRecipientKeycloakIdAndArchivedFalseOrderByCreatedAtDesc(
            String recipientKeycloakId,
            Pageable pageable
    );

    Page<ContactMessage> findBySenderKeycloakIdAndArchivedFalseOrderByCreatedAtDesc(
            String senderKeycloakId,
            Pageable pageable
    );

    @Query("""
            SELECT m
            FROM ContactMessage m
            WHERE m.archived = true
              AND (m.senderKeycloakId = :userId OR m.recipientKeycloakId = :userId)
              AND m.organizationId = :orgId
            ORDER BY m.createdAt DESC
            """)
    Page<ContactMessage> findArchivedForUser(@Param("userId") String userId, Pageable pageable, @Param("orgId") Long orgId);

    @Query("""
            SELECT m
            FROM ContactMessage m
            WHERE m.id = :id
              AND (m.senderKeycloakId = :userId OR m.recipientKeycloakId = :userId)
              AND m.organizationId = :orgId
            """)
    Optional<ContactMessage> findByIdForUser(@Param("id") Long id, @Param("userId") String userId, @Param("orgId") Long orgId);

    @Query("""
            SELECT m
            FROM ContactMessage m
            WHERE m.id IN :ids
              AND (m.senderKeycloakId = :userId OR m.recipientKeycloakId = :userId)
              AND m.organizationId = :orgId
            """)
    List<ContactMessage> findByIdsForUser(@Param("ids") List<Long> ids, @Param("userId") String userId, @Param("orgId") Long orgId);
}
