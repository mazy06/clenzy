package com.clenzy.service.agent.supervision;

import com.clenzy.dto.SupervisionActivitySnapshotDto;
import com.clenzy.dto.SupervisionFeedEntryDto;
import com.clenzy.model.Property;
import com.clenzy.model.SupervisionActivity;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.SupervisionActivityRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.service.agent.ToolRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Journal d'activité réel de la constellation (feed + métriques).
 *
 * <p>Écriture best-effort (jamais sur le chemin critique d'un run) ; lecture
 * ownership-checked (la propriété doit appartenir à l'org du requester, sauf
 * platform staff).</p>
 */
@Service
public class SupervisionActivityService {

    private static final Logger log = LoggerFactory.getLogger(SupervisionActivityService.class);
    private static final int FEED_LIMIT = 20;
    // Fenêtre élargie côté requête : on filtre ensuite les entrées read-only
    // (héritage) pour garantir jusqu'à FEED_LIMIT vraies actions au rendu.
    private static final int FEED_FETCH_LIMIT = 200;
    private static final Duration AUTO_ACTIONS_WINDOW = Duration.ofHours(24);

    private final SupervisionActivityRepository activityRepository;
    private final SupervisionModuleRegistry registry;
    private final ToolRegistry toolRegistry;
    private final PropertyRepository propertyRepository;
    private final OrganizationAccessGuard organizationAccessGuard;

    // @Lazy : ToolRegistry dépend (transitivement) de ce service → sans lazy, cycle
    // de beans au démarrage. Le proxy est résolu au 1er appel (registre alors prêt).
    public SupervisionActivityService(SupervisionActivityRepository activityRepository,
                                      SupervisionModuleRegistry registry,
                                      @Lazy ToolRegistry toolRegistry,
                                      PropertyRepository propertyRepository,
                                      OrganizationAccessGuard organizationAccessGuard) {
        this.activityRepository = activityRepository;
        this.registry = registry;
        this.toolRegistry = toolRegistry;
        this.propertyRepository = propertyRepository;
        this.organizationAccessGuard = organizationAccessGuard;
    }

    /**
     * Enregistre une action observée d'un specialist (best-effort). Le specialist
     * est mappé vers un module ; un specialist technique masqué (→ null) n'est pas
     * journalisé. Un échec ne casse JAMAIS le run en cours (avalé + logué debug).
     */
    @Transactional
    public void recordAct(Long organizationId, Long propertyId, String specialist,
                          String toolName, String summary) {
        // Ne journaliser que les VRAIES ACTIONS : les outils d'écriture
        // (ToolDescriptor.write → requiresConfirmation). Les outils de LECTURE
        // exécutés par un scan (analyses, prévisions…) ne sont PAS des actions
        // et pollueraient le feed « En direct » — on les ignore ici.
        if (!isWriteTool(toolName)) {
            return;
        }
        // Un specialist technique masqué (→ module null) n'est pas journalisé.
        recordModuleAct(organizationId, propertyId,
                registry.moduleForSpecialist(specialist), toolName, summary);
    }

    /** Un outil est une « action » s'il est déclaré en écriture (confirmation requise). */
    private boolean isWriteTool(String toolName) {
        if (toolName == null || toolName.isBlank()) {
            return false;
        }
        return toolRegistry.find(toolName)
                .map(h -> h.descriptor().requiresConfirmation())
                .orElse(false);
    }

    /**
     * Vrai UNIQUEMENT si {@code toolName} correspond à un outil connu de LECTURE.
     * Un nom inconnu (ex. action d'automatisation déterministe) renvoie false →
     * l'entrée est conservée au rendu. Sert à masquer le bruit read-only hérité.
     */
    private boolean isReadOnlyTool(String toolName) {
        if (toolName == null || toolName.isBlank()) {
            return false;
        }
        return toolRegistry.find(toolName)
                .map(h -> !h.descriptor().requiresConfirmation())
                .orElse(false);
    }

    /**
     * Journalise une action déjà rattachée à un module de la constellation
     * (com/rev/ops/fin/rep) — utilisé par le moteur d'automatisation déterministe
     * pour que la constellation reflète aussi les flux SANS IA. Best-effort :
     * un échec ne casse jamais l'exécution en cours.
     */
    @Transactional
    public void recordModuleAct(Long organizationId, Long propertyId, String moduleKey,
                                String toolName, String summary) {
        if (organizationId == null || propertyId == null || moduleKey == null) {
            return;
        }
        try {
            activityRepository.save(new SupervisionActivity(
                    organizationId, propertyId, moduleKey,
                    SupervisionActivity.KIND_ACT, toolName, summary));
        } catch (Exception e) {
            log.debug("supervision activity record failed (module={} prop={}): {}",
                    moduleKey, propertyId, e.getMessage());
        }
    }

    /** Feed + compteur d'actions d'une propriété (ownership-checked). */
    @Transactional(readOnly = true)
    public SupervisionActivitySnapshotDto getSnapshot(Long propertyId) {
        Property property = propertyRepository.findById(propertyId).orElse(null);
        if (property == null) {
            return new SupervisionActivitySnapshotDto(List.of(), 0);
        }
        // findById contourne le filtre org → valider l'ownership explicitement.
        organizationAccessGuard.requireSameOrganization(
                property.getOrganizationId(), "Propriété hors de votre organisation");

        Long orgId = property.getOrganizationId();
        // On récupère une fenêtre plus large puis on MASQUE les entrées d'outils
        // read-only déjà présentes en base (héritage d'avant le filtre d'écriture) :
        // le feed « En direct » ne montre que de vraies actions. Les entrées
        // d'automatisation (tool_name non répertorié) sont conservées.
        List<SupervisionFeedEntryDto> feed = activityRepository
                .findByOrganizationIdAndPropertyIdOrderByCreatedAtDesc(
                        orgId, propertyId, PageRequest.of(0, FEED_FETCH_LIMIT))
                .stream()
                .filter(a -> !isReadOnlyTool(a.getToolName()))
                .limit(FEED_LIMIT)
                .map(this::toFeedEntry)
                .toList();

        long autoActions = activityRepository.countByOrganizationIdAndPropertyIdAndKindAndCreatedAtAfter(
                orgId, propertyId, SupervisionActivity.KIND_ACT,
                Instant.now().minus(AUTO_ACTIONS_WINDOW));

        return new SupervisionActivitySnapshotDto(feed, (int) autoActions);
    }

    private SupervisionFeedEntryDto toFeedEntry(SupervisionActivity a) {
        String text = a.getSummary() != null && !a.getSummary().isBlank()
                ? a.getSummary()
                : humanizeTool(a.getToolName(), a.getModuleKey());
        return new SupervisionFeedEntryDto(
                String.valueOf(a.getId()),
                a.getModuleKey(),
                a.getCreatedAt() != null ? a.getCreatedAt().toString() : Instant.now().toString(),
                text,
                a.getToolName());
    }

    /** snake_case → libellé court lisible ; repli sur le module si vide. */
    private static String humanizeTool(String toolName, String fallback) {
        if (toolName == null || toolName.isBlank()) {
            return fallback;
        }
        String spaced = toolName.replace('_', ' ').trim();
        return spaced.isEmpty()
                ? fallback
                : Character.toUpperCase(spaced.charAt(0)) + spaced.substring(1);
    }
}
