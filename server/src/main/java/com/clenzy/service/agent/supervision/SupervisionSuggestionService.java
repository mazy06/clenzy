package com.clenzy.service.agent.supervision;

import com.clenzy.dto.SupervisionSuggestionDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.repository.SupervisionSuggestionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

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
    private final TransactionTemplate transactionTemplate;

    public SupervisionSuggestionService(SupervisionSuggestionRepository repository,
                                        SuggestionActionExecutor actionExecutor,
                                        Clock clock,
                                        PlatformTransactionManager transactionManager) {
        this.repository = repository;
        this.actionExecutor = actionExecutor;
        this.clock = clock;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
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
        try {
            recordActionableStrict(organizationId, propertyId, moduleKey, null, title, motif,
                    actionType, actionParams, estimatedImpactCents, severity);
        } catch (Exception e) {
            log.debug("supervision actionable suggestion record failed (module={} prop={}): {}",
                    moduleKey, propertyId, e.getMessage());
        }
    }

    /**
     * Variante STRICTE de {@link #recordActionable} pour les executeurs du moteur
     * AutomationRule (vague 3) : un echec de persistance se PROPAGE (statut FAILED
     * explicite cote moteur — jamais de catch avaleur sur un flux argent).
     *
     * @param reservationId reservation liee (affichage/apply), optionnelle
     * @return true si la suggestion a ete creee, false si une proposition identique
     *         est deja en attente sur ce logement (deduplication par intitule)
     */
    @Transactional
    public boolean recordActionableStrict(Long organizationId, Long propertyId, String moduleKey,
                                          Long reservationId, String title, String motif,
                                          String actionType, String actionParams,
                                          Long estimatedImpactCents, String severity) {
        if (organizationId == null || propertyId == null || moduleKey == null
                || title == null || title.isBlank()) {
            throw new IllegalArgumentException(
                    "Suggestion actionnable incomplete (org/logement/module/titre requis)");
        }
        String safeTitle = truncate(title.strip(), TITLE_MAX);
        boolean dup = repository.existsByOrganizationIdAndPropertyIdAndModuleKeyAndTitleAndStatus(
                organizationId, propertyId, moduleKey, safeTitle, SupervisionSuggestion.STATUS_PENDING);
        if (dup) {
            return false;
        }
        SupervisionSuggestion s = new SupervisionSuggestion(
                organizationId, propertyId, moduleKey, null, safeTitle,
                truncate(motif, MOTIF_MAX), clock.instant().plus(TTL));
        s.setReservationId(reservationId);
        s.setActionType(actionType);
        s.setActionParams(actionParams);
        s.setEstimatedImpactCents(estimatedImpactCents);
        s.setSeverity(severity);
        repository.save(s);
        return true;
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
     * Applique l'action d'une suggestion actionnable (ownership org-scopé :
     * une suggestion d'une autre org est introuvable → 404).
     *
     * <p>Transition atomique {@code PENDING → APPLIED} (CAS repo, jamais
     * check-then-act). Deux chemins selon l'action (cf.
     * {@link SuggestionActionExecutor#hasExternalEffect}) :</p>
     * <ul>
     *   <li><b>Écritures DB uniquement</b> (PRICE_DROP, CALENDAR_BLOCK) : exécution
     *       DANS la transaction du CAS — un échec annule la transition (comportement
     *       historique, pas de suggestion « appliquée » sans effet) ;</li>
     *   <li><b>Effet externe</b> (DEPOSIT_REFUND / DEPOSIT_RELEASE, appel Stripe) :
     *       le CAS est committé PUIS l'effet est exécuté HORS transaction (règle
     *       audit n°2 — jamais d'appel Stripe en transaction DB, idempotency key
     *       déterministe côté gateway) ; un échec déclenche la compensation
     *       {@code APPLIED → PENDING} (CAS) et se propage.</li>
     * </ul>
     *
     * <p>Double-clic / double-livraison : le 2e CAS ne matche rien → 400.
     * Pas de {@code @Transactional} ici : l'orchestration transactionnelle est
     * explicite via {@link TransactionTemplate} (évite l'auto-invocation proxy).</p>
     */
    public void apply(Long organizationId, Long suggestionId) {
        SupervisionSuggestion suggestion = transactionTemplate.execute(status -> {
            SupervisionSuggestion s = repository.findByIdAndOrganizationId(suggestionId, organizationId)
                    .orElseThrow(() -> new NotFoundException("Suggestion introuvable : " + suggestionId));
            if (s.getActionType() == null) {
                throw new IllegalArgumentException("Cette suggestion n'est pas actionnable");
            }
            int transitioned = repository.markApplied(suggestionId, organizationId, clock.instant());
            if (transitioned == 0) {
                throw new IllegalArgumentException("Suggestion déjà traitée");
            }
            if (!actionExecutor.hasExternalEffect(s.getActionType())) {
                actionExecutor.execute(s);
            }
            return s;
        });
        if (actionExecutor.hasExternalEffect(suggestion.getActionType())) {
            try {
                actionExecutor.execute(suggestion);
            } catch (RuntimeException e) {
                // Compensation : l'effet externe n'a pas eu lieu (ou a échoué avant la
                // transition d'état métier) → la suggestion redevient actionnable.
                transactionTemplate.executeWithoutResult(status ->
                        repository.revertApplied(suggestionId, organizationId));
                throw e;
            }
        }
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
