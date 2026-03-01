package com.clenzy.controller;

import com.clenzy.dto.OwnerPayoutDto;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.ChannelCommission;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.service.AccountingService;
import com.clenzy.tenant.TenantContext;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/accounting")
public class AccountingController {

    private final AccountingService accountingService;
    private final TenantContext tenantContext;

    public AccountingController(AccountingService accountingService,
                                TenantContext tenantContext) {
        this.accountingService = accountingService;
        this.tenantContext = tenantContext;
    }

    @GetMapping("/payouts")
    public List<OwnerPayoutDto> getPayouts(@RequestParam(required = false) Long ownerId,
                                            @RequestParam(required = false) PayoutStatus status) {
        Long orgId = tenantContext.getOrganizationId();
        if (ownerId != null) {
            return accountingService.getPayoutsByOwner(ownerId, orgId).stream()
                .map(OwnerPayoutDto::from).toList();
        }
        if (status != null) {
            return accountingService.getPayoutsByStatus(status, orgId).stream()
                .map(OwnerPayoutDto::from).toList();
        }
        return accountingService.getPayouts(orgId).stream()
            .map(OwnerPayoutDto::from).toList();
    }

    @GetMapping("/payouts/{id}")
    public OwnerPayoutDto getPayout(@PathVariable Long id) {
        Long orgId = tenantContext.getOrganizationId();
        return OwnerPayoutDto.from(accountingService.getPayoutById(id, orgId));
    }

    @PostMapping("/payouts/generate")
    @ResponseStatus(HttpStatus.CREATED)
    public OwnerPayoutDto generatePayout(@RequestParam Long ownerId,
                                          @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                          @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        Long orgId = tenantContext.getOrganizationId();
        return OwnerPayoutDto.from(accountingService.generatePayout(ownerId, orgId, from, to));
    }

    @PutMapping("/payouts/{id}/approve")
    public OwnerPayoutDto approvePayout(@PathVariable Long id) {
        Long orgId = tenantContext.getOrganizationId();
        return OwnerPayoutDto.from(accountingService.approvePayout(id, orgId));
    }

    @PutMapping("/payouts/{id}/pay")
    public OwnerPayoutDto markAsPaid(@PathVariable Long id,
                                      @RequestParam String paymentReference) {
        Long orgId = tenantContext.getOrganizationId();
        return OwnerPayoutDto.from(accountingService.markAsPaid(id, orgId, paymentReference));
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
}
