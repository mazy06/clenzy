package com.clenzy.integration.external.strategy;

import com.clenzy.service.signature.SignatureProviderType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestClient;

import java.util.HashMap;
import java.util.Map;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link OdooConnectionTestStrategy}.
 *
 * <h2>Focus</h2>
 * <ul>
 *   <li>providerType() retourne ODOO</li>
 *   <li>Null inputs renvoient false immediatement (court-circuit)</li>
 *   <li>accountIdentifier mal forme (sans '|') refuse</li>
 *   <li>URL avec/sans slash final supportee (concatenation correcte)</li>
 *   <li>Reponses parsing : ok / uid false / uid null / response null / no map result</li>
 *   <li>Exception RestClient -> false (jamais propagee au caller)</li>
 * </ul>
 */
class OdooConnectionTestStrategyTest {

    private OdooConnectionTestStrategy strategy;

    @BeforeEach
    void setUp() {
        strategy = new OdooConnectionTestStrategy();
    }

    @Test
    @DisplayName("providerType returns ODOO")
    void providerType_returnsOdoo() {
        assertThat(strategy.providerType()).isEqualTo(SignatureProviderType.ODOO);
    }

    @Test
    @DisplayName("testConnection returns false when serverUrl is null")
    void testConnection_nullServerUrl_false() {
        assertThat(strategy.testConnection(null, "db|user", "apiKey")).isFalse();
    }

    @Test
    @DisplayName("testConnection returns false when accountIdentifier is null")
    void testConnection_nullAccountIdentifier_false() {
        assertThat(strategy.testConnection("https://odoo.example.com", null, "apiKey")).isFalse();
    }

    @Test
    @DisplayName("testConnection returns false when apiKey is null")
    void testConnection_nullApiKey_false() {
        assertThat(strategy.testConnection("https://odoo.example.com", "db|user", null)).isFalse();
    }

    @Test
    @DisplayName("testConnection returns false when accountIdentifier missing '|' separator")
    void testConnection_invalidAccountIdentifierFormat_false() {
        assertThat(strategy.testConnection("https://odoo.example.com", "dbWithoutUser", "apiKey")).isFalse();
    }

    @Test
    @DisplayName("testConnection returns false when accountIdentifier is empty string")
    void testConnection_emptyAccountIdentifier_false() {
        assertThat(strategy.testConnection("https://odoo.example.com", "", "apiKey")).isFalse();
    }

    @Test
    @DisplayName("testConnection returns true when response has positive uid (integer)")
    void testConnection_validUid_true() {
        installMockRestClient(strategy, Map.of("result", Map.of("uid", 12)));

        assertThat(strategy.testConnection("https://odoo.example.com",
                "myDb|admin", "secret")).isTrue();
    }

    @Test
    @DisplayName("testConnection returns false when uid is Boolean.FALSE")
    void testConnection_uidBooleanFalse_false() {
        installMockRestClient(strategy, Map.of("result", Map.of("uid", false)));

        assertThat(strategy.testConnection("https://odoo.example.com",
                "myDb|admin", "secret")).isFalse();
    }

    @Test
    @DisplayName("testConnection returns false when response is null")
    void testConnection_responseNull_false() {
        installMockRestClient(strategy, null);

        assertThat(strategy.testConnection("https://odoo.example.com",
                "myDb|admin", "secret")).isFalse();
    }

    @Test
    @DisplayName("testConnection returns false when result field is missing")
    void testConnection_missingResultField_false() {
        installMockRestClient(strategy, Map.of("noResult", "x"));

        assertThat(strategy.testConnection("https://odoo.example.com",
                "myDb|admin", "secret")).isFalse();
    }

    @Test
    @DisplayName("testConnection returns false when result is not a Map (e.g. string)")
    void testConnection_resultNotAMap_false() {
        installMockRestClient(strategy, Map.of("result", "not-a-map"));

        assertThat(strategy.testConnection("https://odoo.example.com",
                "myDb|admin", "secret")).isFalse();
    }

    @Test
    @DisplayName("testConnection returns false when uid field is null in result map")
    void testConnection_uidIsNull_false() {
        // Map.of refuses null values — emulate with a HashMap
        java.util.Map<String, Object> result = new java.util.HashMap<>();
        result.put("uid", null);
        installMockRestClient(strategy, Map.of("result", result));

        assertThat(strategy.testConnection("https://odoo.example.com",
                "myDb|admin", "secret")).isFalse();
    }

    @Test
    @DisplayName("testConnection returns false when RestClient throws an exception")
    void testConnection_restClientThrows_false() {
        RestClient mockClient = mock(RestClient.class);
        when(mockClient.post()).thenThrow(new RuntimeException("network error"));
        ReflectionTestUtils.setField(strategy, "restClient", mockClient);

        assertThat(strategy.testConnection("https://odoo.example.com",
                "myDb|admin", "secret")).isFalse();
    }

    @Test
    @DisplayName("testConnection appends /web/session/authenticate when URL lacks trailing slash")
    void testConnection_urlWithoutTrailingSlash_works() {
        installMockRestClient(strategy, Map.of("result", Map.of("uid", 7)));

        // Should not throw and not return false due to URL handling
        assertThat(strategy.testConnection("https://odoo.example.com",
                "db|user", "key")).isTrue();
    }

    @Test
    @DisplayName("testConnection appends web/session/authenticate when URL has trailing slash")
    void testConnection_urlWithTrailingSlash_works() {
        installMockRestClient(strategy, Map.of("result", Map.of("uid", 7)));

        assertThat(strategy.testConnection("https://odoo.example.com/",
                "db|user", "key")).isTrue();
    }

    // ─── Helper to inject a mocked RestClient ────────────────────────────────

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static void installMockRestClient(OdooConnectionTestStrategy strategy, Map responseBody) {
        RestClient mockClient = mock(RestClient.class);
        RestClient.RequestBodyUriSpec uriSpec = mock(RestClient.RequestBodyUriSpec.class);
        RestClient.RequestBodySpec bodySpec = mock(RestClient.RequestBodySpec.class);
        RestClient.ResponseSpec responseSpec = mock(RestClient.ResponseSpec.class);

        lenient().when(mockClient.post()).thenReturn(uriSpec);
        lenient().when(uriSpec.uri(anyString())).thenReturn(bodySpec);
        // Use specific Consumer.class type matcher to bind to the right overload
        lenient().when(bodySpec.headers((Consumer<HttpHeaders>) any(Consumer.class))).thenReturn(bodySpec);
        lenient().when(bodySpec.body(any(Object.class))).thenReturn(bodySpec);
        lenient().when(bodySpec.retrieve()).thenReturn(responseSpec);
        lenient().when(responseSpec.body(Map.class)).thenReturn(responseBody);

        ReflectionTestUtils.setField(strategy, "restClient", mockClient);
    }
}
