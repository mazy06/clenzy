package com.clenzy.service;

import com.clenzy.model.WaitlistSignup;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Synchronisation des contacts vers Brevo (API v3, list management).
 *
 * Best-effort et optionnel : si {@code brevo.api-key} ou {@code brevo.waitlist-list-id}
 * ne sont pas configurés (env BREVO_API_KEY / BREVO_WAITLIST_LIST_ID), la synchro est
 * simplement ignorée — l'inscription waitlist reste enregistrée en BDD.
 */
@Service
public class BrevoContactService {

    private static final Logger log = LoggerFactory.getLogger(BrevoContactService.class);

    private final RestClient restClient = RestClient.create();

    @Value("${brevo.api-key:}")
    private String apiKey;

    @Value("${brevo.base-url:https://api.brevo.com/v3}")
    private String baseUrl;

    @Value("${brevo.waitlist-list-id:0}")
    private long waitlistListId;

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank() && waitlistListId > 0;
    }

    /**
     * Ajoute (ou met à jour) un contact dans la liste Brevo de la waitlist.
     * @return true si l'appel a réussi ; false si Brevo n'est pas configuré ou en cas d'erreur.
     */
    public boolean addToWaitlist(WaitlistSignup s) {
        if (!isConfigured()) {
            log.info("Brevo non configuré (brevo.api-key / brevo.waitlist-list-id) — sync waitlist ignorée pour {}", s.getEmail());
            return false;
        }
        try {
            Map<String, Object> attributes = new HashMap<>();
            if (s.getFullName() != null && !s.getFullName().isBlank()) attributes.put("FULLNAME", s.getFullName());
            if (s.getCity() != null && !s.getCity().isBlank()) attributes.put("VILLE", s.getCity());

            Map<String, Object> body = new HashMap<>();
            body.put("email", s.getEmail());
            body.put("attributes", attributes);
            body.put("listIds", List.of(waitlistListId));
            body.put("updateEnabled", true);

            restClient.post()
                    .uri(baseUrl + "/contacts")
                    .header("api-key", apiKey)
                    .header("accept", "application/json")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            log.info("Contact waitlist synchronisé Brevo (liste {}) : {}", waitlistListId, s.getEmail());
            return true;
        } catch (Exception e) {
            log.warn("Sync Brevo waitlist KO pour {} : {}", s.getEmail(), e.getMessage());
            return false;
        }
    }
}
