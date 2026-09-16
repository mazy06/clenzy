package com.clenzy.marketplace.controller;

import com.clenzy.marketplace.service.MarketplaceOnboardingService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/** Accessible sans organisation locale ; l'identité et la candidature sont vérifiées par le service. */
@RestController
@RequestMapping("/api/me/marketplace-reconciliation")
@PreAuthorize("isAuthenticated()")
public class MarketplaceAccountReconciliationController {
    private final MarketplaceOnboardingService onboarding;
    public MarketplaceAccountReconciliationController(MarketplaceOnboardingService onboarding) {
        this.onboarding = onboarding;
    }

    @PostMapping("/{providerId}")
    public Result reconcile(@PathVariable Long providerId, @AuthenticationPrincipal Jwt jwt) {
        return new Result(onboarding.reconcile(providerId, jwt));
    }

    public record Result(MarketplaceOnboardingService.Outcome outcome) {}
}
