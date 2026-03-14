package com.clenzy.controller;

import com.clenzy.dto.OwnerPayoutDto;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.ChannelCommission;
import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.model.User;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.AccountingService;
import com.clenzy.service.PayoutExecutionService;
import com.clenzy.tenant.TenantContext;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/accounting")
@PreAuthorize("isAuthenticated()")
public class AccountingController {

    private final AccountingService accountingService;
    private final PayoutExecutionService payoutExecutionService;
    private final OwnerPayoutRepository payoutRepository;
    private final UserRepository userRepository;
    private final TenantContext tenantContext;

    public AccountingController(AccountingService accountingService,
                                PayoutExecutionService payoutExecutionService,
                                OwnerPayoutRepository payoutRepository,
                                UserRepository userRepository,
                                TenantContext tenantContext) {
        this.accountingService = accountingService;
        this.payoutExecutionService = payoutExecutionService;
        this.payoutRepository = payoutRepository;
        this.userRepository = userRepository;
        this.tenantContext = tenantContext;
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
        return toDtosWithOwnerNames(payouts);
    }

    @GetMapping("/payouts/{id}")
    public OwnerPayoutDto getPayout(@PathVariable Long id) {
        Long orgId = tenantContext.getOrganizationId();
        OwnerPayout payout = accountingService.getPayoutById(id, orgId);
        String ownerName = resolveOwnerName(payout.getOwnerId());
        return OwnerPayoutDto.from(payout, ownerName);
    }

    @PostMapping("/payouts/generate")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
    public OwnerPayoutDto generatePayout(@RequestParam Long ownerId,
                                          @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                          @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        Long orgId = tenantContext.getOrganizationId();
        OwnerPayout payout = accountingService.generatePayout(ownerId, orgId, from, to);
        String ownerName = resolveOwnerName(ownerId);
        return OwnerPayoutDto.from(payout, ownerName);
    }

    @PutMapping("/payouts/{id}/approve")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
    public OwnerPayoutDto approvePayout(@PathVariable Long id) {
        Long orgId = tenantContext.getOrganizationId();
        OwnerPayout payout = accountingService.approvePayout(id, orgId);
        String ownerName = resolveOwnerName(payout.getOwnerId());
        return OwnerPayoutDto.from(payout, ownerName);
    }

    @PutMapping("/payouts/{id}/pay")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
    public OwnerPayoutDto markAsPaid(@PathVariable Long id,
                                      @RequestParam String paymentReference) {
        Long orgId = tenantContext.getOrganizationId();
        OwnerPayout payout = accountingService.markAsPaid(id, orgId, paymentReference);
        String ownerName = resolveOwnerName(payout.getOwnerId());
        return OwnerPayoutDto.from(payout, ownerName);
    }

    @PostMapping("/payouts/{id}/execute")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
    public OwnerPayoutDto executePayout(@PathVariable Long id) {
        Long orgId = tenantContext.getOrganizationId();
        OwnerPayout payout = payoutExecutionService.executePayout(id, orgId);
        String ownerName = resolveOwnerName(payout.getOwnerId());
        return OwnerPayoutDto.from(payout, ownerName);
    }

    @PostMapping("/payouts/{id}/retry")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
    public OwnerPayoutDto retryPayout(@PathVariable Long id) {
        Long orgId = tenantContext.getOrganizationId();
        OwnerPayout payout = payoutExecutionService.retryPayout(id, orgId);
        String ownerName = resolveOwnerName(payout.getOwnerId());
        return OwnerPayoutDto.from(payout, ownerName);
    }

    @GetMapping("/payouts/pending-count")
    public Map<String, Object> getPendingPayoutCount() {
        Long orgId = tenantContext.getOrganizationId();
        long count = payoutRepository.countPendingByOrgId(orgId);
        BigDecimal totalAmount = payoutRepository.sumPendingAmountByOrgId(orgId);
        return Map.of(
                "pendingCount", count,
                "totalPendingAmount", totalAmount
        );
    }

    @GetMapping("/commissions")
    public List<ChannelCommission> getCommissions() {
        Long orgId = tenantContext.getOrganizationId();
        return accountingService.getChannelCommissions(orgId);
    }

    @PutMapping("/commissions/{channel}")
    public ChannelCommission saveCommission(@PathVariable ChannelName channel,
                                             @RequestBody ChannelCommission commission) {
        Long orgId = tenantContext.getOrganizationId();
        commission.setOrganizationId(orgId);
        commission.setChannelName(channel);
        return accountingService.saveChannelCommission(commission);
    }

    // ── Private helpers ─────────────────────────────────────────────────────

    private String resolveOwnerName(Long ownerId) {
        return userRepository.findById(ownerId)
            .map(User::getFullName).orElse(null);
    }

    /**
     * Resout les noms des proprietaires en batch pour eviter les N+1 queries.
     */
    private List<OwnerPayoutDto> toDtosWithOwnerNames(List<OwnerPayout> payouts) {
        Set<Long> ownerIds = payouts.stream()
            .map(OwnerPayout::getOwnerId)
            .collect(Collectors.toSet());
        Map<Long, String> namesByOwnerId = userRepository.findAllById(ownerIds).stream()
            .collect(Collectors.toMap(User::getId, User::getFullName, (a, b) -> a));
        return payouts.stream()
            .map(p -> OwnerPayoutDto.from(p, namesByOwnerId.get(p.getOwnerId())))
            .toList();
    }
}
