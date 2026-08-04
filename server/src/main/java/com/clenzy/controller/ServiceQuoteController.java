package com.clenzy.controller;

import com.clenzy.model.ServiceQuote;
import com.clenzy.service.ServiceQuoteService;
import com.clenzy.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Devis prestataires d'une intervention (fiche intervention > Devis, M4).
 * Alimente la carte QUOTE_APPROVAL de l'agent Opérations.
 */
@RestController
@RequestMapping("/api")
@PreAuthorize("isAuthenticated()")
public class ServiceQuoteController {

    /** Shape stable (jamais l'entité — règle audit n°5). */
    public record ServiceQuoteDto(Long id, Long interventionId, String providerName,
                                  String providerEmail, String providerPhone,
                                  BigDecimal amount, String currency, LocalDate validUntil,
                                  LocalDate earliestStartDate, String description, String status) {
        static ServiceQuoteDto from(ServiceQuote q) {
            return new ServiceQuoteDto(q.getId(), q.getInterventionId(), q.getProviderName(),
                    q.getProviderEmail(), q.getProviderPhone(), q.getAmount(), q.getCurrency(),
                    q.getValidUntil(), q.getEarliestStartDate(), q.getDescription(),
                    q.getStatus().name());
        }
    }

    private final ServiceQuoteService serviceQuoteService;
    private final TenantContext tenantContext;

    public ServiceQuoteController(ServiceQuoteService serviceQuoteService,
                                  TenantContext tenantContext) {
        this.serviceQuoteService = serviceQuoteService;
        this.tenantContext = tenantContext;
    }

    @GetMapping("/interventions/{interventionId}/quotes")
    @Operation(summary = "Lister les devis d'une intervention")
    public ResponseEntity<List<ServiceQuoteDto>> list(@PathVariable Long interventionId) {
        return ResponseEntity.ok(serviceQuoteService
                .listForIntervention(interventionId, tenantContext.getRequiredOrganizationId())
                .stream().map(ServiceQuoteDto::from).toList());
    }

    @PostMapping("/interventions/{interventionId}/quotes")
    @Operation(summary = "Saisir un devis reçu (l'intervention est re-validée org)")
    public ResponseEntity<ServiceQuoteDto> create(@PathVariable Long interventionId,
                                                  @RequestBody ServiceQuoteDto request) {
        final ServiceQuote quote = new ServiceQuote();
        quote.setInterventionId(interventionId);
        quote.setProviderName(request.providerName());
        quote.setProviderEmail(request.providerEmail());
        quote.setProviderPhone(request.providerPhone());
        quote.setAmount(request.amount());
        if (request.currency() != null) quote.setCurrency(request.currency());
        quote.setValidUntil(request.validUntil());
        quote.setEarliestStartDate(request.earliestStartDate());
        quote.setDescription(request.description());
        return ResponseEntity.ok(ServiceQuoteDto.from(
                serviceQuoteService.create(tenantContext.getRequiredOrganizationId(), quote)));
    }

    @PostMapping("/service-quotes/{id}/approve")
    @Operation(summary = "Approuver un devis (les concurrents sont écartés, coût reporté)")
    public ResponseEntity<ServiceQuoteDto> approve(@PathVariable Long id,
                                                   @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(ServiceQuoteDto.from(serviceQuoteService.approve(
                id, tenantContext.getRequiredOrganizationId(),
                "user:" + (jwt != null ? jwt.getSubject() : "unknown"))));
    }

    @DeleteMapping("/service-quotes/{id}")
    @Operation(summary = "Supprimer un devis non approuvé")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        serviceQuoteService.delete(id, tenantContext.getRequiredOrganizationId());
        return ResponseEntity.noContent().build();
    }
}
