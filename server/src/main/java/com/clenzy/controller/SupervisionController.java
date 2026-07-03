package com.clenzy.controller;

import com.clenzy.dto.PayoutReminderDto;
import com.clenzy.dto.SupervisionActivitySnapshotDto;
import com.clenzy.dto.SupervisionScanResultDto;
import com.clenzy.dto.SupervisionSuggestionDto;
import com.clenzy.dto.UnpaidServiceRequestCardDto;
import com.clenzy.service.PayoutReminderService;
import com.clenzy.service.UnpaidServiceRequestCardService;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import com.clenzy.service.agent.supervision.SupervisionScanService;
import com.clenzy.service.agent.supervision.SupervisionSuggestionService;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Données runtime de la constellation Superviseur (feed + métriques réelles).
 *
 * <p>Distinct de {@link SupervisionConfigController} (config) ; même base path,
 * mêmes rôles de lecture. Ownership de la propriété validé dans le service.</p>
 */
@RestController
@RequestMapping("/api/ai/supervision")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST','SUPERVISOR')")
public class SupervisionController {

    private final SupervisionActivityService activityService;
    private final SupervisionScanService scanService;
    private final SupervisionSuggestionService suggestionService;
    private final PayoutReminderService payoutReminderService;
    private final UnpaidServiceRequestCardService unpaidServiceRequestCardService;
    private final TenantContext tenantContext;

    public SupervisionController(SupervisionActivityService activityService,
                                 SupervisionScanService scanService,
                                 SupervisionSuggestionService suggestionService,
                                 PayoutReminderService payoutReminderService,
                                 UnpaidServiceRequestCardService unpaidServiceRequestCardService,
                                 TenantContext tenantContext) {
        this.activityService = activityService;
        this.scanService = scanService;
        this.suggestionService = suggestionService;
        this.payoutReminderService = payoutReminderService;
        this.unpaidServiceRequestCardService = unpaidServiceRequestCardService;
        this.tenantContext = tenantContext;
    }

    /** GET /api/ai/supervision/activity/{propertyId} — feed + actions récentes. */
    @GetMapping("/activity/{propertyId}")
    public ResponseEntity<SupervisionActivitySnapshotDto> activity(@PathVariable Long propertyId) {
        return ResponseEntity.ok(activityService.getSnapshot(propertyId));
    }

    /**
     * POST /api/ai/supervision/scan/{propertyId} — lance un scan manuel de la
     * propriété (revue proactive multi-agent). Synchrone : renvoie le bilan
     * (actions journalisées + suggestions en attente + synthèse).
     */
    @PostMapping("/scan/{propertyId}")
    public ResponseEntity<SupervisionScanResultDto> scan(@PathVariable Long propertyId,
                                                         @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(scanService.scan(propertyId, jwt));
    }

    /** GET /api/ai/supervision/suggestions/{propertyId} — file org-scopée en attente. */
    @GetMapping("/suggestions/{propertyId}")
    public ResponseEntity<List<SupervisionSuggestionDto>> suggestions(@PathVariable Long propertyId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(suggestionService.list(orgId, propertyId));
    }

    /** POST /api/ai/supervision/suggestions/{id}/dismiss — rejette une suggestion. */
    @PostMapping("/suggestions/{id}/dismiss")
    public ResponseEntity<Void> dismissSuggestion(@PathVariable Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        suggestionService.dismiss(orgId, id);
        return ResponseEntity.noContent().build();
    }

    /**
     * POST /api/ai/supervision/suggestions/{id}/apply — applique l'action portée
     * par une suggestion actionnable (ex. baisse de prix). Org-scopé, idempotent
     * (CAS PENDING→APPLIED côté service). 400 si non actionnable / déjà traitée.
     */
    @PostMapping("/suggestions/{id}/apply")
    public ResponseEntity<Void> applySuggestion(@PathVariable Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        suggestionService.apply(orgId, id);
        return ResponseEntity.noContent().build();
    }

    /**
     * GET /api/ai/supervision/payout-reminder — rappel J-1 de génération d'un lot
     * de reversement (module Finance de la constellation), ou 204 si rien à afficher.
     * Par utilisateur (opt-out + accusé propres au demandeur).
     */
    @GetMapping("/payout-reminder")
    public ResponseEntity<PayoutReminderDto> payoutReminder(@AuthenticationPrincipal Jwt jwt) {
        return payoutReminderService.currentReminder(jwt.getSubject())
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    /** POST /api/ai/supervision/payout-reminder/ack — « Info reçue » (accuse l'échéance courante). */
    @PostMapping("/payout-reminder/ack")
    public ResponseEntity<Void> ackPayoutReminder(@AuthenticationPrincipal Jwt jwt) {
        payoutReminderService.acknowledge(jwt.getSubject());
        return ResponseEntity.noContent().build();
    }

    /** POST /api/ai/supervision/payout-reminder/opt-out — « Ne plus afficher » (opt-out définitif). */
    @PostMapping("/payout-reminder/opt-out")
    public ResponseEntity<Void> optOutPayoutReminder(@AuthenticationPrincipal Jwt jwt) {
        payoutReminderService.optOut(jwt.getSubject());
        return ResponseEntity.noContent().build();
    }

    /**
     * GET /api/ai/supervision/unpaid-service-requests/{propertyId} — cartes déterministes
     * « demandes de service impayées » du logement (une par ServiceRequest non réglée),
     * ou liste vide si tout est réglé. Org-scopé (pas d'IDOR). Le règlement réutilise le
     * flux SR existant : {@code POST /service-requests/{id}/create-payment-session}.
     */
    @GetMapping("/unpaid-service-requests/{propertyId}")
    public ResponseEntity<List<UnpaidServiceRequestCardDto>> unpaidServiceRequests(@PathVariable Long propertyId) {
        return ResponseEntity.ok(unpaidServiceRequestCardService.forProperty(propertyId));
    }
}
