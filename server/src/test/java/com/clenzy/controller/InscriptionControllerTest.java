package com.clenzy.controller;

import com.clenzy.dto.InscriptionDto;
import com.clenzy.service.InscriptionService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

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
}
