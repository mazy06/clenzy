package com.clenzy.integration.compliance.controller;

import com.clenzy.integration.compliance.submission.ComplianceProviderPendingException;
import com.clenzy.integration.compliance.submission.ComplianceSubmissionService;
import com.clenzy.integration.compliance.submission.DeclarationSummaryDto;
import com.clenzy.integration.compliance.submission.SubmissionResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Controller de consultation du statut + retry manuel de la soumission d'une fiche de police
 * au provider de conformité.
 *
 * <ul>
 *   <li>{@code GET  /api/compliance/declarations/by-reservation/{reservationId}} — statut (sans PII).</li>
 *   <li>{@code POST /api/compliance/declarations/{id}/submit} — (re)soumission.</li>
 * </ul>
 *
 * <p>Controller <b>mince</b> — délègue à {@link ComplianceSubmissionService} (ownership org validé
 * côté service). Restreint à HOST / SUPER_ADMIN / SUPER_MANAGER.</p>
 */
@RestController
@RequestMapping("/api/compliance/declarations")
@PreAuthorize("hasAnyRole('HOST','SUPER_ADMIN','SUPER_MANAGER')")
public class ComplianceSubmissionController {

    private static final Logger log = LoggerFactory.getLogger(ComplianceSubmissionController.class);

    private final ComplianceSubmissionService submissionService;

    public ComplianceSubmissionController(ComplianceSubmissionService submissionService) {
        this.submissionService = submissionService;
    }

    @GetMapping("/by-reservation/{reservationId}")
    public ResponseEntity<List<DeclarationSummaryDto>> byReservation(@PathVariable Long reservationId) {
        return ResponseEntity.ok(submissionService.listForReservation(reservationId));
    }

    @PostMapping("/{id}/submit")
    public ResponseEntity<?> submit(@PathVariable Long id) {
        try {
            return submissionService.retrySubmission(id)
                    .<ResponseEntity<?>>map(result -> ResponseEntity.ok(Map.of(
                            "accepted", result.accepted(),
                            "externalReference", result.externalReference() == null ? "" : result.externalReference(),
                            "message", result.message())))
                    // Déclaration introuvable / non COMPLETED / déjà SUBMITTED / pas de connexion ACTIVE.
                    .orElseGet(() -> ResponseEntity.ok(Map.of(
                            "accepted", false,
                            "skipped", true,
                            "message", "Aucune soumission effectuée (déclaration non éligible ou aucun provider connecté).")));
        } catch (ComplianceProviderPendingException e) {
            log.info("Retry soumission déclaration {} : provider {} non intégrable — {}",
                    id, e.getProvider(), e.getMessage());
            return ResponseEntity.status(501).body(Map.of(
                    "accepted", false,
                    "pending", true,
                    "provider", e.getProvider().name(),
                    "message", e.getMessage()));
        }
    }
}
