package com.clenzy.integration.compliance.strategy;

import com.clenzy.integration.compliance.model.ComplianceProviderType;
import com.clenzy.integration.compliance.submission.chekin.ChekinApiClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestClientException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChekinConnectionTestStrategyTest {

    private static final String BASE_URL = "https://a.chekin.io/public/api/v1";

    @Mock private ChekinApiClient client;

    private ChekinConnectionTestStrategy strategy;

    @BeforeEach
    void setUp() {
        strategy = new ChekinConnectionTestStrategy(client);
    }

    @Test
    void providerType_isChekin() {
        assertThat(strategy.providerType()).isEqualTo(ComplianceProviderType.CHEKIN);
    }

    @Test
    void whenTokenExchangeSucceeds_thenConnectionAccepted() {
        when(client.exchangeApiKeyForToken(eq(BASE_URL), anyString(), eq("valid-key")))
                .thenReturn("jwt-token");

        assertThat(strategy.testConnection(BASE_URL, null, "valid-key")).isTrue();
    }

    @Test
    void whenTokenExchangeFailsHttp_thenConnectionRejected() {
        when(client.exchangeApiKeyForToken(eq(BASE_URL), anyString(), eq("bad-key")))
                .thenThrow(new RestClientException("401 Unauthorized"));

        assertThat(strategy.testConnection(BASE_URL, null, "bad-key")).isFalse();
    }

    @Test
    void whenResponseHasNoToken_thenConnectionRejected() {
        when(client.exchangeApiKeyForToken(eq(BASE_URL), anyString(), eq("key-xxxx")))
                .thenThrow(new IllegalStateException("Token JWT absent"));

        assertThat(strategy.testConnection(BASE_URL, null, "key-xxxx")).isFalse();
    }

    @Test
    void whenBlankCredentials_thenRejectedWithoutApiCall() {
        assertThat(strategy.testConnection(null, null, "key")).isFalse();
        assertThat(strategy.testConnection("  ", null, "key")).isFalse();
        assertThat(strategy.testConnection(BASE_URL, null, null)).isFalse();
        assertThat(strategy.testConnection(BASE_URL, null, "  ")).isFalse();
        verifyNoInteractions(client);
    }
}
