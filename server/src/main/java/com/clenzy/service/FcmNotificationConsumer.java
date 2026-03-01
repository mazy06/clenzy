package com.clenzy.service;

import com.clenzy.config.KafkaConfig;
import com.google.firebase.FirebaseApp;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Consomme les events du topic notifications.send et envoie des push via FCM.
 * Les events sont produits par le NotificationService existant via l'outbox pattern.
 */
@Service
public class FcmNotificationConsumer {

    private static final Logger log = LoggerFactory.getLogger(FcmNotificationConsumer.class);

    private final FcmService fcmService;

    public FcmNotificationConsumer(FcmService fcmService) {
        this.fcmService = fcmService;
    }

    @KafkaListener(
            topics = KafkaConfig.TOPIC_NOTIFICATIONS,
            groupId = "clenzy-fcm-push",
            containerFactory = "kafkaListenerContainerFactory"
    )
    @SuppressWarnings("unchecked")
    public void handleNotificationEvent(Map<String, Object> event) {
        if (FirebaseApp.getApps().isEmpty()) {
            log.debug("Firebase non initialise, push ignore");
            return;
        }

        try {
            String userId = (String) event.get("userId");
            String title = (String) event.get("title");
            String body = (String) event.get("message");
            String notificationType = (String) event.get("notificationType");
            String entityId = event.get("entityId") != null ? String.valueOf(event.get("entityId")) : null;
            String actionUrl = (String) event.get("actionUrl");

            if (userId == null || title == null) {
                log.warn("Event notification incomplet: userId={}, title={}", userId, title);
                return;
            }

            // Construire les data push pour le client mobile
            Map<String, String> data = new HashMap<>();
            if (notificationType != null) data.put("type", notificationType);
            if (entityId != null) data.put("entityId", entityId);
            if (actionUrl != null) data.put("url", actionUrl);

            // Gestion multi-destinataires
            Object targetUsers = event.get("targetUserIds");
            if (targetUsers instanceof List<?> userIds) {
                List<String> ids = userIds.stream()
                        .filter(id -> id instanceof String)
                        .map(id -> (String) id)
                        .toList();
                fcmService.sendToUsers(ids, title, body, data);
                log.debug("Push envoye a {} utilisateurs pour event {}", ids.size(), notificationType);
            } else {
                fcmService.sendToUser(userId, title, body, data);
                log.debug("Push envoye a {} pour event {}", userId, notificationType);
            }

        } catch (Exception e) {
            log.error("Erreur traitement event push: {}", e.getMessage(), e);
        }
    }
}
