package com.clenzy.service;

import com.clenzy.model.DeviceToken;
import com.google.firebase.messaging.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Service d'envoi de notifications push via Firebase Cloud Messaging.
 */
@Service
public class FcmService {

    private static final Logger log = LoggerFactory.getLogger(FcmService.class);

    private final DeviceTokenService deviceTokenService;

    public FcmService(DeviceTokenService deviceTokenService) {
        this.deviceTokenService = deviceTokenService;
    }

    /**
     * Envoie une notification push a un utilisateur sur tous ses appareils.
     */
    public void sendToUser(String userId, String title, String body, Map<String, String> data) {
        List<DeviceToken> tokens = deviceTokenService.getTokensForUser(userId);
        if (tokens.isEmpty()) {
            log.debug("Aucun token push pour l'utilisateur {}", userId);
            return;
        }

        for (DeviceToken deviceToken : tokens) {
            sendToToken(deviceToken.getToken(), title, body, data, deviceToken.getPlatform());
        }
    }

    /**
     * Envoie une notification push a plusieurs utilisateurs.
     */
    public void sendToUsers(List<String> userIds, String title, String body, Map<String, String> data) {
        for (String userId : userIds) {
            sendToUser(userId, title, body, data);
        }
    }

    private void sendToToken(String token, String title, String body, Map<String, String> data, String platform) {
        try {
            Message.Builder messageBuilder = Message.builder()
                    .setToken(token)
                    .setNotification(Notification.builder()
                            .setTitle(title)
                            .setBody(body)
                            .build());

            if (data != null && !data.isEmpty()) {
                messageBuilder.putAllData(data);
            }

            // Configuration specifique par plateforme
            if ("android".equals(platform)) {
                messageBuilder.setAndroidConfig(AndroidConfig.builder()
                        .setPriority(AndroidConfig.Priority.HIGH)
                        .setNotification(AndroidNotification.builder()
                                .setChannelId(getAndroidChannel(data))
                                .build())
                        .build());
            } else if ("ios".equals(platform)) {
                messageBuilder.setApnsConfig(ApnsConfig.builder()
                        .setAps(Aps.builder()
                                .setSound("default")
                                .setBadge(1)
                                .build())
                        .build());
            }

            String response = FirebaseMessaging.getInstance().send(messageBuilder.build());
            log.debug("Push envoye: {} -> {}", token.substring(0, Math.min(20, token.length())), response);

        } catch (FirebaseMessagingException e) {
            if (e.getMessagingErrorCode() == MessagingErrorCode.UNREGISTERED
                    || e.getMessagingErrorCode() == MessagingErrorCode.INVALID_ARGUMENT) {
                // Token invalide — le supprimer
                log.info("Token push invalide, suppression: {}", token.substring(0, Math.min(20, token.length())));
                deviceTokenService.unregister(token);
            } else {
                log.error("Erreur envoi push FCM: {}", e.getMessage());
            }
        }
    }

    /**
     * Determine le channel Android en fonction du type de notification.
     */
    private String getAndroidChannel(Map<String, String> data) {
        if (data == null) return "system";
        String type = data.get("type");
        if (type == null) return "system";

        if (type.startsWith("INTERVENTION_")) return "interventions";
        if (type.startsWith("SERVICE_REQUEST_")) return "service_requests";
        if (type.equals("MESSAGE_NEW")) return "messages";
        if (type.equals("PAYMENT_RECEIVED")) return "payments";
        return "system";
    }
}
