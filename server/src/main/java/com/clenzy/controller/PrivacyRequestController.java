package com.clenzy.controller;

import com.clenzy.model.PrivacyRequest;
import com.clenzy.service.PrivacyRequestService;
import com.clenzy.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Demandes RGPD (Réglages > Confidentialité, M9). L'effacement passe aussi par
 * la carte GDPR_ERASE de l'agent Conformité — même chemin service.
 */
@RestController
@RequestMapping("/api/privacy-requests")
@PreAuthorize("isAuthenticated()")
public class PrivacyRequestController {

    /** Shape stable (jamais l'entité — règle audit n°5). */
    public record PrivacyRequestDto(Long id, Long guestId, String requesterEmail, String type,
                                    String status, LocalDate requestedAt, LocalDate dueAt,
                                    String handledBy, String notes, String report) {
        static PrivacyRequestDto from(PrivacyRequest r) {
            return new PrivacyRequestDto(r.getId(), r.getGuestId(), r.getRequesterEmail(),
                    r.getType().name(), r.getStatus().name(), r.getRequestedAt(), r.getDueAt(),
                    r.getHandledBy(), r.getNotes(), r.getReport());
        }
    }

    public record CreateRequest(Long guestId, String requesterEmail, String type, String notes) {}

    private final PrivacyRequestService privacyRequestService;
    private final TenantContext tenantContext;

    public PrivacyRequestController(PrivacyRequestService privacyRequestService,
                                    TenantContext tenantContext) {
        this.privacyRequestService = privacyRequestService;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    @Operation(summary = "Lister les demandes RGPD de l'organisation")
    public ResponseEntity<List<PrivacyRequestDto>> list() {
        return ResponseEntity.ok(privacyRequestService.list(tenantContext.getRequiredOrganizationId())
                .stream().map(PrivacyRequestDto::from).toList());
    }

    @PostMapping
    @Operation(summary = "Saisir une demande RGPD reçue (échéance légale J+30 posée automatiquement)")
    public ResponseEntity<PrivacyRequestDto> create(@RequestBody CreateRequest request) {
        return ResponseEntity.ok(PrivacyRequestDto.from(privacyRequestService.create(
                tenantContext.getRequiredOrganizationId(), request.guestId(),
                request.requesterEmail(),
                request.type() != null ? PrivacyRequest.Type.valueOf(request.type()) : null,
                request.notes())));
    }

    @PostMapping("/{id}/erase")
    @Operation(summary = "Exécuter l'effacement sélectif (IRRÉVERSIBLE — PII purgées, obligations légales conservées)")
    public ResponseEntity<PrivacyRequestDto> erase(@PathVariable Long id,
                                                   @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(PrivacyRequestDto.from(privacyRequestService.executeErasure(
                id, tenantContext.getRequiredOrganizationId(),
                "user:" + (jwt != null ? jwt.getSubject() : "unknown"))));
    }

    @PostMapping("/{id}/refuse")
    @Operation(summary = "Refuser la demande (motif tracé)")
    public ResponseEntity<Void> refuse(@PathVariable Long id,
                                       @AuthenticationPrincipal Jwt jwt,
                                       @RequestBody(required = false) Map<String, String> body) {
        privacyRequestService.refuse(id, tenantContext.getRequiredOrganizationId(),
                "user:" + (jwt != null ? jwt.getSubject() : "unknown"),
                body != null ? body.get("reason") : null);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/complete")
    @Operation(summary = "Clore manuellement une demande d'accès/rectification traitée hors système")
    public ResponseEntity<Void> complete(@PathVariable Long id,
                                         @AuthenticationPrincipal Jwt jwt) {
        privacyRequestService.completeManually(id, tenantContext.getRequiredOrganizationId(),
                "user:" + (jwt != null ? jwt.getSubject() : "unknown"));
        return ResponseEntity.noContent().build();
    }
}
