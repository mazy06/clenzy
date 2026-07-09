package com.clenzy.service.agent.supervision;

import com.clenzy.dto.SupervisionConfigDto;
import com.clenzy.dto.SupervisionScanResultDto;
import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.AgentOrchestrator;
import com.clenzy.service.agent.AgentSseEvent;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;

/**
 * Scan MANUEL de la constellation (Phase 3-B.2 étape 1) : déclenché par un
 * opérateur sur une propriété, fait tourner l'orchestrateur multi-agent en mode
 * « revue proactive » et :
 * <ul>
 *   <li>journalise l'activité réelle des agents ({@link SupervisionActivityService}) ;</li>
 *   <li>les actions sensibles proposées tombent dans la file HITL existante
 *       (PendingToolStore, via le pipeline {@code handleMessage}).</li>
 * </ul>
 *
 * <p><b>Synchrone, dans le thread de la requête HTTP</b> : le contexte tenant +
 * sécurité est déjà posé par {@code TenantFilter}, donc pas besoin de
 * {@code TenantScopedExecutor} ici (réservé à la version auto-déclenchée 3-B.2 étape 2).</p>
 *
 * <p>Gating : ne tourne que si la feature est activée pour l'org et non en pause.
 * (Le filtrage par module activé/autonomie est une affinage de l'étape suivante.)</p>
 */
@Service
public class SupervisionScanService {

    private static final Logger log = LoggerFactory.getLogger(SupervisionScanService.class);
    /** Identité système des scans autonomes (pas d'opérateur). */
    private static final String SYSTEM_IDENTITY = "system:supervisor";

    private final AgentOrchestrator orchestrator;
    private final SupervisionConfigService configService;
    private final SupervisionActivityService activityService;
    private final SupervisionSuggestionService suggestionService;
    private final SupervisionModuleRegistry moduleRegistry;
    private final BusinessAnalyticsScanner businessAnalyticsScanner;
    private final ReviewModerationScanner reviewModerationScanner;
    private final GuestInstructionsScanner guestInstructionsScanner;
    private final PropertyRepository propertyRepository;
    private final OrganizationAccessGuard organizationAccessGuard;
    private final TenantContext tenantContext;

    public SupervisionScanService(AgentOrchestrator orchestrator,
                                  SupervisionConfigService configService,
                                  SupervisionActivityService activityService,
                                  SupervisionSuggestionService suggestionService,
                                  SupervisionModuleRegistry moduleRegistry,
                                  BusinessAnalyticsScanner businessAnalyticsScanner,
                                  ReviewModerationScanner reviewModerationScanner,
                                  GuestInstructionsScanner guestInstructionsScanner,
                                  PropertyRepository propertyRepository,
                                  OrganizationAccessGuard organizationAccessGuard,
                                  TenantContext tenantContext) {
        this.orchestrator = orchestrator;
        this.configService = configService;
        this.activityService = activityService;
        this.suggestionService = suggestionService;
        this.moduleRegistry = moduleRegistry;
        this.businessAnalyticsScanner = businessAnalyticsScanner;
        this.reviewModerationScanner = reviewModerationScanner;
        this.guestInstructionsScanner = guestInstructionsScanner;
        this.propertyRepository = propertyRepository;
        this.organizationAccessGuard = organizationAccessGuard;
        this.tenantContext = tenantContext;
    }

    public SupervisionScanResultDto scan(Long propertyId, Jwt jwt) {
        if (jwt == null) {
            throw new IllegalStateException("Scan requiert un utilisateur authentifié");
        }
        Long orgId = tenantContext.getRequiredOrganizationId();

        // Ownership : findById contourne le filtre org → valider explicitement.
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new IllegalArgumentException("Propriété introuvable : " + propertyId));
        organizationAccessGuard.requireSameOrganization(
                property.getOrganizationId(), "Propriété hors de votre organisation");

        SupervisionConfigDto config = configService.getConfig(orgId);
        if (!config.enabled()) {
            return new SupervisionScanResultDto("disabled", 0, 0, null);
        }
        if (config.paused()) {
            return new SupervisionScanResultDto("paused", 0, 0, null);
        }

        String language = jwt.getClaimAsString("locale");
        if (language == null || language.isBlank()) {
            language = "fr";
        }
        AgentContext context = new AgentContext(
                orgId, jwt.getSubject(), jwt, language, "/planning", propertyId);

        // Scan opérateur (requête/réponse, sans streaming) : on PERSISTE les actions
        // proposées dans la file de suggestions → elles apparaissent comme cartes HITL
        // dans « Attend ta validation ». (Avant : false → le bouton « Scanner » ne
        // produisait jamais de carte, juste un résumé texte.)
        return runScan(orgId, propertyId, context, true);
    }

    /**
     * Scan AUTONOME (système, sans opérateur) — appelé par le scheduler
     * {@code SupervisionAutonomousScanner} DANS un contexte tenant déjà posé
     * (TenantScopedExecutor). Identité système (pas de JWT) : produit de
     * l'activité journalisée ; les actions sensibles restent des suggestions.
     */
    public SupervisionScanResultDto autonomousScan(Long orgId, Long propertyId) {
        AgentContext context = new AgentContext(
                orgId, SYSTEM_IDENTITY, null, "fr", "/planning", propertyId);
        // Scan autonome : pas d'opérateur → les propositions vont dans la file
        // org-scopée (SupervisionSuggestionService) pour atteindre les opérateurs.
        return runScan(orgId, propertyId, context, true);
    }

    /**
     * Mode dégradé « plafond premium atteint » (X8-b, scénario S4 D-105) :
     * heuristiques analytics déterministes SEULES — zéro appel LLM, zéro crédit.
     * Les suggestions restent alimentées, l'exécution proactive attend le cycle
     * suivant (ou un relèvement du plafond).
     */
    public void deterministicScanOnly(Long orgId, Long propertyId) {
        businessAnalyticsScanner.scanProperty(orgId, propertyId);
        reviewModerationScanner.scanProperty(orgId, propertyId);
        guestInstructionsScanner.scanProperty(orgId, propertyId);
    }

    /**
     * Boucle commune : exécute l'orchestrateur, journalise l'activité observée et
     * (si {@code recordSuggestions}) route les propositions vers la file org-scopée.
     */
    private SupervisionScanResultDto runScan(Long orgId, Long propertyId, AgentContext context,
                                             boolean recordSuggestions) {
        // Heuristiques analytics déterministes (Phase A) : émises AVANT le run LLM,
        // sans coût token, best-effort (n'interrompt jamais le scan).
        if (recordSuggestions) {
            businessAnalyticsScanner.scanProperty(orgId, propertyId);
            reviewModerationScanner.scanProperty(orgId, propertyId);
            guestInstructionsScanner.scanProperty(orgId, propertyId);
        }
        AtomicInteger activities = new AtomicInteger();
        AtomicInteger suggestions = new AtomicInteger();
        StringBuilder reply = new StringBuilder();
        // Specialist actif le plus récent → attribue une suggestion (le
        // tool_confirmation_request ne porte pas le specialist).
        AtomicReference<String> lastModule = new AtomicReference<>(null);

        Consumer<AgentSseEvent> consumer = e -> {
            String type = e.type() == null ? "" : e.type();
            switch (type) {
                case "agent_activity" -> {
                    String module = moduleRegistry.moduleForSpecialist(e.toolName());
                    if (module != null) {
                        lastModule.set(module);
                    }
                    if ("acting".equals(e.finishReason())) {
                        activityService.recordAct(orgId, propertyId,
                                e.toolName(), e.displayHint(), e.toolResult());
                        activities.incrementAndGet();
                    }
                }
                case "tool_confirmation_request" -> {
                    suggestions.incrementAndGet();
                    if (recordSuggestions && lastModule.get() != null) {
                        String title = e.toolName() != null
                                ? humanizeTool(e.toolName()) : "Action proposée";
                        suggestionService.record(orgId, propertyId, lastModule.get(),
                                e.toolName(), title, e.toolDescription());
                    }
                }
                case "text_delta" -> {
                    if (e.delta() != null) {
                        reply.append(e.delta());
                    }
                }
                default -> { /* autres events ignorés pour le scan */ }
            }
        };

        // Échec propagé (pas avalé) : surface l'erreur au caller / GlobalExceptionHandler.
        orchestrator.handleMessage(null, buildScanPrompt(), context, consumer);

        log.info("Supervision scan property={} org={} → {} action(s), {} suggestion(s)",
                propertyId, orgId, activities.get(), suggestions.get());
        return new SupervisionScanResultDto(
                "ok", activities.get(), suggestions.get(), reply.toString().strip());
    }

    /** snake_case → libellé court lisible (pour l'intitulé d'une suggestion). */
    private static String humanizeTool(String toolName) {
        if (toolName == null || toolName.isBlank()) {
            return "Action proposée";
        }
        String spaced = toolName.replace('_', ' ').strip();
        return spaced.isEmpty()
                ? "Action proposée"
                : Character.toUpperCase(spaced.charAt(0)) + spaced.substring(1);
    }

    private String buildScanPrompt() {
        return "Fais une revue proactive de ce logement (la propriété sélectionnée). "
                + "Passe en revue : (1) les messages voyageurs en attente de réponse, "
                + "(2) les tarifs et créneaux à faible demande à optimiser, "
                + "(3) les ménages et interventions à planifier, "
                + "(4) les réservations nécessitant une attention. "
                // Les interventions IMPAYÉES sont surfacées de façon déterministe (carte de
                // paiement dédiée, calcul serveur) → NE PAS les détecter ni proposer de
                // règlement ici, pour éviter une suggestion doublon et économiser des tokens.
                + "N'analyse PAS les paiements d'interventions impayées : ils sont gérés ailleurs. "
                + "IMPORTANT : quand tu identifies un point actionnable, n'écris PAS seulement une "
                + "recommandation — APPELLE le tool d'action correspondant pour la PROPOSER (il demandera "
                + "confirmation avant tout effet). Exemple : un message voyageur sans réponse → prépare la "
                + "réponse via send_guest_message ; un créneau à faible demande → propose "
                + "recommend_price_adjustments. Si tout est en ordre, dis-le simplement. Sois concis.";
    }
}
