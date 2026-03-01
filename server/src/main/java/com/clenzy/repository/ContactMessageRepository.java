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
            """)
    Optional<ContactMessage> findByIdForUser(@Param("id") Long id, @Param("userId") String userId);

    @Query("""
            SELECT m
            FROM ContactMessage m
            WHERE m.id IN :ids
              AND (m.senderKeycloakId = :userId OR m.recipientKeycloakId = :userId)
            """)
    List<ContactMessage> findByIdsForUser(@Param("ids") List<Long> ids, @Param("userId") String userId);

    // ── Thread queries ──────────────────────────────────────────────────────

    /**
     * Tous les messages non-archives entre l'utilisateur et un interlocuteur donne,
     * tries par date croissante (pour affichage chat).
     */
    @Query("""
            SELECT m FROM ContactMessage m
            WHERE m.organizationId = :orgId
              AND m.archived = false
              AND ((m.senderKeycloakId = :userId AND m.recipientKeycloakId = :otherUserId)
                OR (m.senderKeycloakId = :otherUserId AND m.recipientKeycloakId = :userId))
            ORDER BY m.createdAt ASC
            """)
    List<ContactMessage> findThreadMessages(
            @Param("userId") String userId,
            @Param("otherUserId") String otherUserId,
            @Param("orgId") Long orgId);

    /**
     * Messages non-lus (SENT ou DELIVERED) d'un thread ou le userId est destinataire.
     * Utilise pour marquer un thread comme lu en une seule operation.
     */
    @Query("""
            SELECT m FROM ContactMessage m
            WHERE m.organizationId = :orgId
              AND m.archived = false
              AND m.recipientKeycloakId = :userId
              AND m.senderKeycloakId = :counterpartId
              AND m.status IN (com.clenzy.model.ContactMessageStatus.SENT, com.clenzy.model.ContactMessageStatus.DELIVERED)
            """)
    List<ContactMessage> findUnreadThreadMessages(
            @Param("userId") String userId,
            @Param("counterpartId") String counterpartId,
            @Param("orgId") Long orgId);

    /**
     * Tous les messages non-archives de l'utilisateur (envoyes et recus),
     * tries par date decroissante. Utilise cote service pour le groupement par thread.
     */
    @Query("""
            SELECT m FROM ContactMessage m
            WHERE m.organizationId = :orgId
              AND m.archived = false
              AND (m.senderKeycloakId = :userId OR m.recipientKeycloakId = :userId)
            ORDER BY m.createdAt DESC
            """)
    List<ContactMessage> findAllForUser(
            @Param("userId") String userId,
            @Param("orgId") Long orgId);
}
