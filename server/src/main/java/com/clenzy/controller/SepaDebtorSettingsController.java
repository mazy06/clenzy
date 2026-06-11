package com.clenzy.controller;

import com.clenzy.model.Organization;
import com.clenzy.service.OrganizationService;
import com.clenzy.tenant.TenantContext;
import com.clenzy.util.IbanMasker;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/settings/sepa-debtor")
@PreAuthorize("isAuthenticated()")
public class SepaDebtorSettingsController {

    private final OrganizationService organizationService;
    private final TenantContext tenantContext;

    public SepaDebtorSettingsController(OrganizationService organizationService,
                                         TenantContext tenantContext) {
        this.organizationService = organizationService;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public ResponseEntity<SepaDebtorConfigResponse> getSepaDebtorConfig() {
        Long orgId = tenantContext.getOrganizationId();
        Organization org = organizationService.findById(orgId)
                .orElseThrow(() -> new IllegalArgumentException("Organisation introuvable"));

        String maskedIban = IbanMasker.mask(org.getSepaDebtorIban());
        return ResponseEntity.ok(new SepaDebtorConfigResponse(
                org.getSepaDebtorName(),
                maskedIban,
                org.getSepaDebtorBic(),
                org.getSepaDebtorIban() != null && !org.getSepaDebtorIban().isBlank()
        ));
    }

    @PutMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN')")
    public SepaDebtorConfigResponse updateSepaDebtorConfig(@RequestBody UpdateSepaDebtorRequest request) {
        Long orgId = tenantContext.getOrganizationId();
        Organization org = organizationService.updateSepaDebtorConfig(
                orgId, request.name(), request.iban(), request.bic());

        return new SepaDebtorConfigResponse(
                org.getSepaDebtorName(),
                IbanMasker.mask(org.getSepaDebtorIban()),
                org.getSepaDebtorBic(),
                true
        );
    }

    public record SepaDebtorConfigResponse(String name, String iban, String bic, boolean configured) {}
    public record UpdateSepaDebtorRequest(String name, String iban, String bic) {}
}
