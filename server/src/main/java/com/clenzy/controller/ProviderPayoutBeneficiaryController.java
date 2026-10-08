package com.clenzy.controller;

import com.clenzy.service.payout.ProviderPayoutBeneficiaryService;
import com.clenzy.service.payout.HousekeeperPayoutService;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/** Décision financière réservée au staff plateforme, sur la mission de l'organisation courante. */
@RestController
@RequestMapping("/api/interventions/{missionId}/payout-beneficiary")
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
public class ProviderPayoutBeneficiaryController {
    public record OrganizationChoice(@NotNull @Positive Long organizationId) {}
    private final ProviderPayoutBeneficiaryService service;
    private final TenantContext tenant;
    private final HousekeeperPayoutService payouts;
    public ProviderPayoutBeneficiaryController(ProviderPayoutBeneficiaryService service, TenantContext tenant,
            HousekeeperPayoutService payouts) {
        this.service = service; this.tenant = tenant; this.payouts = payouts;
    }
    @GetMapping
    public ProviderPayoutBeneficiaryService.Choice choice(@PathVariable Long missionId) {
        return service.choice(missionId, tenant.getRequiredOrganizationId());
    }
    @PutMapping
    public ProviderPayoutBeneficiaryService.Choice select(@PathVariable Long missionId,
            @Valid @RequestBody OrganizationChoice choice, @AuthenticationPrincipal Jwt jwt) {
        Long orgId = tenant.getRequiredOrganizationId();
        var selected = service.selectOrganization(missionId, orgId, choice.organizationId(), jwt.getSubject());
        // La décision est commitée avant toute tentative de transfert ; les contrôles de mission restent appliqués.
        payouts.processCompletedMission(missionId, orgId);
        return selected;
    }
}
