package com.clenzy.controller;

import com.clenzy.dto.ContractSignaturePublicDto;
import com.clenzy.service.signature.ContractSignatureService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Rate-limit double dimension du flux public de signature (Z4B-SECBUGS-03) :
 * consultation limitee par IP ET par token, signature par token ET par IP,
 * repli compteur local si Redis indisponible (pas de fail-open).
 */
@ExtendWith(MockitoExtension.class)
class PublicContractSignatureControllerTest {

    private static final UUID TOKEN = UUID.fromString("11111111-2222-3333-4444-555555555555");

    @Mock private ContractSignatureService contractSignatureService;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;

    private PublicContractSignatureController controller;

    @BeforeEach
    void setUp() {
        controller = new PublicContractSignatureController(contractSignatureService, redisTemplate);
    }

    private MockHttpServletRequest request(String ip) {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setRemoteAddr(ip);
        return req;
    }

    private ContractSignaturePublicDto dto() {
        return new ContractSignaturePublicDto("PENDING", "C-2026-001", "MANAGEMENT", "Villa Azur",
                "Jean Dupont", 0.20, null, null, null, true, null, null, null, "consent");
    }

    @Nested
    @DisplayName("Consultation — keying par IP et par token")
    class ViewRateLimit {

        @Test
        void whenViewUnderLimits_thenIncrementsIpAndTokenKeys() {
            when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.increment(any(String.class))).thenReturn(1L);
            when(contractSignatureService.getPublicView(TOKEN)).thenReturn(dto());

            ContractSignaturePublicDto result = controller.getView(TOKEN.toString(), request("8.8.8.8"));

            assertThat(result.status()).isEqualTo("PENDING");
            verify(valueOps).increment("contract-sign:view:8.8.8.8");
            verify(valueOps).increment("contract-sign:view-token:" + TOKEN);
        }

        @Test
        void whenTokenCapExceeded_thenBlocked429EvenIfIpUnderLimit() {
            when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.increment("contract-sign:view:9.9.9.9")).thenReturn(1L);
            when(valueOps.increment("contract-sign:view-token:" + TOKEN)).thenReturn(61L);

            assertThatThrownBy(() -> controller.getView(TOKEN.toString(), request("9.9.9.9")))
                    .isInstanceOf(ResponseStatusException.class)
                    .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                            .isEqualTo(HttpStatus.TOO_MANY_REQUESTS));
            verify(contractSignatureService, never()).getPublicView(any());
        }

        @Test
        void whenMalformedToken_then404BeforeTokenKeying() {
            when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.increment("contract-sign:view:8.8.8.8")).thenReturn(1L);

            assertThatThrownBy(() -> controller.getView("not-a-uuid", request("8.8.8.8")))
                    .isInstanceOf(ResponseStatusException.class)
                    .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                            .isEqualTo(HttpStatus.NOT_FOUND));
            verify(contractSignatureService, never()).getPublicView(any());
        }
    }

    @Nested
    @DisplayName("Signature — keying par token et par IP")
    class SignRateLimit {

        @Test
        void whenSignIpCapExceeded_thenBlocked429BeforeService() {
            when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.increment("contract-sign:sign-ip:8.8.8.8")).thenReturn(11L);

            assertThatThrownBy(() -> controller.sign(TOKEN.toString(),
                    new PublicContractSignatureController.PublicSignRequest("Jean Dupont", true),
                    request("8.8.8.8")))
                    .isInstanceOf(ResponseStatusException.class)
                    .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                            .isEqualTo(HttpStatus.TOO_MANY_REQUESTS));
            verify(contractSignatureService, never()).sign(any(), any(), anyBoolean(), any(), any());
        }

        @Test
        void whenSignTokenCapExceeded_thenBlocked429() {
            when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.increment("contract-sign:sign-ip:8.8.8.8")).thenReturn(1L);
            when(valueOps.increment("contract-sign:sign:" + TOKEN)).thenReturn(6L);

            assertThatThrownBy(() -> controller.sign(TOKEN.toString(),
                    new PublicContractSignatureController.PublicSignRequest("Jean Dupont", true),
                    request("8.8.8.8")))
                    .isInstanceOf(ResponseStatusException.class);
            verify(contractSignatureService, never()).sign(any(), any(), anyBoolean(), any(), any());
        }
    }

    @Nested
    @DisplayName("Redis indisponible — repli compteur local, pas de fail-open")
    class LocalFallback {

        @Test
        void whenRedisDown_thenLocalCounterStillEnforcesIpLimit() {
            when(redisTemplate.opsForValue()).thenThrow(new RuntimeException("redis down"));
            when(contractSignatureService.getPublicView(TOKEN)).thenReturn(dto());

            // Les 30 premieres vues passent (limite IP), la 31e est bloquee.
            for (int i = 0; i < 30; i++) {
                assertThatCode(() -> controller.getView(TOKEN.toString(), request("8.8.8.8")))
                        .doesNotThrowAnyException();
            }
            assertThatThrownBy(() -> controller.getView(TOKEN.toString(), request("8.8.8.8")))
                    .isInstanceOf(ResponseStatusException.class)
                    .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                            .isEqualTo(HttpStatus.TOO_MANY_REQUESTS));
        }
    }
}
