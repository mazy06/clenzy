package com.clenzy.service.messaging;

import com.clenzy.config.TranslationConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TranslationServiceTest {

    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOperations;
    @Mock private RestTemplate restTemplate;

    private TranslationConfig config;
    private TranslationService service;

    @BeforeEach
    void setUp() {
        config = new TranslationConfig();
        service = new TranslationService(config, redisTemplate, new ObjectMapper());
        // Swap the internal RestTemplate (default constructor builds its own) for the mock
        ReflectionTestUtils.setField(service, "restTemplate", restTemplate);
    }

    // ----- Disabled / null / blank / unsupported language -----

    @Test
    void translate_disabled_returnsOriginal() {
        config.setEnabled(false);
        assertThat(service.translate("Bonjour", "en")).isEqualTo("Bonjour");
    }

    @Test
    void translate_nullText_returnsNull() {
        config.setEnabled(true);
        assertThat(service.translate(null, "en")).isNull();
    }

    @Test
    void translate_blankText_returnsBlank() {
        config.setEnabled(true);
        assertThat(service.translate("  ", "en")).isEqualTo("  ");
    }

    @Test
    void translate_unsupportedLanguage_returnsOriginal() {
        config.setEnabled(true);
        assertThat(service.translate("Bonjour", "xx")).isEqualTo("Bonjour");
    }

    // ----- Cache -----

    @Test
    void translate_cachedValue_returnsCached() {
        config.setEnabled(true);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(anyString())).thenReturn("Hello");

        String result = service.translate("Bonjour", "en");
        assertThat(result).isEqualTo("Hello");
        verifyNoInteractions(restTemplate);
    }

    @Test
    void translate_redisUnavailable_continuesWithoutCache() {
        config.setEnabled(true);
        when(redisTemplate.opsForValue()).thenThrow(new RuntimeException("Redis down"));

        // No API key, so falls back to original text
        String result = service.translate("Bonjour", "en");
        assertThat(result).isEqualTo("Bonjour");
    }

    // ----- isSupported -----

    @Test
    void isSupported_validLanguages() {
        assertThat(service.isSupported("fr")).isTrue();
        assertThat(service.isSupported("EN")).isTrue();
        assertThat(service.isSupported("ar")).isTrue();
        assertThat(service.isSupported("zh")).isTrue();
        assertThat(service.isSupported("ja")).isTrue();
        assertThat(service.isSupported("ko")).isTrue();
        assertThat(service.isSupported("pt")).isTrue();
    }

    @Test
    void isSupported_invalidLanguages() {
        assertThat(service.isSupported("xx")).isFalse();
        assertThat(service.isSupported(null)).isFalse();
        assertThat(service.isSupported("")).isFalse();
    }

    // ----- DeepL provider -----

    @Test
    void translate_deeplNoApiKey_returnsOriginal() {
        config.setEnabled(true);
        config.setProvider("deepl");
        config.setDeeplApiKey(null);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(anyString())).thenReturn(null);

        String result = service.translate("Bonjour", "en");
        assertThat(result).isEqualTo("Bonjour");
        verifyNoInteractions(restTemplate);
    }

    @Test
    void translate_deeplBlankApiKey_returnsOriginal() {
        config.setEnabled(true);
        config.setProvider("deepl");
        config.setDeeplApiKey("  ");
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(anyString())).thenReturn(null);

        String result = service.translate("Bonjour", "en");
        assertThat(result).isEqualTo("Bonjour");
    }

    @Test
    void translate_deeplSuccess_returnsTranslationAndCaches() {
        config.setEnabled(true);
        config.setProvider("deepl");
        config.setDeeplApiKey("test-key");
        config.setCacheTtlHours(24);

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(anyString())).thenReturn(null);

        String responseBody = "{\"translations\":[{\"text\":\"Hello\",\"detected_source_language\":\"FR\"}]}";
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
            .thenReturn(new ResponseEntity<>(responseBody, HttpStatus.OK));

        String result = service.translate("Bonjour", "en");

        assertThat(result).isEqualTo("Hello");
        verify(valueOperations).set(anyString(), eq("Hello"), eq(Duration.ofHours(24)));
    }

    @Test
    void translate_deeplFailure_returnsOriginal() {
        config.setEnabled(true);
        config.setProvider("deepl");
        config.setDeeplApiKey("test-key");

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(anyString())).thenReturn(null);

        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
            .thenReturn(new ResponseEntity<>("error", HttpStatus.INTERNAL_SERVER_ERROR));

        String result = service.translate("Bonjour", "en");
        assertThat(result).isEqualTo("Bonjour");
    }

    @Test
    void translate_deeplEmptyTranslations_returnsOriginal() {
        config.setEnabled(true);
        config.setProvider("deepl");
        config.setDeeplApiKey("test-key");

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(anyString())).thenReturn(null);

        String responseBody = "{\"translations\":[]}";
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
            .thenReturn(new ResponseEntity<>(responseBody, HttpStatus.OK));

        String result = service.translate("Bonjour", "en");
        assertThat(result).isEqualTo("Bonjour");
    }

    @Test
    void translate_deeplException_returnsOriginal() {
        config.setEnabled(true);
        config.setProvider("deepl");
        config.setDeeplApiKey("test-key");

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(anyString())).thenReturn(null);

        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
            .thenThrow(new RuntimeException("Network down"));

        String result = service.translate("Bonjour", "en");
        assertThat(result).isEqualTo("Bonjour");
    }

    // ----- Google Translate provider -----

    @Test
    void translate_googleNoApiKey_returnsOriginal() {
        config.setEnabled(true);
        config.setProvider("google");
        config.setGoogleApiKey(null);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(anyString())).thenReturn(null);

        String result = service.translate("Bonjour", "en");
        assertThat(result).isEqualTo("Bonjour");
        verifyNoInteractions(restTemplate);
    }

    @Test
    void translate_googleSuccess_returnsTranslation() {
        config.setEnabled(true);
        config.setProvider("google");
        config.setGoogleApiKey("g-test-key");

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(anyString())).thenReturn(null);

        String responseBody = "{\"data\":{\"translations\":[{\"translatedText\":\"Hello\"}]}}";
        when(restTemplate.exchange(contains("googleapis"), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
            .thenReturn(new ResponseEntity<>(responseBody, HttpStatus.OK));

        String result = service.translate("Bonjour", "en");
        assertThat(result).isEqualTo("Hello");
    }

    @Test
    void translate_googleFailure_returnsOriginal() {
        config.setEnabled(true);
        config.setProvider("google");
        config.setGoogleApiKey("g-test-key");

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(anyString())).thenReturn(null);

        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
            .thenReturn(new ResponseEntity<>("", HttpStatus.BAD_REQUEST));

        assertThat(service.translate("Bonjour", "en")).isEqualTo("Bonjour");
    }

    @Test
    void translate_googleEscapesQuotes() {
        config.setEnabled(true);
        config.setProvider("google");
        config.setGoogleApiKey("g-test-key");

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(anyString())).thenReturn(null);

        String responseBody = "{\"data\":{\"translations\":[{\"translatedText\":\"He said: Hi\"}]}}";
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
            .thenReturn(new ResponseEntity<>(responseBody, HttpStatus.OK));

        // Text contains quotes / newlines / tabs / backslash to exercise escapeJson
        String result = service.translate("\"hi\"\n\t\\back", "en");
        assertThat(result).isEqualTo("He said: Hi");
    }

    // ----- Unknown provider -----

    @Test
    void translate_unknownProvider_returnsOriginal() {
        config.setEnabled(true);
        config.setProvider("unknown");

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(anyString())).thenReturn(null);

        String result = service.translate("Bonjour", "en");
        assertThat(result).isEqualTo("Bonjour");
    }

    // ----- Cache write failure -----

    @Test
    void translate_cacheWriteFails_stillReturnsTranslation() {
        config.setEnabled(true);
        config.setProvider("deepl");
        config.setDeeplApiKey("test-key");

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(anyString())).thenReturn(null);
        doThrow(new RuntimeException("Redis write down"))
            .when(valueOperations).set(anyString(), anyString(), any(Duration.class));

        String responseBody = "{\"translations\":[{\"text\":\"Hello\"}]}";
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
            .thenReturn(new ResponseEntity<>(responseBody, HttpStatus.OK));

        String result = service.translate("Bonjour", "en");
        assertThat(result).isEqualTo("Hello");
    }

    @Test
    void translate_translationEqualsOriginal_returnsOriginalWithoutCaching() {
        config.setEnabled(true);
        config.setProvider("deepl");
        config.setDeeplApiKey("test-key");

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(anyString())).thenReturn(null);

        // API returns the original text → no caching
        String responseBody = "{\"translations\":[{\"text\":\"Bonjour\"}]}";
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
            .thenReturn(new ResponseEntity<>(responseBody, HttpStatus.OK));

        String result = service.translate("Bonjour", "en");
        assertThat(result).isEqualTo("Bonjour");
        verify(valueOperations, never()).set(anyString(), anyString(), any(Duration.class));
    }
}
