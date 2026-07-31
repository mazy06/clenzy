package com.clenzy.service;

import com.clenzy.dto.SplitRatios;
import com.clenzy.dto.SplitResult;
import com.clenzy.model.LedgerReferenceType;
import com.clenzy.model.ManagementContract;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.SplitConfiguration;
import com.clenzy.model.Wallet;
import com.clenzy.model.WalletType;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.SplitConfigurationRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SplitPaymentServiceTest {

    @Mock private SplitConfigurationRepository splitConfigRepository;
    @Mock private ManagementContractService managementContractService;
    @Mock private ReservationRepository reservationRepository;
    @Mock private WalletService walletService;
    @Mock private LedgerService ledgerService;
    @Mock private com.clenzy.repository.LedgerEntryRepository ledgerEntryRepository;

    private TenantContext tenantContext;
    private SplitPaymentService service;
    private static final Long ORG_ID = 7L;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);
        service = new SplitPaymentService(splitConfigRepository, managementContractService,
                reservationRepository, walletService, ledgerService, ledgerEntryRepository,
                tenantContext);
    }

    /**
     * Audit 2026-07 (P5-05) — ESCROW_RELEASED arrive par Kafka, donc at-least-once. Le statut
     * de l'EscrowHold ne peut pas servir de garde : il vaut deja RELEASED quand l'evenement
     * est publie. Sans idempotence, un rejeu — y compris un simple redemarrage ou un timeout
     * de broker, sans aucun attaquant — recrediterait le wallet du proprietaire.
     */
    @Test
    @DisplayName("splitPayment : un rejeu n'ecrit aucune nouvelle ligne au ledger (P5-05)")
    void splitPayment_replayIsIdempotent() {
        when(ledgerEntryRepository.existsByReferenceTypeAndReferenceId(
                LedgerReferenceType.SPLIT, "SPLIT-RES-55")).thenReturn(true);

        var result = service.splitPayment(55L, new java.math.BigDecimal("100.00"), "EUR", 9L);

        assertThat(result.ownerAmount()).isEqualByComparingTo("0");
        verify(ledgerService, never()).recordTransfer(any(), any(), any(), any(), any(), any());
        verify(walletService, never()).getOrCreateWallet(any(), any(), any(), any());
    }

    private Wallet wallet(Long id, WalletType type) {
        Wallet w = new Wallet();
        w.setId(id);
        w.setOrganizationId(ORG_ID);
        w.setWalletType(type);
        return w;
    }

    private void stubDefaultWallets() {
        when(walletService.getOrCreatePlatformWallet(ORG_ID, "EUR")).thenReturn(wallet(1L, WalletType.PLATFORM));
        when(walletService.getOrCreateWallet(eq(ORG_ID), eq(WalletType.OWNER), any(), eq("EUR")))
                .thenReturn(wallet(2L, WalletType.OWNER));
        when(walletService.getOrCreateWallet(eq(ORG_ID), eq(WalletType.CONCIERGE), any(), eq("EUR")))
                .thenReturn(wallet(3L, WalletType.CONCIERGE));
    }

    // ─── splitPayment (reservation-based) ─────────────────────────────────

    @Nested
    @DisplayName("splitPayment")
    class SplitForReservation {
        @Test
        @DisplayName("uses defaults when no contract + no org config")
        void whenNoContract_thenUsesDefaults() {
            when(reservationRepository.findById(100L)).thenReturn(Optional.empty());
            when(splitConfigRepository.findByOrganizationIdAndIsDefaultTrue(ORG_ID))
                    .thenReturn(Optional.empty());
            stubDefaultWallets();

            SplitResult res = service.splitPayment(100L, new BigDecimal("100.00"), "EUR", 42L);

            assertThat(res.ownerAmount()).isEqualByComparingTo("80.00");
            assertThat(res.platformAmount()).isEqualByComparingTo("5.00");
            assertThat(res.conciergeAmount()).isEqualByComparingTo("15.00");
            verify(ledgerService, times(2)).recordTransfer(any(), any(), any(), eq(LedgerReferenceType.SPLIT), anyString(), anyString());
        }

        @Test
        @DisplayName("uses ManagementContract commissionRate when present")
        void whenContractExists_thenUsesCommissionRate() {
            Property prop = new Property();
            prop.setId(11L);
            Reservation r = new Reservation();
            r.setId(101L);
            r.setProperty(prop);
            when(reservationRepository.findById(101L)).thenReturn(Optional.of(r));

            ManagementContract contract = new ManagementContract();
            contract.setCommissionRate(new BigDecimal("0.20")); // 20%
            when(managementContractService.getActiveContract(11L, ORG_ID))
                    .thenReturn(Optional.of(contract));

            stubDefaultWallets();

            SplitResult res = service.splitPayment(101L, new BigDecimal("100.00"), "EUR", 42L);

            // ownerShare = 0.80, platform = 0.05 (25% of 0.20), concierge = 0.15
            assertThat(res.ownerAmount()).isEqualByComparingTo("80.00");
            assertThat(res.platformAmount()).isEqualByComparingTo("5.00");
            assertThat(res.conciergeAmount()).isEqualByComparingTo("15.00");
        }

        @Test
        @DisplayName("uses org split configuration when no contract")
        void whenContractMissing_thenUsesOrgConfig() {
            when(reservationRepository.findById(102L)).thenReturn(Optional.empty());
            SplitConfiguration cfg = new SplitConfiguration();
            cfg.setOwnerShare(new BigDecimal("0.7000"));
            cfg.setPlatformShare(new BigDecimal("0.1000"));
            cfg.setConciergeShare(new BigDecimal("0.2000"));
            when(splitConfigRepository.findByOrganizationIdAndIsDefaultTrue(ORG_ID))
                    .thenReturn(Optional.of(cfg));
            stubDefaultWallets();

            SplitResult res = service.splitPayment(102L, new BigDecimal("100.00"), "EUR", 42L);

            assertThat(res.ownerAmount()).isEqualByComparingTo("70.00");
            assertThat(res.platformAmount()).isEqualByComparingTo("10.00");
            assertThat(res.conciergeAmount()).isEqualByComparingTo("20.00");
        }

        @Test
        @DisplayName("repository throws is swallowed, falls back to org config")
        void whenRepositoryThrows_thenFallback() {
            when(reservationRepository.findById(199L)).thenThrow(new RuntimeException("DB error"));
            when(splitConfigRepository.findByOrganizationIdAndIsDefaultTrue(ORG_ID))
                    .thenReturn(Optional.empty());
            stubDefaultWallets();

            SplitResult res = service.splitPayment(199L, new BigDecimal("100.00"), "EUR", 42L);

            assertThat(res.totalAmount()).isEqualByComparingTo("100.00");
        }

        @Test
        @DisplayName("zero owner share skips ledger transfer for owner")
        void whenZeroOwnerShare_thenSkipsOwnerTransfer() {
            when(reservationRepository.findById(103L)).thenReturn(Optional.empty());
            SplitConfiguration cfg = new SplitConfiguration();
            cfg.setOwnerShare(BigDecimal.ZERO);
            cfg.setPlatformShare(new BigDecimal("0.5000"));
            cfg.setConciergeShare(new BigDecimal("0.5000"));
            when(splitConfigRepository.findByOrganizationIdAndIsDefaultTrue(ORG_ID))
                    .thenReturn(Optional.of(cfg));
            stubDefaultWallets();

            SplitResult res = service.splitPayment(103L, new BigDecimal("100.00"), "EUR", 42L);

            assertThat(res.ownerAmount()).isEqualByComparingTo("0.00");
            // 1 transfer instead of 2 (concierge only)
            verify(ledgerService, times(1)).recordTransfer(any(), any(), any(), any(), anyString(), anyString());
        }

        @Test
        @DisplayName("contract with null commissionRate falls back to defaults")
        void whenContractWithNullCommission_thenFallback() {
            Property prop = new Property();
            prop.setId(11L);
            Reservation r = new Reservation();
            r.setProperty(prop);
            when(reservationRepository.findById(104L)).thenReturn(Optional.of(r));
            ManagementContract contract = new ManagementContract();
            contract.setCommissionRate(null);
            when(managementContractService.getActiveContract(11L, ORG_ID))
                    .thenReturn(Optional.of(contract));
            when(splitConfigRepository.findByOrganizationIdAndIsDefaultTrue(ORG_ID))
                    .thenReturn(Optional.empty());
            stubDefaultWallets();

            SplitResult res = service.splitPayment(104L, new BigDecimal("100.00"), "EUR", 42L);

            assertThat(res.ownerAmount()).isEqualByComparingTo("80.00");
        }
    }

    // ─── splitGenericPayment ──────────────────────────────────────────────

    @Nested
    @DisplayName("splitGenericPayment")
    class SplitGenericPayment {
        @Test
        @DisplayName("splits intervention amount with defaults when no property")
        void whenNoProperty_thenDefaults() {
            when(splitConfigRepository.findByOrganizationIdAndIsDefaultTrue(ORG_ID))
                    .thenReturn(Optional.empty());
            stubDefaultWallets();

            SplitResult res = service.splitGenericPayment(new BigDecimal("100.00"), "EUR",
                    42L, null, "intervention", "55");

            assertThat(res.totalAmount()).isEqualByComparingTo("100.00");
            assertThat(res.ownerAmount()).isEqualByComparingTo("80.00");
            assertThat(res.platformAmount()).isEqualByComparingTo("5.00");
            assertThat(res.conciergeAmount()).isEqualByComparingTo("15.00");
        }

        @Test
        @DisplayName("null ownerId skips owner wallet + owner transfer")
        void whenNoOwnerId_thenSkipsOwnerTransfer() {
            when(splitConfigRepository.findByOrganizationIdAndIsDefaultTrue(ORG_ID))
                    .thenReturn(Optional.empty());
            when(walletService.getOrCreatePlatformWallet(ORG_ID, "EUR")).thenReturn(wallet(1L, WalletType.PLATFORM));
            when(walletService.getOrCreateWallet(ORG_ID, WalletType.CONCIERGE, null, "EUR"))
                    .thenReturn(wallet(3L, WalletType.CONCIERGE));

            SplitResult res = service.splitGenericPayment(new BigDecimal("100.00"), "EUR",
                    null, null, "intervention", "56");

            assertThat(res.ownerWalletId()).isNull();
            verify(walletService, never()).getOrCreateWallet(eq(ORG_ID), eq(WalletType.OWNER), any(), anyString());
        }

        @Test
        @DisplayName("uses ManagementContract for property when present")
        void whenPropertyHasContract_thenUsesIt() {
            ManagementContract contract = new ManagementContract();
            contract.setCommissionRate(new BigDecimal("0.30"));
            when(managementContractService.getActiveContract(11L, ORG_ID))
                    .thenReturn(Optional.of(contract));
            stubDefaultWallets();

            SplitResult res = service.splitGenericPayment(new BigDecimal("100.00"), "EUR",
                    42L, 11L, "service-request", "12");

            // owner = 0.70, platform = 0.075 → rounded to 0.08
            // 0.30 × 0.25 = 0.075 → setScale(4, HALF_UP) = 0.0750
            // platformAmount = 100 × 0.0750 = 7.50
            assertThat(res.ownerAmount()).isEqualByComparingTo("70.00");
            assertThat(res.platformAmount()).isEqualByComparingTo("7.50");
            // remainder
            assertThat(res.conciergeAmount()).isEqualByComparingTo("22.50");
        }

        @Test
        @DisplayName("manager contract lookup throws — fallback to defaults")
        void whenContractLookupFails_thenFallback() {
            when(managementContractService.getActiveContract(11L, ORG_ID))
                    .thenThrow(new RuntimeException("DB down"));
            when(splitConfigRepository.findByOrganizationIdAndIsDefaultTrue(ORG_ID))
                    .thenReturn(Optional.empty());
            stubDefaultWallets();

            SplitResult res = service.splitGenericPayment(new BigDecimal("100.00"), "EUR",
                    42L, 11L, "intervention", "X");

            assertThat(res.ownerAmount()).isEqualByComparingTo("80.00");
        }

        @Test
        @DisplayName("no contract for property — fallback to org config")
        void whenNoContract_thenOrgConfig() {
            when(managementContractService.getActiveContract(11L, ORG_ID))
                    .thenReturn(Optional.empty());
            SplitConfiguration cfg = new SplitConfiguration();
            cfg.setOwnerShare(new BigDecimal("0.9500"));
            cfg.setPlatformShare(new BigDecimal("0.0500"));
            cfg.setConciergeShare(BigDecimal.ZERO);
            when(splitConfigRepository.findByOrganizationIdAndIsDefaultTrue(ORG_ID))
                    .thenReturn(Optional.of(cfg));
            stubDefaultWallets();

            SplitResult res = service.splitGenericPayment(new BigDecimal("200.00"), "EUR",
                    42L, 11L, "intervention", "Z");

            assertThat(res.ownerAmount()).isEqualByComparingTo("190.00");
            assertThat(res.platformAmount()).isEqualByComparingTo("10.00");
            assertThat(res.conciergeAmount()).isEqualByComparingTo("0.00");
        }
    }

    // ─── resolveSplitRatios ───────────────────────────────────────────────

    @Nested
    @DisplayName("resolveSplitRatios(orgId)")
    class ResolveSplitRatios {
        @Test
        @DisplayName("returns DEFAULT when no config")
        void whenNoConfig_thenReturnsDefault() {
            when(splitConfigRepository.findByOrganizationIdAndIsDefaultTrue(ORG_ID))
                    .thenReturn(Optional.empty());

            SplitRatios r = service.resolveSplitRatios(ORG_ID);

            assertThat(r).isEqualTo(SplitRatios.DEFAULT);
        }

        @Test
        @DisplayName("returns org-configured ratios when present")
        void whenConfig_thenReturnsOrg() {
            SplitConfiguration cfg = new SplitConfiguration();
            cfg.setOwnerShare(new BigDecimal("0.60"));
            cfg.setPlatformShare(new BigDecimal("0.20"));
            cfg.setConciergeShare(new BigDecimal("0.20"));
            when(splitConfigRepository.findByOrganizationIdAndIsDefaultTrue(ORG_ID))
                    .thenReturn(Optional.of(cfg));

            SplitRatios r = service.resolveSplitRatios(ORG_ID);

            assertThat(r.ownerShare()).isEqualByComparingTo("0.60");
        }
    }

    @Nested
    @DisplayName("resolveSplitRatios(orgId, reservationId)")
    class ResolveSplitRatiosByReservation {
        @Test
        @DisplayName("null reservationId returns org config")
        void whenNullReservationId_thenOrgConfig() {
            when(splitConfigRepository.findByOrganizationIdAndIsDefaultTrue(ORG_ID))
                    .thenReturn(Optional.empty());

            SplitRatios r = service.resolveSplitRatios(ORG_ID, null);

            assertThat(r).isEqualTo(SplitRatios.DEFAULT);
        }

        @Test
        @DisplayName("reservation with property without contract falls back to org config")
        void whenNoContract_thenOrgConfig() {
            Reservation r = new Reservation();
            Property p = new Property();
            p.setId(11L);
            r.setProperty(p);
            when(reservationRepository.findById(50L)).thenReturn(Optional.of(r));
            when(managementContractService.getActiveContract(11L, ORG_ID)).thenReturn(Optional.empty());
            when(splitConfigRepository.findByOrganizationIdAndIsDefaultTrue(ORG_ID))
                    .thenReturn(Optional.empty());

            SplitRatios ratios = service.resolveSplitRatios(ORG_ID, 50L);
            assertThat(ratios).isEqualTo(SplitRatios.DEFAULT);
        }

        @Test
        @DisplayName("reservation without property — fallback")
        void whenNoProperty_thenFallback() {
            Reservation r = new Reservation();
            r.setProperty(null);
            when(reservationRepository.findById(50L)).thenReturn(Optional.of(r));
            when(splitConfigRepository.findByOrganizationIdAndIsDefaultTrue(ORG_ID))
                    .thenReturn(Optional.empty());

            SplitRatios ratios = service.resolveSplitRatios(ORG_ID, 50L);
            assertThat(ratios).isEqualTo(SplitRatios.DEFAULT);
        }
    }

    @Nested
    @DisplayName("resolveSplitRatiosForProperty")
    class ResolveByProperty {

        @Test
        @DisplayName("la commission du contrat se scinde selon le ratio configure, pas 25/75")
        void whenContractAndOrgRatio_thenSplitFollowsConfiguration() {
            // 1 % plateforme / 19 % conciergerie → la commission se scinde 5/95.
            SplitConfiguration cfg = new SplitConfiguration();
            cfg.setOwnerShare(new BigDecimal("0.8000"));
            cfg.setPlatformShare(new BigDecimal("0.0100"));
            cfg.setConciergeShare(new BigDecimal("0.1900"));
            when(splitConfigRepository.findByOrganizationIdAndIsDefaultTrue(ORG_ID))
                    .thenReturn(Optional.of(cfg));

            ManagementContract contract = new ManagementContract();
            contract.setCommissionRate(new BigDecimal("0.20"));
            when(managementContractService.getActiveContract(11L, ORG_ID))
                    .thenReturn(Optional.of(contract));

            SplitRatios r = service.resolveSplitRatiosForProperty(ORG_ID, 11L);

            // 0.20 × (0.01 / 0.20) = 0.01 — et non 0.05 comme avec l'ancien 25/75.
            assertThat(r.ownerShare()).isEqualByComparingTo("0.80");
            assertThat(r.platformShare()).isEqualByComparingTo("0.0100");
            assertThat(r.conciergeShare()).isEqualByComparingTo("0.1900");
        }

        @Test
        @DisplayName("sans configuration, le partage reste celui d'avant")
        void whenContractAndNoConfiguration_thenLegacySplitIsPreserved() {
            // Les defauts (5 / 15) portent deja le ratio 25/75 : le comportement
            // historique ne bouge pas pour qui n'a rien configure.
            when(splitConfigRepository.findByOrganizationIdAndIsDefaultTrue(ORG_ID))
                    .thenReturn(Optional.empty());

            ManagementContract contract = new ManagementContract();
            contract.setCommissionRate(new BigDecimal("0.20"));
            when(managementContractService.getActiveContract(11L, ORG_ID))
                    .thenReturn(Optional.of(contract));

            SplitRatios r = service.resolveSplitRatiosForProperty(ORG_ID, 11L);

            assertThat(r.platformShare()).isEqualByComparingTo("0.0500");
            assertThat(r.conciergeShare()).isEqualByComparingTo("0.1500");
        }

        @Test
        @DisplayName("configuration sans prelevement : repli sur 25/75 plutot qu'une division par zero")
        void whenConfigurationTakesNothing_thenFallsBackWithoutDividingByZero() {
            SplitConfiguration cfg = new SplitConfiguration();
            cfg.setOwnerShare(new BigDecimal("1.0000"));
            cfg.setPlatformShare(BigDecimal.ZERO);
            cfg.setConciergeShare(BigDecimal.ZERO);
            when(splitConfigRepository.findByOrganizationIdAndIsDefaultTrue(ORG_ID))
                    .thenReturn(Optional.of(cfg));

            ManagementContract contract = new ManagementContract();
            contract.setCommissionRate(new BigDecimal("0.20"));
            when(managementContractService.getActiveContract(11L, ORG_ID))
                    .thenReturn(Optional.of(contract));

            SplitRatios r = service.resolveSplitRatiosForProperty(ORG_ID, 11L);

            assertThat(r.platformShare()).isEqualByComparingTo("0.0500");
            assertThat(r.conciergeShare()).isEqualByComparingTo("0.1500");
        }

        @Test
        @DisplayName("les trois parts retombent exactement sur 1, quel que soit le ratio")
        void whenRatioDoesNotDivideEvenly_thenSharesStillSumToOne() {
            // 1/3 : la scission ne tombe pas juste, le solde doit absorber l'arrondi.
            SplitConfiguration cfg = new SplitConfiguration();
            cfg.setOwnerShare(new BigDecimal("0.7000"));
            cfg.setPlatformShare(new BigDecimal("0.1000"));
            cfg.setConciergeShare(new BigDecimal("0.2000"));
            when(splitConfigRepository.findByOrganizationIdAndIsDefaultTrue(ORG_ID))
                    .thenReturn(Optional.of(cfg));

            ManagementContract contract = new ManagementContract();
            contract.setCommissionRate(new BigDecimal("0.17"));
            when(managementContractService.getActiveContract(11L, ORG_ID))
                    .thenReturn(Optional.of(contract));

            SplitRatios r = service.resolveSplitRatiosForProperty(ORG_ID, 11L);

            assertThat(r.ownerShare().add(r.platformShare()).add(r.conciergeShare()))
                    .isEqualByComparingTo("1");
        }

        @Test
        @DisplayName("null propertyId returns org config")
        void whenNullPropertyId_thenOrg() {
            when(splitConfigRepository.findByOrganizationIdAndIsDefaultTrue(ORG_ID))
                    .thenReturn(Optional.empty());

            SplitRatios r = service.resolveSplitRatiosForProperty(ORG_ID, null);

            assertThat(r).isEqualTo(SplitRatios.DEFAULT);
        }

        @Test
        @DisplayName("property with contract returns commission-based ratios")
        void whenContract_thenRatios() {
            ManagementContract contract = new ManagementContract();
            contract.setCommissionRate(new BigDecimal("0.20"));
            when(managementContractService.getActiveContract(11L, ORG_ID))
                    .thenReturn(Optional.of(contract));

            SplitRatios r = service.resolveSplitRatiosForProperty(ORG_ID, 11L);

            assertThat(r.ownerShare()).isEqualByComparingTo("0.80");
            assertThat(r.platformShare()).isEqualByComparingTo("0.0500");
            assertThat(r.conciergeShare()).isEqualByComparingTo("0.1500");
        }

        @Test
        @DisplayName("contract throws — fallback to org config")
        void whenContractThrows_thenFallback() {
            when(managementContractService.getActiveContract(11L, ORG_ID))
                    .thenThrow(new RuntimeException("oops"));
            when(splitConfigRepository.findByOrganizationIdAndIsDefaultTrue(ORG_ID))
                    .thenReturn(Optional.empty());

            SplitRatios r = service.resolveSplitRatiosForProperty(ORG_ID, 11L);

            assertThat(r).isEqualTo(SplitRatios.DEFAULT);
        }
    }
}
