package com.clenzy.repository;

import com.clenzy.model.Notification;
import com.clenzy.model.NotificationCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {

    /** Toutes les notifications d'un utilisateur, triees par date descendante */
    List<Notification> findByUserIdOrderByCreatedAtDesc(String userId);

    /** Notifications filtrees par categorie */
    List<Notification> findByUserIdAndCategoryOrderByCreatedAtDesc(String userId, NotificationCategory category);

    /** Notifications non lues d'un utilisateur */
    List<Notification> findByUserIdAndReadFalseOrderByCreatedAtDesc(String userId);

    /** Nombre de notifications non lues */
    long countByUserIdAndReadFalse(String userId);

    /** Trouver une notification par ID et userId (securite) */
    Optional<Notification> findByIdAndUserId(Long id, String userId);

    /** Marquer toutes les notifications comme lues pour un utilisateur */
    @Modifying
    @Query("UPDATE Notification n SET n.read = true, n.updatedAt = CURRENT_TIMESTAMP WHERE n.userId = :userId AND n.read = false AND n.organizationId = :orgId")
    int markAllAsReadByUserId(@Param("userId") String userId, @Param("orgId") Long orgId);

    /** Supprimer une notification par ID et userId (securite) */
    void deleteByIdAndUserId(Long id, String userId);
}
