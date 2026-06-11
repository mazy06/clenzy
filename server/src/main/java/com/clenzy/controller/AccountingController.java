package com.clenzy.controller;

import com.clenzy.dto.ChannelCommissionDto;
import com.clenzy.dto.OwnerPayoutDto;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.service.AccountingQueryService;
import com.clenzy.service.AccountingService;
import com.clenzy.service.OwnerStatementService;
import com.clenzy.service.PayoutExecutionService;
import com.clenzy.tenant.TenantContext;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/accounting")
@PreAuthorize("isAuthenticated()")
public class AccountingController {

    private final AccountingService accountingService;
    private final PayoutExecutionService payoutExecutionService;
    private final AccountingQueryService accountingQueryService;
    private final TenantContext tenantContext;
    private final OwnerStatementService ownerStatementService;

    public AccountingController(AccountingService accountingService,
                                PayoutExecutionService payoutExecutionService,
                                AccountingQueryService accountingQueryService,
                                TenantContext tenantContext,
                                OwnerStatementService ownerStatementService) {
        this.accountingService = accountingService;
        this.payoutExecutionService = payoutExecutionService;
        this.accountingQueryService = accountingQueryService;
        this.tenantContext = tenantContext;
        this.ownerStatementService = ownerStatementService;
    }

    @GetMapping("/payouts")
    public List<OwnerPayoutDto> getPayouts(@RequestParam(required = false) Long ownerId,
                                            @RequestParam(required = false) PayoutStatus status) {
        Long orgId = tenantContext.getOrganizationId();
        List<OwnerPayout> payouts;
        if (ownerId != null) {
            payouts = accountingService.getPayoutsByOwner(ownerId, orgId);
        } else if (status != null) {
            payouts = accountingService.getPayoutsByStatus(status, orgId);
        } else {
            payouts = accountingService.getPayouts(orgId);
        }
        return accountingQueryService.toDtosWithOwnerNames(payouts);
    }

    @GetMapping("/payouts/{id}")
    public OwnerPayoutDto getPayout(@PathVariable Long id) {
        Long orgId = tenantContext.getOrganizationId();
        OwnerPayout payout = accountingService.getPayoutById(id, orgId);
        return accountingQueryService.toDtoWithOwnerName(payout);
    }

    @PostMapping("/payouts/generate")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
    public OwnerPayoutDto generatePayout(@RequestParam Long ownerId,
                                          @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                          @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        Long orgId = tenantContext.getOrganizationId();
        OwnerPayout payout = accountingService.generatePayout(ownerId, orgId, from, to);
        return accountingQueryService.toDtoWithOwnerName(payout);
    }

    /**
     * Generation batch pour tous les proprietaires eligibles de l'organisation
     * sur une periode donnee. Workflow critique fin de mois des conciergeries.
     *
     * <p>Idempotent (un payout deja existant sur la periode est retourne tel quel).</p>
     */
    @PostMapping("/payouts/generate-batch")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
    public List<OwnerPayoutDto> generatePayoutsBatch(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        Long orgId = tenantContext.getOrganizationId();
        List<OwnerPayout> payouts = accountingService.generatePayoutsBatch(orgId, from, to);
        return accountingQueryService.toDtosWithOwnerNames(payouts);
    }

    /**
     * Envoie au proprietaire un releve mail HTML resumant les reversements
     * VERSES sur la periode. Differenciateur Clenzy : transparence proactive
     * vers les proprietaires (vs Smoobu/Hostaway qui ne le proposent pas).
     */
    @PostMapping("/owners/{ownerId}/send-statement")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
    public Map<String, Object> sendOwnerStatement(
            @PathVariable Long ownerId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        Long orgId = tenantContext.getOrganizationId();
        String conciergerieName = accountingQueryService.getOrganizationName(orgId)
            .orElse("Votre conciergerie");

        OwnerStatementService.OwnerStatementResult result =
            ownerStatementService.sendStatement(ownerId, orgId, from, to, conciergerieName);

        return Map.of(
            "emailSentTo", result.emailSentTo(),
            "ownerName", result.ownerName(),
            "payoutsCount", result.payoutsCount(),
            "totalPaid", result.totalPaid(),
            "totalGross", result.totalGross(),
            "totalCommission", result.totalCommission(),
            "totalExpenses", result.totalExpenses()
        );
    }

    @PutMapping("/payouts/{id}/approve")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
    public OwnerPayoutDto approvePayout(@PathVariable Long id) {
        Long orgId = tenantContext.getOrganizationId();
        OwnerPayout payout = accountingService.approvePayout(id, orgId);
        return accountingQueryService.toDtoWithOwnerName(payout);
    }

    @PutMapping("/payouts/{id}/pay")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
    public OwnerPayoutDto markAsPaid(@PathVariable Long id,
                                      @RequestParam String paymentReference) {
        Long orgId = tenantContext.getOrganizationId();
        OwnerPayout payout = accountingService.markAsPaid(id, orgId, paymentReference);
        return accountingQueryService.toDtoWithOwnerName(payout);
    }

    @PostMapping("/payouts/{id}/execute")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
    public OwnerPayoutDto executePayout(@PathVariable Long id) {
        Long orgId = tenantContext.getOrganizationId();
        OwnerPayout payout = payoutExecutionService.executePayout(id, orgId);
        return accountingQueryService.toDtoWithOwnerName(payout);
    }

    @PostMapping("/payouts/{id}/retry")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
    public OwnerPayoutDto retryPayout(@PathVariable Long id) {
        Long orgId = tenantContext.getOrganizationId();
        OwnerPayout payout = payoutExecutionService.retryPayout(id, orgId);
        return accountingQueryService.toDtoWithOwnerName(payout);
    }

    @GetMapping("/payouts/pending-count")
    public Map<String, Object> getPendingPayoutCount() {
        Long orgId = tenantContext.getOrganizationId();
        AccountingQueryService.PendingPayoutSummary summary =
            accountingQueryService.getPendingPayoutSummary(orgId);
        return Map.of(
                "pendingCount", summary.pendingCount(),
                "totalPendingAmount", summary.totalPendingAmount()
        );
    }

    /**
     * Returns pending payout count and amount for the authenticated user (prestataire).
     * Uses the user's database ID as ownerId to filter payouts.
     */
    @GetMapping("/payouts/my-pending")
    public Map<String, Object> getMyPendingPayout(@AuthenticationPrincipal Jwt jwt) {
        AccountingQueryService.PendingPayoutSummary summary =
            accountingQueryService.getMyPendingPayoutSummary(jwt.getSubject());
        return Map.of(
                "pendingCount", summary.pendingCount(),
                "totalPendingAmount", summary.totalPendingAmount()
        );
    }

    @GetMapping("/commissions")
    public List<ChannelCommissionDto> getCommissions() {
        Long orgId = tenantContext.getOrganizationId();
        return accountingService.getChannelCommissions(orgId).stream()
            .map(ChannelCommissionDto::from)
            .toList();
    }

    @PutMapping("/commissions/{channel}")
    public ChannelCommissionDto saveCommission(@PathVariable ChannelName channel,
                                                @RequestBody ChannelCommissionDto commission) {
        Long orgId = tenantContext.getOrganizationId();
        return ChannelCommissionDto.from(
            accountingService.saveChannelCommission(channel, orgId, commission));
    }
}
