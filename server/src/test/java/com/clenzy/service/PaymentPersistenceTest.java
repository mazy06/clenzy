package com.clenzy.service;

import static org.mockito.Mockito.mock;

import com.clenzy.dto.PaymentOrchestrationRequest;
import com.clenzy.model.PaymentProviderType;
import com.clenzy.model.PaymentTransaction;
import com.clenzy.model.TransactionStatus;
import com.clenzy.model.TransactionType;
import com.clenzy.payment.PaymentResult;
import com.clenzy.repository.PaymentTransactionRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Caractérise {@link PaymentPersistence} : écritures DB en transactions courtes
 * + publication outbox. Assertions historiquement portées par
 * {@code PaymentOrchestrationServiceTest} avant l'extraction (ADR Vague 1b).
 */
@ExtendWith(MockitoExtension.class)
class PaymentPersistenceTest {

    @Mock private PaymentTransactionRepository transactionRepository;
    @Mock private com.clenzy.service.DepositReconciler depositReconciler;
    @Mock private OutboxPublisher outboxPublisher;

    @Mock private InterventionPaymentCoordination interventionPayments;
    private PaymentPersistence persistence;

    private static final Long ORG_ID = 42L;

    @BeforeEach
    void setUp() {
        persistence = new PaymentPersistence(transactionRepository, outboxPublisher, new ObjectMapper(), depositReconciler, interventionPayments, mock(InvoicePaymentCoordination.class), org.mockito.Mockito.mock(com.clenzy.service.payout.BaitlyTransferRecoveryStore.class));
    }

    private PaymentTransaction tx(String ref, TransactionStatus status, PaymentProviderType type) {
        PaymentTransaction t = new PaymentTransaction();
        t.setOrganizationId(ORG_ID);
        t.setTransactionRef(ref);
        t.setProviderType(type);
        t.setPaymentType(TransactionType.CHECKOUT);
        t.setStatus(status);
        t.setAmount(BigDecimal.valueOf(100));
        t.setCurrency("EUR");
        t.setSourceType("INTERVENTION");
        t.setSourceId(10L);
        return t;
    }

    private PaymentOrchestrationRequest request(String idempotencyKey) {
        return new PaymentOrchestrationRequest(
                BigDecimal.valueOf(100), "EUR", "INTERVENTION", 10L,
                "desc", "e@x.com", null, "ok", "ko", Map.of("k", "v"), idempotencyKey);
    }


    @Test void ambiguousFailedBatchKeepsItsIdempotencyKey() {
        var tx = tx("TX-batch", TransactionStatus.FAILED, PaymentProviderType.STRIPE);
        tx.setSourceType("INTERVENTION_BATCH"); tx.setIdempotencyKey("batch");
        when(transactionRepository.findByIdempotencyKey("batch")).thenReturn(Optional.of(tx));
        assertThat(persistence.consumeIdempotentReplay("batch")).contains(tx);
        assertThat(tx.getIdempotencyKey()).isEqualTo("batch");
        verify(transactionRepository,never()).save(any());
    }
    @Test void verifiedExpiredBatchCanBeRetried() {
        var tx=tx("TX-batch",TransactionStatus.FAILED,PaymentProviderType.STRIPE);
        tx.setSourceType("INTERVENTION_BATCH"); tx.setIdempotencyKey("batch"); tx.setMetadata(Map.of("batchRetryAllowed",true));
        when(transactionRepository.findByIdempotencyKey("batch")).thenReturn(Optional.of(tx));
        assertThat(persistence.consumeIdempotentReplay("batch")).isEmpty();
        assertThat(tx.getIdempotencyKey()).isNull();
    }
    @Test void failedServiceRequestKeepsItsAttemptForReconciliation() {
        var tx = tx("TX-request", TransactionStatus.FAILED, PaymentProviderType.STRIPE);
        tx.setSourceType("SERVICE_REQUEST"); tx.setIdempotencyKey("request");
        when(transactionRepository.findByIdempotencyKey("request")).thenReturn(Optional.of(tx));
        assertThat(persistence.consumeIdempotentReplay("request")).contains(tx);
        assertThat(tx.getIdempotencyKey()).isEqualTo("request");
        verify(transactionRepository, never()).save(any());
    }
    @Test void failedIndividualWithoutExpirationProofKeepsItsAttempt() {
        var tx = tx("TX-uncertain", TransactionStatus.FAILED, PaymentProviderType.STRIPE);
        tx.setIdempotencyKey("individual");
        when(transactionRepository.findByIdempotencyKey("individual")).thenReturn(Optional.of(tx));
        assertThat(persistence.consumeIdempotentReplay("individual")).contains(tx);
        assertThat(tx.getIdempotencyKey()).isEqualTo("individual");
        verify(transactionRepository, never()).save(any());
    }
    @Test void batchRefundDoesNotCreateGenericFullSessionRefund() {
        var tx=tx("TX-batch",TransactionStatus.COMPLETED,PaymentProviderType.STRIPE);
        tx.setSourceType("INTERVENTION_BATCH");
        when(transactionRepository.lockByReference(ORG_ID, "TX-batch")).thenReturn(Optional.of(tx));
        assertThatThrownBy(()->persistence.createRefundPending(ORG_ID,"TX-batch",null)).hasMessageContaining("par allocation");
        verify(transactionRepository,never()).save(any());
    }
    @Nested
    @DisplayName("consumeIdempotentReplay")
    class ConsumeIdempotentReplay {

        @Test
        @DisplayName("null key → empty without hitting the repository")
        void nullKey() {
            assertThat(persistence.consumeIdempotentReplay(null)).isEmpty();
            verify(transactionRepository, never()).findByIdempotencyKey(any());
        }

        @Test
        @DisplayName("blank key → empty without hitting the repository")
        void blankKey() {
            assertThat(persistence.consumeIdempotentReplay("  ")).isEmpty();
            verify(transactionRepository, never()).findByIdempotencyKey(any());
        }

        @Test
        @DisplayName("unknown key → empty")
        void unknownKey() {
            when(transactionRepository.findByIdempotencyKey("K")).thenReturn(Optional.empty());
            assertThat(persistence.consumeIdempotentReplay("K")).isEmpty();
        }

        @Test
        @DisplayName("existing non-FAILED → returns it (replay)")
        void existingReplay() {
            PaymentTransaction existing = tx("TX-OLD", TransactionStatus.PROCESSING, PaymentProviderType.STRIPE);
            when(transactionRepository.findByIdempotencyKey("K")).thenReturn(Optional.of(existing));
            assertThat(persistence.consumeIdempotentReplay("K")).contains(existing);
        }

        @Test
        @DisplayName("expiration prouvée → libère la clé pour une nouvelle tentative")
        void existingFailed() {
            PaymentTransaction failed = tx("TX-FAILED", TransactionStatus.FAILED, PaymentProviderType.STRIPE);
            failed.setIdempotencyKey("K");
            failed.setMetadata(Map.of("standaloneRetryAllowed", true));
            when(transactionRepository.findByIdempotencyKey("K")).thenReturn(Optional.of(failed));
            when(transactionRepository.save(any())).thenAnswer(i -> i.getArgument(0));

            assertThat(persistence.consumeIdempotentReplay("K")).isEmpty();
            assertThat(failed.getIdempotencyKey()).isNull();
            verify(transactionRepository).save(failed);
        }
    }

    @Nested
    @DisplayName("createPending")
    class CreatePending {

        @Test
        @DisplayName("saves a PENDING transaction with request fields")
        void savesPending() {
            when(transactionRepository.save(any())).thenAnswer(i -> i.getArgument(0));

            PaymentTransaction result = persistence.createPending(
                    ORG_ID, PaymentProviderType.STRIPE, request("IDEM"), "IDEM");

            assertThat(result.getStatus()).isEqualTo(TransactionStatus.PENDING);
            assertThat(result.getProviderType()).isEqualTo(PaymentProviderType.STRIPE);
            assertThat(result.getAmount()).isEqualByComparingTo("100");
            assertThat(result.getCurrency()).isEqualTo("EUR");
            assertThat(result.getSourceType()).isEqualTo("INTERVENTION");
            assertThat(result.getSourceId()).isEqualTo(10L);
            assertThat(result.getIdempotencyKey()).isEqualTo("IDEM");
            assertThat(result.getTransactionRef()).startsWith("TX-");
            var order = org.mockito.Mockito.inOrder(interventionPayments, transactionRepository);
            order.verify(interventionPayments).lockPaymentMissions(eq(ORG_ID), any());
            order.verify(transactionRepository).save(any());
        }

        @Test
        void rejectedMissionLockDoesNotPersistPayment() {
            org.mockito.Mockito.doThrow(new org.springframework.security.access.AccessDeniedException("Mission"))
                    .when(interventionPayments).lockPaymentMissions(eq(ORG_ID), any());
            assertThatThrownBy(() -> persistence.createPending(
                    ORG_ID, PaymentProviderType.STRIPE, request("IDEM"), "IDEM"))
                    .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
            verify(transactionRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("finalizeInitiation")
    class FinalizeInitiation {

        @Test
        @DisplayName("success → PROCESSING + providerTxId + outbox PAYMENT_INITIATED")
        void success() {
            PaymentTransaction pending = tx("TX-1", TransactionStatus.PENDING, PaymentProviderType.STRIPE);
            when(transactionRepository.findByTransactionRef("TX-1")).thenReturn(Optional.of(pending));
            when(transactionRepository.save(any())).thenAnswer(i -> i.getArgument(0));

            PaymentTransaction result = persistence.finalizeInitiation(
                    "TX-1", PaymentResult.success("pi_1", "url"), ORG_ID);

            assertThat(result.getStatus()).isEqualTo(TransactionStatus.PROCESSING);
            assertThat(result.getProviderTxId()).isEqualTo("pi_1");
            verify(outboxPublisher).publish(eq("PAYMENT"), anyString(), eq("PAYMENT_INITIATED"),
                    anyString(), anyString(), anyString(), eq(ORG_ID));
        }

        @Test
        @DisplayName("failure result → FAILED + error + outbox")
        void failureResult() {
            PaymentTransaction pending = tx("TX-1", TransactionStatus.PENDING, PaymentProviderType.STRIPE);
            when(transactionRepository.findByTransactionRef("TX-1")).thenReturn(Optional.of(pending));
            when(transactionRepository.save(any())).thenAnswer(i -> i.getArgument(0));

            PaymentTransaction result = persistence.finalizeInitiation(
                    "TX-1", PaymentResult.failure("Card declined"), ORG_ID);

            assertThat(result.getStatus()).isEqualTo(TransactionStatus.FAILED);
            assertThat(result.getErrorMessage()).isEqualTo("Card declined");
            verify(outboxPublisher).publish(eq("PAYMENT"), anyString(), eq("PAYMENT_INITIATED"),
                    anyString(), anyString(), anyString(), eq(ORG_ID));
        }
    }

    @Nested
    @DisplayName("markInitiationFailed")
    class MarkInitiationFailed {

        @Test
        @DisplayName("sets FAILED, saves, does NOT publish")
        void marksFailedNoPublish() {
            PaymentTransaction pending = tx("TX-1", TransactionStatus.PENDING, PaymentProviderType.STRIPE);
            when(transactionRepository.findByTransactionRef("TX-1")).thenReturn(Optional.of(pending));
            when(transactionRepository.save(any())).thenAnswer(i -> i.getArgument(0));

            PaymentTransaction result = persistence.markInitiationFailed("TX-1", "Network error");

            assertThat(result.getStatus()).isEqualTo(TransactionStatus.FAILED);
            assertThat(result.getErrorMessage()).isEqualTo("Network error");
            verify(outboxPublisher, never()).publish(any(), any(), any(), any(), any(), any(), any());
        }
    }

    @Nested
    @DisplayName("refunds")
    class Refunds {

        @Test
        @DisplayName("createRefundPending → PROCESSING refund tx + original context")
        void createRefundPending() {
            PaymentTransaction original = tx("TX-ORIG", TransactionStatus.COMPLETED, PaymentProviderType.STRIPE);
            original.setProviderTxId("pi_orig");
            original.setAmount(BigDecimal.valueOf(200));
            original.setProviderTxId("cs_orig");
            when(transactionRepository.lockByReference(ORG_ID, "TX-ORIG")).thenReturn(Optional.of(original));
            ArgumentCaptor<PaymentTransaction> captor = ArgumentCaptor.forClass(PaymentTransaction.class);
            when(transactionRepository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

            PaymentPersistence.RefundInit init = persistence.createRefundPending(
                    ORG_ID, "TX-ORIG", BigDecimal.valueOf(200));

            assertThat(init.providerType()).isEqualTo(PaymentProviderType.STRIPE);
            assertThat(init.originalProviderTxId()).isEqualTo("cs_orig");
            assertThat(init.originalAmount()).isEqualByComparingTo("200");
            assertThat(init.refundTransactionRef()).startsWith("REF-");
            PaymentTransaction saved = captor.getValue();
            assertThat(saved.getPaymentType()).isEqualTo(TransactionType.REFUND);
            assertThat(saved.getStatus()).isEqualTo(TransactionStatus.PROCESSING);
            assertThat(saved.getAmount()).isEqualByComparingTo("200");
            assertThat(saved.getMetadata()).containsEntry("originalTransactionRef", "TX-ORIG");
        }

        @Test
        @DisplayName("createRefundPending → null amount uses original amount")
        void createRefundPendingNullAmount() {
            PaymentTransaction original = tx("TX-ORIG", TransactionStatus.COMPLETED, PaymentProviderType.STRIPE);
            original.setAmount(BigDecimal.valueOf(200));
            original.setProviderTxId("cs_orig");
            when(transactionRepository.lockByReference(ORG_ID, "TX-ORIG")).thenReturn(Optional.of(original));
            ArgumentCaptor<PaymentTransaction> captor = ArgumentCaptor.forClass(PaymentTransaction.class);
            when(transactionRepository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

            persistence.createRefundPending(ORG_ID, "TX-ORIG", null);

            assertThat(captor.getValue().getAmount()).isEqualByComparingTo("200");
        }

        @Test
        @DisplayName("createRefundPending → throws when tx not found")
        void createRefundNotFound() {
            when(transactionRepository.lockByReference(ORG_ID, "NOPE")).thenReturn(Optional.empty());
            assertThatThrownBy(() -> persistence.createRefundPending(ORG_ID, "NOPE", null))
                    .isInstanceOf(RuntimeException.class).hasMessageContaining("Transaction not found");
        }

        @Test
        @DisplayName("createRefundPending → throws when wrong org")
        void createRefundWrongOrg() {
            PaymentTransaction other = tx("TX-OTHER", TransactionStatus.COMPLETED, PaymentProviderType.STRIPE);
            other.setOrganizationId(999L);
            when(transactionRepository.lockByReference(ORG_ID, "TX-OTHER")).thenReturn(Optional.of(other));
            assertThatThrownBy(() -> persistence.createRefundPending(ORG_ID, "TX-OTHER", null))
                    .isInstanceOf(RuntimeException.class).hasMessageContaining("Transaction not found");
        }

        @Test
        @DisplayName("finalizeRefund success → COMPLETED + outbox PAYMENT_REFUNDED")
        void finalizeRefundSuccess() {
            PaymentTransaction refund = tx("REF-1", TransactionStatus.PROCESSING, PaymentProviderType.STRIPE);
            refund.setPaymentType(TransactionType.REFUND);
            refund.setPaymentType(TransactionType.REFUND);
            when(transactionRepository.lockByReference(ORG_ID, "REF-1")).thenReturn(Optional.of(refund));
            when(transactionRepository.save(any())).thenAnswer(i -> i.getArgument(0));

            PaymentTransaction result = persistence.finalizeRefund("REF-1", PaymentResult.success("rf_1", null), ORG_ID);

            assertThat(result.getStatus()).isEqualTo(TransactionStatus.COMPLETED);
            verify(outboxPublisher).publish(eq("PAYMENT"), anyString(), eq("PAYMENT_REFUNDED"),
                    anyString(), anyString(), anyString(), eq(ORG_ID));
        }

        @Test
        @DisplayName("finalizeRefund failure → FAILED + outbox")
        void finalizeRefundFailure() {
            PaymentTransaction refund = tx("REF-1", TransactionStatus.PROCESSING, PaymentProviderType.STRIPE);
            refund.setPaymentType(TransactionType.REFUND);
            when(transactionRepository.lockByReference(ORG_ID, "REF-1")).thenReturn(Optional.of(refund));
            when(transactionRepository.save(any())).thenAnswer(i -> i.getArgument(0));

            PaymentTransaction result = persistence.finalizeRefund("REF-1", PaymentResult.failure("Already refunded"), ORG_ID);

            assertThat(result.getStatus()).isEqualTo(TransactionStatus.FAILED);
            verify(outboxPublisher, never()).publish(any(), any(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("markRefundFailed → FAILED, no publish")
        void markRefundFailed() {

            PaymentTransaction refund = tx("REF-1", TransactionStatus.PROCESSING, PaymentProviderType.STRIPE);
            refund.setPaymentType(TransactionType.REFUND);
            when(transactionRepository.lockByReference(ORG_ID, "REF-1")).thenReturn(Optional.of(refund));
            when(transactionRepository.save(any())).thenAnswer(i -> i.getArgument(0));

            when(transactionRepository.findByTransactionRef("REF-1")).thenReturn(Optional.of(refund));
            PaymentTransaction result = persistence.markRefundFailed("REF-1", "boom");

            assertThat(result.getStatus()).isEqualTo(TransactionStatus.FAILED);
            assertThat(result.getErrorMessage()).isEqualTo("boom");
            verify(outboxPublisher, never()).publish(any(), any(), any(), any(), any(), any(), any());
        }
    }

    @Nested
    @DisplayName("completeTransaction / failTransaction (webhooks)")
    class Webhooks {

        @Test
        @DisplayName("completeTransaction → COMPLETED + outbox")
        void complete() {
            // La transition passe par un UPDATE conditionnel (P6-05) : le CAS est gagne
            // (1 ligne), puis requireTx relit l'entite — deja COMPLETED en base.
            PaymentTransaction t = tx("TX-1", TransactionStatus.COMPLETED, PaymentProviderType.STRIPE);
            when(transactionRepository.markCompleted("TX-1")).thenReturn(1);
            when(transactionRepository.findByTransactionRef("TX-1")).thenReturn(Optional.of(t));

            PaymentTransaction result = persistence.completeTransaction("TX-1");

            assertThat(result.getStatus()).isEqualTo(TransactionStatus.COMPLETED);
            verify(outboxPublisher).publish(eq("PAYMENT"), anyString(), eq("PAYMENT_COMPLETED"),
                    anyString(), anyString(), anyString(), eq(ORG_ID));
        }

        @Test
        @DisplayName("completeTransaction idempotent → skips when already COMPLETED")
        void completeIdempotent() {
            PaymentTransaction t = tx("TX-1", TransactionStatus.COMPLETED, PaymentProviderType.STRIPE);
            when(transactionRepository.markCompleted("TX-1")).thenReturn(0);
            when(transactionRepository.findByTransactionRef("TX-1")).thenReturn(Optional.of(t));

            persistence.completeTransaction("TX-1");

            verify(transactionRepository, never()).save(any());
            verify(outboxPublisher, never()).publish(any(), any(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("completeTransaction → throws when not found")
        void completeNotFound() {
            when(transactionRepository.findByTransactionRef("NOPE")).thenReturn(Optional.empty());
            assertThatThrownBy(() -> persistence.completeTransaction("NOPE"))
                    .isInstanceOf(RuntimeException.class).hasMessageContaining("Transaction not found");
        }

        @Test
        @DisplayName("failTransaction → FAILED + outbox")
        void fail() {
            // Idem pour l'echec : UPDATE conditionnel puis relecture (P6-12).
            PaymentTransaction t = tx("TX-1", TransactionStatus.FAILED, PaymentProviderType.STRIPE);
            t.setErrorMessage("Card declined");
            when(transactionRepository.markFailed("TX-1", "Card declined")).thenReturn(1);
            when(transactionRepository.findByTransactionRef("TX-1")).thenReturn(Optional.of(t));

            PaymentTransaction result = persistence.failTransaction("TX-1", "Card declined");

            assertThat(result.getStatus()).isEqualTo(TransactionStatus.FAILED);
            assertThat(result.getErrorMessage()).isEqualTo("Card declined");
            verify(outboxPublisher).publish(eq("PAYMENT"), anyString(), eq("PAYMENT_FAILED"),
                    anyString(), anyString(), anyString(), eq(ORG_ID));
        }

        /**
         * Audit 2026-07 (P6-05) — {@code completeTransaction} etait un check-then-act :
         * {@code findByTransactionRef} sans verrou, test du statut, puis {@code save}
         * inconditionnel. Sous READ COMMITTED, deux rejeux concurrents du meme webhook
         * lisaient tous deux PROCESSING et publiaient chacun un PAYMENT_COMPLETED dans
         * l'outbox. La transition passe desormais par un UPDATE conditionnel : le perdant
         * du CAS obtient 0 ligne modifiee et ne publie rien.
         */
        @Test
        @DisplayName("completeTransaction : le perdant du CAS ne publie aucun evenement (P6-05)")
        void completeLosesCasAndPublishesNothing() {
            PaymentTransaction t = tx("TX-1", TransactionStatus.COMPLETED, PaymentProviderType.STRIPE);
            when(transactionRepository.markCompleted("TX-1")).thenReturn(0);
            when(transactionRepository.findByTransactionRef("TX-1")).thenReturn(Optional.of(t));

            PaymentTransaction result = persistence.completeTransaction("TX-1");

            assertThat(result.getStatus()).isEqualTo(TransactionStatus.COMPLETED);
            verify(outboxPublisher, never()).publish(any(), any(), any(), any(), any(), any(), any());
        }

        /**
         * Audit 2026-07 (P6-12) — {@code failTransaction} n'avait aucune garde d'etat :
         * {@code COMPLETED → FAILED} etait autorise. Le rejeu d'un webhook d'echec signe,
         * apres un succes, degradait une transaction encaissee et publiait PAYMENT_FAILED,
         * desynchronisant le ledger de l'entite metier restee PAID.
         */
        @Test
        @DisplayName("failTransaction ne degrade pas une transaction COMPLETED (P6-12)")
        void failDoesNotDowngradeCompleted() {
            PaymentTransaction t = tx("TX-1", TransactionStatus.COMPLETED, PaymentProviderType.STRIPE);
            when(transactionRepository.markFailed("TX-1", "Card declined")).thenReturn(0);
            when(transactionRepository.findByTransactionRef("TX-1")).thenReturn(Optional.of(t));

            PaymentTransaction result = persistence.failTransaction("TX-1", "Card declined");

            assertThat(result.getStatus())
                    .as("une transaction encaissee ne doit jamais repasser en echec")
                    .isEqualTo(TransactionStatus.COMPLETED);
            verify(outboxPublisher, never()).publish(any(), any(), any(), any(), any(), any(), any());
        }
    }

    @Nested
    @DisplayName("publishEvent error handling")
    class PublishEventErrors {

        @Test
        @DisplayName("does not break when ObjectMapper throws JsonProcessingException")
        void jsonErrorSwallowed() throws JsonProcessingException {
            ObjectMapper failingMapper = org.mockito.Mockito.mock(ObjectMapper.class);
            when(failingMapper.writeValueAsString(any())).thenThrow(new JsonProcessingException("boom") {});
            PaymentPersistence failing = new PaymentPersistence(transactionRepository, outboxPublisher, failingMapper, depositReconciler, interventionPayments, mock(InvoicePaymentCoordination.class), org.mockito.Mockito.mock(com.clenzy.service.payout.BaitlyTransferRecoveryStore.class));

            PaymentTransaction t = tx("TX-1", TransactionStatus.COMPLETED, PaymentProviderType.STRIPE);
            when(transactionRepository.markCompleted("TX-1")).thenReturn(1);
            when(transactionRepository.findByTransactionRef("TX-1")).thenReturn(Optional.of(t));

            PaymentTransaction result = failing.completeTransaction("TX-1");

            assertThat(result.getStatus()).isEqualTo(TransactionStatus.COMPLETED);
            verify(outboxPublisher, never()).publish(any(), any(), any(), any(), any(), any(), any());
        }
    }
}
