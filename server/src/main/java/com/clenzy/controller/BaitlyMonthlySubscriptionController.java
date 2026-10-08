package com.clenzy.controller;

import com.clenzy.service.BaitlyMonthlySubscriptionService;
import com.clenzy.service.BaitlyMonthlyPricing.Plan;
import com.stripe.exception.StripeException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.*;

/** L'autorisation de gestion de l'organisation active est également vérifiée dans chaque service. */
@RestController
@RequestMapping("/api/subscription/monthly")
@PreAuthorize("hasAnyRole('HOST','SUPER_ADMIN','SUPER_MANAGER')")
public class BaitlyMonthlySubscriptionController {
    private final BaitlyMonthlySubscriptionService subscriptions;
    private final com.clenzy.service.BaitlySubscriptionBilling billing;
    private final com.clenzy.service.BaitlySubscriptionAmendments amendments;
    public BaitlyMonthlySubscriptionController(BaitlyMonthlySubscriptionService subscriptions,com.clenzy.service.BaitlySubscriptionBilling billing,com.clenzy.service.BaitlySubscriptionAmendments amendments){this.subscriptions=subscriptions;this.billing=billing;this.amendments=amendments;}
    public record Checkout(@NotNull Plan plan,@NotNull UUID requestId,String promoCode) {}
    public record Country(@jakarta.validation.constraints.NotBlank String billingCountry) {}
    @GetMapping("/billing-country")
    public BaitlyMonthlySubscriptionService.BillingCountry billingCountry(@AuthenticationPrincipal Jwt jwt){return subscriptions.billingCountry(jwt.getSubject());}
    @PutMapping("/billing-country")
    public BaitlyMonthlySubscriptionService.BillingCountry billingCountry(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody Country body){return subscriptions.updateBillingCountry(jwt.getSubject(),body.billingCountry());}
    @GetMapping("/proposal")
    public BaitlyMonthlySubscriptionService.Proposal proposal(@AuthenticationPrincipal Jwt jwt,@RequestParam Plan plan,@RequestParam(required=false)String promoCode) {
        return subscriptions.proposal(jwt.getSubject(),plan,promoCode);
    }
    @GetMapping
    public List<BaitlyMonthlySubscriptionService.Contract> contracts(@AuthenticationPrincipal Jwt jwt){return subscriptions.contracts(jwt.getSubject());}
    @GetMapping("/invoices")
    public List<BaitlyMonthlySubscriptionService.Bill> invoices(@AuthenticationPrincipal Jwt jwt){return subscriptions.invoices(jwt.getSubject());}
    @PostMapping("/checkout")
    public Map<String,String> checkout(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody Checkout body) throws StripeException {
        return subscriptions.checkout(jwt.getSubject(),body.plan(),body.requestId(),body.promoCode());
    }
    @PostMapping("/{id}/refresh")
    public void refresh(@AuthenticationPrincipal Jwt jwt,@PathVariable Long id)throws StripeException{billing.refresh(subscriptions.refresh(jwt.getSubject(),id));}
    @PostMapping("/{id}/abandon")
    public void abandon(@AuthenticationPrincipal Jwt jwt,@PathVariable Long id)throws StripeException{subscriptions.cancelCheckout(jwt.getSubject(),id);}
    @PostMapping("/{id}/cancel-at-period-end")
    public void cancelAtPeriodEnd(@AuthenticationPrincipal Jwt jwt,@PathVariable Long id)throws StripeException{subscriptions.cancelAtPeriodEnd(jwt.getSubject(),id);amendments.cancelled(jwt.getSubject(),id);}
    @PostMapping("/{id}/payment-method")
    public Map<String,String> paymentMethod(@AuthenticationPrincipal Jwt jwt,@PathVariable Long id)throws StripeException{return subscriptions.paymentPortal(jwt.getSubject(),id);}
    @GetMapping("/{id}/changes")
    public List<com.clenzy.service.BaitlySubscriptionAmendments.Change> changes(@AuthenticationPrincipal Jwt jwt,@PathVariable Long id){return amendments.list(jwt.getSubject(),id);}
    @GetMapping("/{id}/change-proposal")
    public com.clenzy.service.BaitlySubscriptionAmendments.Proposal proposal(@AuthenticationPrincipal Jwt jwt,@PathVariable Long id,@RequestParam Plan plan)throws StripeException{return amendments.proposal(jwt.getSubject(),id,plan);}
    public record Amendment(@NotNull Plan plan,@NotNull UUID requestId,@NotNull com.clenzy.model.BaitlySubscriptionAmendment.Terms accepted) {}
    @PostMapping("/{id}/changes")
    public com.clenzy.service.BaitlySubscriptionAmendments.Change change(@AuthenticationPrincipal Jwt jwt,@PathVariable Long id,@Valid @RequestBody Amendment body)throws StripeException{return amendments.schedule(jwt.getSubject(),id,body.plan(),body.requestId(),body.accepted());}
}
