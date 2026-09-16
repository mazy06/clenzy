package com.clenzy.marketplace.service;

import com.clenzy.service.EmailService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Transport du courriel d’activation Baitly, appelé par la file des invitations.
 * Les candidatures, confirmations et décisions passent exclusivement par
 * MarketplaceNotificationOutbox et MarketplaceNotificationDelivery.
 * Une panne de transport remonte au worker, qui conserve la livraison à reprendre.
 */
@Service
public class MarketplaceNotificationService {
    private final EmailService emailService;

    @Value("${clenzy.marketplace.landing-url:http://localhost:3005}")
    private String landingUrl;

    public MarketplaceNotificationService(EmailService emailService) {
        this.emailService = emailService;
    }

    public void sendAccountActivation(String displayName, String email, String activationToken) {
        if (email == null || email.isBlank()) {
            throw new IllegalStateException("Aucune adresse pour inviter le prestataire");
        }
        if (activationToken == null || activationToken.isBlank()) {
            throw new IllegalStateException("Aucun jeton pour inviter le prestataire");
        }
        String link = landingUrl.replaceAll("/+$", "")
            + "/prestataires/activation?token="
            + URLEncoder.encode(activationToken, StandardCharsets.UTF_8);
        emailService.sendSystemTemplateEmail(email, "marketplace_account_activation",
            Map.of("displayName", displayName == null ? "" : displayName, "activationLink", link), null);
    }
}
