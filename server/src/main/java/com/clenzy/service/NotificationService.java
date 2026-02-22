package com.clenzy.service;

import com.clenzy.dto.NotificationDto;
import com.clenzy.model.*;
import com.clenzy.repository.NotificationRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.Objects;

@Service
@Transactional
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository notificationRepository;
    private final NotificationPreferenceService preferenceService;
    private final UserRepository userRepository;
    private final TenantContext tenantContext;

    public NotificationService(NotificationRepository notificationRepository,
                               NotificationPreferenceService preferenceService,
                               UserRepository userRepository,
                               TenantContext tenantContext) {
        this.notificationRepository = notificationRepository;
        this.preferenceService = preferenceService;
        this.userRepository = userRepository;
        this.tenantContext = tenantContext;
    }

    // ─── Lecture ─────────────────────────────────────────────────────────────────

    /**
     * Retourne toutes les notifications d'un utilisateur, triees par date descendante.
     */
    @Transactional(readOnly = true)
    public List<NotificationDto> getAllForUser(String userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(NotificationDto::fromEntity)
                .toList();
    }

    /**
     * Retourne le nombre de notifications non lues.
     */
    @Transactional(readOnly = true)
    public long getUnreadCount(String userId) {
        return notificationRepository.countByUserIdAndReadFalse(userId);
    }

    // ─── Actions ────────────────────────────────────────────────────────────────

    /**
     * Marque une notification comme lue.
     * Verifie que la notification appartient bien a l'utilisateur.
     */
    public NotificationDto markAsRead(Long notificationId, String userId) {
        Notification notification = notificationRepository.findByIdAndUserId(notificationId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Notification introuvable ou acces refuse."));

        notification.setRead(true);
        notification = notificationRepository.save(notification);
        return NotificationDto.fromEntity(notification);
    }

    /**
     * Marque toutes les notifications comme lues pour un utilisateur.
     */
    public void markAllAsRead(String userId) {
        int updated = notificationRepository.markAllAsReadByUserId(userId, tenantContext.getRequiredOrganizationId());
        log.debug("{} notifications marquees comme lues pour l'utilisateur {}", updated, userId);
    }

    /**
     * Supprime une notification.
     * Verifie que la notification appartient bien a l'utilisateur.
     */
    public void delete(Long notificationId, String userId) {
        Notification notification = notificationRepository.findByIdAndUserId(notificationId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Notification introuvable ou acces refuse."));
        notificationRepository.delete(notification);
    }

    // ─── Creation legacy (sans NotificationKey) ─────────────────────────────────

    /**
     * Cree et persiste une nouvelle notification pour un utilisateur.
     * Methode legacy conservee pour backward compatibility.
     */
    public NotificationDto create(String userId, String title, String message,
                                   NotificationType type, NotificationCategory category,
                                   String actionUrl) {
        Notification notification = new Notification(userId, title, message, type, category);
        notification.setActionUrl(actionUrl);
        notification.setOrganizationId(tenantContext.getOrganizationId());
        notification = notificationRepository.save(notification);
        log.info("Notification creee: {} pour l'utilisateur {}", notification.getId(), userId);
        return NotificationDto.fromEntity(notification);
    }

    /**
     * Shortcut pour creer une notification de type INFO.
     */
    public NotificationDto createInfo(String userId, String title, String message,
                                       NotificationCategory category, String actionUrl) {
        return create(userId, title, message, NotificationType.INFO, category, actionUrl);
    }

    /**
     * Shortcut pour creer une notification de type SUCCESS.
     */
    public NotificationDto createSuccess(String userId, String title, String message,
                                          NotificationCategory category, String actionUrl) {
        return create(userId, title, message, NotificationType.SUCCESS, category, actionUrl);
    }

    /**
     * Shortcut pour creer une notification de type WARNING.
     */
    public NotificationDto createWarning(String userId, String title, String message,
                                          NotificationCategory category, String actionUrl) {
        return create(userId, title, message, NotificationType.WARNING, category, actionUrl);
    }

    /**
     * Shortcut pour creer une notification de type ERROR.
     */
    public NotificationDto createError(String userId, String title, String message,
                                        NotificationCategory category, String actionUrl) {
        return create(userId, title, message, NotificationType.ERROR, category, actionUrl);
    }

    // ─── Creation avec NotificationKey (nouveau systeme) ────────────────────────

    /**
     * Cree une notification avec verification des preferences utilisateur.
     * Si l'utilisateur a desactive cette notification, elle n'est pas creee.
     *
     * @return le DTO cree, ou null si la notification est desactivee
     */
    public NotificationDto send(String userId, NotificationKey key, String title, String message, String actionUrl) {
        if (userId == null || key == null) {
            log.warn("Tentative de notification avec userId ou key null");
            return null;
        }

        try {
            // Verifier les preferences utilisateur
            if (!preferenceService.isEnabled(userId, key)) {
                log.debug("Notification {} desactivee pour l'utilisateur {}", key, userId);
                return null;
            }

            Notification notification = new Notification(userId, title, message, key.getDefaultType(), key.getCategory());
            notification.setNotificationKey(key);
            notification.setActionUrl(actionUrl);
            notification.setOrganizationId(tenantContext.getOrganizationId());
            notification = notificationRepository.save(notification);
            log.info("Notification {} creee (ID: {}) pour l'utilisateur {}", key, notification.getId(), userId);
            return NotificationDto.fromEntity(notification);
        } catch (Exception e) {
            // Ne jamais laisser une erreur de notification impacter la logique metier
            log.error("Erreur lors de la creation de notification {} pour {}: {}", key, userId, e.getMessage());
            return null;
        }
    }

    // ─── Helpers pour notifier des groupes ──────────────────────────────────────

    /**
     * Notifie tous les ADMIN et MANAGER du systeme.
     */
    public void notifyAdminsAndManagers(NotificationKey key, String title, String message, String actionUrl) {
        try {
            List<User> adminsManagers = userRepository.findByRoleIn(
                    Arrays.asList(UserRole.SUPER_ADMIN, UserRole.SUPER_MANAGER),
                    tenantContext.getRequiredOrganizationId()
            );
            for (User user : adminsManagers) {
                if (user.getKeycloakId() != null) {
                    send(user.getKeycloakId(), key, title, message, actionUrl);
                }
            }
        } catch (Exception e) {
            log.error("Erreur lors de la notification des admins/managers pour {}: {}", key, e.getMessage());
        }
    }

    /**
     * Notifie une liste d'utilisateurs par leurs keycloakId.
     */
    public void notifyUsers(List<String> keycloakIds, NotificationKey key, String title, String message, String actionUrl) {
        if (keycloakIds == null || keycloakIds.isEmpty()) {
            return;
        }
        try {
            keycloakIds.stream()
                    .filter(Objects::nonNull)
                    .distinct()
                    .forEach(keycloakId -> send(keycloakId, key, title, message, actionUrl));
        } catch (Exception e) {
            log.error("Erreur lors de la notification de {} utilisateurs pour {}: {}", keycloakIds.size(), key, e.getMessage());
        }
    }

    /**
     * Notifie un utilisateur unique (wrapper try-catch pour usage dans les services).
     */
    public void notify(String keycloakId, NotificationKey key, String title, String message, String actionUrl) {
        if (keycloakId == null) {
            return;
        }
        send(keycloakId, key, title, message, actionUrl);
    }
}
