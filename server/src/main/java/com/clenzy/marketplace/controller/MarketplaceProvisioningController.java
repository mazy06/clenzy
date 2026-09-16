package com.clenzy.marketplace.controller;

import com.clenzy.marketplace.service.MarketplaceProvisioningJobs;
import com.clenzy.marketplace.service.MarketplaceActivationDeliveries;
import com.clenzy.exception.NotFoundException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/** Diagnostic réservé à l'équipe plateforme, comme la modération des candidatures. */
@RestController
@RequestMapping("/api/admin/marketplace/providers")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
public class MarketplaceProvisioningController {
    private final MarketplaceProvisioningJobs jobs;
    private final MarketplaceActivationDeliveries deliveries;
    public MarketplaceProvisioningController(MarketplaceProvisioningJobs jobs, MarketplaceActivationDeliveries deliveries) {
        this.jobs = jobs;
        this.deliveries = deliveries;
    }

    @GetMapping("/{id}/activation-delivery")
    public MarketplaceActivationDeliveries.State invitation(@PathVariable Long id) {
        return deliveries.state(id).orElseThrow(() -> new NotFoundException("Aucune invitation suivie pour cette fiche"));
    }

    @GetMapping("/{id}/provisioning")
    public MarketplaceProvisioningJobs.State state(@PathVariable Long id) {
        return jobs.state(id).orElseThrow(() -> new NotFoundException("Aucun provisionnement enregistré pour cette fiche"));
    }

    @PostMapping("/{id}/provisioning/retry")
    @ResponseStatus(org.springframework.http.HttpStatus.ACCEPTED)
    public void retry(@PathVariable Long id,
                      @org.springframework.security.core.annotation.AuthenticationPrincipal org.springframework.security.oauth2.jwt.Jwt jwt) {
        if (jwt == null || jwt.getSubject() == null) throw new org.springframework.security.access.AccessDeniedException("Identité requise");
        if (!jobs.retry(id, jwt.getSubject())) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,
                    "Seul un provisionnement en échec ou interrompu depuis quinze minutes peut être repris");
        }
    }
}
