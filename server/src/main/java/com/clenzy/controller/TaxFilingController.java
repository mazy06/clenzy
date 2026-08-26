package com.clenzy.controller;

import com.clenzy.model.TaxFiling;
import com.clenzy.service.TaxFilingService;
import com.clenzy.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Registre des déclarations de taxe de séjour (Rapports > Taxe de séjour).
 * Vague M-A des modèles métier — statuts DUE/FILED/PAID par trimestre.
 */
@RestController
@RequestMapping("/api/tax-filings")
@PreAuthorize("isAuthenticated()")
public class TaxFilingController {

    /** Shape stable pour l'écran Rapports (jamais l'entité — règle audit n°5). */
    public record TaxFilingDto(Long id, LocalDate periodStart, LocalDate periodEnd,
                               BigDecimal amount, String currency, String status,
                               String paymentReference) {
        static TaxFilingDto from(TaxFiling f) {
            return new TaxFilingDto(f.getId(), f.getPeriodStart(), f.getPeriodEnd(),
                    f.getAmount(), f.getCurrency(), f.getStatus().name(), f.getPaymentReference());
        }
    }

    private final TaxFilingService taxFilingService;
    private final TenantContext tenantContext;

    public TaxFilingController(TaxFilingService taxFilingService, TenantContext tenantContext) {
        this.taxFilingService = taxFilingService;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    @Operation(summary = "Lister les déclarations de taxe de séjour de l'organisation")
    public ResponseEntity<List<TaxFilingDto>> list() {
        return ResponseEntity.ok(taxFilingService.list(tenantContext.getRequiredOrganizationId())
                .stream().map(TaxFilingDto::from).toList());
    }

    @PostMapping("/{id}/mark-filed")
    @Operation(summary = "Marquer la déclaration comme déposée (date de dépôt et référence facultatives)")
    public ResponseEntity<Void> markFiled(@PathVariable Long id,
                                          @RequestBody(required = false) Map<String, String> body) {
        // `depositedOn` est la date du dépôt RÉEL auprès de l'administration ;
        // l'horodatage de saisie est posé par le service dans tous les cas.
        taxFilingService.markFiled(id, tenantContext.getRequiredOrganizationId(),
                parseDepositedOn(body), body != null ? body.get("reference") : null);
        return ResponseEntity.noContent().build();
    }

    /** Date de dépôt du corps de requête — absente ou illisible rend {@code null}. */
    private static java.time.LocalDate parseDepositedOn(Map<String, String> body) {
        final String raw = body == null ? null : body.get("depositedOn");
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return java.time.LocalDate.parse(raw);
        } catch (java.time.format.DateTimeParseException e) {
            return null;
        }
    }

    @PostMapping("/{id}/mark-paid")
    @Operation(summary = "Marquer la déclaration comme payée (référence facultative)")
    public ResponseEntity<Void> markPaid(@PathVariable Long id,
                                         @RequestBody(required = false) Map<String, String> body) {
        taxFilingService.markPaid(id, tenantContext.getRequiredOrganizationId(),
                body != null ? body.get("reference") : null);
        return ResponseEntity.noContent().build();
    }
}
