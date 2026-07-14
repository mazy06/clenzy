package com.clenzy.controller;

import com.clenzy.dto.IssueDtos.CreateIssueRequest;
import com.clenzy.dto.IssueDtos.DismissIssueRequest;
import com.clenzy.dto.IssueDtos.IssueDto;
import com.clenzy.dto.IssueDtos.QualifyIssueRequest;
import com.clenzy.model.Issue.IssueStatus;
import com.clenzy.service.IssueService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Anomalies terrain (Moteur Ménage 3C / P10).
 * Création ouverte aux rôles terrain (housekeeper/technicien) et gestionnaires ;
 * qualification/conversion/rejet réservées aux gestionnaires (l'ownership org
 * est validé dans {@link IssueService} — fail-closed). Controller mince
 * (règle ArchUnit) : délégation au service, aucune logique ni repository ici.
 */
@RestController
@RequestMapping("/api/issues")
@PreAuthorize("isAuthenticated()")
public class IssueController {

    private final IssueService issueService;

    public IssueController(IssueService issueService) {
        this.issueService = issueService;
    }

    /** Signalement — le signaleur est TOUJOURS le porteur du JWT. */
    @PostMapping
    public ResponseEntity<IssueDto> create(@Valid @RequestBody CreateIssueRequest request,
                                           @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(issueService.create(request, jwt.getSubject()));
    }

    /**
     * Liste org-scopée, filtres optionnels statut / logement.
     * {@code mine=true} : restreint aux anomalies signalées par le porteur du JWT
     * (suivi « Mes signalements » mobile).
     */
    @GetMapping
    public ResponseEntity<List<IssueDto>> list(
            @RequestParam(required = false) IssueStatus status,
            @RequestParam(required = false) Long propertyId,
            @RequestParam(required = false, defaultValue = "false") boolean mine,
            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(issueService.list(status, propertyId, mine ? jwt.getSubject() : null));
    }

    @GetMapping("/{id}")
    public ResponseEntity<IssueDto> get(@PathVariable Long id) {
        return ResponseEntity.ok(issueService.get(id));
    }

    /** Qualification (catégorie / sévérité / chiffrage) — gestionnaires. */
    @PutMapping("/{id}/qualify")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER', 'HOST')")
    public ResponseEntity<IssueDto> qualify(@PathVariable Long id,
                                            @Valid @RequestBody QualifyIssueRequest request) {
        return ResponseEntity.ok(issueService.qualify(id, request));
    }

    /** Conversion en demande de maintenance pré-chiffrée — gestionnaires. */
    @PutMapping("/{id}/convert")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER', 'HOST')")
    public ResponseEntity<IssueDto> convert(@PathVariable Long id,
                                            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(issueService.convert(id, jwt.getSubject()));
    }

    /** Rejet — gestionnaires. */
    @PutMapping("/{id}/dismiss")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER', 'HOST')")
    public ResponseEntity<IssueDto> dismiss(@PathVariable Long id,
                                            @RequestBody(required = false) @Valid DismissIssueRequest request) {
        return ResponseEntity.ok(issueService.dismiss(id, request));
    }
}
