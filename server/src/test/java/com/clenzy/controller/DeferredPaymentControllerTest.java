package com.clenzy.controller;

import com.clenzy.dto.HostBalanceSummaryDto;
import com.clenzy.service.DeferredPaymentService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DeferredPaymentControllerTest {

    @Mock private DeferredPaymentService deferredPaymentService;

    private DeferredPaymentController controller;

    @BeforeEach
    void setUp() {
        controller = new DeferredPaymentController(deferredPaymentService);
    }

    @Nested
    @DisplayName("getHostBalance")
    class GetBalance {
        @Test
        void whenSuccess_thenReturnsOk() {
            HostBalanceSummaryDto summary = mock(HostBalanceSummaryDto.class);
            when(deferredPaymentService.getHostBalance(1L)).thenReturn(summary);

            ResponseEntity<?> response = controller.getHostBalance(1L);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenNotFound_thenReturns404() {
            when(deferredPaymentService.getHostBalance(1L)).thenThrow(new RuntimeException("Host not found"));

            ResponseEntity<?> response = controller.getHostBalance(1L);

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }
    }

    @Nested
    @DisplayName("createPaymentLink")
    class CreatePaymentLink {
        @Test
        void whenSuccess_thenReturnsUrl() throws Exception {
            when(deferredPaymentService.createGroupedPaymentSession(1L))
                    .thenReturn("https://checkout.stripe.com/session/test");

            ResponseEntity<?> response = controller.createPaymentLink(1L);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenRuntimeException_thenBadRequest() throws Exception {
            when(deferredPaymentService.createGroupedPaymentSession(1L))
                    .thenThrow(new RuntimeException("No unpaid interventions"));

            ResponseEntity<?> response = controller.createPaymentLink(1L);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenCheckedException_thenReturns500() throws Exception {
            when(deferredPaymentService.createGroupedPaymentSession(1L))
                    .thenAnswer(inv -> { throw new Exception("Stripe error"); });

            ResponseEntity<?> response = controller.createPaymentLink(1L);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }
}
