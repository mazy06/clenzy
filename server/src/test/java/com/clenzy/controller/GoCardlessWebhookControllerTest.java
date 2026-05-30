package com.clenzy.controller;

import com.clenzy.model.NotificationKey;
import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.payment.payout.PayoutNotifier;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.service.NotificationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link GoCardlessWebhookController}.
 *
 * Covers signature validation (HMAC-SHA256), payload parsing, event dispatch,
 * idempotence (already-PAID), and admin escalation on revert post-paid.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("GoCardlessWebhookController")
class GoCardlessWebhookControllerTest {

    @Mock private OwnerPayoutRepository payoutRepository;
    @Mock private PayoutNotifier notifier;
    @Mock private NotificationService notificationService;

    private static final String SECRET = "test-secret-value-xyz";

    private GoCardlessWebhookController controller;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        controller = new GoCardlessWebhookController(payoutRepository, notifier, notificationService, objectMapper);
        ReflectionTestUtils.setField(controller, "webhookSecret", SECRET);
    }

    private String signHmacSha256(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] computed = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(computed);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private OwnerPayout newPayout(Long id, Long orgId, PayoutStatus status) {
        OwnerPayout payout = new OwnerPayout();
        payout.setId(id);
        payout.setOrganizationId(orgId);
        payout.setStatus(status);
        payout.setPaymentReference("GOCARDLESS:pay-123");
        return payout;
    }

    @Nested
    @DisplayName("signature validation")
    class SignatureValidation {

        @Test
        @DisplayName("when secret blank -> 503 service unavailable")
        void whenSecretBlank_thenReturns503() {
            ReflectionTestUtils.setField(controller, "webhookSecret", "");
            ResponseEntity<String> response = controller.handleEvent("{}", "any-sig");
            assertThat(response.getStatusCode().value()).isEqualTo(503);
            verify(payoutRepository, never()).save(any());
        }

        @Test
        @DisplayName("when signature null -> 401 missing signature")
        void whenSignatureNull_thenReturns401() {
            ResponseEntity<String> response = controller.handleEvent("{}", null);
            assertThat(response.getStatusCode().value()).isEqualTo(401);
            assertThat(response.getBody()).isEqualTo("Missing signature");
        }

        @Test
        @DisplayName("when signature blank -> 401 missing signature")
        void whenSignatureBlank_thenReturns401() {
            ResponseEntity<String> response = controller.handleEvent("{}", "   ");
            assertThat(response.getStatusCode().value()).isEqualTo(401);
        }

        @Test
        @DisplayName("when signature invalide -> 401 invalid signature")
        void whenSignatureInvalide_thenReturns401() {
            ResponseEntity<String> response = controller.handleEvent("{}", "deadbeef");
            assertThat(response.getStatusCode().value()).isEqualTo(401);
            assertThat(response.getBody()).isEqualTo("Invalid signature");
        }

        @Test
        @DisplayName("signature with different length -> 401")
        void whenSignatureWrongLength_thenReturns401() {
            // Right HMAC charset but truncated
            ResponseEntity<String> response = controller.handleEvent("{}", "ab");
            assertThat(response.getStatusCode().value()).isEqualTo(401);
        }
    }

    @Nested
    @DisplayName("payload parsing")
    class PayloadParsing {

        @Test
        @DisplayName("malformed JSON -> 400")
        void whenMalformedJson_thenReturns400() {
            String body = "{ not_json";
            String sig = signHmacSha256(body);
            ResponseEntity<String> response = controller.handleEvent(body, sig);
            assertThat(response.getStatusCode().value()).isEqualTo(400);
            assertThat(response.getBody()).isEqualTo("Invalid JSON");
        }

        @Test
        @DisplayName("missing events array -> 400")
        void whenNoEventsField_thenReturns400() {
            String body = "{\"foo\":\"bar\"}";
            String sig = signHmacSha256(body);
            ResponseEntity<String> response = controller.handleEvent(body, sig);
            assertThat(response.getStatusCode().value()).isEqualTo(400);
            assertThat(response.getBody()).isEqualTo("Missing events");
        }

        @Test
        @DisplayName("events present but not an array -> 400")
        void whenEventsNotArray_thenReturns400() {
            String body = "{\"events\":\"oops\"}";
            String sig = signHmacSha256(body);
            ResponseEntity<String> response = controller.handleEvent(body, sig);
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
    }

    @Nested
    @DisplayName("event dispatch")
    class EventDispatch {

        @Test
        @DisplayName("action=paid -> markPaid + notifier.notifySuccess + status PAID")
        void whenActionPaid_thenMarkPaidAndNotify() {
            String body = """
                {"events":[{"resource_type":"payments","action":"paid","links":{"payment":"pay-123"}}]}
                """;
            String sig = signHmacSha256(body);
            OwnerPayout payout = newPayout(10L, 1L, PayoutStatus.PROCESSING);
            when(payoutRepository.findFirstByPaymentReference("GOCARDLESS:pay-123"))
                .thenReturn(Optional.of(payout));
            when(payoutRepository.save(any())).thenReturn(payout);

            ResponseEntity<String> response = controller.handleEvent(body, sig);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(payout.getStatus()).isEqualTo(PayoutStatus.PAID);
            assertThat(payout.getPaidAt()).isNotNull();
            verify(notifier).notifySuccess(payout);
        }

        @Test
        @DisplayName("action=confirmed -> markPaid (alias)")
        void whenActionConfirmed_thenMarkPaid() {
            String body = """
                {"events":[{"resource_type":"payments","action":"confirmed","links":{"payment":"pay-123"}}]}
                """;
            String sig = signHmacSha256(body);
            OwnerPayout payout = newPayout(10L, 1L, PayoutStatus.PROCESSING);
            when(payoutRepository.findFirstByPaymentReference(anyString()))
                .thenReturn(Optional.of(payout));
            when(payoutRepository.save(any())).thenReturn(payout);

            ResponseEntity<String> response = controller.handleEvent(body, sig);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(payout.getStatus()).isEqualTo(PayoutStatus.PAID);
            verify(notifier).notifySuccess(payout);
        }

        @Test
        @DisplayName("action=failed -> markFailed + notifier.notifyFailure + status FAILED")
        void whenActionFailed_thenMarkFailed() {
            String body = """
                {"events":[{"resource_type":"payments","action":"failed","links":{"payment":"pay-123"}}]}
                """;
            String sig = signHmacSha256(body);
            OwnerPayout payout = newPayout(10L, 1L, PayoutStatus.PROCESSING);
            when(payoutRepository.findFirstByPaymentReference(anyString()))
                .thenReturn(Optional.of(payout));
            when(payoutRepository.save(any())).thenReturn(payout);

            ResponseEntity<String> response = controller.handleEvent(body, sig);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(payout.getStatus()).isEqualTo(PayoutStatus.FAILED);
            assertThat(payout.getFailureReason()).contains("failed");
            verify(notifier).notifyFailure(any(OwnerPayout.class), anyString());
        }

        @Test
        @DisplayName("action=cancelled -> markFailed")
        void whenActionCancelled_thenMarkFailed() {
            String body = """
                {"events":[{"resource_type":"payments","action":"cancelled","links":{"payment":"pay-123"}}]}
                """;
            String sig = signHmacSha256(body);
            OwnerPayout payout = newPayout(10L, 1L, PayoutStatus.PROCESSING);
            when(payoutRepository.findFirstByPaymentReference(anyString()))
                .thenReturn(Optional.of(payout));
            when(payoutRepository.save(any())).thenReturn(payout);

            controller.handleEvent(body, sig);
            assertThat(payout.getStatus()).isEqualTo(PayoutStatus.FAILED);
        }

        @Test
        @DisplayName("action=customer_approval_denied -> markFailed")
        void whenActionCustomerApprovalDenied_thenMarkFailed() {
            String body = """
                {"events":[{"resource_type":"payments","action":"customer_approval_denied","links":{"payment":"pay-123"}}]}
                """;
            String sig = signHmacSha256(body);
            OwnerPayout payout = newPayout(10L, 1L, PayoutStatus.PROCESSING);
            when(payoutRepository.findFirstByPaymentReference(anyString()))
                .thenReturn(Optional.of(payout));
            when(payoutRepository.save(any())).thenReturn(payout);

            controller.handleEvent(body, sig);
            assertThat(payout.getStatus()).isEqualTo(PayoutStatus.FAILED);
        }

        @Test
        @DisplayName("unknown action -> no state change")
        void whenActionUnknown_thenNoChange() {
            String body = """
                {"events":[{"resource_type":"payments","action":"submitted","links":{"payment":"pay-123"}}]}
                """;
            String sig = signHmacSha256(body);
            OwnerPayout payout = newPayout(10L, 1L, PayoutStatus.PROCESSING);
            when(payoutRepository.findFirstByPaymentReference(anyString()))
                .thenReturn(Optional.of(payout));

            ResponseEntity<String> response = controller.handleEvent(body, sig);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(payout.getStatus()).isEqualTo(PayoutStatus.PROCESSING);
            verify(payoutRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("filter / lookup edge cases")
    class FilterAndLookup {

        @Test
        @DisplayName("resource_type != payments -> ignored, no DB lookup")
        void whenResourceTypeNotPayments_thenIgnored() {
            String body = """
                {"events":[{"resource_type":"mandates","action":"created","links":{"mandate":"m-1"}}]}
                """;
            String sig = signHmacSha256(body);

            ResponseEntity<String> response = controller.handleEvent(body, sig);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(payoutRepository, never()).findFirstByPaymentReference(anyString());
        }

        @Test
        @DisplayName("event without action -> ignored")
        void whenNoAction_thenIgnored() {
            String body = """
                {"events":[{"resource_type":"payments","links":{"payment":"pay-123"}}]}
                """;
            String sig = signHmacSha256(body);
            ResponseEntity<String> response = controller.handleEvent(body, sig);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(payoutRepository, never()).findFirstByPaymentReference(anyString());
        }

        @Test
        @DisplayName("event without links -> ignored")
        void whenNoLinks_thenIgnored() {
            String body = """
                {"events":[{"resource_type":"payments","action":"paid"}]}
                """;
            String sig = signHmacSha256(body);
            ResponseEntity<String> response = controller.handleEvent(body, sig);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(payoutRepository, never()).findFirstByPaymentReference(anyString());
        }

        @Test
        @DisplayName("event without payment id -> ignored")
        void whenNoPaymentId_thenIgnored() {
            String body = """
                {"events":[{"resource_type":"payments","action":"paid","links":{"foo":"bar"}}]}
                """;
            String sig = signHmacSha256(body);
            ResponseEntity<String> response = controller.handleEvent(body, sig);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(payoutRepository, never()).findFirstByPaymentReference(anyString());
        }

        @Test
        @DisplayName("payout not found -> log + no save")
        void whenPayoutNotFound_thenNoSave() {
            String body = """
                {"events":[{"resource_type":"payments","action":"paid","links":{"payment":"pay-xxx"}}]}
                """;
            String sig = signHmacSha256(body);
            when(payoutRepository.findFirstByPaymentReference("GOCARDLESS:pay-xxx"))
                .thenReturn(Optional.empty());

            ResponseEntity<String> response = controller.handleEvent(body, sig);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(payoutRepository, never()).save(any());
            verify(notifier, never()).notifySuccess(any());
        }
    }

    @Nested
    @DisplayName("idempotence + revert post-paid")
    class IdempotenceAndRevert {

        @Test
        @DisplayName("payout already PAID with paid action -> no double save/notify")
        void whenAlreadyPaid_thenIdempotent() {
            String body = """
                {"events":[{"resource_type":"payments","action":"paid","links":{"payment":"pay-123"}}]}
                """;
            String sig = signHmacSha256(body);
            OwnerPayout payout = newPayout(10L, 1L, PayoutStatus.PAID);
            when(payoutRepository.findFirstByPaymentReference(anyString()))
                .thenReturn(Optional.of(payout));

            ResponseEntity<String> response = controller.handleEvent(body, sig);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(payoutRepository, never()).save(any());
            verify(notifier, never()).notifySuccess(any());
        }

        @Test
        @DisplayName("payout already PAID with failed action -> admin escalation, no failure-notify")
        void whenAlreadyPaidThenReverted_thenEscalatesAdmins() {
            String body = """
                {"events":[{"resource_type":"payments","action":"failed","links":{"payment":"pay-123"}}]}
                """;
            String sig = signHmacSha256(body);
            OwnerPayout payout = newPayout(10L, 42L, PayoutStatus.PAID);
            when(payoutRepository.findFirstByPaymentReference(anyString()))
                .thenReturn(Optional.of(payout));

            ResponseEntity<String> response = controller.handleEvent(body, sig);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            // Status stays PAID — revert is escalated to admins
            assertThat(payout.getStatus()).isEqualTo(PayoutStatus.PAID);
            verify(payoutRepository, never()).save(any());
            ArgumentCaptor<Long> orgIdCap = ArgumentCaptor.forClass(Long.class);
            verify(notificationService).notifyAdminsAndManagersByOrgId(
                orgIdCap.capture(),
                any(NotificationKey.class),
                anyString(), anyString(), anyString());
            assertThat(orgIdCap.getValue()).isEqualTo(42L);
        }
    }

    @Nested
    @DisplayName("multiple events in batch")
    class BatchProcessing {

        @Test
        @DisplayName("multiple events -> each processed")
        void whenMultipleEvents_thenEachProcessed() {
            String body = """
                {"events":[
                  {"resource_type":"payments","action":"paid","links":{"payment":"pay-1"}},
                  {"resource_type":"payments","action":"failed","links":{"payment":"pay-2"}}
                ]}
                """;
            String sig = signHmacSha256(body);
            OwnerPayout p1 = newPayout(1L, 1L, PayoutStatus.PROCESSING);
            p1.setPaymentReference("GOCARDLESS:pay-1");
            OwnerPayout p2 = newPayout(2L, 1L, PayoutStatus.PROCESSING);
            p2.setPaymentReference("GOCARDLESS:pay-2");
            when(payoutRepository.findFirstByPaymentReference("GOCARDLESS:pay-1"))
                .thenReturn(Optional.of(p1));
            when(payoutRepository.findFirstByPaymentReference("GOCARDLESS:pay-2"))
                .thenReturn(Optional.of(p2));
            when(payoutRepository.save(any(OwnerPayout.class))).thenAnswer(inv -> inv.getArgument(0));

            ResponseEntity<String> response = controller.handleEvent(body, sig);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(p1.getStatus()).isEqualTo(PayoutStatus.PAID);
            assertThat(p2.getStatus()).isEqualTo(PayoutStatus.FAILED);
        }
    }
}
