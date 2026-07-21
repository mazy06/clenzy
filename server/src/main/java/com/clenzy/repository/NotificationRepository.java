package com.clenzy.repository;

import com.clenzy.model.Notification;
import com.clenzy.model.NotificationCategory;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {

    /**
     * Notifications d'un utilisateur, triees par date descendante, bornees par
     * le Pageable : la table croit indefiniment par utilisateur et l'endpoint
     * est polle en continu — sans borne, tout l'historique etait charge et
     * serialise a chaque appel.
     */
    List<Notification> findByUserIdOrderByCreatedAtDesc(String userId, Pageable pageable);

    /** Notifications filtrees par categorie */
    List<Notification> findByUserIdAndCategoryOrderByCreatedAtDesc(String userId, NotificationCategory category);

    /** Version paginee par categorie (mode pagine opt-in de la page Notifications). */
    List<Notification> findByUserIdAndCategoryOrderByCreatedAtDesc(String userId, NotificationCategory category, Pageable pageable);

    /** Notifications non lues d'un utilisateur */
    List<Notification> findByUserIdAndReadFalseOrderByCreatedAtDesc(String userId);

    /** Version paginee des non lues (mode pagine opt-in de la page Notifications). */
    List<Notification> findByUserIdAndReadFalseOrderByCreatedAtDesc(String userId, Pageable pageable);

    /** Nombre de notifications non lues */
    long countByUserIdAndReadFalse(String userId);

    /** Nombre total de notifications d'un utilisateur (totalElements du mode pagine). */
    long countByUserId(String userId);

    /** Nombre de notifications d'un utilisateur dans une categorie (totalElements du mode pagine). */
    long countByUserIdAndCategory(String userId, NotificationCategory category);

    /** Trouver une notification par ID et userId (securite) */
    Optional<Notification> findByIdAndUserId(Long id, String userId);

    /** Marquer toutes les notifications comme lues pour un utilisateur */
    @Modifying
    @Query("UPDATE Notification n SET n.read = true, n.updatedAt = CURRENT_TIMESTAMP WHERE n.userId = :userId AND n.read = false AND n.organizationId = :orgId")
    int markAllAsReadByUserId(@Param("userId") String userId, @Param("orgId") Long orgId);

    /** Supprimer une notification par ID et userId (securite) */
    void deleteByIdAndUserId(Long id, String userId);

    /** Purge de retention : supprime les notifications anterieures au seuil. */
    @Modifying
    @Query("DELETE FROM Notification n WHERE n.createdAt < :before")
    int deleteByCreatedAtBefore(@Param("before") Instant before);
}
