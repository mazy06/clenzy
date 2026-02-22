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
        void whenSuccess_thenReturnsOk() throws Exception {
            InscriptionDto dto = mock(InscriptionDto.class);
            when(dto.getEmail()).thenReturn("test@example.com");
            Map<String, String> result = Map.of("checkoutUrl", "https://checkout.stripe.com/test", "sessionId", "cs_test");
            when(inscriptionService.initiateInscription(dto)).thenReturn(result);

            ResponseEntity<?> response = controller.register(dto);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            @SuppressWarnings("unchecked")
            Map<String, String> body = (Map<String, String>) response.getBody();
            assertThat(body.get("checkoutUrl")).isEqualTo("https://checkout.stripe.com/test");
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
