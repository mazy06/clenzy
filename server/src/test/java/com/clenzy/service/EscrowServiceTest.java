package com.clenzy.service;

import com.clenzy.model.EscrowHold;
import com.clenzy.model.EscrowStatus;
import com.clenzy.model.LedgerEntry;
import com.clenzy.model.LedgerReferenceType;
import com.clenzy.model.Wallet;
import com.clenzy.repository.EscrowHoldRepository;
import com.clenzy.tenant.TenantContext;
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
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EscrowServiceTest {

    @Mock private EscrowHoldRepository escrowHoldRepository;
    @Mock private WalletService walletService;
    @Mock private LedgerService ledgerService;
    @Mock private OutboxPublisher outboxPublisher;

    private TenantContext tenantContext;
    private ObjectMapper objectMapper;
    private EscrowService service;

    private static final Long ORG_ID = 10L;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);
        objectMapper = new ObjectMapper();
        service = new EscrowService(escrowHoldRepository, walletService, ledgerService,
                outboxPublisher, tenantContext, objectMapper);
    }

    private Wallet buildWallet(Long id, Long orgId, String currency) {
        Wallet w = new Wallet();
        w.setId(id);
        w.setOrganizationId(orgId);
        w.setCurrency(currency);
        return w;
    }

    private EscrowHold buildHold(Long id, Long reservationId, EscrowStatus status, BigDecimal amount) {
        EscrowHold h = new EscrowHold();
        h.setId(id);
        h.setOrganizationId(ORG_ID);
        h.setReservationId(reservationId);
        h.setTransactionId(99L);
        h.setAmount(amount);
        h.setCurrency("EUR");
        h.setStatus(status);
        return h;
    }

    @Nested
    @DisplayName("holdFunds")
    class HoldFunds {

        @Test
        void whenValidArgs_thenTransfersFromPlatformToEscrowAndSavesHold() {
            Wallet platform = buildWallet(1L, ORG_ID, "EUR");
            Wallet escrow = buildWallet(2L, ORG_ID, "EUR");
            when(walletService.getOrCreatePlatformWallet(ORG_ID, "EUR")).thenReturn(platform);
            when(walletService.getOrCreateEscrowWallet(ORG_ID, "EUR")).thenReturn(escrow);
            when(escrowHoldRepository.save(any(EscrowHold.class))).thenAnswer(inv -> {
                EscrowHold h = inv.getArgument(0);
                h.setId(123L);
                return h;
            });

            EscrowHold result = service.holdFunds(100L, 200L, new BigDecimal("250.00"), "EUR");

            assertThat(result.getId()).isEqualTo(123L);
            assertThat(result.getStatus()).isEqualTo(EscrowStatus.HELD);
            assertThat(result.getReservationId()).isEqualTo(100L);
            assertThat(result.getTransactionId()).isEqualTo(200L);
            assertThat(result.getOrganizationId()).isEqualTo(ORG_ID);

            verify(ledgerService).recordTransfer(eq(platform), eq(escrow),
                    eq(new BigDecimal("250.00")),
                    eq(LedgerReferenceType.ESCROW_HOLD),
                    eq("ESC-100"),
                    anyString());
        }

        @Test
        void whenNoTenantContext_thenThrows() {
            tenantContext.setOrganizationId(null);

            assertThatThrownBy(() -> service.holdFunds(1L, 2L, BigDecimal.TEN, "EUR"))
                    .isInstanceOf(IllegalStateException.class);
        }
    }

    @Nested
    @DisplayName("releaseFunds")
    class ReleaseFunds {

        @Test
        void whenHoldNotFound_thenThrows() {
            when(escrowHoldRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.releaseFunds(999L, "AUTO"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Escrow hold not found");
        }

        @Test
        void whenStatusNotHeld_thenThrows() {
            EscrowHold hold = buildHold(1L, 100L, EscrowStatus.RELEASED, new BigDecimal("100"));
            when(escrowHoldRepository.findById(1L)).thenReturn(Optional.of(hold));

            assertThatThrownBy(() -> service.releaseFunds(1L, "MANUAL"))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Cannot release");
        }

        @Test
        void whenValid_thenTransfersBackAndPublishesEvent() {
            EscrowHold hold = buildHold(5L, 100L, EscrowStatus.HELD, new BigDecimal("150"));
            Wallet platform = buildWallet(1L, ORG_ID, "EUR");
            Wallet escrow = buildWallet(2L, ORG_ID, "EUR");
            when(escrowHoldRepository.findById(5L)).thenReturn(Optional.of(hold));
            when(walletService.getOrCreatePlatformWallet(ORG_ID, "EUR")).thenReturn(platform);
            when(walletService.getOrCreateEscrowWallet(ORG_ID, "EUR")).thenReturn(escrow);
            when(escrowHoldRepository.save(any(EscrowHold.class))).thenAnswer(inv -> inv.getArgument(0));

            EscrowHold result = service.releaseFunds(5L, "CHECK_IN");

            assertThat(result.getStatus()).isEqualTo(EscrowStatus.RELEASED);
            assertThat(result.getReleasedAt()).isNotNull();
            assertThat(result.getReleaseTrigger()).isEqualTo("CHECK_IN");

            verify(ledgerService).recordTransfer(eq(escrow), eq(platform),
                    eq(new BigDecimal("150")),
                    eq(LedgerReferenceType.ESCROW_RELEASE),
                    eq("ESC-100"),
                    anyString());
            verify(outboxPublisher).publish(eq("ESCROW"), eq("5"), eq("ESCROW_RELEASED"),
                    anyString(), eq("100"), anyString(), eq(ORG_ID));
        }

        @Test
        void whenTriggerIsNull_thenDefaultsToManual() {
            EscrowHold hold = buildHold(6L, 101L, EscrowStatus.HELD, new BigDecimal("200"));
            Wallet platform = buildWallet(1L, ORG_ID, "EUR");
            Wallet escrow = buildWallet(2L, ORG_ID, "EUR");
            when(escrowHoldRepository.findById(6L)).thenReturn(Optional.of(hold));
            when(walletService.getOrCreatePlatformWallet(ORG_ID, "EUR")).thenReturn(platform);
            when(walletService.getOrCreateEscrowWallet(ORG_ID, "EUR")).thenReturn(escrow);
            when(escrowHoldRepository.save(any(EscrowHold.class))).thenAnswer(inv -> inv.getArgument(0));

            EscrowHold result = service.releaseFunds(6L, null);

            assertThat(result.getReleaseTrigger()).isEqualTo("MANUAL");
        }
    }

    @Nested
    @DisplayName("releaseFundsByReservation")
    class ReleaseByReservation {

        @Test
        void whenNoHeldHoldForReservation_thenThrows() {
            when(escrowHoldRepository.findByReservationIdAndStatus(100L, EscrowStatus.HELD))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.releaseFundsByReservation(100L, "AUTO"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("No HELD escrow");
        }

        @Test
        void whenHoldExists_thenDelegatesToReleaseFunds() {
            EscrowHold hold = buildHold(7L, 100L, EscrowStatus.HELD, new BigDecimal("80"));
            Wallet platform = buildWallet(1L, ORG_ID, "EUR");
            Wallet escrow = buildWallet(2L, ORG_ID, "EUR");
            when(escrowHoldRepository.findByReservationIdAndStatus(100L, EscrowStatus.HELD))
                    .thenReturn(Optional.of(hold));
            when(escrowHoldRepository.findById(7L)).thenReturn(Optional.of(hold));
            when(walletService.getOrCreatePlatformWallet(ORG_ID, "EUR")).thenReturn(platform);
            when(walletService.getOrCreateEscrowWallet(ORG_ID, "EUR")).thenReturn(escrow);
            when(escrowHoldRepository.save(any(EscrowHold.class))).thenAnswer(inv -> inv.getArgument(0));

            EscrowHold result = service.releaseFundsByReservation(100L, "CHECK_IN");

            assertThat(result.getStatus()).isEqualTo(EscrowStatus.RELEASED);
            assertThat(result.getReleaseTrigger()).isEqualTo("CHECK_IN");
        }
    }

    @Nested
    @DisplayName("refundEscrow")
    class RefundEscrow {

        @Test
        void whenHoldNotFound_thenThrows() {
            when(escrowHoldRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.refundEscrow(999L))
                    .isInstanceOf(RuntimeException.class);
        }

        @Test
        void whenStatusNotHeld_thenThrows() {
            EscrowHold hold = buildHold(1L, 50L, EscrowStatus.REFUNDED, new BigDecimal("100"));
            when(escrowHoldRepository.findById(1L)).thenReturn(Optional.of(hold));

            assertThatThrownBy(() -> service.refundEscrow(1L))
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        void whenValid_thenRefundsAndPublishesEvent() {
            EscrowHold hold = buildHold(8L, 200L, EscrowStatus.HELD, new BigDecimal("300"));
            Wallet platform = buildWallet(1L, ORG_ID, "EUR");
            Wallet escrow = buildWallet(2L, ORG_ID, "EUR");
            when(escrowHoldRepository.findById(8L)).thenReturn(Optional.of(hold));
            when(walletService.getOrCreatePlatformWallet(ORG_ID, "EUR")).thenReturn(platform);
            when(walletService.getOrCreateEscrowWallet(ORG_ID, "EUR")).thenReturn(escrow);
            when(escrowHoldRepository.save(any(EscrowHold.class))).thenAnswer(inv -> inv.getArgument(0));

            EscrowHold result = service.refundEscrow(8L);

            assertThat(result.getStatus()).isEqualTo(EscrowStatus.REFUNDED);
            assertThat(result.getReleasedAt()).isNotNull();
            assertThat(result.getReleaseTrigger()).isEqualTo("REFUND");

            verify(ledgerService).recordTransfer(eq(escrow), eq(platform),
                    eq(new BigDecimal("300")),
                    eq(LedgerReferenceType.REFUND),
                    eq("ESC-REFUND-200"),
                    anyString());
            verify(outboxPublisher).publish(eq("ESCROW"), anyString(), eq("ESCROW_REFUNDED"),
                    anyString(), anyString(), anyString(), eq(ORG_ID));
        }
    }

    @Nested
    @DisplayName("queries")
    class Queries {

        @Test
        void getEscrowsByOrganization_delegatesToRepository() {
            EscrowHold h1 = buildHold(1L, 100L, EscrowStatus.HELD, BigDecimal.TEN);
            EscrowHold h2 = buildHold(2L, 101L, EscrowStatus.RELEASED, BigDecimal.ONE);
            when(escrowHoldRepository.findByOrganizationId(ORG_ID)).thenReturn(List.of(h1, h2));

            List<EscrowHold> result = service.getEscrowsByOrganization(ORG_ID);

            assertThat(result).hasSize(2);
        }

        @Test
        void findReleasableEscrows_passesStatusAndCurrentTime() {
            EscrowHold h = buildHold(1L, 1L, EscrowStatus.HELD, BigDecimal.TEN);
            when(escrowHoldRepository.findReleasable(eq(EscrowStatus.HELD), any(LocalDateTime.class)))
                    .thenReturn(List.of(h));

            List<EscrowHold> result = service.findReleasableEscrows();

            assertThat(result).hasSize(1);
        }
    }

    @Nested
    @DisplayName("publishEscrowEvent (via release/refund)")
    class PublishEvent {

        @Test
        void payloadContainsExpectedFields() {
            EscrowHold hold = buildHold(42L, 555L, EscrowStatus.HELD, new BigDecimal("99.99"));
            Wallet platform = buildWallet(1L, ORG_ID, "EUR");
            Wallet escrow = buildWallet(2L, ORG_ID, "EUR");
            when(escrowHoldRepository.findById(42L)).thenReturn(Optional.of(hold));
            when(walletService.getOrCreatePlatformWallet(ORG_ID, "EUR")).thenReturn(platform);
            when(walletService.getOrCreateEscrowWallet(ORG_ID, "EUR")).thenReturn(escrow);
            when(escrowHoldRepository.save(any(EscrowHold.class))).thenAnswer(inv -> inv.getArgument(0));

            service.releaseFunds(42L, "TEST");

            ArgumentCaptor<String> payload = ArgumentCaptor.forClass(String.class);
            verify(outboxPublisher).publish(eq("ESCROW"), eq("42"), eq("ESCROW_RELEASED"),
                    anyString(), eq("555"), payload.capture(), eq(ORG_ID));
            assertThat(payload.getValue())
                    .contains("\"escrowId\":42")
                    .contains("\"reservationId\":555")
                    .contains("\"amount\":\"99.99\"")
                    .contains("\"currency\":\"EUR\"")
                    .contains("\"status\":\"RELEASED\"");
        }

        @Test
        void whenReservationIdIsNull_thenPayloadUsesZero() {
            EscrowHold hold = buildHold(50L, null, EscrowStatus.HELD, new BigDecimal("10"));
            Wallet platform = buildWallet(1L, ORG_ID, "EUR");
            Wallet escrow = buildWallet(2L, ORG_ID, "EUR");
            when(escrowHoldRepository.findById(50L)).thenReturn(Optional.of(hold));
            when(walletService.getOrCreatePlatformWallet(ORG_ID, "EUR")).thenReturn(platform);
            when(walletService.getOrCreateEscrowWallet(ORG_ID, "EUR")).thenReturn(escrow);
            when(escrowHoldRepository.save(any(EscrowHold.class))).thenAnswer(inv -> inv.getArgument(0));

            service.releaseFunds(50L, null);

            ArgumentCaptor<String> payload = ArgumentCaptor.forClass(String.class);
            verify(outboxPublisher).publish(anyString(), anyString(), anyString(),
                    anyString(), anyString(), payload.capture(), any());
            assertThat(payload.getValue()).contains("\"reservationId\":0");
        }
    }
}
