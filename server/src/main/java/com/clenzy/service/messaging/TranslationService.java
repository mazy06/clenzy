package com.clenzy.service.messaging;

import com.clenzy.config.TranslationConfig;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Set;

/**
 * Service de traduction automatique avec cache Redis.
 * Supporte DeepL (par defaut) et Google Translate.
 */
@Service
public class TranslationService {

    private static final Logger log = LoggerFactory.getLogger(TranslationService.class);

    private static final Set<String> SUPPORTED_LANGUAGES = Set.of(
        "fr", "en", "es", "de", "it", "pt", "nl", "pl", "ru", "ja", "zh", "ko",
        "ar", "bg", "cs", "da", "el", "et", "fi", "hu", "id", "lt", "lv", "nb",
        "ro", "sk", "sl", "sv", "tr", "uk"
    );

    private final TranslationConfig config;
    private final StringRedisTemplate redisTemplate;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public TranslationService(TranslationConfig config,
                              StringRedisTemplate redisTemplate,
                              ObjectMapper objectMapper) {
        this.config = config;
        this.redisTemplate = redisTemplate;
        this.restTemplate = new RestTemplate();
        this.objectMapper = objectMapper;
    }

    /**
     * Traduit un texte vers la langue cible avec cache Redis.
     * Retourne le texte original si la traduction est desactivee ou echoue.
     */
    public String translate(String text, String targetLanguage) {
        if (!config.isEnabled() || text == null || text.isBlank()) {
            return text;
        }
        if (!isSupported(targetLanguage)) {
            log.debug("Langue non supportee: {}", targetLanguage);
            return text;
        }

        // Verifier le cache
        String cacheKey = buildCacheKey(text, targetLanguage);
        try {
            String cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached != null) {
                return cached;
            }
        } catch (Exception e) {
            log.debug("Cache Redis indisponible: {}", e.getMessage());
        }

        // Traduire
        String translated = callTranslationApi(text, targetLanguage);

        // Mettre en cache
        if (translated != null && !translated.equals(text)) {
            try {
                redisTemplate.opsForValue().set(
                    cacheKey, translated,
                    Duration.ofHours(config.getCacheTtlHours())
                );
            } catch (Exception e) {
                log.debug("Impossible de mettre en cache la traduction: {}", e.getMessage());
            }
            return translated;
        }

        return text;
    }

    public boolean isSupported(String language) {
        return language != null && SUPPORTED_LANGUAGES.contains(language.toLowerCase());
    }

    private String callTranslationApi(String text, String targetLanguage) {
        try {
            if ("deepl".equalsIgnoreCase(config.getProvider())) {
                return callDeepL(text, targetLanguage);
            } else if ("google".equalsIgnoreCase(config.getProvider())) {
                return callGoogleTranslate(text, targetLanguage);
            }
            log.warn("Provider de traduction inconnu: {}", config.getProvider());
            return text;
        } catch (Exception e) {
            log.error("Erreur traduction ({}) vers {}: {}", config.getProvider(), targetLanguage, e.getMessage());
            return text;
        }
    }

    private String callDeepL(String text, String targetLanguage) {
        if (config.getDeeplApiKey() == null || config.getDeeplApiKey().isBlank()) {
            log.warn("DeepL API key non configuree");
            return text;
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.set("Authorization", "DeepL-Auth-Key " + config.getDeeplApiKey());

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("text", text);
        body.add("target_lang", targetLanguage.toUpperCase());

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);
        ResponseEntity<String> response = restTemplate.exchange(
            config.getDeeplApiUrl(), HttpMethod.POST, request, String.class
        );

        if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
            JsonNode root = parseJson(response.getBody());
            JsonNode translations = root.path("translations");
            if (translations.isArray() && !translations.isEmpty()) {
                return translations.get(0).path("text").asText(text);
            }
        }
        return text;
    }

    private String callGoogleTranslate(String text, String targetLanguage) {
        if (config.getGoogleApiKey() == null || config.getGoogleApiKey().isBlank()) {
            log.warn("Google Translate API key non configuree");
            return text;
        }

        String url = "https://translation.googleapis.com/language/translate/v2?key=" + config.getGoogleApiKey();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        String jsonBody = String.format("{\"q\":\"%s\",\"target\":\"%s\",\"format\":\"text\"}",
            escapeJson(text), targetLanguage.toLowerCase());

        HttpEntity<String> request = new HttpEntity<>(jsonBody, headers);
        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, request, String.class);

        if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
            JsonNode root = parseJson(response.getBody());
            JsonNode translations = root.path("data").path("translations");
            if (translations.isArray() && !translations.isEmpty()) {
                return translations.get(0).path("translatedText").asText(text);
            }
        }
        return text;
    }

    private String buildCacheKey(String text, String targetLanguage) {
        String hash = sha256(text);
        return "translation:" + hash + ":" + targetLanguage.toLowerCase();
    }

    private String sha256(String text) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(text.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash).substring(0, 16);
        } catch (Exception e) {
            return String.valueOf(text.hashCode());
        }
    }

    private JsonNode parseJson(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            return objectMapper.createObjectNode();
        }
    }

    private String escapeJson(String text) {
        return text.replace("\\", "\\\\")
                   .replace("\"", "\\\"")
                   .replace("\n", "\\n")
                   .replace("\r", "\\r")
                   .replace("\t", "\\t");
    }
}
