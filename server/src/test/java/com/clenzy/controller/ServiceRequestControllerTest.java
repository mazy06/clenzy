package com.clenzy.controller;

import com.clenzy.dto.ServiceRequestDto;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.RequestStatus;
import com.clenzy.model.ServiceRequest;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.TeamRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.ServiceRequestService;
import com.clenzy.service.StripeService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ServiceRequestControllerTest {

    @Mock private ServiceRequestService service;
    @Mock private StripeService stripeService;
    @Mock private ServiceRequestRepository serviceRequestRepository;
    @Mock private UserRepository userRepository;
    @Mock private TeamRepository teamRepository;
    @Mock private TenantContext tenantContext;

    private ServiceRequestController controller;

    private Jwt createJwt() {
        return Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "user-123")
                .claim("email", "user@example.com")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    @BeforeEach
    void setUp() {
        controller = new ServiceRequestController(service, stripeService, serviceRequestRepository, userRepository, teamRepository, tenantContext);
    }

    @Nested
    @DisplayName("create")
    class Create {
        @Test
        void whenCreate_thenReturns201() {
            ServiceRequestDto dto = new ServiceRequestDto();
            ServiceRequestDto created = new ServiceRequestDto();
            created.id = 1L;
            when(service.create(any(ServiceRequestDto.class))).thenReturn(created);

            ResponseEntity<ServiceRequestDto> response = controller.create(dto);
            assertThat(response.getStatusCode().value()).isEqualTo(201);
            assertThat(response.getBody().id).isEqualTo(1L);
        }
    }

    @Nested
    @DisplayName("update")
    class Update {
        @Test
        void whenUpdate_thenDelegates() {
            ServiceRequestDto dto = new ServiceRequestDto();
            ServiceRequestDto updated = new ServiceRequestDto();
            updated.id = 1L;
            when(service.update(1L, dto)).thenReturn(updated);

            ServiceRequestDto result = controller.update(1L, dto);
            assertThat(result.id).isEqualTo(1L);
        }
    }

    @Nested
    @DisplayName("get")
    class Get {
        @Test
        void whenGet_thenDelegates() {
            ServiceRequestDto dto = new ServiceRequestDto();
            dto.id = 1L;
            when(service.getById(1L)).thenReturn(dto);

            ServiceRequestDto result = controller.get(1L);
            assertThat(result.id).isEqualTo(1L);
        }
    }

    @Nested
    @DisplayName("list")
    class ListRequests {
        @Test
        void whenList_thenDelegates() {
            Jwt jwt = createJwt();
            var pageable = PageRequest.of(0, 10);
            Page<ServiceRequestDto> page = new PageImpl<>(List.of(new ServiceRequestDto()));
            when(service.searchWithRoleBasedAccess(eq(pageable), isNull(), isNull(), isNull(), isNull(), isNull(), eq(jwt)))
                    .thenReturn(page);

            Page<ServiceRequestDto> result = controller.list(pageable, null, null, null, null, null, jwt);
            assertThat(result.getContent()).hasSize(1);
        }
    }

    @Nested
    @DisplayName("delete")
    class Delete {
        @Test
        void whenDelete_thenDelegates() {
            controller.delete(1L);
            verify(service).delete(1L);
        }
    }

    @Nested
    @DisplayName("refuse")
    class Refuse {
        @Test
        void whenRefuse_thenReturnsOkWithDto() {
            ServiceRequestDto dto = new ServiceRequestDto();
            dto.id = 7L;
            when(service.refuse(7L)).thenReturn(dto);

            ResponseEntity<ServiceRequestDto> result = controller.refuse(7L);
            assertThat(result.getStatusCode().value()).isEqualTo(200);
            assertThat(result.getBody().id).isEqualTo(7L);
        }
    }

    @Nested
    @DisplayName("manualAssign")
    class ManualAssign {
        @Test
        void whenAssign_thenDelegates() {
            ServiceRequestDto dto = new ServiceRequestDto();
            dto.id = 42L;
            when(service.manualAssign(42L, 10L, "user")).thenReturn(dto);

            ResponseEntity<ServiceRequestDto> result = controller.manualAssign(42L, 10L, "user");
            assertThat(result.getBody().id).isEqualTo(42L);
        }
    }

    @Nested
    @DisplayName("getPlanningServiceRequests")
    class GetPlanning {
        @Test
        void whenNoProperties_thenUsesGeneralQuery() {
            Jwt jwt = createJwt();
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(serviceRequestRepository.findByStatusAndDesiredDateBetween(
                    eq(RequestStatus.AWAITING_PAYMENT), any(LocalDateTime.class),
                    any(LocalDateTime.class), eq(1L)))
                    .thenReturn(List.of());

            ResponseEntity<List<Map<String, Object>>> result = controller.getPlanningServiceRequests(jwt, null, null, null);

            assertThat(result.getStatusCode().value()).isEqualTo(200);
            assertThat(result.getBody()).isEmpty();
        }

        @Test
        void whenWithPropertyIds_thenUsesPropertyQuery() {
            Jwt jwt = createJwt();
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            ServiceRequest sr = new ServiceRequest();
            sr.setId(5L);
            sr.setTitle("Test SR");
            sr.setEstimatedDurationHours(2);
            when(serviceRequestRepository.findByStatusAndPropertyIdsAndDesiredDateBetween(
                    any(), eq(List.of(10L)), any(), any(), eq(1L)))
                    .thenReturn(List.of(sr));

            ResponseEntity<List<Map<String, Object>>> result = controller.getPlanningServiceRequests(
                    jwt, List.of(10L), null, null);

            assertThat(result.getBody()).hasSize(1);
            assertThat(result.getBody().get(0)).containsEntry("id", 5L).containsEntry("status", "AWAITING_PAYMENT");
        }
    }

    @Nested
    @DisplayName("createPaymentSession")
    class CreatePaymentSession {
        @Test
        void whenStripeFails_thenReturns400() throws Exception {
            Jwt jwt = createJwt();
            when(stripeService.createServiceRequestCheckoutSession(eq(1L), anyString()))
                    .thenThrow(new RuntimeException("Stripe error"));

            ResponseEntity<Map<String, String>> result = controller.createPaymentSession(1L, jwt);
            assertThat(result.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(result.getBody()).containsKey("error");
        }

        @Test
        void whenSuccess_thenReturnsCheckoutUrl() throws Exception {
            Jwt jwt = createJwt();
            com.stripe.model.checkout.Session session = org.mockito.Mockito.mock(
                    com.stripe.model.checkout.Session.class);
            when(session.getUrl()).thenReturn("https://stripe.test/checkout/abc");
            when(stripeService.createServiceRequestCheckoutSession(eq(1L), anyString()))
                    .thenReturn(session);

            ResponseEntity<Map<String, String>> result = controller.createPaymentSession(1L, jwt);
            assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(result.getBody()).containsEntry("checkoutUrl", "https://stripe.test/checkout/abc");
        }
    }

    @Nested
    @DisplayName("createEmbeddedPaymentSession")
    class CreateEmbeddedSession {
        @Test
        void whenSuccess_thenReturnsSessionAndClientSecret() throws Exception {
            Jwt jwt = createJwt();
            com.stripe.model.checkout.Session session = org.mockito.Mockito.mock(
                    com.stripe.model.checkout.Session.class);
            when(session.getId()).thenReturn("sess_emb_1");
            when(session.getClientSecret()).thenReturn("cs_xyz");
            when(stripeService.createServiceRequestEmbeddedCheckoutSession(eq(2L), anyString()))
                    .thenReturn(session);

            ResponseEntity<?> result = controller.createEmbeddedPaymentSession(2L, jwt);
            assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
            @SuppressWarnings("unchecked")
            Map<String, String> body = (Map<String, String>) result.getBody();
            assertThat(body).containsEntry("sessionId", "sess_emb_1")
                    .containsEntry("clientSecret", "cs_xyz");
        }

        @Test
        void whenError_thenReturns400() throws Exception {
            Jwt jwt = createJwt();
            when(stripeService.createServiceRequestEmbeddedCheckoutSession(any(), anyString()))
                    .thenThrow(new RuntimeException("embed error"));

            ResponseEntity<?> result = controller.createEmbeddedPaymentSession(2L, jwt);
            assertThat(result.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        }
    }

    @Nested
    @DisplayName("checkPaymentStatus")
    class CheckPaymentStatus {
        @Test
        void whenSrNotFound_thenReturns500() {
            when(serviceRequestRepository.findById(99L)).thenReturn(java.util.Optional.empty());

            ResponseEntity<?> result = controller.checkPaymentStatus(99L);
            assertThat(result.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        @Test
        void whenAlreadyPaid_thenReturnsPaidStatus() {
            ServiceRequest sr = new ServiceRequest();
            sr.setId(5L);
            sr.setPaymentStatus(PaymentStatus.PAID);
            when(serviceRequestRepository.findById(5L)).thenReturn(java.util.Optional.of(sr));

            ResponseEntity<?> result = controller.checkPaymentStatus(5L);
            assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
            @SuppressWarnings("unchecked")
            Map<String, String> body = (Map<String, String>) result.getBody();
            assertThat(body).containsEntry("paymentStatus", "PAID");
        }

        @Test
        void whenNoStripeSession_thenReturnsNoSession() {
            ServiceRequest sr = new ServiceRequest();
            sr.setId(5L);
            sr.setPaymentStatus(PaymentStatus.PROCESSING);
            sr.setStripeSessionId(null);
            when(serviceRequestRepository.findById(5L)).thenReturn(java.util.Optional.of(sr));

            ResponseEntity<?> result = controller.checkPaymentStatus(5L);
            assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
            @SuppressWarnings("unchecked")
            Map<String, String> body = (Map<String, String>) result.getBody();
            assertThat(body).containsEntry("paymentStatus", "NO_SESSION");
        }

        @Test
        void whenBlankStripeSession_thenReturnsNoSession() {
            ServiceRequest sr = new ServiceRequest();
            sr.setId(5L);
            sr.setPaymentStatus(PaymentStatus.PROCESSING);
            sr.setStripeSessionId("  ");
            when(serviceRequestRepository.findById(5L)).thenReturn(java.util.Optional.of(sr));

            ResponseEntity<?> result = controller.checkPaymentStatus(5L);
            assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
        }
    }

    @Nested
    @DisplayName("planning - with team and user assignees")
    class PlanningWithAssignees {
        @Test
        void whenSrHasUserAssignee_thenIncludesNameInResult() {
            Jwt jwt = createJwt();
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            ServiceRequest sr = new ServiceRequest();
            sr.setId(8L);
            sr.setTitle("Task");
            sr.setEstimatedDurationHours(2);
            sr.setAssignedToType("user");
            sr.setAssignedToId(50L);
            sr.setDesiredDate(LocalDateTime.of(2026, 4, 1, 9, 0));

            when(serviceRequestRepository.findByStatusAndDesiredDateBetween(
                    eq(RequestStatus.AWAITING_PAYMENT), any(), any(), eq(1L)))
                    .thenReturn(List.of(sr));

            com.clenzy.model.User user = new com.clenzy.model.User();
            user.setId(50L);
            user.setFirstName("Alice");
            user.setLastName("Test");
            when(userRepository.findAllById(eq(List.of(50L)))).thenReturn(List.of(user));

            ResponseEntity<List<Map<String, Object>>> result =
                    controller.getPlanningServiceRequests(jwt, null, null, null);
            assertThat(result.getBody()).hasSize(1);
            assertThat(result.getBody().get(0)).containsEntry("assignedToName", "Alice Test");
            assertThat(result.getBody().get(0)).containsEntry("startTime", "09:00");
            assertThat(result.getBody().get(0)).containsEntry("endTime", "11:00");
        }

        @Test
        void whenSrHasTeamAssignee_thenIncludesTeamName() {
            Jwt jwt = createJwt();
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            ServiceRequest sr = new ServiceRequest();
            sr.setId(9L);
            sr.setTitle("Task");
            sr.setEstimatedDurationHours(3);
            sr.setAssignedToType("team");
            sr.setAssignedToId(60L);

            when(serviceRequestRepository.findByStatusAndDesiredDateBetween(
                    eq(RequestStatus.AWAITING_PAYMENT), any(), any(), eq(1L)))
                    .thenReturn(List.of(sr));

            com.clenzy.model.Team team = new com.clenzy.model.Team();
            team.setId(60L);
            team.setName("Team Bravo");
            when(teamRepository.findAllById(eq(List.of(60L)))).thenReturn(List.of(team));

            ResponseEntity<List<Map<String, Object>>> result =
                    controller.getPlanningServiceRequests(jwt, null, null, null);
            assertThat(result.getBody()).hasSize(1);
            assertThat(result.getBody().get(0)).containsEntry("assignedToName", "Team Bravo");
            assertThat(result.getBody().get(0)).containsEntry("startDate", (Object) null); // no desiredDate
        }
    }
}
