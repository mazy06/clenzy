package com.clenzy.controller;

import com.clenzy.service.payout.BaitlyCommercePayoutStore;
import com.clenzy.payment.payout.StripeConnectTransferClient;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController @RequestMapping("/api/commerce/payouts") @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
public class BaitlyCommercePayoutController {
    private final BaitlyCommercePayoutStore store;private final StripeConnectTransferClient stripe;private final TenantContext tenant;
    public BaitlyCommercePayoutController(BaitlyCommercePayoutStore store,StripeConnectTransferClient stripe,TenantContext tenant){this.store=store;this.stripe=stripe;this.tenant=tenant;}
    public record Request(@NotBlank String source,@NotNull Long sourceId,@NotBlank String party,@NotNull UUID requestId,@NotNull @DecimalMin("0.01") java.math.BigDecimal amount,@NotBlank @Size(min=3,max=3) String currency) {}
    @PostMapping("/{id}/cancel") public void cancel(@PathVariable Long id,@AuthenticationPrincipal Jwt jwt){store.cancel(tenant.getRequiredOrganizationId(),id,jwt.getSubject());}
    @GetMapping public BaitlyCommercePayoutStore.View view(@RequestParam String source,@RequestParam Long sourceId){return store.view(tenant.getRequiredOrganizationId(),source,sourceId);}
    @PostMapping public BaitlyCommercePayoutStore.View pay(@Valid @RequestBody Request request,@AuthenticationPrincipal Jwt jwt)throws com.stripe.exception.StripeException {
        Long org=tenant.getRequiredOrganizationId();var instruction=store.prepareAccepted(org,request.source(),request.sourceId(),request.party(),request.requestId(),jwt.getSubject(),request.amount(),request.currency());stripe.createTransfer(instruction);
        return store.view(org,request.source(),request.sourceId());
    }
}
