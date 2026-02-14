package com.clenzy.repository;

import com.clenzy.model.NotificationKey;
import com.clenzy.model.NotificationPreference;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NotificationPreferenceRepository extends JpaRepository<NotificationPreference, Long> {

    /** Toutes les preferences d'un utilisateur */
    List<NotificationPreference> findByUserId(String userId);

    /** Preference specifique d'un utilisateur pour une cle donnee */
    Optional<NotificationPreference> findByUserIdAndNotificationKey(String userId, NotificationKey notificationKey);

    /** Verifie si une notification est explicitement desactivee pour un utilisateur */
    boolean existsByUserIdAndNotificationKeyAndEnabledFalse(String userId, NotificationKey notificationKey);
}
