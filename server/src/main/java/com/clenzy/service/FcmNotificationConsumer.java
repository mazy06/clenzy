package com.clenzy.service;

import com.clenzy.config.KafkaConfig;
import com.clenzy.model.Notification;
import com.clenzy.repository.NotificationRepository;
import com.google.firebase.FirebaseApp;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * Consomme les events du topic notifications.send et envoie des push via FCM.
 * Les events sont produits par le NotificationService existant via l'outbox pattern.
 *
 * <h2>Contrat de confiance (audit 2026-07, P5-08)</h2>
 * <p>Le consumer prenait auparavant le destinataire, le titre et le corps <b>directement dans
 * le payload</b>, et acceptait en plus une liste {@code targetUserIds} arbitraire. Un événement
 * forgé permettait donc un <b>push broadcast avec titre et corps libres</b> — du phishing
 * in-app portant l'identité visuelle de l'application, vers les destinataires choisis par
 * l'émetteur.</p>
 *
 * <p>Deux corrections :</p>
 * <ul>
 *   <li>l'événement ne désigne plus qu'un {@code notificationId} ; le destinataire et le
 *       contenu sont <b>rechargés depuis la notification en base</b>, qui seule fait foi. Le
 *       payload recopiait de toute façon des données déjà persistées ;</li>
 *   <li>{@code targetUserIds} est <b>supprimé</b> : le grep exhaustif du projet ne trouvait
 *       aucun producteur de ce champ — du code mort dont la seule voie d'accès était un
 *       événement forgé (règle CLAUDE.md n°14 : preuve avant suppression ; YAGNI sur les
 *       abstractions « au cas où »). Une notification cible un utilisateur ; un envoi groupé
 *       se traduit par autant de notifications, donc autant d'événements.</li>
 * </ul>
 */
@Service
public class FcmNotificationConsumer {

    private static final Logger log = LoggerFactory.getLogger(FcmNotificationConsumer.class);

    private final FcmService fcmService;
    private final NotificationRepository notificationRepository;

    public FcmNotificationConsumer(FcmService fcmService,
                                   NotificationRepository notificationRepository) {
        this.fcmService = fcmService;
        this.notificationRepository = notificationRepository;
    }

    @KafkaListener(
            topics = KafkaConfig.TOPIC_NOTIFICATIONS,
            groupId = "clenzy-fcm-push",
            containerFactory = "kafkaListenerContainerFactory"
    )
    public void handleNotificationEvent(Map<String, Object> event) {
        if (FirebaseApp.getApps().isEmpty()) {
            log.debug("Firebase non initialise, push ignore");
            return;
        }

        try {
            Long notificationId = toLong(event.get("notificationId"));
            if (notificationId == null) {
                log.warn("Event notification sans notificationId — push ignore");
                return;
            }

            // Source de verite : la notification persistee. Le payload ne sert plus qu'a
            // designer laquelle, jamais a en dicter le destinataire ni le contenu.
            Notification notification = notificationRepository.findById(notificationId).orElse(null);
            if (notification == null) {
                log.warn("Notification {} introuvable — push ignore", notificationId);
                return;
            }
            if (notification.getUserId() == null || notification.getTitle() == null) {
                log.warn("Notification {} sans destinataire ou sans titre — push ignore", notificationId);
                return;
            }

            // Metadonnees de routage cote client, issues de la notification.
            Map<String, String> data = new HashMap<>();
            if (notification.getType() != null) {
                data.put("type", notification.getType().name());
            }
            if (notification.getActionUrl() != null) {
                data.put("url", notification.getActionUrl());
            }
            String entityId = extractEntityIdFrom(event);
            if (entityId != null) {
                data.put("entityId", entityId);
            }

            fcmService.sendToUser(notification.getUserId(), notification.getTitle(),
                    notification.getMessage(), data);
            log.debug("Push envoye pour la notification {} (user {})",
                    notificationId, notification.getUserId());

        } catch (Exception e) {
            log.error("Erreur traitement event push: {}", e.getMessage(), e);
        }
    }

    /**
     * {@code entityId} reste lu dans l'evenement : c'est un deep-link derive de l'actionUrl
     * par le producteur, sans equivalent direct sur l'entite. Il n'influence ni le
     * destinataire ni le contenu affiche.
     */
    private String extractEntityIdFrom(Map<String, Object> event) {
        Object raw = event.get("entityId");
        return raw != null ? String.valueOf(raw) : null;
    }

    private Long toLong(Object value) {
        if (value == null) return null;
        if (value instanceof Number n) return n.longValue();
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
