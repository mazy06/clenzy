package com.clenzy.integration.external.service;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.jasypt.util.text.AES256TextEncryptor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.LoggerFactory;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyApiKeyEncryptionPrivacyTest {
    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void cryptoFailuresExposeNeitherInputNorCause(boolean encrypt) {
        String secret = "synthetic-private-api-key";
        var logger = (Logger) LoggerFactory.getLogger(ApiKeyEncryptionService.class);
        var logs = new ListAppender<ILoggingEvent>();
        logs.start();
        logger.addAppender(logs);
        var failure = new IllegalStateException(secret, new RuntimeException(secret));
        failure.addSuppressed(new RuntimeException(secret));
        try (var construction = mockConstruction(AES256TextEncryptor.class, (mock, context) -> {
            if (encrypt) when(mock.encrypt(secret)).thenThrow(failure);
            else when(mock.decrypt(secret)).thenThrow(failure);
        })) {
            var service = new ApiKeyEncryptionService("synthetic-test-password");
            assertThatThrownBy(() -> {
                if (encrypt) service.encrypt(secret);
                else service.decrypt(secret);
            }).isInstanceOf(IllegalStateException.class)
                    .hasMessage(encrypt ? "API key encryption failed" : "API key decryption failed")
                    .hasNoCause().satisfies(error -> assertThat(error.getSuppressed()).isEmpty());
            assertThat(logs.list).hasSize(1).allSatisfy(event -> {
                assertThat(event.getFormattedMessage()).doesNotContain(secret);
                assertThat(event.getThrowableProxy()).isNull();
                assertThat(event.getArgumentArray()).isNull();
            });
            assertThat(construction.constructed()).hasSize(1);
        } finally {
            logger.detachAppender(logs);
            logs.stop();
        }
    }

    @Test
    void existingJasyptCiphertextRemainsReadableBothDirections() {
        var legacy = new AES256TextEncryptor();
        legacy.setPassword("synthetic-test-password");
        var service = new ApiKeyEncryptionService("synthetic-test-password");
        assertThat(service.decrypt(legacy.encrypt("synthetic-api-key"))).isEqualTo("synthetic-api-key");
        assertThat(legacy.decrypt(service.encrypt("synthetic-api-key"))).isEqualTo("synthetic-api-key");
        assertThat(service.encrypt(null)).isNull();
        assertThat(service.decrypt(null)).isNull();
        assertThat(service.encrypt("")).isEmpty();
        assertThat(service.decrypt("")).isEmpty();
    }
}
