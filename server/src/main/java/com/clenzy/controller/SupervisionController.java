package com.clenzy.controller;

import com.clenzy.dto.PayoutReminderDto;
import com.clenzy.dto.PortfolioSnapshotDto;
import com.clenzy.dto.SupervisionActivitySnapshotDto;
import com.clenzy.dto.SupervisionConversationMessageDto;
import com.clenzy.dto.SupervisionConversationTurnDto;
import com.clenzy.dto.SupervisionReportDto;
import com.clenzy.dto.SupervisionScanResultDto;
import com.clenzy.dto.SupervisionSuggestionDto;
import com.clenzy.dto.UnpaidServiceRequestCardDto;
import com.clenzy.service.PayoutReminderService;
import com.clenzy.service.UnpaidServiceRequestCardService;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import com.clenzy.service.agent.supervision.SupervisionConversationService;
import com.clenzy.service.agent.supervision.PriceSuggestionService;
import com.clenzy.service.agent.supervision.SupervisionPortfolioService;
import com.clenzy.service.agent.supervision.SupervisionReportService;
import com.clenzy.service.agent.supervision.SupervisionScanService;
import com.clenzy.service.agent.supervision.SupervisionSseRegistry;
import com.clenzy.service.agent.supervision.SupervisionSuggestionService;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

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

    /** Durée de vie d'un flux SSE de supervision (le front se reconnecte à l'échéance). */
    private static final long SSE_TIMEOUT_MS = 30L * 60L * 1000L;

    private final SupervisionActivityService activityService;
    private final SupervisionScanService scanService;
    private final SupervisionSuggestionService suggestionService;
    private final SupervisionPortfolioService portfolioService;
    private final SupervisionReportService reportService;
    private final SupervisionConversationService conversationService;
    private final SupervisionSseRegistry sseRegistry;
    private final PayoutReminderService payoutReminderService;
    private final UnpaidServiceRequestCardService unpaidServiceRequestCardService;
    private final PriceSuggestionService priceSuggestionService;
    private final TenantContext tenantContext;

    public SupervisionController(SupervisionActivityService activityService,
                                 SupervisionScanService scanService,
                                 SupervisionSuggestionService suggestionService,
                                 SupervisionPortfolioService portfolioService,
                                 SupervisionReportService reportService,
                                 SupervisionConversationService conversationService,
                                 SupervisionSseRegistry sseRegistry,
                                 PayoutReminderService payoutReminderService,
                                 UnpaidServiceRequestCardService unpaidServiceRequestCardService,
                                 PriceSuggestionService priceSuggestionService,
                                 TenantContext tenantContext) {
        this.activityService = activityService;
        this.scanService = scanService;
        this.suggestionService = suggestionService;
        this.portfolioService = portfolioService;
        this.reportService = reportService;
        this.conversationService = conversationService;
        this.sseRegistry = sseRegistry;
        this.payoutReminderService = payoutReminderService;
        this.unpaidServiceRequestCardService = unpaidServiceRequestCardService;
        this.priceSuggestionService = priceSuggestionService;
        this.tenantContext = tenantContext;
    }

    /** GET /api/ai/supervision/activity/{propertyId} — feed + actions récentes. */
    @GetMapping("/activity/{propertyId}")
    public ResponseEntity<SupervisionActivitySnapshotDto> activity(@PathVariable Long propertyId) {
        return ResponseEntity.ok(activityService.getSnapshot(propertyId));
    }

    /**
     * GET /api/ai/supervision/stream/{propertyId} — flux SSE temps réel du logement (T6/B6) :
     * nouvelles entrées de feed + résolutions de cartes poussées instantanément à tous les
     * opérateurs (fan-out inter-instances via Redis). Ownership validé (getSnapshot lève si non
     * autorisé). Complète le polling 30 s (baseline), ne le remplace pas.
     */
    @GetMapping(value = "/stream/{propertyId}", produces = "text/event-stream")
    public SseEmitter stream(@PathVariable Long propertyId) {
        activityService.getSnapshot(propertyId); // valide l'ownership org (lève sinon)
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        sseRegistry.register(propertyId, emitter);
        try {
            emitter.send(SseEmitter.event().name("ready").data("{}")); // amorce la connexion
        } catch (Exception ignored) {
            // best-effort : si l'amorce échoue, les callbacks de l'émetteur nettoient le registre
        }
        return emitter;
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

    /**
     * GET /api/ai/supervision/portfolio — snapshot AGRÉGÉ de tous les logements de
     * l'organisation du requester (vue d'ensemble) : agents rollupés, file et journal
     * multi-logements. Org-scopé (org du token), pas d'IDOR.
     */
    @GetMapping("/portfolio")
    public ResponseEntity<PortfolioSnapshotDto> portfolio() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(portfolioService.getSnapshot(orgId));
    }

    /**
     * GET /api/ai/supervision/report — bilan de valeur de la constellation sur 30 jours
     * (org du requester) : actions autonomes, suggestions appliquées/rejetées/en attente,
     * taux d'acceptation et estimation du temps opérateur épargné (ROI).
     */
    @GetMapping("/report")
    public ResponseEntity<SupervisionReportDto> report(
            @RequestParam(name = "windowDays", defaultValue = "30") int windowDays) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(reportService.getReport(orgId, windowDays));
    }

    /**
     * POST /api/ai/supervision/conversation/{propertyId} — persiste des tours de la
     * conversation opérateur ↔ orchestrateur (B7). Best-effort, piloté par le front après
     * un échange. Org + logement scopé (org du token, utilisateur = subject JWT).
     */
    @PostMapping("/conversation/{propertyId}")
    public ResponseEntity<Void> recordConversation(@PathVariable Long propertyId,
                                                   @RequestBody List<SupervisionConversationTurnDto> turns,
                                                   @AuthenticationPrincipal Jwt jwt) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        conversationService.record(orgId, propertyId, jwt.getSubject(), turns);
        return ResponseEntity.noContent().build();
    }

    /** GET /api/ai/supervision/conversation/{propertyId} — historique (chrono inversé, org-scopé). */
    @GetMapping("/conversation/{propertyId}")
    public ResponseEntity<List<SupervisionConversationMessageDto>> conversationHistory(
            @PathVariable Long propertyId,
            @RequestParam(name = "limit", defaultValue = "50") int limit) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(conversationService.history(orgId, propertyId, limit));
    }

    /** GET /api/ai/supervision/suggestions/{propertyId} — file org-scopée en attente. */
    @GetMapping("/suggestions/{propertyId}")
    public ResponseEntity<List<SupervisionSuggestionDto>> suggestions(@PathVariable Long propertyId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(suggestionService.list(orgId, propertyId));
    }

    /**
     * GET /api/ai/supervision/pending-counts — compteurs de suggestions en attente
     * (org-scopé) pour les pastilles du planning : total (badge menu) + par logement
     * (badge de cellule). Léger : requête de comptage agrégée, sans charger les cartes.
     */
    @GetMapping("/pending-counts")
    public ResponseEntity<com.clenzy.dto.SupervisionPendingCountsDto> pendingCounts() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(suggestionService.pendingCounts(orgId));
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

    /** Segment de prix édité dans la modale : plage [from, to) (to exclusif) + remise % (baisse). */
    public record PriceSegmentRequest(java.time.LocalDate from, java.time.LocalDate to, int percent) {}

    /** Corps de la simulation yield multi-segment ({@code direction} : "up" = hausse, sinon baisse). */
    public record SimulatePricingRequest(Long propertyId, String direction, List<PriceSegmentRequest> segments) {}

    /** Corps de l'application des segments validés ({@code direction} : "up" = hausse, sinon baisse). */
    public record ApplyCustomRequest(String direction, List<PriceSegmentRequest> segments) {}

    private static boolean isRaise(String direction) {
        return "up".equalsIgnoreCase(direction);
    }

    private static List<PriceSuggestionService.SegmentInput> toSegments(List<PriceSegmentRequest> reqs) {
        if (reqs == null || reqs.isEmpty()) {
            throw new IllegalArgumentException("Au moins un segment est requis");
        }
        return reqs.stream()
                .map(s -> new PriceSuggestionService.SegmentInput(s.from(), s.to(), s.percent()))
                .toList();
    }

    /**
     * POST /api/ai/supervision/simulate-pricing — prévision occupation/revenu (base→projeté)
     * d'un ajustement multi-segment, sur les valeurs éditées dans la modale. Read-only, org-scopé.
     */
    @PostMapping("/simulate-pricing")
    public ResponseEntity<PriceSuggestionService.SimulationResult> simulatePricing(
            @RequestBody SimulatePricingRequest req, @AuthenticationPrincipal Jwt jwt) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(priceSuggestionService.simulate(
                orgId, jwt.getSubject(), req.propertyId(), toSegments(req.segments()), isRaise(req.direction())));
    }

    /**
     * POST /api/ai/supervision/suggestions/{id}/apply-custom — applique les segments de prix
     * validés/édités dans la modale (écrit les RateOverride, visibles dans « Prix dynamique »).
     * Org-scopé, CAS PENDING→APPLIED côté service.
     */
    @PostMapping("/suggestions/{id}/apply-custom")
    public ResponseEntity<Void> applyCustomPricing(@PathVariable Long id, @RequestBody ApplyCustomRequest req) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        priceSuggestionService.applyCustom(orgId, id, toSegments(req.segments()), isRaise(req.direction()));
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
