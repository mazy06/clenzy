package com.clenzy.controller;

import com.clenzy.dto.InscriptionDto;
import com.clenzy.dto.SetPasswordDto;
import com.clenzy.service.InscriptionService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InscriptionControllerTest {

    @Mock private InscriptionService inscriptionService;

    private InscriptionController controller;

    @BeforeEach
    void setUp() {
        controller = new InscriptionController(inscriptionService);
    }

    @Nested
    @DisplayName("register")
    class Register {
        @Test
        void whenSuccess_thenReturnsOkWithClientSecret() throws Exception {
            InscriptionDto dto = mock(InscriptionDto.class);
            when(dto.getEmail()).thenReturn("test@example.com");
            Map<String, Object> result = new java.util.LinkedHashMap<>();
            result.put("clientSecret", "cs_test_secret_abc123");
            result.put("sessionId", "cs_test");
            result.put("pmsBaseCents", 3000);
            result.put("monthlyPriceCents", 1950);
            result.put("stripePriceAmount", 23400L);
            result.put("billingPeriod", "BIENNIAL");
            when(inscriptionService.initiateInscription(dto)).thenReturn(result);

            ResponseEntity<?> response = controller.register(dto);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body.get("clientSecret")).isEqualTo("cs_test_secret_abc123");
            assertThat(body.get("sessionId")).isEqualTo("cs_test");
            assertThat(body.get("pmsBaseCents")).isEqualTo(3000);
            assertThat(body.get("monthlyPriceCents")).isEqualTo(1950);
        }

        @Test
        void whenRuntimeException_thenReturnsConflict() throws Exception {
            InscriptionDto dto = mock(InscriptionDto.class);
            when(dto.getEmail()).thenReturn("existing@example.com");
            when(inscriptionService.initiateInscription(dto)).thenThrow(new RuntimeException("Email already exists"));

            ResponseEntity<?> response = controller.register(dto);

            assertThat(response.getStatusCode().value()).isEqualTo(409);
        }

        @Test
        void whenCheckedException_thenReturns500() throws Exception {
            InscriptionDto dto = mock(InscriptionDto.class);
            when(dto.getEmail()).thenReturn("test@example.com");
            // Simulate a checked exception by wrapping in RuntimeException propagation path
            when(inscriptionService.initiateInscription(dto)).thenAnswer(inv -> {
                throw new Exception("Stripe error");
            });

            ResponseEntity<?> response = controller.register(dto);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }

    @Nested
    @DisplayName("getConfirmInfo")
    class GetConfirmInfo {

        @Test
        void whenValidToken_returnsInfo() {
            Map<String, Object> info = Map.of("email", "u@example.com", "fullName", "Jean");
            when(inscriptionService.getInscriptionInfoByToken("tok123")).thenReturn(info);

            ResponseEntity<?> response = controller.getConfirmInfo("tok123");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).isEqualTo(info);
        }

        @Test
        void whenAlreadyCompleted_returns410() {
            when(inscriptionService.getInscriptionInfoByToken("tok"))
                    .thenThrow(new IllegalStateException("ALREADY_COMPLETED"));

            ResponseEntity<?> response = controller.getConfirmInfo("tok");

            assertThat(response.getStatusCode().value()).isEqualTo(410);
        }

        @Test
        void whenOtherIllegalState_returns400() {
            when(inscriptionService.getInscriptionInfoByToken("tok"))
                    .thenThrow(new IllegalStateException("Other state"));

            ResponseEntity<?> response = controller.getConfirmInfo("tok");

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenRuntimeException_returns404() {
            when(inscriptionService.getInscriptionInfoByToken("tok"))
                    .thenThrow(new RuntimeException("Token invalid"));

            ResponseEntity<?> response = controller.getConfirmInfo("tok");

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }
    }

    @Nested
    @DisplayName("setPassword")
    class SetPassword {

        private SetPasswordDto dto(String token, String pwd) {
            SetPasswordDto d = new SetPasswordDto();
            d.setToken(token);
            d.setPassword(pwd);
            return d;
        }

        @Test
        void whenSuccess_returnsTokens() {
            Map<String, Object> tokens = Map.of("access_token", "AT", "refresh_token", "RT");
            when(inscriptionService.completeInscriptionWithPassword("tok", "Pwd123!"))
                    .thenReturn(tokens);

            ResponseEntity<?> response = controller.setPassword(dto("tok", "Pwd123!"));

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).isEqualTo(tokens);
        }

        @Test
        void whenInvalidToken_returns404() {
            when(inscriptionService.completeInscriptionWithPassword("bad", "Pwd"))
                    .thenThrow(new RuntimeException("Token invalide"));

            ResponseEntity<?> response = controller.setPassword(dto("bad", "Pwd"));

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }

        @Test
        void whenExpiredToken_returns404() {
            when(inscriptionService.completeInscriptionWithPassword("e", "Pwd"))
                    .thenThrow(new RuntimeException("Token expire"));

            ResponseEntity<?> response = controller.setPassword(dto("e", "Pwd"));

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }

        @Test
        void whenAlreadyCompleted_returns410() {
            when(inscriptionService.completeInscriptionWithPassword("t", "Pwd"))
                    .thenThrow(new RuntimeException("Cette inscription a deja ete finalisee."));

            ResponseEntity<?> response = controller.setPassword(dto("t", "Pwd"));

            assertThat(response.getStatusCode().value()).isEqualTo(410);
        }

        @Test
        void whenOtherError_returns400() {
            when(inscriptionService.completeInscriptionWithPassword("t", "Pwd"))
                    .thenThrow(new RuntimeException("Other"));

            ResponseEntity<?> response = controller.setPassword(dto("t", "Pwd"));

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenEmptyMessage_returns400() {
            // Empty message doesn't match any pattern (invalide/expire/finalisee) → 400.
            when(inscriptionService.completeInscriptionWithPassword("t", "Pwd"))
                    .thenThrow(new RuntimeException(""));

            ResponseEntity<?> response = controller.setPassword(dto("t", "Pwd"));

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
    }

    @Nested
    @DisplayName("resendConfirmation")
    class ResendConfirmation {

        @Test
        void whenSuccess_returnsOk() {
            doNothing().when(inscriptionService).resendConfirmationEmail("u@example.com");

            ResponseEntity<?> response = controller.resendConfirmation(Map.of("email", "u@example.com"));

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenEmailMissing_returns400() {
            ResponseEntity<?> response = controller.resendConfirmation(new HashMap<>());

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenEmailBlank_returns400() {
            ResponseEntity<?> response = controller.resendConfirmation(Map.of("email", "  "));

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenServiceFails_returnsGenericOk() {
            doThrow(new RuntimeException("No inscription"))
                    .when(inscriptionService).resendConfirmationEmail("u@example.com");

            ResponseEntity<?> response = controller.resendConfirmation(Map.of("email", "u@example.com"));

            // Generic message to not reveal email existence
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }
}
