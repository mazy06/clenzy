package com.clenzy.integration.kyc.strategy;

import com.clenzy.integration.kyc.model.KycProviderType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpMethod;
import org.springframework.web.client.RestClientException;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KycConnectionTestStrategiesTest {

    @Mock private KycProbeClient probeClient;

    @Nested
    class Onfido {

        private OnfidoConnectionTestStrategy strategy;

        @BeforeEach
        void setUp() {
            strategy = new OnfidoConnectionTestStrategy(probeClient);
        }

        @Test
        void providerType_isOnfido() {
            assertThat(strategy.providerType()).isEqualTo(KycProviderType.ONFIDO);
        }

        @Test
        void when2xx_thenAccepted() {
            when(probeClient.probe(eq(HttpMethod.GET), anyString(), anyMap())).thenReturn(200);
            assertThat(strategy.testConnection("https://api.eu.onfido.com/v3.6", null, "token")).isTrue();
        }

        @Test
        void when401_thenRejected() {
            when(probeClient.probe(eq(HttpMethod.GET), anyString(), anyMap())).thenReturn(401);
            assertThat(strategy.testConnection("https://api.eu.onfido.com/v3.6", null, "bad")).isFalse();
        }

        @Test
        void whenTransportError_thenRejected() {
            when(probeClient.probe(any(), anyString(), anyMap()))
                    .thenThrow(new RestClientException("timeout"));
            assertThat(strategy.testConnection("https://api.eu.onfido.com/v3.6", null, "token")).isFalse();
        }

        @Test
        void whenBlankCredentials_thenRejectedWithoutCall() {
            assertThat(strategy.testConnection(null, null, "token")).isFalse();
            assertThat(strategy.testConnection("https://api.eu.onfido.com/v3.6", null, " ")).isFalse();
            verifyNoInteractions(probeClient);
        }
    }

    @Nested
    class Sumsub {

        private static final Clock FIXED = Clock.fixed(Instant.ofEpochSecond(1_750_000_000L), ZoneOffset.UTC);

        private SumsubConnectionTestStrategy strategy;

        @BeforeEach
        void setUp() {
            strategy = new SumsubConnectionTestStrategy(probeClient, FIXED);
        }

        @Test
        void providerType_isSumsub() {
            assertThat(strategy.providerType()).isEqualTo(KycProviderType.SUMSUB);
        }

        @Test
        void when2xx_thenAccepted_andRequestSigned() {
            when(probeClient.probe(eq(HttpMethod.POST), anyString(), anyMap())).thenReturn(200);

            boolean ok = strategy.testConnection("https://api.sumsub.com", "app-token", "secret-key");

            assertThat(ok).isTrue();
            @SuppressWarnings({"unchecked", "rawtypes"})
            ArgumentCaptor<Map<String, String>> headers = ArgumentCaptor.forClass((Class) Map.class);
            verify(probeClient).probe(eq(HttpMethod.POST),
                    eq("https://api.sumsub.com" + SumsubConnectionTestStrategy.DEFAULT_PROBE_PATH),
                    headers.capture());
            assertThat(headers.getValue())
                    .containsEntry("X-App-Token", "app-token")
                    .containsEntry("X-App-Access-Ts", "1750000000")
                    .containsKey("X-App-Access-Sig");
            assertThat(headers.getValue().get("X-App-Access-Sig")).hasSize(64);
        }

        @Test
        void when400_thenAcceptedAuthPassed() {
            // Les erreurs d'auth Sumsub sont des 401 : un 400 = requête authentifiée,
            // contrat de paramètres variable selon la config du compte.
            when(probeClient.probe(eq(HttpMethod.POST), anyString(), anyMap())).thenReturn(400);
            assertThat(strategy.testConnection("https://api.sumsub.com", "app-token", "secret")).isTrue();
        }

        @Test
        void when401_thenRejected() {
            when(probeClient.probe(eq(HttpMethod.POST), anyString(), anyMap())).thenReturn(401);
            assertThat(strategy.testConnection("https://api.sumsub.com", "app-token", "bad")).isFalse();
        }

        @Test
        void when404_thenRejectedBadBaseUrl() {
            when(probeClient.probe(eq(HttpMethod.POST), anyString(), anyMap())).thenReturn(404);
            assertThat(strategy.testConnection("https://wrong.example.com", "app-token", "secret")).isFalse();
        }

        @Test
        void whenMissingAppToken_thenRejectedWithoutCall() {
            assertThat(strategy.testConnection("https://api.sumsub.com", null, "secret")).isFalse();
            assertThat(strategy.testConnection("https://api.sumsub.com", " ", "secret")).isFalse();
            verifyNoInteractions(probeClient);
        }
    }

    @Nested
    class Veriff {

        private VeriffConnectionTestStrategy strategy;

        @BeforeEach
        void setUp() {
            strategy = new VeriffConnectionTestStrategy(probeClient);
        }

        @Test
        void providerType_isVeriff() {
            assertThat(strategy.providerType()).isEqualTo(KycProviderType.VERIFF);
        }

        @Test
        void when404OnProbeSession_thenAccepted() {
            // Auth acceptée sur une session-probe inconnue : credentials valides.
            when(probeClient.probe(eq(HttpMethod.GET), anyString(), anyMap())).thenReturn(404);
            assertThat(strategy.testConnection("https://stationapi.veriff.com", "api-key", "secret")).isTrue();
        }

        @Test
        void when401_thenRejected() {
            when(probeClient.probe(eq(HttpMethod.GET), anyString(), anyMap())).thenReturn(401);
            assertThat(strategy.testConnection("https://stationapi.veriff.com", "api-key", "bad")).isFalse();
        }

        @Test
        void whenMissingApiKey_thenRejectedWithoutCall() {
            assertThat(strategy.testConnection("https://stationapi.veriff.com", null, "secret")).isFalse();
            verifyNoInteractions(probeClient);
        }
    }
}
