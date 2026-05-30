package com.clenzy.controller;

import com.clenzy.dto.LedgerEntryDto;
import com.clenzy.dto.WalletDto;
import com.clenzy.model.*;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.service.LedgerService;
import com.clenzy.service.WalletService;
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
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WalletControllerTest {

    @Mock private WalletService walletService;
    @Mock private LedgerService ledgerService;
    @Mock private InterventionRepository interventionRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private ServiceRequestRepository serviceRequestRepository;
    @Mock private TenantContext tenantContext;

    private WalletController controller;

    @BeforeEach
    void setUp() {
        controller = new WalletController(
                walletService, ledgerService,
                interventionRepository, reservationRepository, serviceRequestRepository,
                tenantContext);
    }

    private Wallet wallet(Long id, Long orgId, WalletType type, Long ownerId) {
        Wallet w = new Wallet();
        w.setId(id);
        w.setOrganizationId(orgId);
        w.setWalletType(type);
        w.setOwnerId(ownerId);
        w.setCurrency("EUR");
        return w;
    }

    private LedgerEntry ledgerEntry(Long id, LedgerEntryType type, BigDecimal amount,
                                      LedgerReferenceType refType, String refId) {
        LedgerEntry e = new LedgerEntry();
        e.setId(id);
        e.setEntryType(type);
        e.setAmount(amount);
        e.setCurrency("EUR");
        e.setBalanceAfter(BigDecimal.ZERO);
        e.setReferenceType(refType);
        e.setReferenceId(refId);
        e.setDescription("desc");
        return e;
    }

    // ── listWallets ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("listWallets")
    class ListWallets {
        @Test
        void returnsWalletsWithBalances() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Wallet w1 = wallet(10L, 1L, WalletType.PLATFORM, null);
            Wallet w2 = wallet(11L, 1L, WalletType.OWNER, 42L);
            when(walletService.getWalletsByOrganization(1L)).thenReturn(List.of(w1, w2));
            when(walletService.getBalance(10L)).thenReturn(new BigDecimal("500.00"));
            when(walletService.getBalance(11L)).thenReturn(new BigDecimal("200.00"));

            ResponseEntity<List<WalletDto>> response = controller.listWallets();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(2);
            assertThat(response.getBody().get(0).walletType()).isEqualTo("PLATFORM");
            assertThat(response.getBody().get(1).ownerId()).isEqualTo(42L);
        }

        @Test
        void emptyOrg_returnsEmptyList() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(walletService.getWalletsByOrganization(1L)).thenReturn(List.of());

            ResponseEntity<List<WalletDto>> response = controller.listWallets();

            assertThat(response.getBody()).isEmpty();
        }
    }

    // ── getBalance ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getBalance")
    class GetBalance {
        @Test
        void returnsBalance() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Wallet w = wallet(10L, 1L, WalletType.PLATFORM, null);
            when(walletService.getWalletById(10L)).thenReturn(w);
            when(walletService.getBalance(10L)).thenReturn(new BigDecimal("750.00"));

            ResponseEntity<WalletDto> response = controller.getBalance(10L);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().balance()).isEqualByComparingTo("750.00");
        }

        @Test
        void wrongOrg_throws() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(99L);
            Wallet w = wallet(10L, 1L, WalletType.PLATFORM, null);
            when(walletService.getWalletById(10L)).thenReturn(w);

            assertThatThrownBy(() -> controller.getBalance(10L))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Access denied");
        }
    }

    // ── getEntries ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getEntries")
    class GetEntries {
        @Test
        void returnsPagedEntries() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Wallet w = wallet(10L, 1L, WalletType.PLATFORM, null);
            when(walletService.getWalletById(10L)).thenReturn(w);

            LedgerEntry e1 = ledgerEntry(1L, LedgerEntryType.CREDIT,
                    new BigDecimal("100"), LedgerReferenceType.PAYMENT, "ref-1");
            Page<LedgerEntry> entries = new PageImpl<>(List.of(e1));
            Pageable pageable = PageRequest.of(0, 10);
            when(ledgerService.getEntries(eq(10L), any(Pageable.class))).thenReturn(entries);

            ResponseEntity<Page<LedgerEntryDto>> response = controller.getEntries(10L, pageable);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().getContent()).hasSize(1);
            assertThat(response.getBody().getContent().get(0).entryType()).isEqualTo("CREDIT");
        }

        @Test
        void wrongOrg_throws() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(99L);
            Wallet w = wallet(10L, 1L, WalletType.PLATFORM, null);
            when(walletService.getWalletById(10L)).thenReturn(w);

            assertThatThrownBy(() -> controller.getEntries(10L, PageRequest.of(0, 10)))
                    .isInstanceOf(RuntimeException.class);
        }
    }

    // ── initializeWallets ─────────────────────────────────────────────────

    @Nested
    @DisplayName("initializeWallets")
    class InitializeWallets {
        @Test
        void noPaidPayments_returnsZeroBackfilled() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Wallet platform = wallet(1L, 1L, WalletType.PLATFORM, null);
            Wallet escrow = wallet(2L, 1L, WalletType.ESCROW, null);
            when(walletService.getOrCreatePlatformWallet(1L, "EUR")).thenReturn(platform);
            when(walletService.getOrCreateEscrowWallet(1L, "EUR")).thenReturn(escrow);

            when(interventionRepository.findPaymentHistory(eq(PaymentStatus.PAID), isNull(), any(), eq(1L)))
                    .thenReturn(new PageImpl<>(List.of()));
            when(reservationRepository.findAllWithPayment(1L)).thenReturn(List.of());
            when(serviceRequestRepository.findAllAwaitingPayment(1L)).thenReturn(List.of());
            when(serviceRequestRepository.findAll()).thenReturn(List.of());
            when(walletService.getWalletsByOrganization(1L)).thenReturn(List.of(platform, escrow));

            ResponseEntity<Map<String, Object>> response = controller.initializeWallets();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().get("paymentsRecorded")).isEqualTo(0);
            assertThat(response.getBody().get("walletsCreated")).isEqualTo(2);
        }

        @Test
        void paidInterventionsWithoutLedger_backfills() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Wallet platform = wallet(1L, 1L, WalletType.PLATFORM, null);
            Wallet escrow = wallet(2L, 1L, WalletType.ESCROW, null);
            when(walletService.getOrCreatePlatformWallet(1L, "EUR")).thenReturn(platform);
            when(walletService.getOrCreateEscrowWallet(1L, "EUR")).thenReturn(escrow);

            User owner = new User();
            owner.setId(42L);
            Property prop = new Property();
            prop.setOwner(owner);

            Intervention paid = mock(Intervention.class);
            when(paid.getId()).thenReturn(5L);
            when(paid.getEstimatedCost()).thenReturn(new BigDecimal("100"));
            when(paid.getProperty()).thenReturn(prop);
            when(paid.getTitle()).thenReturn("Cleaning");
            when(interventionRepository.findPaymentHistory(eq(PaymentStatus.PAID), isNull(), any(), eq(1L)))
                    .thenReturn(new PageImpl<>(List.of(paid)));
            when(ledgerService.getEntriesByReference(LedgerReferenceType.PAYMENT, "5"))
                    .thenReturn(List.of());

            when(reservationRepository.findAllWithPayment(1L)).thenReturn(List.of());
            when(serviceRequestRepository.findAllAwaitingPayment(1L)).thenReturn(List.of());
            when(serviceRequestRepository.findAll()).thenReturn(List.of());
            when(walletService.getWalletsByOrganization(1L)).thenReturn(List.of(platform, escrow));

            ResponseEntity<Map<String, Object>> response = controller.initializeWallets();

            assertThat(response.getBody().get("paymentsRecorded")).isEqualTo(1);
            verify(walletService).getOrCreateWallet(1L, WalletType.OWNER, 42L, "EUR");
            verify(ledgerService).recordTransfer(eq(escrow), eq(platform),
                    eq(new BigDecimal("100")), eq(LedgerReferenceType.PAYMENT), eq("5"), anyString());
        }

        @Test
        void interventionWithExistingLedger_skipsBackfill() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Wallet platform = wallet(1L, 1L, WalletType.PLATFORM, null);
            Wallet escrow = wallet(2L, 1L, WalletType.ESCROW, null);
            when(walletService.getOrCreatePlatformWallet(1L, "EUR")).thenReturn(platform);
            when(walletService.getOrCreateEscrowWallet(1L, "EUR")).thenReturn(escrow);

            Intervention paid = mock(Intervention.class);
            when(paid.getId()).thenReturn(5L);
            when(paid.getEstimatedCost()).thenReturn(new BigDecimal("100"));
            when(interventionRepository.findPaymentHistory(eq(PaymentStatus.PAID), isNull(), any(), eq(1L)))
                    .thenReturn(new PageImpl<>(List.of(paid)));
            LedgerEntry existing = ledgerEntry(1L, LedgerEntryType.DEBIT, BigDecimal.TEN,
                    LedgerReferenceType.PAYMENT, "5");
            when(ledgerService.getEntriesByReference(LedgerReferenceType.PAYMENT, "5"))
                    .thenReturn(List.of(existing));

            when(reservationRepository.findAllWithPayment(1L)).thenReturn(List.of());
            when(serviceRequestRepository.findAllAwaitingPayment(1L)).thenReturn(List.of());
            when(serviceRequestRepository.findAll()).thenReturn(List.of());
            when(walletService.getWalletsByOrganization(1L)).thenReturn(List.of(platform, escrow));

            ResponseEntity<Map<String, Object>> response = controller.initializeWallets();

            assertThat(response.getBody().get("paymentsRecorded")).isEqualTo(0);
            verify(ledgerService, never()).recordTransfer(any(), any(), any(), any(), any(), anyString());
        }

        @Test
        void interventionWithZeroCost_skips() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Wallet platform = wallet(1L, 1L, WalletType.PLATFORM, null);
            Wallet escrow = wallet(2L, 1L, WalletType.ESCROW, null);
            when(walletService.getOrCreatePlatformWallet(1L, "EUR")).thenReturn(platform);
            when(walletService.getOrCreateEscrowWallet(1L, "EUR")).thenReturn(escrow);

            Intervention free = mock(Intervention.class);
            when(free.getEstimatedCost()).thenReturn(BigDecimal.ZERO);
            when(interventionRepository.findPaymentHistory(eq(PaymentStatus.PAID), isNull(), any(), eq(1L)))
                    .thenReturn(new PageImpl<>(List.of(free)));
            when(reservationRepository.findAllWithPayment(1L)).thenReturn(List.of());
            when(serviceRequestRepository.findAllAwaitingPayment(1L)).thenReturn(List.of());
            when(serviceRequestRepository.findAll()).thenReturn(List.of());
            when(walletService.getWalletsByOrganization(1L)).thenReturn(List.of(platform, escrow));

            ResponseEntity<Map<String, Object>> response = controller.initializeWallets();

            assertThat(response.getBody().get("paymentsRecorded")).isEqualTo(0);
        }

        @Test
        void paidReservationWithoutLedger_backfills() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Wallet platform = wallet(1L, 1L, WalletType.PLATFORM, null);
            Wallet escrow = wallet(2L, 1L, WalletType.ESCROW, null);
            when(walletService.getOrCreatePlatformWallet(1L, "EUR")).thenReturn(platform);
            when(walletService.getOrCreateEscrowWallet(1L, "EUR")).thenReturn(escrow);

            when(interventionRepository.findPaymentHistory(eq(PaymentStatus.PAID), isNull(), any(), eq(1L)))
                    .thenReturn(new PageImpl<>(List.of()));

            Reservation res = new Reservation();
            res.setId(7L);
            res.setPaymentStatus(PaymentStatus.PAID);
            res.setTotalPrice(new BigDecimal("250"));
            res.setGuestName("Alice");
            User resOwner = new User();
            resOwner.setId(50L);
            Property prop = new Property();
            prop.setOwner(resOwner);
            res.setProperty(prop);
            when(reservationRepository.findAllWithPayment(1L)).thenReturn(List.of(res));
            when(ledgerService.getEntriesByReference(LedgerReferenceType.PAYMENT, "7"))
                    .thenReturn(List.of());

            when(serviceRequestRepository.findAllAwaitingPayment(1L)).thenReturn(List.of());
            when(serviceRequestRepository.findAll()).thenReturn(List.of());
            when(walletService.getWalletsByOrganization(1L)).thenReturn(List.of(platform, escrow));

            ResponseEntity<Map<String, Object>> response = controller.initializeWallets();

            assertThat(response.getBody().get("paymentsRecorded")).isEqualTo(1);
            verify(walletService).getOrCreateWallet(1L, WalletType.OWNER, 50L, "EUR");
        }

        @Test
        void reservationWithNullGuestName_usesDefault() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Wallet platform = wallet(1L, 1L, WalletType.PLATFORM, null);
            Wallet escrow = wallet(2L, 1L, WalletType.ESCROW, null);
            when(walletService.getOrCreatePlatformWallet(1L, "EUR")).thenReturn(platform);
            when(walletService.getOrCreateEscrowWallet(1L, "EUR")).thenReturn(escrow);

            when(interventionRepository.findPaymentHistory(eq(PaymentStatus.PAID), isNull(), any(), eq(1L)))
                    .thenReturn(new PageImpl<>(List.of()));

            Reservation res = new Reservation();
            res.setId(8L);
            res.setPaymentStatus(PaymentStatus.PAID);
            res.setTotalPrice(new BigDecimal("100"));
            res.setGuestName(null);
            when(reservationRepository.findAllWithPayment(1L)).thenReturn(List.of(res));
            when(ledgerService.getEntriesByReference(LedgerReferenceType.PAYMENT, "8"))
                    .thenReturn(List.of());

            when(serviceRequestRepository.findAllAwaitingPayment(1L)).thenReturn(List.of());
            when(serviceRequestRepository.findAll()).thenReturn(List.of());
            when(walletService.getWalletsByOrganization(1L)).thenReturn(List.of());

            ResponseEntity<Map<String, Object>> response = controller.initializeWallets();

            assertThat(response.getBody().get("paymentsRecorded")).isEqualTo(1);
        }

        @Test
        void paidServiceRequestForCurrentOrg_backfills() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Wallet platform = wallet(1L, 1L, WalletType.PLATFORM, null);
            Wallet escrow = wallet(2L, 1L, WalletType.ESCROW, null);
            when(walletService.getOrCreatePlatformWallet(1L, "EUR")).thenReturn(platform);
            when(walletService.getOrCreateEscrowWallet(1L, "EUR")).thenReturn(escrow);

            when(interventionRepository.findPaymentHistory(eq(PaymentStatus.PAID), isNull(), any(), eq(1L)))
                    .thenReturn(new PageImpl<>(List.of()));
            when(reservationRepository.findAllWithPayment(1L)).thenReturn(List.of());
            when(serviceRequestRepository.findAllAwaitingPayment(1L)).thenReturn(List.of());

            ServiceRequest sr = mock(ServiceRequest.class);
            when(sr.getId()).thenReturn(9L);
            when(sr.getOrganizationId()).thenReturn(1L);
            when(sr.getPaymentStatus()).thenReturn(PaymentStatus.PAID);
            when(sr.getEstimatedCost()).thenReturn(new BigDecimal("80"));
            when(sr.getTitle()).thenReturn("Repair");
            when(serviceRequestRepository.findAll()).thenReturn(List.of(sr));
            when(ledgerService.getEntriesByReference(LedgerReferenceType.PAYMENT, "9"))
                    .thenReturn(List.of());
            when(walletService.getWalletsByOrganization(1L)).thenReturn(List.of());

            ResponseEntity<Map<String, Object>> response = controller.initializeWallets();

            assertThat(response.getBody().get("paymentsRecorded")).isEqualTo(1);
        }

        @Test
        void serviceRequestForOtherOrg_skipped() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Wallet platform = wallet(1L, 1L, WalletType.PLATFORM, null);
            Wallet escrow = wallet(2L, 1L, WalletType.ESCROW, null);
            when(walletService.getOrCreatePlatformWallet(1L, "EUR")).thenReturn(platform);
            when(walletService.getOrCreateEscrowWallet(1L, "EUR")).thenReturn(escrow);

            when(interventionRepository.findPaymentHistory(eq(PaymentStatus.PAID), isNull(), any(), eq(1L)))
                    .thenReturn(new PageImpl<>(List.of()));
            when(reservationRepository.findAllWithPayment(1L)).thenReturn(List.of());
            when(serviceRequestRepository.findAllAwaitingPayment(1L)).thenReturn(List.of());

            ServiceRequest other = mock(ServiceRequest.class);
            when(other.getOrganizationId()).thenReturn(99L);
            when(serviceRequestRepository.findAll()).thenReturn(List.of(other));
            when(walletService.getWalletsByOrganization(1L)).thenReturn(List.of());

            ResponseEntity<Map<String, Object>> response = controller.initializeWallets();

            assertThat(response.getBody().get("paymentsRecorded")).isEqualTo(0);
        }
    }
}
