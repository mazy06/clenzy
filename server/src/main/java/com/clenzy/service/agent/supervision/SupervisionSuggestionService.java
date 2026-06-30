package com.clenzy.service.agent.supervision;

import com.clenzy.dto.SupervisionSuggestionDto;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.repository.SupervisionSuggestionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    public SupervisionSuggestionService(SupervisionSuggestionRepository repository) {
        this.repository = repository;
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

    private SupervisionSuggestionDto toDto(SupervisionSuggestion s) {
        return new SupervisionSuggestionDto(
                String.valueOf(s.getId()),
                s.getModuleKey(),
                s.getTitle(),
                s.getMotif(),
                s.getReservationId(),
                s.getCreatedAt() != null ? s.getCreatedAt().toString() : Instant.now().toString(),
                s.getExpiresAt() != null ? s.getExpiresAt().toString() : null);
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        String trimmed = value.strip();
        return trimmed.length() <= max ? trimmed : trimmed.substring(0, max);
    }
}
