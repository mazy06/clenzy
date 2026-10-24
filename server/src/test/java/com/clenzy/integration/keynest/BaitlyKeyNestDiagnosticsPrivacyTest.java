package com.clenzy.integration.keynest;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.clenzy.controller.KeyExchangeController;
import com.clenzy.controller.KeyNestWebhookController;
import com.clenzy.model.KeyExchangeCode;
import com.clenzy.repository.KeyExchangeCodeRepository;
import com.clenzy.repository.KeyExchangeEventRepository;
import com.clenzy.service.KeyExchangeService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;

import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Synthetic access codes and provider errors never belong in operational diagnostics. */
class BaitlyKeyNestDiagnosticsPrivacyTest {
    private static final String PRIVATE = "synthetic-secret guest@example.invalid GPS-private";
    private final ListAppender<ILoggingEvent> logs = new ListAppender<>();
    private final List<Logger> loggers = new ArrayList<>();
    private final RestTemplate http = mock(RestTemplate.class);
    private KeyNestApiService service;

    @BeforeEach
    void setUp() {
        logs.start();
        for (Class<?> type : List.of(KeyNestApiService.class, KeyNestWebhookHandler.class,
                KeyNestWebhookController.class, KeyExchangeController.class)) {
            Logger logger = (Logger) LoggerFactory.getLogger(type);
            logger.addAppender(logs);
            loggers.add(logger);
        }
        var config = mock(KeyNestConfig.class);
        when(config.isConfigured()).thenReturn(true);
        when(config.getApiUrl()).thenReturn("https://provider.example.invalid");
        when(config.getApiKey()).thenReturn(PRIVATE);
        service = new KeyNestApiService(config, http, new ObjectMapper());
    }

    @AfterEach
    void tearDown() {
        try {
            assertThat(logs.list).allSatisfy(event -> {
                assertThat(event.getFormattedMessage()).doesNotContain(PRIVATE, "synthetic-secret", "example.invalid", "48.85", "2.35");
                assertThat(event.getThrowableProxy()).isNull();
                if (event.getArgumentArray() != null) {
                    assertThat(Arrays.toString(event.getArgumentArray())).doesNotContain(PRIVATE);
                }
            });
        } finally {
            loggers.forEach(logger -> logger.detachAppender(logs));
            logs.stop();
        }
    }

    private RuntimeException failure() {
        var error = new RuntimeException(PRIVATE, new IllegalStateException(PRIVATE));
        error.addSuppressed(new RuntimeException(PRIVATE));
        return error;
    }

    @ParameterizedTest
    @ValueSource(strings = {"search", "key", "code", "cancel", "status"})
    @SuppressWarnings("unchecked")
    void providerFailureIsBoundedWithoutRetryOrSuccess(String action) {
        if (action.equals("cancel")) {
            when(http.exchange(anyString(), eq(HttpMethod.DELETE), any(HttpEntity.class), eq(Void.class))).thenThrow(failure());
        } else {
            when(http.exchange(anyString(), any(HttpMethod.class), any(HttpEntity.class),
                    any(ParameterizedTypeReference.class))).thenThrow(failure());
        }
        if (action.equals("status")) {
            assertThat(service.getKeyStatus(PRIVATE)).containsEntry("status", "ERROR")
                    .containsEntry("error", "Service KeyNest temporairement indisponible");
        } else {
            assertThatThrownBy(() -> {
                switch (action) {
                    case "search" -> service.searchStores(48.85, 2.35, 5);
                    case "key" -> service.createKeyWithCollectionCode(PRIVATE, PRIVATE);
                    case "code" -> service.createCollectionCode(PRIVATE);
                    case "cancel" -> service.cancelCode(PRIVATE);
                    default -> throw new AssertionError(action);
                }
            }).hasMessage("Service KeyNest temporairement indisponible").hasNoCause()
                    .satisfies(error -> assertThat(error.getSuppressed()).isEmpty());
        }
        assertThat(mockingDetails(http).getInvocations()).hasSize(1);
        assertThat(logs.list).isNotEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"searchStoresFallback", "createKeyFallback", "createCodeFallback"})
    void circuitBreakerFallbackDropsPrivateCause(String method) throws Exception {
        Object[] args;
        Class<?>[] types;
        if (method.equals("searchStoresFallback")) {
            args = new Object[]{48.85, 2.35, 5.0, failure()};
            types = new Class<?>[]{double.class, double.class, double.class, Throwable.class};
        } else if (method.equals("createKeyFallback")) {
            args = new Object[]{PRIVATE, PRIVATE, failure()};
            types = new Class<?>[]{String.class, String.class, Throwable.class};
        } else {
            args = new Object[]{PRIVATE, failure()};
            types = new Class<?>[]{String.class, Throwable.class};
        }
        var fallback = KeyNestApiService.class.getDeclaredMethod(method, types);
        fallback.setAccessible(true);
        if (method.equals("searchStoresFallback")) assertThat((List<?>) fallback.invoke(service, args)).isEmpty();
        else assertThatThrownBy(() -> fallback.invoke(service, args)).cause()
                .hasMessage("Service KeyNest temporairement indisponible").hasNoCause();
        verifyNoInteractions(http);
    }

    @Test
    void cancellationSuccessDoesNotLogAccessReference() {
        when(http.exchange(anyString(), eq(HttpMethod.DELETE), any(HttpEntity.class), eq(Void.class)))
                .thenReturn(ResponseEntity.noContent().build());
        service.cancelCode(PRIVATE);
    }

    @ParameterizedTest
    @ValueSource(strings = {"collected", "unknown", "missing"})
    void webhookLogsContainOnlyControlledEventType(String action) {
        var codes = mock(KeyExchangeCodeRepository.class);
        var events = mock(KeyExchangeEventRepository.class);
        var code = new KeyExchangeCode();
        code.setId(1L);
        code.setCode(PRIVATE);
        when(codes.findByProviderCodeId(PRIVATE)).thenReturn(action.equals("missing") ? Optional.empty() : Optional.of(code));
        var handler = new KeyNestWebhookHandler(mock(KeyNestConfig.class), codes, events);
        handler.handleWebhookEvent(Map.of("event", action.equals("collected") ? "collected" : PRIVATE,
                "code_id", PRIVATE, "actor_name", PRIVATE));
        if (action.equals("collected")) {
            verify(codes).save(code);
            verify(events).save(argThat(event -> event.getActorName().equals(PRIVATE)));
            assertThat(logs.list).anySatisfy(event -> assertThat(event.getFormattedMessage()).contains("KEY_COLLECTED"));
        } else {
            verify(codes, never()).save(any());
            verifyNoInteractions(events);
        }
    }

    @Test
    void invalidSignedJsonReturnsRetryableFailureWithoutParserPayload() {
        var handler = mock(KeyNestWebhookHandler.class);
        when(handler.verifySignature(anyString(), anyString())).thenReturn(true);
        var controller = new KeyNestWebhookController(handler, new ObjectMapper());
        var response = controller.handleWebhook("{\"" + PRIVATE, PRIVATE);
        assertThat(response.getStatusCode().value()).isEqualTo(500);
        assertThat(response.getBody().toString()).doesNotContain(PRIVATE);
        verify(handler, never()).handleWebhookEvent(any());
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void searchBoundaryDoesNotReflectEvenUnsanitizedImplementation(boolean configurationFailure) {
        var api = mock(KeyNestApiService.class);
        when(api.searchStores(anyDouble(), anyDouble(), anyDouble()))
                .thenThrow(configurationFailure ? new IllegalStateException(PRIVATE) : failure());
        var controller = new KeyExchangeController(mock(KeyExchangeService.class), api);
        var response = controller.searchKeyNestStores(48.85, 2.35, 5);
        assertThat(response.getStatusCode().value()).isEqualTo(configurationFailure ? 400 : 500);
        assertThat(response.getBody().toString()).doesNotContain(PRIVATE);
    }
}
