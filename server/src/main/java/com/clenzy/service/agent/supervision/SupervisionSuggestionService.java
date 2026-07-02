package com.clenzy.service.agent.supervision;

import com.clenzy.dto.SupervisionSuggestionDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.repository.SupervisionSuggestionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * File de suggestions ORG-scopée de la constellation.
 *
 * <p>Écriture : un scan autonome propose une action → suggestion en attente
 * (déduplication : pas de doublon en attente sur le même intitulé). Lecture/rejet
 * scopés à l'org du requester. Best-effort à l'écriture (jamais sur le chemin
 * critique d'un scan).</p>
 */
@Service
public class SupervisionSuggestionService {

    private static final Logger log = LoggerFactory.getLogger(SupervisionSuggestionService.class);
    private static final Duration TTL = Duration.ofDays(7);
    private static final int TITLE_MAX = 300;
    private static final int MOTIF_MAX = 500;

    private final SupervisionSuggestionRepository repository;
    private final SuggestionActionExecutor actionExecutor;
    private final Clock clock;

    public SupervisionSuggestionService(SupervisionSuggestionRepository repository,
                                        SuggestionActionExecutor actionExecutor,
                                        Clock clock) {
        this.repository = repository;
        this.actionExecutor = actionExecutor;
        this.clock = clock;
    }

    /** Enregistre une suggestion (best-effort, dédupliquée). */
    @Transactional
    public void record(Long organizationId, Long propertyId, String moduleKey,
                       String toolName, String title, String motif) {
        if (organizationId == null || propertyId == null || moduleKey == null
                || title == null || title.isBlank()) {
            return;
        }
        String safeTitle = truncate(title.strip(), TITLE_MAX);
        try {
            boolean dup = repository.existsByOrganizationIdAndPropertyIdAndModuleKeyAndTitleAndStatus(
                    organizationId, propertyId, moduleKey, safeTitle, SupervisionSuggestion.STATUS_PENDING);
            if (dup) {
                return; // déjà proposé, en attente → on ne duplique pas
            }
            repository.save(new SupervisionSuggestion(
                    organizationId, propertyId, moduleKey, toolName, safeTitle,
                    truncate(motif, MOTIF_MAX), Instant.now().plus(TTL)));
        } catch (Exception e) {
            log.debug("supervision suggestion record failed (module={} prop={}): {}",
                    moduleKey, propertyId, e.getMessage());
        }
    }

    /**
     * Enregistre une suggestion ACTIONNABLE (scanner analytics déterministe) :
     * porte un {@code actionType} exécutable + params + impact estimé. Best-effort,
     * dédupliquée par intitulé (comme {@link #record}). Un même intitulé encore en
     * attente n'est pas redupliqué → un scan répété ne spamme pas la file.
     */
    @Transactional
    public void recordActionable(Long organizationId, Long propertyId, String moduleKey,
                                 String title, String motif, String actionType,
                                 String actionParams, Long estimatedImpactCents, String severity) {
        if (organizationId == null || propertyId == null || moduleKey == null
                || title == null || title.isBlank()) {
            return;
        }
        String safeTitle = truncate(title.strip(), TITLE_MAX);
        try {
            boolean dup = repository.existsByOrganizationIdAndPropertyIdAndModuleKeyAndTitleAndStatus(
                    organizationId, propertyId, moduleKey, safeTitle, SupervisionSuggestion.STATUS_PENDING);
            if (dup) {
                return;
            }
            SupervisionSuggestion s = new SupervisionSuggestion(
                    organizationId, propertyId, moduleKey, null, safeTitle,
                    truncate(motif, MOTIF_MAX), clock.instant().plus(TTL));
            s.setActionType(actionType);
            s.setActionParams(actionParams);
            s.setEstimatedImpactCents(estimatedImpactCents);
            s.setSeverity(severity);
            repository.save(s);
        } catch (Exception e) {
            log.debug("supervision actionable suggestion record failed (module={} prop={}): {}",
                    moduleKey, propertyId, e.getMessage());
        }
    }

    /** Suggestions en attente non expirées d'un logement (org du requester). */
    @Transactional(readOnly = true)
    public List<SupervisionSuggestionDto> list(Long organizationId, Long propertyId) {
        return repository.findByOrganizationIdAndPropertyIdAndStatusAndExpiresAtAfterOrderByCreatedAtDesc(
                        organizationId, propertyId, SupervisionSuggestion.STATUS_PENDING, Instant.now())
                .stream()
                .map(this::toDto)
                .toList();
    }

    /** Rejette une suggestion (ownership org-scopé). No-op si absente/autre org. */
    @Transactional
    public void dismiss(Long organizationId, Long suggestionId) {
        repository.findByIdAndOrganizationId(suggestionId, organizationId).ifPresent(s -> {
            s.setStatus(SupervisionSuggestion.STATUS_DISMISSED);
            repository.save(s);
        });
    }

    /**
     * Applique l'action d'une suggestion actionnable (ownership org-scopé).
     *
     * <p>Transition atomique {@code PENDING → APPLIED} (CAS repo, jamais
     * check-then-act) PUIS exécution DANS la même transaction : un échec
     * d'exécution annule la transition (pas de suggestion « appliquée » sans
     * effet). Double-clic / double-livraison : le 2e CAS ne matche rien → 400.</p>
     */
    @Transactional
    public void apply(Long organizationId, Long suggestionId) {
        SupervisionSuggestion s = repository.findByIdAndOrganizationId(suggestionId, organizationId)
                .orElseThrow(() -> new NotFoundException("Suggestion introuvable : " + suggestionId));
        if (s.getActionType() == null) {
            throw new IllegalArgumentException("Cette suggestion n'est pas actionnable");
        }
        int transitioned = repository.markApplied(suggestionId, organizationId, clock.instant());
        if (transitioned == 0) {
            throw new IllegalArgumentException("Suggestion déjà traitée");
        }
        actionExecutor.execute(s);
    }

    private SupervisionSuggestionDto toDto(SupervisionSuggestion s) {
        return new SupervisionSuggestionDto(
                String.valueOf(s.getId()),
                s.getModuleKey(),
                s.getTitle(),
                s.getMotif(),
                s.getReservationId(),
                s.getCreatedAt() != null ? s.getCreatedAt().toString() : clock.instant().toString(),
                s.getExpiresAt() != null ? s.getExpiresAt().toString() : null,
                s.getActionType(),
                s.getEstimatedImpactCents(),
                s.getSeverity());
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        String trimmed = value.strip();
        return trimmed.length() <= max ? trimmed : trimmed.substring(0, max);
    }
}
