package com.clenzy.controller;

import com.clenzy.dto.OwnerPayoutDto;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.ChannelCommission;
import com.clenzy.model.Organization;
import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.model.User;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.AccountingService;
import com.clenzy.service.OwnerStatementService;
import com.clenzy.service.PayoutExecutionService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AccountingControllerTest {

    @Mock private AccountingService accountingService;
    @Mock private PayoutExecutionService payoutExecutionService;
    @Mock private OwnerPayoutRepository payoutRepository;
    @Mock private UserRepository userRepository;
    @Mock private TenantContext tenantContext;
    @Mock private OwnerStatementService ownerStatementService;
    @Mock private OrganizationRepository organizationRepository;

    private AccountingController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new AccountingController(
                accountingService, payoutExecutionService, payoutRepository,
                userRepository, tenantContext, ownerStatementService, organizationRepository);
        jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "kc-user-1")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    private OwnerPayout payout(Long id, Long ownerId, PayoutStatus status) {
        OwnerPayout p = new OwnerPayout();
        p.setId(id);
        p.setOwnerId(ownerId);
        p.setStatus(status);
        p.setOrganizationId(1L);
        p.setPeriodStart(LocalDate.now().minusMonths(1));
        p.setPeriodEnd(LocalDate.now());
        p.setGrossRevenue(new BigDecimal("1000"));
        p.setCommissionAmount(new BigDecimal("200"));
        p.setCommissionRate(new BigDecimal("0.20"));
        p.setExpenses(BigDecimal.ZERO);
        p.setNetAmount(new BigDecimal("800"));
        return p;
    }

    private User user(Long id, String first, String last) {
        User u = new User();
        u.setId(id);
        u.setFirstName(first);
        u.setLastName(last);
        u.setKeycloakId("kc-user-" + id);
        return u;
    }

    // ── getPayouts ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("getPayouts")
    class GetPayouts {
        @Test
        void noFilter_returnsAll() {
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            OwnerPayout p = payout(1L, 42L, PayoutStatus.PENDING);
            when(accountingService.getPayouts(1L)).thenReturn(List.of(p));
            when(userRepository.findAllById(any())).thenReturn(List.of(user(42L, "John", "Doe")));

            List<OwnerPayoutDto> result = controller.getPayouts(null, null);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).ownerName()).isEqualTo("John Doe");
        }

        @Test
        void ownerIdFilter_callsByOwner() {
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            OwnerPayout p = payout(1L, 42L, PayoutStatus.PENDING);
            when(accountingService.getPayoutsByOwner(42L, 1L)).thenReturn(List.of(p));
            when(userRepository.findAllById(any())).thenReturn(List.of(user(42L, "John", "Doe")));

            List<OwnerPayoutDto> result = controller.getPayouts(42L, null);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).ownerId()).isEqualTo(42L);
        }

        @Test
        void statusFilter_callsByStatus() {
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            OwnerPayout p = payout(1L, 42L, PayoutStatus.APPROVED);
            when(accountingService.getPayoutsByStatus(PayoutStatus.APPROVED, 1L)).thenReturn(List.of(p));
            when(userRepository.findAllById(any())).thenReturn(List.of(user(42L, "John", "Doe")));

            List<OwnerPayoutDto> result = controller.getPayouts(null, PayoutStatus.APPROVED);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).status()).isEqualTo(PayoutStatus.APPROVED);
        }

        @Test
        void empty_returnsEmptyList() {
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            when(accountingService.getPayouts(1L)).thenReturn(List.of());
            when(userRepository.findAllById(any())).thenReturn(List.of());

            List<OwnerPayoutDto> result = controller.getPayouts(null, null);

            assertThat(result).isEmpty();
        }
    }

    // ── getPayout ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getPayout")
    class GetPayout {
        @Test
        void returnsDto() {
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            OwnerPayout p = payout(1L, 42L, PayoutStatus.PENDING);
            when(accountingService.getPayoutById(1L, 1L)).thenReturn(p);
            when(userRepository.findById(42L)).thenReturn(Optional.of(user(42L, "John", "Doe")));

            OwnerPayoutDto dto = controller.getPayout(1L);

            assertThat(dto.id()).isEqualTo(1L);
            assertThat(dto.ownerName()).isEqualTo("John Doe");
        }

        @Test
        void ownerNotFound_dtoHasNullName() {
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            OwnerPayout p = payout(1L, 42L, PayoutStatus.PENDING);
            when(accountingService.getPayoutById(1L, 1L)).thenReturn(p);
            when(userRepository.findById(42L)).thenReturn(Optional.empty());

            OwnerPayoutDto dto = controller.getPayout(1L);

            assertThat(dto.ownerName()).isNull();
        }
    }

    // ── generatePayout ───────────────────────────────────────────────────

    @Nested
    @DisplayName("generatePayout")
    class GeneratePayout {
        @Test
        void valid_returnsDto() {
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            OwnerPayout p = payout(10L, 42L, PayoutStatus.PENDING);
            when(accountingService.generatePayout(eq(42L), eq(1L), any(), any())).thenReturn(p);
            when(userRepository.findById(42L)).thenReturn(Optional.of(user(42L, "John", "Doe")));

            OwnerPayoutDto dto = controller.generatePayout(42L,
                    LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31));

            assertThat(dto.id()).isEqualTo(10L);
        }
    }

    // ── generatePayoutsBatch ─────────────────────────────────────────────

    @Nested
    @DisplayName("generatePayoutsBatch")
    class GenerateBatch {
        @Test
        void returnsListWithOwnerNames() {
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            OwnerPayout p1 = payout(1L, 10L, PayoutStatus.PENDING);
            OwnerPayout p2 = payout(2L, 20L, PayoutStatus.PENDING);
            when(accountingService.generatePayoutsBatch(eq(1L), any(), any()))
                    .thenReturn(List.of(p1, p2));
            when(userRepository.findAllById(any())).thenReturn(List.of(
                    user(10L, "Alice", "A"), user(20L, "Bob", "B")));

            List<OwnerPayoutDto> result = controller.generatePayoutsBatch(
                    LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31));

            assertThat(result).hasSize(2);
        }
    }

    // ── sendOwnerStatement ───────────────────────────────────────────────

    @Nested
    @DisplayName("sendOwnerStatement")
    class SendOwnerStatement {
        @Test
        void valid_returnsSummary() {
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            Organization org = new Organization();
            org.setName("MyConcierge");
            when(organizationRepository.findById(1L)).thenReturn(Optional.of(org));
            OwnerStatementService.OwnerStatementResult result = new OwnerStatementService.OwnerStatementResult(
                    "e@x.com", "John Doe", 2,
                    new BigDecimal("400"), new BigDecimal("500"),
                    new BigDecimal("100"), BigDecimal.ZERO);
            when(ownerStatementService.sendStatement(eq(42L), eq(1L), any(), any(), eq("MyConcierge")))
                    .thenReturn(result);

            Map<String, Object> response = controller.sendOwnerStatement(42L,
                    LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31));

            assertThat(response).containsEntry("emailSentTo", "e@x.com");
            assertThat(response).containsEntry("payoutsCount", 2);
        }

        @Test
        void organizationNotFound_usesDefault() {
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            when(organizationRepository.findById(1L)).thenReturn(Optional.empty());
            OwnerStatementService.OwnerStatementResult result = new OwnerStatementService.OwnerStatementResult(
                    "e@x.com", "John Doe", 0,
                    BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
            when(ownerStatementService.sendStatement(eq(42L), eq(1L), any(), any(), eq("Votre conciergerie")))
                    .thenReturn(result);

            Map<String, Object> response = controller.sendOwnerStatement(42L,
                    LocalDate.now(), LocalDate.now());

            assertThat(response).containsKey("emailSentTo");
        }
    }

    // ── approvePayout ────────────────────────────────────────────────────

    @Nested
    @DisplayName("approvePayout")
    class ApprovePayout {
        @Test
        void valid_returnsDto() {
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            OwnerPayout p = payout(1L, 42L, PayoutStatus.APPROVED);
            when(accountingService.approvePayout(1L, 1L)).thenReturn(p);
            when(userRepository.findById(42L)).thenReturn(Optional.of(user(42L, "John", "Doe")));

            OwnerPayoutDto dto = controller.approvePayout(1L);

            assertThat(dto.status()).isEqualTo(PayoutStatus.APPROVED);
        }
    }

    // ── markAsPaid ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("markAsPaid")
    class MarkAsPaid {
        @Test
        void valid_returnsDto() {
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            OwnerPayout p = payout(1L, 42L, PayoutStatus.PAID);
            p.setPaymentReference("REF-XYZ");
            when(accountingService.markAsPaid(1L, 1L, "REF-XYZ")).thenReturn(p);
            when(userRepository.findById(42L)).thenReturn(Optional.of(user(42L, "John", "Doe")));

            OwnerPayoutDto dto = controller.markAsPaid(1L, "REF-XYZ");

            assertThat(dto.paymentReference()).isEqualTo("REF-XYZ");
        }
    }

    // ── executePayout ────────────────────────────────────────────────────

    @Nested
    @DisplayName("executePayout")
    class ExecutePayout {
        @Test
        void delegatesToExecutionService() {
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            OwnerPayout p = payout(1L, 42L, PayoutStatus.PROCESSING);
            when(payoutExecutionService.executePayout(1L, 1L)).thenReturn(p);
            when(userRepository.findById(42L)).thenReturn(Optional.of(user(42L, "John", "Doe")));

            OwnerPayoutDto dto = controller.executePayout(1L);

            assertThat(dto.status()).isEqualTo(PayoutStatus.PROCESSING);
        }
    }

    // ── retryPayout ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("retryPayout")
    class RetryPayout {
        @Test
        void delegatesToExecutionService() {
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            OwnerPayout p = payout(1L, 42L, PayoutStatus.PROCESSING);
            when(payoutExecutionService.retryPayout(1L, 1L)).thenReturn(p);
            when(userRepository.findById(42L)).thenReturn(Optional.of(user(42L, "John", "Doe")));

            OwnerPayoutDto dto = controller.retryPayout(1L);

            assertThat(dto.id()).isEqualTo(1L);
        }
    }

    // ── getPendingPayoutCount ────────────────────────────────────────────

    @Nested
    @DisplayName("getPendingPayoutCount")
    class GetPendingCount {
        @Test
        void returnsCountAndAmount() {
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            when(payoutRepository.countPendingByOrgId(1L)).thenReturn(5L);
            when(payoutRepository.sumPendingAmountByOrgId(1L)).thenReturn(new BigDecimal("1500.00"));

            Map<String, Object> response = controller.getPendingPayoutCount();

            assertThat(response.get("pendingCount")).isEqualTo(5L);
            assertThat(response.get("totalPendingAmount")).isEqualTo(new BigDecimal("1500.00"));
        }
    }

    // ── getMyPendingPayout ───────────────────────────────────────────────

    @Nested
    @DisplayName("getMyPendingPayout")
    class GetMyPending {
        @Test
        void returnsUserPending() {
            User u = user(7L, "John", "Doe");
            when(userRepository.findByKeycloakId("kc-user-1")).thenReturn(Optional.of(u));
            when(payoutRepository.countPendingByOwnerId(7L)).thenReturn(3L);
            when(payoutRepository.sumPendingAmountByOwnerId(7L)).thenReturn(new BigDecimal("250"));

            Map<String, Object> response = controller.getMyPendingPayout(jwt);

            assertThat(response.get("pendingCount")).isEqualTo(3L);
            assertThat(response.get("totalPendingAmount")).isEqualTo(new BigDecimal("250"));
        }

        @Test
        void userNotFound_throws() {
            when(userRepository.findByKeycloakId("kc-user-1")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> controller.getMyPendingPayout(jwt))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("User not found");
        }
    }

    // ── commissions ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("commissions")
    class Commissions {
        @Test
        void getCommissions_returnsList() {
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            ChannelCommission cc = new ChannelCommission();
            cc.setOrganizationId(1L);
            cc.setChannelName(ChannelName.AIRBNB);
            when(accountingService.getChannelCommissions(1L)).thenReturn(List.of(cc));

            List<ChannelCommission> result = controller.getCommissions();

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getChannelName()).isEqualTo(ChannelName.AIRBNB);
        }

        @Test
        void saveCommission_setsChannelAndOrgIdAndSaves() {
            when(tenantContext.getOrganizationId()).thenReturn(1L);
            ChannelCommission cc = new ChannelCommission();
            when(accountingService.saveChannelCommission(any())).thenAnswer(inv -> inv.getArgument(0));

            ChannelCommission result = controller.saveCommission(ChannelName.BOOKING, cc);

            assertThat(result.getChannelName()).isEqualTo(ChannelName.BOOKING);
            assertThat(result.getOrganizationId()).isEqualTo(1L);
        }
    }
}
