package com.clenzy.controller;

import com.clenzy.service.*;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.util.UUID;

@RestController @RequestMapping("/api/commerce/refunds")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
public class BaitlyCommerceRefundController {
    private final TenantContext tenant;private final BaitlyCommerceRefunds refunds;private final ManagedRefundReconciliation reconciliation;
    public BaitlyCommerceRefundController(TenantContext tenant,BaitlyCommerceRefunds refunds,ManagedRefundReconciliation reconciliation){this.tenant=tenant;this.refunds=refunds;this.reconciliation=reconciliation;}
    public record Request(@NotBlank String reference,@NotNull UUID requestId,@NotNull @DecimalMin("0.01") BigDecimal amount,@NotBlank @Size(max=1000) String reason) {}
    @GetMapping("/credit-purchases") public java.util.List<BaitlyCommerceRefunds.ReceiptView> purchases(){return refunds.creditPurchases(tenant.getRequiredOrganizationId());}
    @GetMapping public BaitlyCommerceRefunds.View view(@RequestParam(required=false) String reference,@RequestParam(required=false) String source,@RequestParam(required=false) Long sourceId) {
        return reference!=null?refunds.view(tenant.getRequiredOrganizationId(),reference):refunds.view(tenant.getRequiredOrganizationId(),source,sourceId);
    }
    @PostMapping public BaitlyCommerceRefunds.View create(@RequestBody @Valid Request request,@AuthenticationPrincipal Jwt jwt) {
        Long org=tenant.getRequiredOrganizationId();String ref=refunds.prepare(org,request.reference(),request.amount(),request.requestId(),request.reason(),jwt.getSubject());
        var result=reconciliation.resumeSeries(ref,org);
        if(result.getStatus()==com.clenzy.model.TransactionStatus.COMPLETED)refunds.reconcile(ref);
        return refunds.view(org,request.reference());
    }
}
