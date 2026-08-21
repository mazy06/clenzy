package com.clenzy.controller;

import com.clenzy.dto.QuoteLineDto;
import com.clenzy.model.ServiceQuote;
import com.clenzy.service.ServiceQuoteService;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
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

    /** Lecture seule du detail JSON : pas d'etat, donc partageable. */
    private static final ObjectMapper LINES_MAPPER = new ObjectMapper();

    /** Shape stable (jamais l'entité — règle audit n°5). */
    public record ServiceQuoteDto(Long id, Long interventionId, String providerName,
                                  String providerEmail, String providerPhone,
                                  BigDecimal amount, String currency, LocalDate validUntil,
                                  LocalDate earliestStartDate, String description, String status,
                                  Long providerUserId,
                                  /** Generation du PDF du devis — de quoi l'ouvrir et le transmettre. */
                                  Long documentGenerationId,
                                  /** Detail chiffre : ce que le total recouvre. */
                                  List<QuoteLineDto> lines,
                                  /** Acompte exigible a la validation (maintenance). */
                                  BigDecimal depositPercent,
                                  BigDecimal depositAmount) {
        static ServiceQuoteDto from(ServiceQuote q) {
            return new ServiceQuoteDto(q.getId(), q.getInterventionId(), q.getProviderName(),
                    q.getProviderEmail(), q.getProviderPhone(), q.getAmount(), q.getCurrency(),
                    q.getValidUntil(), q.getEarliestStartDate(), q.getDescription(),
                    q.getStatus().name(), q.getProviderUserId(), parseGenerationId(q.getDocumentRef()),
                    parseLines(q.getLines()), q.getDepositPercent(), q.getDepositAmount());
        }

        /** Un detail illisible ne doit pas faire echouer toute la liste. */
        private static List<QuoteLineDto> parseLines(String json) {
            if (json == null || json.isBlank()) return List.of();
            try {
                return LINES_MAPPER.readValue(json, new TypeReference<List<QuoteLineDto>>() {});
            } catch (Exception e) {
                return List.of();
            }
        }

        /** `documentRef` est un champ libre : un contenu non numerique n'est pas une generation. */
        private static Long parseGenerationId(String documentRef) {
            try {
                return documentRef != null ? Long.valueOf(documentRef) : null;
            } catch (NumberFormatException e) {
                return null;
            }
        }
    }

    /** Le detail est stocke tel quel ; une serialisation qui echoue laisse NULL. */
    private static String serializeLines(List<QuoteLineDto> lines) {
        if (lines == null || lines.isEmpty()) return null;
        try {
            return LINES_MAPPER.writeValueAsString(lines);
        } catch (Exception e) {
            return null;
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
        quote.setLines(serializeLines(request.lines()));
        return ResponseEntity.ok(ServiceQuoteDto.from(
                serviceQuoteService.create(tenantContext.getRequiredOrganizationId(), quote)));
    }

    @GetMapping("/service-quotes/mine")
    @Operation(summary = "Mes devis — ceux que j'ai soumis")
    public ResponseEntity<List<ServiceQuoteDto>> listMine(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(serviceQuoteService
                .listMine(jwt.getSubject(), tenantContext.getRequiredOrganizationId())
                .stream().map(ServiceQuoteDto::from).toList());
    }

    @GetMapping("/service-quotes/my-agreed-rates")
    @Operation(summary = "Mes tarifs convenus par logement (devis deja approuves)")
    public ResponseEntity<List<AgreedRateDto>> myAgreedRates(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(serviceQuoteService
                .listMyAgreedRates(jwt.getSubject(), tenantContext.getRequiredOrganizationId())
                .stream()
                .map(r -> new AgreedRateDto(r.getPropertyId(), r.getAmount(), r.getCurrency(), r.getAgreedAt()))
                .toList());
    }

    /** Tarif deja approuve pour un logement — shape stable, jamais l'entite. */
    public record AgreedRateDto(Long propertyId, BigDecimal amount, String currency,
                                java.time.LocalDateTime agreedAt) {}

    @PostMapping("/interventions/{interventionId}/quotes/mine")
    @Operation(summary = "Soumettre MON devis sur une intervention (intervenant)")
    public ResponseEntity<ServiceQuoteDto> submitMine(@PathVariable Long interventionId,
                                                @RequestBody ServiceQuoteDto request,
                                                @AuthenticationPrincipal Jwt jwt) {
        final ServiceQuote quote = new ServiceQuote();
        quote.setInterventionId(interventionId);
        quote.setAmount(request.amount());
        if (request.currency() != null) quote.setCurrency(request.currency());
        quote.setValidUntil(request.validUntil());
        quote.setEarliestStartDate(request.earliestStartDate());
        quote.setDescription(request.description());
        quote.setLines(serializeLines(request.lines()));
        // Nom, email et auteur viennent du JWT — pas du corps de requete.
        return ResponseEntity.ok(ServiceQuoteDto.from(serviceQuoteService.submitAsProvider(
                tenantContext.getRequiredOrganizationId(), quote, jwt.getSubject())));
    }

    @PostMapping("/service-quotes/{id}/reject")
    @Operation(summary = "Ecarter un devis sans en retenir un autre")
    public ResponseEntity<ServiceQuoteDto> reject(@PathVariable Long id,
                                                  @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(ServiceQuoteDto.from(serviceQuoteService.reject(
                id, tenantContext.getRequiredOrganizationId(), jwt)));
    }

    @PostMapping("/service-quotes/{id}/approve")
    @Operation(summary = "Approuver un devis (les concurrents sont écartés, coût reporté)")
    public ResponseEntity<ServiceQuoteDto> approve(@PathVariable Long id,
                                                   @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(ServiceQuoteDto.from(serviceQuoteService.approve(
                id, tenantContext.getRequiredOrganizationId(),
                "user:" + (jwt != null ? jwt.getSubject() : "unknown"), jwt)));
    }

    @DeleteMapping("/service-quotes/{id}")
    @Operation(summary = "Supprimer un devis non approuvé")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        serviceQuoteService.delete(id, tenantContext.getRequiredOrganizationId());
        return ResponseEntity.noContent().build();
    }
}
