package com.clenzy.controller;

import com.clenzy.dto.HousekeeperPayoutDtos.AccountSessionDto;
import com.clenzy.dto.HousekeeperPayoutDtos.MyPayoutsDto;
import com.clenzy.dto.HousekeeperPayoutDtos.OnboardingLinkDto;
import com.clenzy.dto.HousekeeperPayoutDtos.PayoutRecordDto;
import com.clenzy.model.HousekeeperPayoutConfig;
import com.clenzy.model.User;
import com.clenzy.service.payout.HousekeeperPayoutService;
import com.clenzy.tenant.TenantContext;
import com.stripe.exception.StripeException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * Versements Stripe Connect de tous les métiers. Route historique conservée.
 * /me et /account-session : le PRO (ownership par le JWT — jamais d'id client).
 * /org et /{id}/retry : staff plateforme. Controller mince (règle ArchUnit).
 */
@RestController
@RequestMapping("/api/housekeeper-payouts")
@PreAuthorize("isAuthenticated()")
public class HousekeeperPayoutController {

    private final HousekeeperPayoutService payoutService;
    private final TenantContext tenantContext;

    public HousekeeperPayoutController(HousekeeperPayoutService payoutService,
                                       TenantContext tenantContext) {
        this.payoutService = payoutService;
        this.tenantContext = tenantContext;
    }

    /** Statut d'onboarding + historique de MES versements. */
    @GetMapping("/me")
    public ResponseEntity<MyPayoutsDto> getMyPayouts(@AuthenticationPrincipal Jwt jwt) {
        User me = payoutService.requireCurrentUser(jwt.getSubject());
        Long orgId = tenantContext.getRequiredOrganizationId();
        HousekeeperPayoutConfig config = payoutService.getConfig(me.getId(), orgId).orElse(null);
        List<PayoutRecordDto> records = payoutService.listRecordsForUser(me.getId(), orgId).stream()
                .map(PayoutRecordDto::from)
                .toList();
        return ResponseEntity.ok(new MyPayoutsDto(
                config != null && config.getStripeAccountId() != null,
                config != null && config.isOnboardingCompleted(),
                records));
    }

    /** Account Session pour l'onboarding EMBARQUÉ (le pro ne quitte pas Baitly). */
    @PostMapping("/account-session")
    public ResponseEntity<AccountSessionDto> createAccountSession(@AuthenticationPrincipal Jwt jwt) {
        User me = payoutService.requireCurrentUser(jwt.getSubject());
        Long orgId = tenantContext.getRequiredOrganizationId();
        try {
            String clientSecret = payoutService.createAccountSession(me, orgId);
            return ResponseEntity.ok(new AccountSessionDto(clientSecret));
        } catch (StripeException e) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_GATEWAY,
                    "Stripe indisponible : " + e.getMessage());
        }
    }

    /**
     * AccountLink d'onboarding hébergé — flux MOBILE (navigateur in-app). Les
     * composants embarqués étant web-only, le mobile ouvre cette URL Stripe puis
     * appelle {@code /refresh-status} au retour.
     */
    @PostMapping("/onboarding-link")
    public ResponseEntity<OnboardingLinkDto> createOnboardingLink(@AuthenticationPrincipal Jwt jwt) {
        User me = payoutService.requireCurrentUser(jwt.getSubject());
        Long orgId = tenantContext.getRequiredOrganizationId();
        try {
            String url = payoutService.generateOnboardingLink(me, orgId);
            return ResponseEntity.ok(new OnboardingLinkDto(url));
        } catch (StripeException e) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_GATEWAY,
                    "Stripe indisponible : " + e.getMessage());
        }
    }

    /** Rafraîchit le statut d'onboarding depuis Stripe (retour du composant embarqué). */
    @PostMapping("/refresh-status")
    public ResponseEntity<MyPayoutsDto> refreshStatus(@AuthenticationPrincipal Jwt jwt) {
        User me = payoutService.requireCurrentUser(jwt.getSubject());
        Long orgId = tenantContext.getRequiredOrganizationId();
        try {
            payoutService.refreshOnboardingStatus(me.getId(), orgId);
        } catch (StripeException e) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_GATEWAY,
                    "Stripe indisponible : " + e.getMessage());
        }
        return getMyPayouts(jwt);
    }

    /** Versements de l'org — staff plateforme (vue admin). */
    @GetMapping("/org")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
    public ResponseEntity<List<PayoutRecordDto>> listOrgPayouts() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(payoutService.listRecordsForOrg(orgId).stream()
                .map(PayoutRecordDto::from)
                .toList());
    }

    /** Aperçu sans mouvement PSP, limité à l'organisation courante. */
    @GetMapping("/{recordId}/retry-preview")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
    public com.clenzy.dto.HousekeeperPayoutDtos.RetryQuote previewRetry(@PathVariable Long recordId) {
        return payoutService.previewRetry(recordId, tenantContext.getRequiredOrganizationId());
    }

    /** Relance manuelle d'un versement FAILED/BLOCKED avec les montants confirmés. */
    @PostMapping("/{recordId}/retry")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
    public ResponseEntity<PayoutRecordDto> retryPayout(@PathVariable Long recordId,
            @jakarta.validation.Valid @RequestBody com.clenzy.dto.HousekeeperPayoutDtos.RetryRequest request) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(PayoutRecordDto.from(payoutService.retryPayout(recordId, orgId,
                new com.clenzy.dto.HousekeeperPayoutDtos.RetryQuote(request.amount(), request.commissionAmount()))));
    }
}
