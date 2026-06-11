package com.clenzy.controller;

import com.clenzy.dto.LedgerEntryDto;
import com.clenzy.dto.WalletDto;
import com.clenzy.model.*;
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
    @Mock private TenantContext tenantContext;

    private WalletController controller;

    @BeforeEach
    void setUp() {
        controller = new WalletController(walletService, ledgerService, tenantContext);
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

    // NOTE : les tests de la logique de backfill (interventions, reservations,
    // service requests, idempotence ledger) ont ete deplaces dans
    // com.clenzy.service.WalletServiceTest suite au refactor T-ARCH-03
    // (la logique vit desormais dans WalletService.initializeWallets, @Transactional).

    @Nested
    @DisplayName("initializeWallets")
    class InitializeWallets {
        @Test
        void noPaidPayments_returnsZeroBackfilled() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(walletService.initializeWallets(1L))
                    .thenReturn(new WalletService.WalletInitializationResult(2, 0));

            ResponseEntity<Map<String, Object>> response = controller.initializeWallets();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().get("paymentsRecorded")).isEqualTo(0);
            assertThat(response.getBody().get("walletsCreated")).isEqualTo(2);
        }

        @Test
        void whenInitialized_thenDelegatesWithCurrentOrgId() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(42L);
            when(walletService.initializeWallets(42L))
                    .thenReturn(new WalletService.WalletInitializationResult(3, 5));

            ResponseEntity<Map<String, Object>> response = controller.initializeWallets();

            assertThat(response.getBody().get("paymentsRecorded")).isEqualTo(5);
            assertThat(response.getBody().get("walletsCreated")).isEqualTo(3);
            verify(walletService).initializeWallets(42L);
        }
    }
}
