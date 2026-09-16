package com.clenzy.controller;

import com.clenzy.model.ServiceQuoteAmendment;
import com.clenzy.service.ServiceQuoteAmendmentService;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api")
@PreAuthorize("isAuthenticated()")
public class ServiceQuoteAmendmentController {
    private final ServiceQuoteAmendmentService service;
    private final TenantContext tenant;
    public ServiceQuoteAmendmentController(ServiceQuoteAmendmentService service, TenantContext tenant) {
        this.service = service; this.tenant = tenant;
    }
    public record Proposal(@NotNull BigDecimal amount, String reason) {}
    public record Decision(@NotNull Long version) {}
    public record AmendmentDto(Long id, long version, Long quoteId, Long interventionId,
                               BigDecimal originalAmount, BigDecimal proposedAmount, String currency,
                               String reason, String status, Long proposedBy, Instant createdAt,
                               Long decidedBy, Instant decidedAt) {
        static AmendmentDto from(ServiceQuoteAmendment proposal) {
            return new AmendmentDto(proposal.getId(), proposal.getVersion(), proposal.getQuoteId(),
                    proposal.getInterventionId(), proposal.getOriginalAmount(), proposal.getProposedAmount(),
                    proposal.getCurrency(), proposal.getReason(), proposal.getStatus().name(),
                    proposal.getProposedBy(), proposal.getCreatedAt(), proposal.getDecidedBy(), proposal.getDecidedAt());
        }
    }
    @GetMapping("/service-quotes/{quoteId}/amendments")
    public List<AmendmentDto> list(@PathVariable Long quoteId, @AuthenticationPrincipal Jwt jwt) {
        return service.list(quoteId, tenant.getRequiredOrganizationId(), jwt).stream().map(AmendmentDto::from).toList();
    }
    @GetMapping("/service-quotes/{quoteId}/agreement")
    public com.clenzy.service.ServiceQuoteAgreementService.Agreement currentAgreement(
            @PathVariable Long quoteId, @AuthenticationPrincipal Jwt jwt) {
        return service.currentAgreement(quoteId, tenant.getRequiredOrganizationId(), jwt);
    }
    @GetMapping("/service-quotes/{quoteId}/amendment-access")
    public ServiceQuoteAmendmentService.Access access(@PathVariable Long quoteId, @AuthenticationPrincipal Jwt jwt) {
        return service.access(quoteId, tenant.getRequiredOrganizationId(), jwt);
    }
    @PostMapping("/service-quotes/{quoteId}/amendments")
    public AmendmentDto propose(@PathVariable Long quoteId, @Valid @RequestBody Proposal body,
                                @AuthenticationPrincipal Jwt jwt) {
        return AmendmentDto.from(service.propose(quoteId, tenant.getRequiredOrganizationId(), jwt, body.amount(), body.reason()));
    }
    @PostMapping("/service-quote-amendments/{id}/withdraw")
    public AmendmentDto withdraw(@PathVariable Long id, @Valid @RequestBody Decision body,
                                 @AuthenticationPrincipal Jwt jwt) {
        return AmendmentDto.from(service.close(id, tenant.getRequiredOrganizationId(), jwt, body.version(), true));
    }
    @PostMapping("/service-quote-amendments/{id}/reject")
    public AmendmentDto reject(@PathVariable Long id, @Valid @RequestBody Decision body,
                               @AuthenticationPrincipal Jwt jwt) {
        return AmendmentDto.from(service.close(id, tenant.getRequiredOrganizationId(), jwt, body.version(), false));
    }
    @PostMapping("/service-quote-amendments/{id}/accept")
    public AmendmentDto accept(@PathVariable Long id, @Valid @RequestBody Decision body,
                               @AuthenticationPrincipal Jwt jwt) {
        return AmendmentDto.from(service.accept(id, tenant.getRequiredOrganizationId(), jwt, body.version()));
    }
}
