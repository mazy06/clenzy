package com.clenzy.service.messaging;

import com.clenzy.config.TranslationConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TranslationServiceTest {

    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOperations;

    private TranslationConfig config;
    private TranslationService service;

    @BeforeEach
    void setUp() {
        config = new TranslationConfig();
        service = new TranslationService(config, redisTemplate, new ObjectMapper());
    }

    @Test
    void translate_disabled_returnsOriginal() {
        config.setEnabled(false);
        String result = service.translate("Bonjour", "en");
        assertThat(result).isEqualTo("Bonjour");
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
        String result = service.translate("Bonjour", "xx");
        assertThat(result).isEqualTo("Bonjour");
    }

    @Test
    void translate_cachedValue_returnsCached() {
        config.setEnabled(true);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(anyString())).thenReturn("Hello");

        String result = service.translate("Bonjour", "en");
        assertThat(result).isEqualTo("Hello");
        verify(valueOperations).get(anyString());
    }

    @Test
    void translate_redisUnavailable_continuesWithoutCache() {
        config.setEnabled(true);
        when(redisTemplate.opsForValue()).thenThrow(new RuntimeException("Redis down"));

        // Should not throw, just return original (no API configured)
        String result = service.translate("Bonjour", "en");
        assertThat(result).isEqualTo("Bonjour");
    }

    @Test
    void isSupported_validLanguages() {
        assertThat(service.isSupported("fr")).isTrue();
        assertThat(service.isSupported("en")).isTrue();
        assertThat(service.isSupported("es")).isTrue();
        assertThat(service.isSupported("de")).isTrue();
        assertThat(service.isSupported("it")).isTrue();
    }

    @Test
    void isSupported_invalidLanguages() {
        assertThat(service.isSupported("xx")).isFalse();
        assertThat(service.isSupported(null)).isFalse();
        assertThat(service.isSupported("")).isFalse();
    }

    @Test
    void translate_noApiKey_returnsOriginal() {
        config.setEnabled(true);
        config.setProvider("deepl");
        config.setDeeplApiKey(null);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(anyString())).thenReturn(null);

        String result = service.translate("Bonjour", "en");
        assertThat(result).isEqualTo("Bonjour");
    }
}
