package com.clenzy.service.agent.supervision;

import com.clenzy.dto.SupervisionActivitySnapshotDto;
import com.clenzy.dto.SupervisionFeedEntryDto;
import com.clenzy.model.Property;
import com.clenzy.model.SupervisionActivity;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.SupervisionActivityRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
    private static final Duration AUTO_ACTIONS_WINDOW = Duration.ofHours(24);

    private final SupervisionActivityRepository activityRepository;
    private final SupervisionModuleRegistry registry;
    private final PropertyRepository propertyRepository;
    private final OrganizationAccessGuard organizationAccessGuard;

    public SupervisionActivityService(SupervisionActivityRepository activityRepository,
                                      SupervisionModuleRegistry registry,
                                      PropertyRepository propertyRepository,
                                      OrganizationAccessGuard organizationAccessGuard) {
        this.activityRepository = activityRepository;
        this.registry = registry;
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
        if (organizationId == null || propertyId == null) {
            return;
        }
        String moduleKey = registry.moduleForSpecialist(specialist);
        if (moduleKey == null) {
            return; // specialist technique masqué / inconnu → pas de ligne
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
        List<SupervisionFeedEntryDto> feed = activityRepository
                .findByOrganizationIdAndPropertyIdOrderByCreatedAtDesc(
                        orgId, propertyId, PageRequest.of(0, FEED_LIMIT))
                .stream()
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
                text);
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
