package com.clenzy.service.messaging;

import com.clenzy.model.WhatsAppConfig;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class WhatsAppApiService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppApiService.class);
    private static final String GRAPH_API_BASE = "https://graph.facebook.com/v18.0";

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public WhatsAppApiService(ObjectMapper objectMapper) {
        this.restTemplate = new RestTemplate();
        this.objectMapper = objectMapper;
    }

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
                    log.info("WhatsApp message envoye a {}: {}", phoneNumber, messageId);
                    return messageId;
                }
            } catch (Exception e) {
                log.warn("Erreur parsing reponse WhatsApp: {}", e.getMessage());
            }
        }
        throw new RuntimeException("Erreur envoi WhatsApp: status " + response.getStatusCode());
    }

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
                log.warn("Erreur parsing reponse WhatsApp template: {}", e.getMessage());
            }
        }
        throw new RuntimeException("Erreur envoi template WhatsApp: status " + response.getStatusCode());
    }

    public void markAsRead(WhatsAppConfig config, String messageId) {
        String url = GRAPH_API_BASE + "/" + config.getPhoneNumberId() + "/messages";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(config.getApiToken());

        String body = String.format(
            "{\"messaging_product\":\"whatsapp\",\"status\":\"read\",\"message_id\":\"%s\"}", messageId);

        HttpEntity<String> request = new HttpEntity<>(body, headers);
        restTemplate.exchange(url, HttpMethod.POST, request, String.class);
    }

    @SuppressWarnings("unused")
    private String sendTextFallback(WhatsAppConfig config, String phoneNumber, String text, Throwable t) {
        log.error("Circuit breaker WhatsApp ouvert: {}", t.getMessage());
        throw new RuntimeException("Service WhatsApp temporairement indisponible", t);
    }

    @SuppressWarnings("unused")
    private String sendTemplateFallback(WhatsAppConfig config, String phoneNumber,
                                         String templateName, String language, Throwable t) {
        log.error("Circuit breaker WhatsApp template ouvert: {}", t.getMessage());
        throw new RuntimeException("Service WhatsApp temporairement indisponible", t);
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
