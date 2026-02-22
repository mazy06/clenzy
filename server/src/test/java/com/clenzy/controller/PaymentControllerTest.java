package com.clenzy.controller;

import com.clenzy.model.*;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.StripeService;
import com.clenzy.tenant.TenantContext;
import com.stripe.exception.StripeException;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentControllerTest {

    @Mock private StripeService stripeService;
    @Mock private InterventionRepository interventionRepository;
    @Mock private UserRepository userRepository;
    @Mock private TenantContext tenantContext;

    private PaymentController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() throws Exception {
        controller = new PaymentController(stripeService, interventionRepository, userRepository, tenantContext);
        Field field = PaymentController.class.getDeclaredField("stripeSecretKey");
        field.setAccessible(true);
        field.set(controller, "sk_test_xxx");

        jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "user-123")
                .claim("email", "user@test.com")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    @Nested
    @DisplayName("createPaymentSession")
    class CreateSession {
        @Test
        void whenInterventionNotFound_thenError() {
            com.clenzy.dto.PaymentSessionRequest request = mock(com.clenzy.dto.PaymentSessionRequest.class);
            when(request.getInterventionId()).thenReturn(1L);
            when(interventionRepository.findById(1L)).thenReturn(Optional.empty());

            ResponseEntity<?> response = controller.createPaymentSession(request, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }

        @Test
        void whenAlreadyPaid_thenBadRequest() {
            com.clenzy.dto.PaymentSessionRequest request = mock(com.clenzy.dto.PaymentSessionRequest.class);
            when(request.getInterventionId()).thenReturn(1L);
            Intervention intervention = mock(Intervention.class);
            when(intervention.getStatus()).thenReturn(InterventionStatus.AWAITING_PAYMENT);
            when(intervention.getPaymentStatus()).thenReturn(PaymentStatus.PAID);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            ResponseEntity<?> response = controller.createPaymentSession(request, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenWrongStatus_thenBadRequest() {
            com.clenzy.dto.PaymentSessionRequest request = mock(com.clenzy.dto.PaymentSessionRequest.class);
            when(request.getInterventionId()).thenReturn(1L);
            Intervention intervention = mock(Intervention.class);
            when(intervention.getStatus()).thenReturn(InterventionStatus.COMPLETED);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            ResponseEntity<?> response = controller.createPaymentSession(request, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
    }

    @Nested
    @DisplayName("getSessionStatus")
    class GetSessionStatus {
        @Test
        void whenFound_thenReturnsStatus() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Intervention intervention = mock(Intervention.class);
            when(intervention.getPaymentStatus()).thenReturn(PaymentStatus.PAID);
            when(intervention.getStatus()).thenReturn(InterventionStatus.COMPLETED);
            when(interventionRepository.findByStripeSessionId("sess-1", 1L))
                    .thenReturn(Optional.of(intervention));

            ResponseEntity<?> response = controller.getSessionStatus("sess-1");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body).containsEntry("paymentStatus", "PAID");
        }

        @Test
        void whenNotFound_thenReturns404() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(interventionRepository.findByStripeSessionId("bad-sess", 1L))
                    .thenReturn(Optional.empty());

            ResponseEntity<?> response = controller.getSessionStatus("bad-sess");

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }
    }

    @Nested
    @DisplayName("getPaymentHistory")
    class GetPaymentHistory {
        @Test
        void whenAdminUser_thenReturnsHistory() {
            User user = mock(User.class);
            when(user.getRole()).thenReturn(UserRole.SUPER_ADMIN);
            when(userRepository.findByKeycloakId("user-123")).thenReturn(Optional.of(user));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Page<Intervention> page = new PageImpl<>(List.of());
            when(interventionRepository.findPaymentHistory(isNull(), isNull(), any(), eq(1L))).thenReturn(page);

            ResponseEntity<?> response = controller.getPaymentHistory(0, 10, null, null, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenUserNotFound_thenUnauthorized() {
            when(userRepository.findByKeycloakId("user-123")).thenReturn(Optional.empty());

            ResponseEntity<?> response = controller.getPaymentHistory(0, 10, null, null, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(401);
        }

        @Test
        void whenInvalidStatus_thenBadRequest() {
            ResponseEntity<?> response = controller.getPaymentHistory(0, 10, "INVALID_STATUS", null, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
    }

    @Nested
    @DisplayName("getPaymentSummary")
    class GetPaymentSummary {
        @Test
        void whenAdmin_thenReturnsSummary() {
            User user = mock(User.class);
            when(user.getRole()).thenReturn(UserRole.SUPER_ADMIN);
            when(userRepository.findByKeycloakId("user-123")).thenReturn(Optional.of(user));
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            Page<Intervention> page = new PageImpl<>(List.of());
            when(interventionRepository.findPaymentHistory(isNull(), isNull(), any(), eq(1L))).thenReturn(page);

            ResponseEntity<?> response = controller.getPaymentSummary(null, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenUserNotFound_thenUnauthorized() {
            when(userRepository.findByKeycloakId("user-123")).thenReturn(Optional.empty());

            ResponseEntity<?> response = controller.getPaymentSummary(null, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(401);
        }
    }

    @Nested
    @DisplayName("getHostsWithPayments")
    class GetHostsWithPayments {
        @Test
        void whenCalled_thenReturnsHosts() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Object[] row = new Object[]{1L, "John", "Doe"};
            List<Object[]> rows = new java.util.ArrayList<>();
            rows.add(row);
            when(interventionRepository.findDistinctHostsWithPayments(1L)).thenReturn(rows);

            ResponseEntity<?> response = controller.getHostsWithPayments();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenError_thenReturns500() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(interventionRepository.findDistinctHostsWithPayments(1L))
                    .thenThrow(new RuntimeException("DB error"));

            ResponseEntity<?> response = controller.getHostsWithPayments();

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }

    @Nested
    @DisplayName("refundPayment")
    class RefundPayment {
        @Test
        void whenNotPaid_thenBadRequest() {
            Intervention intervention = mock(Intervention.class);
            when(intervention.getPaymentStatus()).thenReturn(PaymentStatus.PENDING);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            ResponseEntity<?> response = controller.refundPayment(1L);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenPaid_thenRefunds() throws StripeException {
            Intervention intervention = mock(Intervention.class);
            when(intervention.getPaymentStatus()).thenReturn(PaymentStatus.PAID);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(intervention));

            ResponseEntity<?> response = controller.refundPayment(1L);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(stripeService).refundPayment(1L);
        }

        @Test
        void whenNotFound_thenReturns500() {
            when(interventionRepository.findById(99L)).thenReturn(Optional.empty());

            ResponseEntity<?> response = controller.refundPayment(99L);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }
}
