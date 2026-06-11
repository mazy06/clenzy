package com.clenzy.controller;

import com.clenzy.model.NotificationKey;
import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.payment.payout.PayoutNotifier;
import com.clenzy.payment.payout.PayoutWebhookService;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.service.NotificationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link WiseWebhookController}.
 *
 * Covers signature config absent (degraded mode), missing/invalid sig (when configured),
 * event-type filter, transfer state mapping, idempotence, and admin escalation on revert.
 *
 * <p>Le controller est branche sur un {@link PayoutWebhookService} reel (CAS via
 * UPDATE conditionnel) alimente par les mocks — les transitions sont verifiees
 * via les appels repository conditionnels, plus de mutation d'entite en memoire.</p>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("WiseWebhookController")
class WiseWebhookControllerTest {

    @Mock private OwnerPayoutRepository payoutRepository;
    @Mock private PayoutNotifier notifier;
    @Mock private NotificationService notificationService;

    private WiseWebhookController controller;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        PayoutWebhookService payoutWebhookService =
            new PayoutWebhookService(payoutRepository, notifier, notificationService);
        controller = new WiseWebhookController(payoutWebhookService, objectMapper);
        // Default: no public key configured (signature check disabled — degraded mode)
        ReflectionTestUtils.setField(controller, "wisePublicKeyPem", "");
    }

    private OwnerPayout newPayout(Long id, Long orgId, PayoutStatus status) {
        OwnerPayout payout = new OwnerPayout();
        payout.setId(id);
        payout.setOrganizationId(orgId);
        payout.setStatus(status);
        payout.setPaymentReference("WISE:123456");
        return payout;
    }

    private String transferEvent(long transferId, String state) {
        return String.format("""
            {
              "event_type": "transfers#state-change",
              "data": {
                "resource": {"id": %d, "type": "transfer", "profile_id": 1, "account_id": 2},
                "current_state": "%s",
                "previous_state": "submitted"
              }
            }
            """, transferId, state);
    }

    @Nested
    @DisplayName("signature config")
    class SignatureConfig {

        @Test
        @DisplayName("public key blank -> verification disabled, body processed")
        void whenPublicKeyBlank_thenAccepts() {
            String body = transferEvent(123456L, "outgoing_payment_sent");
            when(payoutRepository.findFirstByPaymentReference("WISE:123456")).thenReturn(Optional.empty());

            ResponseEntity<String> response = controller.handleTransferStateChange(body, null);

            // 200 even without signature when not configured
            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        @DisplayName("public key configured + signature null -> 401")
        void whenPubKeySetAndSigNull_thenReturns401() {
            ReflectionTestUtils.setField(controller, "wisePublicKeyPem",
                "-----BEGIN PUBLIC KEY-----\nfakekey\n-----END PUBLIC KEY-----");

            ResponseEntity<String> response = controller.handleTransferStateChange("{}", null);

            assertThat(response.getStatusCode().value()).isEqualTo(401);
            assertThat(response.getBody()).isEqualTo("Missing signature");
        }

        @Test
        @DisplayName("public key configured + signature blank -> 401")
        void whenPubKeySetAndSigBlank_thenReturns401() {
            ReflectionTestUtils.setField(controller, "wisePublicKeyPem",
                "-----BEGIN PUBLIC KEY-----\nfakekey\n-----END PUBLIC KEY-----");
            ResponseEntity<String> response = controller.handleTransferStateChange("{}", "  ");
            assertThat(response.getStatusCode().value()).isEqualTo(401);
        }

        @Test
        @DisplayName("public key configured + signature invalide -> 401 (verifyRsa fails)")
        void whenPubKeySetAndSigBad_thenReturns401() {
            ReflectionTestUtils.setField(controller, "wisePublicKeyPem",
                "-----BEGIN PUBLIC KEY-----\ninvalid-base64\n-----END PUBLIC KEY-----");

            ResponseEntity<String> response = controller.handleTransferStateChange("{}",
                "dGVzdC1iYXNlNjQ=");

            assertThat(response.getStatusCode().value()).isEqualTo(401);
            assertThat(response.getBody()).isEqualTo("Invalid signature");
        }
    }

    @Nested
    @DisplayName("payload parsing")
    class PayloadParsing {

        @Test
        @DisplayName("malformed JSON -> 400")
        void whenMalformedJson_thenReturns400() {
            ResponseEntity<String> response = controller.handleTransferStateChange("{ broken", null);
            assertThat(response.getStatusCode().value()).isEqualTo(400);
            assertThat(response.getBody()).isEqualTo("Invalid JSON");
        }

        @Test
        @DisplayName("event_type != transfers#state-change -> 200 OK ignored")
        void whenOtherEventType_thenReturns200() {
            String body = """
                {"event_type":"profiles#update","data":{"resource":{"id":1}}}
                """;
            ResponseEntity<String> response = controller.handleTransferStateChange(body, null);
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(payoutRepository, never()).findFirstByPaymentReference(anyString());
        }

        @Test
        @DisplayName("missing data -> 400")
        void whenMissingData_thenReturns400() {
            String body = """
                {"event_type":"transfers#state-change"}
                """;
            ResponseEntity<String> response = controller.handleTransferStateChange(body, null);
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        @DisplayName("missing data.resource -> 400")
        void whenMissingResource_thenReturns400() {
            String body = """
                {"event_type":"transfers#state-change","data":{"current_state":"processing"}}
                """;
            ResponseEntity<String> response = controller.handleTransferStateChange(body, null);
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
    }

    @Nested
    @DisplayName("lookup payout")
    class LookupPayout {

        @Test
        @DisplayName("unknown transfer -> 200 OK with body 'Unknown transfer'")
        void whenUnknownTransfer_thenReturns200() {
            String body = transferEvent(999999L, "outgoing_payment_sent");
            when(payoutRepository.findFirstByPaymentReference("WISE:999999"))
                .thenReturn(Optional.empty());

            ResponseEntity<String> response = controller.handleTransferStateChange(body, null);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).isEqualTo("Unknown transfer");
        }
    }

    @Nested
    @DisplayName("state mapping")
    class StateMapping {

        @Test
        @DisplayName("outgoing_payment_sent -> transition conditionnelle PAID + notifySuccess")
        void whenOutgoingPaymentSent_thenMarkPaid() {
            String body = transferEvent(123456L, "outgoing_payment_sent");
            OwnerPayout payout = newPayout(10L, 1L, PayoutStatus.PROCESSING);
            when(payoutRepository.findFirstByPaymentReference("WISE:123456"))
                .thenReturn(Optional.of(payout));
            when(payoutRepository.markPaidIfNotAlreadyPaid(eq(10L), eq(PayoutStatus.PAID), any(Instant.class)))
                .thenReturn(1);
            when(payoutRepository.findById(10L)).thenReturn(Optional.of(payout));

            ResponseEntity<String> response = controller.handleTransferStateChange(body, null);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(payoutRepository).markPaidIfNotAlreadyPaid(eq(10L), eq(PayoutStatus.PAID), any(Instant.class));
            verify(notifier).notifySuccess(payout);
        }

        @Test
        @DisplayName("funds_refunded -> transition conditionnelle FAILED + notifyFailure")
        void whenFundsRefunded_thenMarkFailed() {
            String body = transferEvent(123456L, "funds_refunded");
            OwnerPayout payout = newPayout(10L, 1L, PayoutStatus.PROCESSING);
            when(payoutRepository.findFirstByPaymentReference("WISE:123456"))
                .thenReturn(Optional.of(payout));
            when(payoutRepository.markFailedIfNotPaid(
                    10L, PayoutStatus.FAILED, "Wise state: funds_refunded", PayoutStatus.PAID))
                .thenReturn(1);
            when(payoutRepository.findById(10L)).thenReturn(Optional.of(payout));

            controller.handleTransferStateChange(body, null);

            verify(payoutRepository).markFailedIfNotPaid(
                10L, PayoutStatus.FAILED, "Wise state: funds_refunded", PayoutStatus.PAID);
            verify(notifier).notifyFailure(any(), eq("Wise state: funds_refunded"));
        }

        @Test
        @DisplayName("charged_back -> markFailed")
        void whenChargedBack_thenMarkFailed() {
            String body = transferEvent(123456L, "charged_back");
            OwnerPayout payout = newPayout(10L, 1L, PayoutStatus.PROCESSING);
            when(payoutRepository.findFirstByPaymentReference("WISE:123456"))
                .thenReturn(Optional.of(payout));
            when(payoutRepository.markFailedIfNotPaid(
                    10L, PayoutStatus.FAILED, "Wise state: charged_back", PayoutStatus.PAID))
                .thenReturn(1);
            when(payoutRepository.findById(10L)).thenReturn(Optional.of(payout));

            controller.handleTransferStateChange(body, null);

            verify(notifier).notifyFailure(any(), eq("Wise state: charged_back"));
        }

        @Test
        @DisplayName("cancelled -> markFailed")
        void whenCancelled_thenMarkFailed() {
            String body = transferEvent(123456L, "cancelled");
            OwnerPayout payout = newPayout(10L, 1L, PayoutStatus.PROCESSING);
            when(payoutRepository.findFirstByPaymentReference("WISE:123456"))
                .thenReturn(Optional.of(payout));
            when(payoutRepository.markFailedIfNotPaid(
                    10L, PayoutStatus.FAILED, "Wise state: cancelled", PayoutStatus.PAID))
                .thenReturn(1);
            when(payoutRepository.findById(10L)).thenReturn(Optional.of(payout));

            controller.handleTransferStateChange(body, null);

            verify(notifier).notifyFailure(any(), eq("Wise state: cancelled"));
        }

        @Test
        @DisplayName("bounced_back -> markFailed")
        void whenBouncedBack_thenMarkFailed() {
            String body = transferEvent(123456L, "bounced_back");
            OwnerPayout payout = newPayout(10L, 1L, PayoutStatus.PROCESSING);
            when(payoutRepository.findFirstByPaymentReference("WISE:123456"))
                .thenReturn(Optional.of(payout));
            when(payoutRepository.markFailedIfNotPaid(
                    10L, PayoutStatus.FAILED, "Wise state: bounced_back", PayoutStatus.PAID))
                .thenReturn(1);
            when(payoutRepository.findById(10L)).thenReturn(Optional.of(payout));

            controller.handleTransferStateChange(body, null);

            verify(notifier).notifyFailure(any(), eq("Wise state: bounced_back"));
        }

        @Test
        @DisplayName("intermediate state (processing) -> no action")
        void whenIntermediateState_thenNoAction() {
            String body = transferEvent(123456L, "processing");
            OwnerPayout payout = newPayout(10L, 1L, PayoutStatus.PROCESSING);
            when(payoutRepository.findFirstByPaymentReference("WISE:123456"))
                .thenReturn(Optional.of(payout));

            ResponseEntity<String> response = controller.handleTransferStateChange(body, null);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(payout.getStatus()).isEqualTo(PayoutStatus.PROCESSING);
            verify(payoutRepository, never()).save(any());
            verify(payoutRepository, never())
                .markPaidIfNotAlreadyPaid(any(), any(), any());
            verify(payoutRepository, never())
                .markFailedIfNotPaid(any(), any(), any(), any());
        }

        @Test
        @DisplayName("uppercase state -> still matches (case insensitive)")
        void whenStateUppercase_thenStillMatches() {
            String body = transferEvent(123456L, "OUTGOING_PAYMENT_SENT");
            OwnerPayout payout = newPayout(10L, 1L, PayoutStatus.PROCESSING);
            when(payoutRepository.findFirstByPaymentReference("WISE:123456"))
                .thenReturn(Optional.of(payout));
            when(payoutRepository.markPaidIfNotAlreadyPaid(eq(10L), eq(PayoutStatus.PAID), any(Instant.class)))
                .thenReturn(1);
            when(payoutRepository.findById(10L)).thenReturn(Optional.of(payout));

            controller.handleTransferStateChange(body, null);

            verify(notifier).notifySuccess(payout);
        }
    }

    @Nested
    @DisplayName("idempotence + revert post-paid")
    class IdempotenceAndRevert {

        @Test
        @DisplayName("payout already PAID with sent state -> no double save/notify")
        void whenAlreadyPaid_thenIdempotent() {
            String body = transferEvent(123456L, "outgoing_payment_sent");
            OwnerPayout payout = newPayout(10L, 1L, PayoutStatus.PAID);
            when(payoutRepository.findFirstByPaymentReference("WISE:123456"))
                .thenReturn(Optional.of(payout));
            // CAS : 0 ligne modifiee = deja PAID
            when(payoutRepository.markPaidIfNotAlreadyPaid(eq(10L), eq(PayoutStatus.PAID), any(Instant.class)))
                .thenReturn(0);

            ResponseEntity<String> response = controller.handleTransferStateChange(body, null);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(payoutRepository, never()).save(any());
            verify(notifier, never()).notifySuccess(any());
        }

        @Test
        @DisplayName("payout PAID then refunded -> escalate to admins, status unchanged")
        void whenPaidThenRefunded_thenEscalates() {
            String body = transferEvent(123456L, "funds_refunded");
            OwnerPayout payout = newPayout(10L, 42L, PayoutStatus.PAID);
            when(payoutRepository.findFirstByPaymentReference("WISE:123456"))
                .thenReturn(Optional.of(payout));
            // CAS : 0 ligne modifiee = deja PAID, le statut n'est pas ecrase
            when(payoutRepository.markFailedIfNotPaid(
                    10L, PayoutStatus.FAILED, "Wise state: funds_refunded", PayoutStatus.PAID))
                .thenReturn(0);

            ResponseEntity<String> response = controller.handleTransferStateChange(body, null);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(payout.getStatus()).isEqualTo(PayoutStatus.PAID);
            verify(payoutRepository, never()).save(any());
            verify(notifier, never()).notifyFailure(any(), anyString());
            verify(notificationService).notifyAdminsAndManagersByOrgId(
                org.mockito.ArgumentMatchers.eq(42L),
                any(NotificationKey.class),
                anyString(), anyString(), anyString());
        }
    }
}
