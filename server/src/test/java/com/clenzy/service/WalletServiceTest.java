package com.clenzy.service;

import com.clenzy.model.Intervention;
import com.clenzy.model.LedgerReferenceType;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.ServiceRequest;
import com.clenzy.model.User;
import com.clenzy.model.Wallet;
import com.clenzy.model.WalletType;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.WalletRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WalletServiceTest {

    @Mock private WalletRepository walletRepository;
    @Mock private LedgerService ledgerService;
    @Mock private InterventionRepository interventionRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private ServiceRequestRepository serviceRequestRepository;
    @Mock private TenantContext tenantContext;

    private WalletService service;

    @BeforeEach
    void setUp() {
        service = new WalletService(walletRepository, ledgerService,
                interventionRepository, reservationRepository, serviceRequestRepository,
                tenantContext);
    }

    private Wallet buildWallet(Long id, Long orgId, WalletType type, Long ownerId) {
        Wallet w = new Wallet();
        w.setId(id);
        w.setOrganizationId(orgId);
        w.setWalletType(type);
        w.setOwnerId(ownerId);
        w.setCurrency("EUR");
        return w;
    }

    @Nested
    @DisplayName("getOrCreateWallet - with owner")
    class GetOrCreateWithOwner {

        @Test
        @DisplayName("returns existing wallet when found")
        void existingWallet_returns() {
            Wallet existing = buildWallet(1L, 100L, WalletType.OWNER, 5L);
            when(walletRepository.findByOrganizationIdAndWalletTypeAndOwnerIdAndCurrency(
                    100L, WalletType.OWNER, 5L, "EUR"))
                    .thenReturn(Optional.of(existing));

            Wallet result = service.getOrCreateWallet(100L, WalletType.OWNER, 5L, "EUR");

            assertThat(result).isSameAs(existing);
            verify(walletRepository, never()).save(any());
        }

        @Test
        @DisplayName("creates new wallet when missing")
        void newWallet_creates() {
            when(walletRepository.findByOrganizationIdAndWalletTypeAndOwnerIdAndCurrency(
                    100L, WalletType.OWNER, 5L, "EUR"))
                    .thenReturn(Optional.empty());
            when(walletRepository.save(any(Wallet.class))).thenAnswer(inv -> {
                Wallet w = inv.getArgument(0);
                w.setId(99L);
                return w;
            });

            Wallet result = service.getOrCreateWallet(100L, WalletType.OWNER, 5L, "EUR");

            assertThat(result.getId()).isEqualTo(99L);
            assertThat(result.getOrganizationId()).isEqualTo(100L);
            assertThat(result.getWalletType()).isEqualTo(WalletType.OWNER);
            assertThat(result.getOwnerId()).isEqualTo(5L);
            assertThat(result.getCurrency()).isEqualTo("EUR");
        }

        @Test
        @DisplayName("does not call ledger when creating")
        void newWallet_noLedgerCall() {
            when(walletRepository.findByOrganizationIdAndWalletTypeAndOwnerIdAndCurrency(
                    100L, WalletType.OWNER, 5L, "EUR"))
                    .thenReturn(Optional.empty());
            when(walletRepository.save(any(Wallet.class))).thenAnswer(inv -> inv.getArgument(0));

            service.getOrCreateWallet(100L, WalletType.OWNER, 5L, "EUR");

            verifyNoInteractions(ledgerService);
        }
    }

    @Nested
    @DisplayName("getOrCreateWallet - without owner (PLATFORM/ESCROW)")
    class GetOrCreateWithoutOwner {

        @Test
        @DisplayName("uses no-owner repository method when ownerId is null")
        void noOwner_usesNoOwnerMethod() {
            Wallet existing = buildWallet(1L, 100L, WalletType.PLATFORM, null);
            when(walletRepository.findByOrganizationIdAndWalletTypeAndOwnerIdIsNullAndCurrency(
                    100L, WalletType.PLATFORM, "EUR"))
                    .thenReturn(Optional.of(existing));

            Wallet result = service.getOrCreateWallet(100L, WalletType.PLATFORM, null, "EUR");

            assertThat(result).isSameAs(existing);
        }

        @Test
        @DisplayName("creates new no-owner wallet when missing")
        void noOwner_creates() {
            when(walletRepository.findByOrganizationIdAndWalletTypeAndOwnerIdIsNullAndCurrency(
                    100L, WalletType.ESCROW, "EUR"))
                    .thenReturn(Optional.empty());
            when(walletRepository.save(any(Wallet.class))).thenAnswer(inv -> {
                Wallet w = inv.getArgument(0);
                w.setId(50L);
                return w;
            });

            Wallet result = service.getOrCreateWallet(100L, WalletType.ESCROW, null, "EUR");

            assertThat(result.getId()).isEqualTo(50L);
            assertThat(result.getOwnerId()).isNull();
        }
    }

    @Nested
    @DisplayName("convenience methods")
    class Convenience {

        @Test
        @DisplayName("getOrCreatePlatformWallet delegates with PLATFORM type and null owner")
        void platform_delegates() {
            when(walletRepository.findByOrganizationIdAndWalletTypeAndOwnerIdIsNullAndCurrency(
                    100L, WalletType.PLATFORM, "USD"))
                    .thenReturn(Optional.empty());
            when(walletRepository.save(any(Wallet.class))).thenAnswer(inv -> inv.getArgument(0));

            Wallet w = service.getOrCreatePlatformWallet(100L, "USD");

            assertThat(w.getWalletType()).isEqualTo(WalletType.PLATFORM);
            assertThat(w.getOwnerId()).isNull();
        }

        @Test
        @DisplayName("getOrCreateEscrowWallet delegates with ESCROW type and null owner")
        void escrow_delegates() {
            when(walletRepository.findByOrganizationIdAndWalletTypeAndOwnerIdIsNullAndCurrency(
                    100L, WalletType.ESCROW, "EUR"))
                    .thenReturn(Optional.empty());
            when(walletRepository.save(any(Wallet.class))).thenAnswer(inv -> inv.getArgument(0));

            Wallet w = service.getOrCreateEscrowWallet(100L, "EUR");

            assertThat(w.getWalletType()).isEqualTo(WalletType.ESCROW);
            assertThat(w.getOwnerId()).isNull();
        }
    }

    @Nested
    @DisplayName("getBalance")
    class GetBalance {

        @Test
        @DisplayName("returns ledger calculated balance")
        void normalBalance() {
            when(ledgerService.calculateBalance(1L)).thenReturn(new BigDecimal("123.45"));

            BigDecimal balance = service.getBalance(1L);

            assertThat(balance).isEqualByComparingTo("123.45");
        }

        @Test
        @DisplayName("returns ZERO when ledger returns null")
        void nullBalance_returnsZero() {
            when(ledgerService.calculateBalance(1L)).thenReturn(null);

            BigDecimal balance = service.getBalance(1L);

            assertThat(balance).isEqualByComparingTo(BigDecimal.ZERO);
        }
    }

    @Nested
    @DisplayName("getWalletsByOrganization")
    class GetWalletsByOrg {

        @Test
        @DisplayName("delegates to repository")
        void delegates() {
            List<Wallet> list = List.of(
                    buildWallet(1L, 100L, WalletType.PLATFORM, null),
                    buildWallet(2L, 100L, WalletType.OWNER, 5L)
            );
            when(walletRepository.findByOrganizationId(100L)).thenReturn(list);

            List<Wallet> result = service.getWalletsByOrganization(100L);

            assertThat(result).hasSize(2);
        }

        @Test
        @DisplayName("returns empty list when no wallets")
        void empty() {
            when(walletRepository.findByOrganizationId(100L)).thenReturn(List.of());

            assertThat(service.getWalletsByOrganization(100L)).isEmpty();
        }
    }

    @Nested
    @DisplayName("getWalletById")
    class GetWalletById {

        @Test
        @DisplayName("returns wallet when found")
        void found() {
            Wallet w = buildWallet(1L, 100L, WalletType.PLATFORM, null);
            when(walletRepository.findById(1L)).thenReturn(Optional.of(w));

            Wallet result = service.getWalletById(1L);

            assertThat(result).isSameAs(w);
        }

        @Test
        @DisplayName("throws when wallet not found")
        void notFound_throws() {
            when(walletRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.getWalletById(99L))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("not found");
        }
    }

    // ── initializeWallets (backfill deplace de WalletController, T-ARCH-03) ──

    @Nested
    @DisplayName("initializeWallets")
    class InitializeWallets {

        private final Wallet platform = buildWallet(1L, 1L, WalletType.PLATFORM, null);
        private final Wallet escrow = buildWallet(2L, 1L, WalletType.ESCROW, null);

        /**
         * Stubs communs : wallets de base existants + aucune source de paiement.
         * lenient() car chaque test surcharge la source qui le concerne.
         */
        private void setupBaseWalletsAndEmptySources() {
            lenient().when(walletRepository.findByOrganizationIdAndWalletTypeAndOwnerIdIsNullAndCurrency(
                    1L, WalletType.PLATFORM, "EUR")).thenReturn(Optional.of(platform));
            lenient().when(walletRepository.findByOrganizationIdAndWalletTypeAndOwnerIdIsNullAndCurrency(
                    1L, WalletType.ESCROW, "EUR")).thenReturn(Optional.of(escrow));
            lenient().when(interventionRepository.findPaymentHistory(eq(PaymentStatus.PAID), isNull(), any(), eq(1L)))
                    .thenReturn(new PageImpl<>(List.of()));
            lenient().when(reservationRepository.findPaidWithOwnerForWalletBackfill(1L)).thenReturn(List.of());
            lenient().when(serviceRequestRepository.findByOrganizationIdAndPaymentStatus(1L, PaymentStatus.PAID))
                    .thenReturn(List.<ServiceRequest>of());
            lenient().when(walletRepository.findByOrganizationId(1L)).thenReturn(List.of(platform, escrow));
        }

        @Test
        void whenNoPaidPayments_thenZeroBackfilled() {
            setupBaseWalletsAndEmptySources();

            WalletService.WalletInitializationResult result = service.initializeWallets(1L);

            assertThat(result.paymentsRecorded()).isEqualTo(0);
            assertThat(result.walletsCreated()).isEqualTo(2);
            verify(ledgerService, never()).recordTransfer(any(), any(), any(), any(), any(), anyString());
        }

        @Test
        void whenPaidInterventionWithoutLedger_thenBackfillsTransferAndOwnerWallet() {
            setupBaseWalletsAndEmptySources();

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
            when(ledgerService.hasEntriesForReference(LedgerReferenceType.PAYMENT, "5"))
                    .thenReturn(false);
            Wallet ownerWallet = buildWallet(10L, 1L, WalletType.OWNER, 42L);
            when(walletRepository.findByOrganizationIdAndWalletTypeAndOwnerIdAndCurrency(
                    1L, WalletType.OWNER, 42L, "EUR")).thenReturn(Optional.of(ownerWallet));

            WalletService.WalletInitializationResult result = service.initializeWallets(1L);

            assertThat(result.paymentsRecorded()).isEqualTo(1);
            verify(walletRepository).findByOrganizationIdAndWalletTypeAndOwnerIdAndCurrency(
                    1L, WalletType.OWNER, 42L, "EUR");
            verify(ledgerService).recordTransfer(eq(escrow), eq(platform),
                    eq(new BigDecimal("100")), eq(LedgerReferenceType.PAYMENT), eq("5"), anyString());
        }

        @Test
        void whenInterventionAlreadyInLedger_thenSkipsBackfill() {
            setupBaseWalletsAndEmptySources();

            Intervention paid = mock(Intervention.class);
            when(paid.getId()).thenReturn(5L);
            when(paid.getEstimatedCost()).thenReturn(new BigDecimal("100"));
            when(interventionRepository.findPaymentHistory(eq(PaymentStatus.PAID), isNull(), any(), eq(1L)))
                    .thenReturn(new PageImpl<>(List.of(paid)));
            when(ledgerService.hasEntriesForReference(LedgerReferenceType.PAYMENT, "5"))
                    .thenReturn(true);

            WalletService.WalletInitializationResult result = service.initializeWallets(1L);

            assertThat(result.paymentsRecorded()).isEqualTo(0);
            verify(ledgerService, never()).recordTransfer(any(), any(), any(), any(), any(), anyString());
        }

        @Test
        void whenInterventionZeroCost_thenSkips() {
            setupBaseWalletsAndEmptySources();

            Intervention free = mock(Intervention.class);
            when(free.getEstimatedCost()).thenReturn(BigDecimal.ZERO);
            when(interventionRepository.findPaymentHistory(eq(PaymentStatus.PAID), isNull(), any(), eq(1L)))
                    .thenReturn(new PageImpl<>(List.of(free)));

            WalletService.WalletInitializationResult result = service.initializeWallets(1L);

            assertThat(result.paymentsRecorded()).isEqualTo(0);
            verify(ledgerService, never()).recordTransfer(any(), any(), any(), any(), any(), anyString());
        }

        @Test
        void whenPaidReservationWithoutLedger_thenBackfillsAndEnsuresOwnerWallet() {
            setupBaseWalletsAndEmptySources();

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
            when(reservationRepository.findPaidWithOwnerForWalletBackfill(1L)).thenReturn(List.of(res));
            when(ledgerService.hasEntriesForReference(LedgerReferenceType.PAYMENT, "7"))
                    .thenReturn(false);
            Wallet ownerWallet = buildWallet(11L, 1L, WalletType.OWNER, 50L);
            when(walletRepository.findByOrganizationIdAndWalletTypeAndOwnerIdAndCurrency(
                    1L, WalletType.OWNER, 50L, "EUR")).thenReturn(Optional.of(ownerWallet));

            WalletService.WalletInitializationResult result = service.initializeWallets(1L);

            assertThat(result.paymentsRecorded()).isEqualTo(1);
            verify(walletRepository).findByOrganizationIdAndWalletTypeAndOwnerIdAndCurrency(
                    1L, WalletType.OWNER, 50L, "EUR");
            verify(ledgerService).recordTransfer(eq(escrow), eq(platform),
                    eq(new BigDecimal("250")), eq(LedgerReferenceType.PAYMENT), eq("7"), anyString());
        }

        @Test
        void whenReservationGuestNameNull_thenUsesDefaultLabel() {
            setupBaseWalletsAndEmptySources();

            Reservation res = new Reservation();
            res.setId(8L);
            res.setPaymentStatus(PaymentStatus.PAID);
            res.setTotalPrice(new BigDecimal("100"));
            res.setGuestName(null);
            when(reservationRepository.findPaidWithOwnerForWalletBackfill(1L)).thenReturn(List.of(res));
            when(ledgerService.hasEntriesForReference(LedgerReferenceType.PAYMENT, "8"))
                    .thenReturn(false);

            WalletService.WalletInitializationResult result = service.initializeWallets(1L);

            assertThat(result.paymentsRecorded()).isEqualTo(1);
            ArgumentCaptor<String> description = ArgumentCaptor.forClass(String.class);
            verify(ledgerService).recordTransfer(eq(escrow), eq(platform),
                    eq(new BigDecimal("100")), eq(LedgerReferenceType.PAYMENT), eq("8"),
                    description.capture());
            assertThat(description.getValue()).contains("guest");
        }

        @Test
        void whenPaidServiceRequestForCurrentOrg_thenBackfills() {
            setupBaseWalletsAndEmptySources();

            ServiceRequest sr = mock(ServiceRequest.class);
            when(sr.getId()).thenReturn(9L);
            when(sr.getEstimatedCost()).thenReturn(new BigDecimal("80"));
            when(sr.getTitle()).thenReturn("Repair");
            when(serviceRequestRepository.findByOrganizationIdAndPaymentStatus(1L, PaymentStatus.PAID))
                    .thenReturn(List.of(sr));
            when(ledgerService.hasEntriesForReference(LedgerReferenceType.PAYMENT, "9"))
                    .thenReturn(false);

            WalletService.WalletInitializationResult result = service.initializeWallets(1L);

            assertThat(result.paymentsRecorded()).isEqualTo(1);
            verify(ledgerService).recordTransfer(eq(escrow), eq(platform),
                    eq(new BigDecimal("80")), eq(LedgerReferenceType.PAYMENT), eq("9"), anyString());
        }

        @Test
        void whenServiceRequestBelongsToOtherOrg_thenSkipped() {
            setupBaseWalletsAndEmptySources();

            // Le scoping org est desormais fait en SQL : la requete est emise pour
            // l'org courante uniquement, une SR d'une autre org n'est jamais chargee.
            WalletService.WalletInitializationResult result = service.initializeWallets(1L);

            assertThat(result.paymentsRecorded()).isEqualTo(0);
            verify(serviceRequestRepository).findByOrganizationIdAndPaymentStatus(1L, PaymentStatus.PAID);
            verify(serviceRequestRepository, never()).findAll();
            verify(ledgerService, never()).recordTransfer(any(), any(), any(), any(), any(), anyString());
        }
    }
}
