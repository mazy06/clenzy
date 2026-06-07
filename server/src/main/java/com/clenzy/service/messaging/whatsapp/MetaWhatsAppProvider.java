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

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Implementation {@link WhatsAppProvider} pour Meta Cloud API officielle
 * (graph.facebook.com). La version d'API est configurable via
 * {@code clenzy.whatsapp.meta.graph-api-base} (defaut : version stable courante).
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

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String graphApiBase;

    public MetaWhatsAppProvider(
            ObjectMapper objectMapper,
            @Value("${clenzy.whatsapp.meta.graph-api-base:https://graph.facebook.com/v23.0}") String graphApiBase) {
        this.restTemplate = new RestTemplate();
        this.objectMapper = objectMapper;
        this.graphApiBase = graphApiBase;
    }

    @Override
    public WhatsAppProviderType getProviderType() {
        return WhatsAppProviderType.META;
    }

    @Override
    @CircuitBreaker(name = "whatsapp", fallbackMethod = "sendTextFallback")
    public String sendTextMessage(WhatsAppConfig config, String phoneNumber, String text) {
        String url = graphApiBase + "/" + config.getPhoneNumberId() + "/messages";

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
        String url = graphApiBase + "/" + config.getPhoneNumberId() + "/messages";

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
    @CircuitBreaker(name = "whatsapp", fallbackMethod = "sendTemplateParamsFallback")
    public String sendTemplateMessage(WhatsAppConfig config, String phoneNumber,
                                        String templateName, String language, List<String> parameters) {
        String url = graphApiBase + "/" + config.getPhoneNumberId() + "/messages";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(config.getApiToken());

        Map<String, Object> template = new LinkedHashMap<>();
        template.put("name", templateName);
        template.put("language", Map.of("code", language));
        if (parameters != null && !parameters.isEmpty()) {
            List<Map<String, String>> bodyParams = parameters.stream()
                .map(v -> Map.of("type", "text", "text", v != null ? v : ""))
                .toList();
            template.put("components", List.of(Map.of("type", "body", "parameters", bodyParams)));
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("messaging_product", "whatsapp");
        payload.put("to", sanitizePhone(phoneNumber));
        payload.put("type", "template");
        payload.put("template", template);

        String body;
        try {
            body = objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            throw new RuntimeException("Erreur serialisation payload template Meta WhatsApp", e);
        }

        HttpEntity<String> request = new HttpEntity<>(body, headers);
        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, request, String.class);

        if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
            try {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode messages = root.path("messages");
                if (messages.isArray() && !messages.isEmpty()) {
                    String messageId = messages.get(0).path("id").asText();
                    log.info("Meta WhatsApp template '{}' envoye a {}: {}", templateName, phoneNumber, messageId);
                    return messageId;
                }
            } catch (Exception e) {
                log.warn("Erreur parsing reponse Meta WhatsApp template: {}", e.getMessage());
            }
        }
        throw new RuntimeException("Erreur envoi template Meta WhatsApp: status " + response.getStatusCode());
    }

    @Override
    public void markAsRead(WhatsAppConfig config, String messageId) {
        try {
            String url = graphApiBase + "/" + config.getPhoneNumberId() + "/messages";

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

    @SuppressWarnings("unused")
    private String sendTemplateParamsFallback(WhatsAppConfig config, String phoneNumber,
                                               String templateName, String language,
                                               List<String> parameters, Throwable t) {
        log.error("Circuit breaker Meta WhatsApp ouvert (template params): {}", t.getMessage());
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
