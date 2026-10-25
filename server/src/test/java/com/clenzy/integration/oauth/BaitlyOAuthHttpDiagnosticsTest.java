package com.clenzy.integration.oauth;

import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;
import java.lang.reflect.*;
import java.util.*;
import java.util.stream.Stream;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Aucun compte réel : erreurs privées et objets de connexion synthétiques uniquement. */
class BaitlyOAuthHttpDiagnosticsTest {
    static final String PRIVATE = "synthetic-private@example.invalid?access_token=synthetic-secret";
    static final String[] PROVIDERS = {"pennylane", "docusign", "quickbooks", "sage", "xero", "airbnb", "minut", "netatmo"};
    record Case(String provider, String mode) {}
    static Stream<Case> scenarios() {
        return Arrays.stream(PROVIDERS).flatMap(provider -> Stream.of("invalidState", "stateFailure", "exchangeFailure",
                "disconnectFailure", "status", "disconnectSuccess").map(mode -> new Case(provider, mode)));
    }
    String prefix(String provider) {
        return switch (provider) {case "docusign" -> "DocuSign"; case "quickbooks" -> "QuickBooks";
            default -> Character.toUpperCase(provider.charAt(0)) + provider.substring(1);};
    }
    boolean nativeProvider(String provider) {return Set.of("airbnb", "minut", "netatmo").contains(provider);}
    Object connection(String provider) throws Exception {
        Class<?> type = Class.forName("com.clenzy.integration." + provider + ".model." + prefix(provider) + "Connection");
        Object value = type.getConstructor().newInstance();
        Method setter = Arrays.stream(type.getMethods()).filter(m -> m.getName().equals("setStatus")).findFirst().orElseThrow();
        Object error = Arrays.stream(setter.getParameterTypes()[0].getEnumConstants()).filter(v -> v.toString().equals("ERROR")).findFirst().orElseThrow();
        setter.invoke(value, error);
        type.getMethod("setErrorMessage", String.class).invoke(value, PRIVATE);
        return value;
    }
    RuntimeException failure() {
        var value = new IllegalStateException(PRIVATE, new IllegalArgumentException(PRIVATE));
        value.addSuppressed(new RuntimeException(PRIVATE)); return value;
    }
    Jwt jwt() {return Jwt.withTokenValue("synthetic").header("alg", "RS256").subject("synthetic-user").build();}
    record Fixture(Object controller, Object service) {}
    Fixture fixture(Case test) throws Exception {
        String name = prefix(test.provider());
        Class<?> controllerType = Class.forName("com.clenzy.integration." + test.provider() + ".controller."
                + name + (Set.of("minut", "netatmo").contains(test.provider()) ? "Controller" : "OAuthController"));
        Class<?> serviceType = Class.forName("com.clenzy.integration." + test.provider() + ".service." + name + "OAuthService");
        Object service = mock(serviceType, invocation -> {
            String method = invocation.getMethod().getName();
            if (method.equals("getAuthorizationUrl")) throw failure();
            if (method.equals("validateAndConsumeState") || method.equals("consumeState")) {
                if (test.mode().equals("stateFailure")) throw failure();
                if (test.mode().equals("invalidState")) {
                    if (nativeProvider(test.provider())) throw failure();
                    return Optional.empty();
                }
                if (test.provider().equals("netatmo")) return new com.clenzy.integration.netatmo.service.NetatmoOAuthService.OAuthState("synthetic-user", 7L);
                if (nativeProvider(test.provider())) return "synthetic-user";
                if (test.provider().equals("quickbooks")) return Optional.of(new OAuthStateService.StatePayload(3L, 7L));
                return Optional.of(Map.of("userId", 3L, "orgId", 7L));
            }
            if (method.equals("exchangeCodeForToken")) throw failure();
            if (method.equals("revokeToken") && test.mode().equals("disconnectFailure")) throw failure();
            if (method.equals("getConnection") || method.equals("getConnectionStatus")) return Optional.of(connection(test.provider()));
            return org.mockito.Answers.RETURNS_DEFAULTS.answer(invocation);
        });
        Constructor<?> constructor = controllerType.getConstructors()[0];
        Object[] dependencies = Arrays.stream(constructor.getParameterTypes()).map(type -> {
            if (type.equals(serviceType)) return service;
            if (type.equals(TenantContext.class)) {
                var tenant = mock(TenantContext.class); when(tenant.getRequiredOrganizationId()).thenReturn(7L); return tenant;
            }
            return mock(type);
        }).toArray();
        return new Fixture(constructor.newInstance(dependencies), service);
    }
    ResponseEntity<?> invoke(Fixture fixture, String action) throws Exception {
        Method method = Arrays.stream(fixture.controller().getClass().getMethods()).filter(m -> m.getName().equals(action)).findFirst().orElseThrow();
        Object[] args = action.equals("callback") ? (method.getParameterCount() == 3 ? new Object[]{PRIVATE, PRIVATE, null} : new Object[]{PRIVATE, PRIVATE})
                : method.getParameterCount() == 0 ? new Object[0] : new Object[]{jwt()};
        return (ResponseEntity<?>) method.invoke(fixture.controller(), args);
    }
    @ParameterizedTest @MethodSource("scenarios")
    void httpAndApplicationLogsNeverReemitPrivateProviderData(Case test) throws Exception {
        var fixture = fixture(test);
        var logger = (ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory.getLogger(fixture.controller().getClass());
        var logs = new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>(); logs.start(); logger.addAppender(logs);
        try {
            String action = test.mode().startsWith("disconnect") ? "disconnect" : test.mode().equals("status") ? "status" : "callback";
            ResponseEntity<?> response = invoke(fixture, action);
            String wire = new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules().writeValueAsString(response.getBody()) + response.getHeaders();
            assertThat(wire).doesNotContain(PRIVATE, "synthetic-secret", "access_token");
            assertThat(logs.list).allSatisfy(event -> {
                assertThat(event.getFormattedMessage()).doesNotContain(PRIVATE, "synthetic-secret", "access_token");
                assertThat(event.getThrowableProxy()).isNull();
            });
            if (test.mode().equals("status")) assertThat(wire).contains(BaitlyOAuthHttpDiagnostics.CONNECTION_ERROR);
            else if (test.mode().equals("disconnectSuccess")) {
                assertThat(response.getStatusCode().value()).isEqualTo(200);
                if (!nativeProvider(test.provider())) assertThat(wire).contains(BaitlyOAuthHttpDiagnostics.LOCAL_DISCONNECT);
            } else assertThat(response.getStatusCode().is2xxSuccessful()).isFalse();
            if (test.mode().equals("invalidState") || test.mode().equals("stateFailure")) {
                assertThat(mockingDetails(fixture.service()).getInvocations()).noneMatch(call -> call.getMethod().getName().equals("exchangeCodeForToken"));
            }
        } finally {logger.detachAppender(logs); logs.stop();}
    }
    @ParameterizedTest @ValueSource(strings={"airbnb", "minut", "netatmo"})
    void connectionConfigurationErrorsAreBounded(String provider) throws Exception {
        var response = invoke(fixture(new Case(provider, "connect")), "connect");
        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(response.getBody().toString()).contains(BaitlyOAuthHttpDiagnostics.CONFIGURATION_UNAVAILABLE).doesNotContain(PRIVATE);
    }
}
