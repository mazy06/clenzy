package com.clenzy.controller;

import com.clenzy.model.Organization;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/settings/sepa-debtor")
@PreAuthorize("isAuthenticated()")
public class SepaDebtorSettingsController {

    private final OrganizationRepository organizationRepository;
    private final TenantContext tenantContext;

    public SepaDebtorSettingsController(OrganizationRepository organizationRepository,
                                         TenantContext tenantContext) {
        this.organizationRepository = organizationRepository;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public ResponseEntity<SepaDebtorConfigResponse> getSepaDebtorConfig() {
        Long orgId = tenantContext.getOrganizationId();
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new IllegalArgumentException("Organisation introuvable"));

        String maskedIban = maskIban(org.getSepaDebtorIban());
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
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new IllegalArgumentException("Organisation introuvable"));

        if (request.name() != null) {
            org.setSepaDebtorName(request.name().trim());
        }
        if (request.iban() != null) {
            String cleanIban = request.iban().replaceAll("\\s", "").toUpperCase();
            if (cleanIban.length() < 15 || cleanIban.length() > 34) {
                throw new IllegalArgumentException("L'IBAN doit contenir entre 15 et 34 caracteres");
            }
            org.setSepaDebtorIban(cleanIban);
        }
        if (request.bic() != null) {
            String cleanBic = request.bic().replaceAll("\\s", "").toUpperCase();
            if (!cleanBic.matches("^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$")) {
                throw new IllegalArgumentException("Le BIC doit contenir 8 ou 11 caracteres alphanumeriques au format SWIFT");
            }
            org.setSepaDebtorBic(cleanBic);
        }

        organizationRepository.save(org);

        return new SepaDebtorConfigResponse(
                org.getSepaDebtorName(),
                maskIban(org.getSepaDebtorIban()),
                org.getSepaDebtorBic(),
                true
        );
    }

    private String maskIban(String iban) {
        if (iban == null || iban.length() < 8) return null;
        return iban.substring(0, 4) + "****" + iban.substring(iban.length() - 4);
    }

    public record SepaDebtorConfigResponse(String name, String iban, String bic, boolean configured) {}
    public record UpdateSepaDebtorRequest(String name, String iban, String bic) {}
}
