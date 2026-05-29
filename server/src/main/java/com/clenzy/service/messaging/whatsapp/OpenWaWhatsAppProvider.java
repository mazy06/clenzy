package com.clenzy.service.messaging.whatsapp;

import com.clenzy.model.WhatsAppConfig;
import com.clenzy.model.WhatsAppProviderType;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * Implementation {@link WhatsAppProvider} pour une instance OpenWA self-hosted
 * (NestJS + whatsapp-web.js, cf. https://github.com/rmyndharis/OpenWA).
 *
 * <h3>Architecture</h3>
 * OpenWA tourne en container Docker interne au reseau Clenzy (cf. clenzy-infra
 * docker-compose service `openwa`, port 2785 non expose externe). On l'appelle
 * via REST HTTP, l'auth se fait par header {@code X-API-Key}. Chaque org Clenzy
 * a sa propre session OpenWA (= compte WhatsApp scanne via QR) et sa propre
 * cle API per-session.
 *
 * <h3>Mapping numero -> chatId WhatsApp</h3>
 * OpenWA attend le format {@code 33612345678@c.us} (sans +, suffixe @c.us pour
 * les contacts individuels, @g.us pour les groupes). On convertit en interne.
 *
 * <h3>Limitations explicites (vs Meta)</h3>
 * <ul>
 *   <li><b>{@code sendTemplateMessage}</b> throw {@link UnsupportedOperationException}.
 *       OpenWA ne supporte pas les templates approuves Meta — c'est la nature
 *       meme du provider (pas d'approbation business cote WhatsApp). Le code
 *       appelant doit catch et fallback sur sendTextMessage.</li>
 *   <li><b>Throughput plafonne</b> : 20 msg/min, 200 msg/h cote OpenWA (anti-ban).
 *       Les bursts au-dessus sont queues par OpenWA, pas de back-pressure cote
 *       client — on accepte la latence.</li>
 * </ul>
 *
 * <h3>Circuit breaker</h3>
 * Partage le meme circuit breaker {@code "whatsapp"} que {@link MetaWhatsAppProvider}
 * (meme niveau de service du point de vue applicatif). Si OpenWA tombe, le CB
 * s'ouvre apres N erreurs et redirige vers fallback (RuntimeException remontee
 * a l'appelant qui logue dans guest_message_log avec status=FAILED).
 */
@Service
public class OpenWaWhatsAppProvider implements WhatsAppProvider {

    private static final Logger log = LoggerFactory.getLogger(OpenWaWhatsAppProvider.class);

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String baseUrl;

    public OpenWaWhatsAppProvider(
            ObjectMapper objectMapper,
            // URL de l'instance OpenWA interne. Default = service name Docker
            // (resolution DNS interne via le reseau bridge clenzy-network).
            @Value("${clenzy.whatsapp.openwa.base-url:http://openwa:2785}") String baseUrl) {
        this.restTemplate = new RestTemplate();
        this.objectMapper = objectMapper;
        this.baseUrl = baseUrl;
    }

    @Override
    public WhatsAppProviderType getProviderType() {
        return WhatsAppProviderType.OPENWA;
    }

    @Override
    @CircuitBreaker(name = "whatsapp", fallbackMethod = "sendTextFallback")
    public String sendTextMessage(WhatsAppConfig config, String phoneNumber, String text) {
        validateConfig(config);

        String url = baseUrl + "/api/sessions/" + config.getOpenwaSessionId() + "/messages/send-text";

        Map<String, String> body = Map.of(
            "chatId", toChatId(phoneNumber),
            "text", text != null ? text : ""
        );

        ResponseEntity<String> response = restTemplate.exchange(
            url, HttpMethod.POST, withAuth(body, config), String.class);

        if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
            try {
                JsonNode root = objectMapper.readTree(response.getBody());
                // OpenWA renvoie { "messageId": "..." } ou { "id": "..." } selon version
                String messageId = root.path("messageId").asText(
                    root.path("id").asText(""));
                if (!messageId.isBlank()) {
                    log.info("OpenWA WhatsApp message envoye a {}: {}", phoneNumber, messageId);
                    return messageId;
                }
            } catch (Exception e) {
                log.warn("Erreur parsing reponse OpenWA: {}", e.getMessage());
            }
        }
        throw new RuntimeException("Erreur envoi OpenWA WhatsApp: status " + response.getStatusCode());
    }

    /**
     * <b>Non supporte par OpenWA</b>. whatsapp-web.js ne peut pas envoyer de
     * templates approuves Meta — c'est une feature qui requiert l'API officielle
     * et un Business Manager verifie. Le code appelant doit catch cette exception
     * et fallback sur {@link #sendTextMessage} avec un message libre.
     */
    @Override
    public String sendTemplateMessage(WhatsAppConfig config, String phoneNumber,
                                        String templateName, String language) {
        throw new UnsupportedOperationException(
            "OpenWA ne supporte pas les templates Meta-approves. " +
            "Le code appelant doit fallback sur sendTextMessage avec le contenu en clair.");
    }

    @Override
    public void markAsRead(WhatsAppConfig config, String messageId) {
        try {
            validateConfig(config);
            String url = baseUrl + "/api/sessions/" + config.getOpenwaSessionId() + "/messages/" + messageId + "/read";
            restTemplate.exchange(url, HttpMethod.POST, withAuth(Map.of(), config), String.class);
        } catch (Exception e) {
            // Best-effort, comme pour Meta : un read receipt KO ne doit pas
            // casser le flow de l'appelant.
            log.debug("markAsRead OpenWA KO pour {}: {}", messageId, e.getMessage());
        }
    }

    // ─── Helpers ────────────────────────────────────────────────────────

    private void validateConfig(WhatsAppConfig config) {
        if (config.getOpenwaSessionId() == null || config.getOpenwaSessionId().isBlank()) {
            throw new IllegalStateException("OpenWA session non configuree pour cette organisation. " +
                "Scannez le QR code depuis Settings > Notifications > WhatsApp.");
        }
        if (config.getOpenwaApiKey() == null || config.getOpenwaApiKey().isBlank()) {
            throw new IllegalStateException("OpenWA API key manquante pour cette organisation.");
        }
    }

    /**
     * Construit une {@link HttpEntity} avec le body JSON + headers d'auth
     * OpenWA (X-API-Key per-session, Content-Type JSON).
     */
    private HttpEntity<Map<String, String>> withAuth(Map<String, String> body, WhatsAppConfig config) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-API-Key", config.getOpenwaApiKey());
        return new HttpEntity<>(body, headers);
    }

    /**
     * Convertit un numero E.164 (+33612345678) en chatId WhatsApp
     * (33612345678@c.us). OpenWA / whatsapp-web.js utilise ce format pour
     * identifier les contacts individuels.
     */
    private String toChatId(String phoneNumber) {
        if (phoneNumber == null) return "";
        String digits = phoneNumber.replaceAll("[^\\d]", "");
        return digits + "@c.us";
    }

    @SuppressWarnings("unused")
    private String sendTextFallback(WhatsAppConfig config, String phoneNumber, String text, Throwable t) {
        log.error("Circuit breaker OpenWA WhatsApp ouvert (text): {}", t.getMessage());
        throw new RuntimeException("Service OpenWA WhatsApp temporairement indisponible", t);
    }
}
