package com.clenzy.controller;

import com.clenzy.dto.PayoutTransferDto;
import com.clenzy.service.payout.BaitlyExpensePayoutService;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/provider-expenses")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
public class BaitlyExpensePayoutController {
    private final BaitlyExpensePayoutService payouts;
    private final TenantContext tenant;
    private final com.clenzy.service.payout.BaitlyExpenseBeneficiaryService beneficiaries;
    public record Company(@jakarta.validation.constraints.NotNull @jakarta.validation.constraints.Positive Long organizationId) {}
    public BaitlyExpensePayoutController(BaitlyExpensePayoutService payouts, TenantContext tenant,
            com.clenzy.service.payout.BaitlyExpenseBeneficiaryService beneficiaries) {
        this.payouts = payouts; this.tenant = tenant; this.beneficiaries=beneficiaries;
    }
    @PostMapping("/{id}/transfer")
    public PayoutTransferDto transfer(@PathVariable Long id,@RequestBody com.clenzy.model.PayoutBeneficiary confirmation) throws com.stripe.exception.StripeException {
        return payouts.pay(id, tenant.getRequiredOrganizationId(),confirmation);
    }
    @PutMapping("/{id}/beneficiary")
    public com.clenzy.service.payout.BaitlyExpenseBeneficiaryService.Choice selectCompany(@PathVariable Long id,
            @jakarta.validation.Valid @RequestBody Company company,
            @org.springframework.security.core.annotation.AuthenticationPrincipal org.springframework.security.oauth2.jwt.Jwt jwt) {
        return beneficiaries.selectCompany(id,tenant.getRequiredOrganizationId(),company.organizationId(),jwt.getSubject());
    }
    @GetMapping("/{id}/transfer-preview")
    public BaitlyExpensePayoutService.Preview preview(@PathVariable Long id) {
        return payouts.preview(id, tenant.getRequiredOrganizationId());
    }
}
