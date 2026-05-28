package com.clenzy.service.messaging.whatsapp;

import com.clenzy.model.WhatsAppConfig;
import com.clenzy.model.WhatsAppProviderType;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

/**
 * Implementation {@link WhatsAppProvider} pour Meta Cloud API officielle
 * (graph.facebook.com v18.0). Default historique de Clenzy depuis l'origine.
 *
 * <p><b>Origine</b> : code extrait de l'ancien {@code WhatsAppApiService}
 * (supprime au commit refactor provider strategy), garde a l'identique le
 * comportement (memes endpoints, meme circuit breaker, memes payloads).</p>
 *
 * <p><b>Compliance</b> : utilise l'API officielle Meta avec Bearer token
 * permanent. Conforme aux ToS WhatsApp Business, eligible aux templates
 * approuves, boutons interactifs, et autres features avancees Meta.</p>
 */
@Service
public class MetaWhatsAppProvider implements WhatsAppProvider {

    private static final Logger log = LoggerFactory.getLogger(MetaWhatsAppProvider.class);
    private static final String GRAPH_API_BASE = "https://graph.facebook.com/v18.0";

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public MetaWhatsAppProvider(ObjectMapper objectMapper) {
        this.restTemplate = new RestTemplate();
        this.objectMapper = objectMapper;
    }

    @Override
    public WhatsAppProviderType getProviderType() {
        return WhatsAppProviderType.META;
    }

    @Override
    @CircuitBreaker(name = "whatsapp", fallbackMethod = "sendTextFallback")
    public String sendTextMessage(WhatsAppConfig config, String phoneNumber, String text) {
        String url = GRAPH_API_BASE + "/" + config.getPhoneNumberId() + "/messages";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(config.getApiToken());

        String body = String.format(
            "{\"messaging_product\":\"whatsapp\",\"to\":\"%s\",\"type\":\"text\",\"text\":{\"body\":\"%s\"}}",
            sanitizePhone(phoneNumber), escapeJson(text)
        );

        HttpEntity<String> request = new HttpEntity<>(body, headers);
        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, request, String.class);

        if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
            try {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode messages = root.path("messages");
                if (messages.isArray() && !messages.isEmpty()) {
                    String messageId = messages.get(0).path("id").asText();
                    log.info("Meta WhatsApp message envoye a {}: {}", phoneNumber, messageId);
                    return messageId;
                }
            } catch (Exception e) {
                log.warn("Erreur parsing reponse Meta WhatsApp: {}", e.getMessage());
            }
        }
        throw new RuntimeException("Erreur envoi Meta WhatsApp: status " + response.getStatusCode());
    }

    @Override
    @CircuitBreaker(name = "whatsapp", fallbackMethod = "sendTemplateFallback")
    public String sendTemplateMessage(WhatsAppConfig config, String phoneNumber,
                                        String templateName, String language) {
        String url = GRAPH_API_BASE + "/" + config.getPhoneNumberId() + "/messages";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(config.getApiToken());

        String body = String.format(
            "{\"messaging_product\":\"whatsapp\",\"to\":\"%s\",\"type\":\"template\"," +
            "\"template\":{\"name\":\"%s\",\"language\":{\"code\":\"%s\"}}}",
            sanitizePhone(phoneNumber), templateName, language
        );

        HttpEntity<String> request = new HttpEntity<>(body, headers);
        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, request, String.class);

        if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
            try {
                JsonNode root = objectMapper.readTree(response.getBody());
                return root.path("messages").get(0).path("id").asText();
            } catch (Exception e) {
                log.warn("Erreur parsing reponse Meta WhatsApp template: {}", e.getMessage());
            }
        }
        throw new RuntimeException("Erreur envoi template Meta WhatsApp: status " + response.getStatusCode());
    }

    @Override
    public void markAsRead(WhatsAppConfig config, String messageId) {
        try {
            String url = GRAPH_API_BASE + "/" + config.getPhoneNumberId() + "/messages";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(config.getApiToken());

            String body = String.format(
                "{\"messaging_product\":\"whatsapp\",\"status\":\"read\",\"message_id\":\"%s\"}", messageId);

            HttpEntity<String> request = new HttpEntity<>(body, headers);
            restTemplate.exchange(url, HttpMethod.POST, request, String.class);
        } catch (Exception e) {
            // Best-effort : un read receipt KO n'est pas critique
            log.debug("markAsRead Meta WhatsApp KO pour {}: {}", messageId, e.getMessage());
        }
    }

    @SuppressWarnings("unused")
    private String sendTextFallback(WhatsAppConfig config, String phoneNumber, String text, Throwable t) {
        log.error("Circuit breaker Meta WhatsApp ouvert (text): {}", t.getMessage());
        throw new RuntimeException("Service Meta WhatsApp temporairement indisponible", t);
    }

    @SuppressWarnings("unused")
    private String sendTemplateFallback(WhatsAppConfig config, String phoneNumber,
                                         String templateName, String language, Throwable t) {
        log.error("Circuit breaker Meta WhatsApp ouvert (template): {}", t.getMessage());
        throw new RuntimeException("Service Meta WhatsApp temporairement indisponible", t);
    }

    private String sanitizePhone(String phone) {
        if (phone == null) return "";
        return phone.replaceAll("[^+\\d]", "");
    }

    private String escapeJson(String text) {
        if (text == null) return "";
        return text.replace("\\", "\\\\").replace("\"", "\\\"")
                   .replace("\n", "\\n").replace("\r", "\\r");
    }
}
