package com.clenzy.service.agent.supervision;

import com.clenzy.dto.SupervisionSuggestionDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.repository.SupervisionSuggestionRepository;
import com.clenzy.service.NotificationService;
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
    /** Une carte « Ignorée » ne peut pas être re-suggérée avant ce délai (anti-spam au scan ;
     *  au-delà, elle peut re-remonter si la situation persiste — pas de masquage définitif). */
    private static final Duration DISMISS_COOLDOWN = Duration.ofDays(14);
    private static final int TITLE_MAX = 300;
    private static final int MOTIF_MAX = 500;

    private final SupervisionSuggestionRepository repository;
    private final SuggestionActionExecutor actionExecutor;
    private final NotificationService notificationService;
    private final SupervisionRealtimePublisher realtimePublisher;
    private final com.clenzy.service.UnpaidServiceRequestCardService unpaidServiceRequestCardService;
    private final Clock clock;
    private final TransactionTemplate transactionTemplate;

    public SupervisionSuggestionService(SupervisionSuggestionRepository repository,
                                        SuggestionActionExecutor actionExecutor,
                                        NotificationService notificationService,
                                        SupervisionRealtimePublisher realtimePublisher,
                                        com.clenzy.service.UnpaidServiceRequestCardService unpaidServiceRequestCardService,
                                        Clock clock,
                                        PlatformTransactionManager transactionManager) {
        this.repository = repository;
        this.actionExecutor = actionExecutor;
        this.notificationService = notificationService;
        this.realtimePublisher = realtimePublisher;
        this.unpaidServiceRequestCardService = unpaidServiceRequestCardService;
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
        return createActionable(organizationId, propertyId, moduleKey, reservationId,
                title, motif, actionType, actionParams, estimatedImpactCents, severity)
                .isPresent();
    }

    /**
     * Variante de {@link #recordActionableStrict} qui retourne l'ID de la
     * suggestion creee (yield v1 F8a : le journal {@code yield_adjustments}
     * lie chaque ligne SUGGESTED a sa suggestion). Vide si une proposition
     * identique est deja en attente (deduplication par intitule).
     */
    @Transactional
    public java.util.Optional<Long> recordActionableWithId(Long organizationId, Long propertyId,
                                                           String moduleKey, Long reservationId,
                                                           String title, String motif,
                                                           String actionType, String actionParams,
                                                           Long estimatedImpactCents, String severity) {
        return createActionable(organizationId, propertyId, moduleKey, reservationId,
                title, motif, actionType, actionParams, estimatedImpactCents, severity, true)
                .map(SupervisionSuggestion::getId);
    }

    /**
     * Variante de {@link #recordActionableWithId} pour le chemin d'AUTO-APPLICATION
     * (Vague 1 autonomie) : la carte est créée avec les mêmes garanties (dédup,
     * TTL, cooldown) mais SANS la notification « attend votre validation » — elle
     * va être appliquée immédiatement par l'acteur système, la notification
     * pertinente est {@code SUPERVISION_AUTO_APPLIED} (émise après succès).
     * Si l'apply échoue ensuite, la carte reste PENDING (repli HITL naturel).
     */
    @Transactional
    public java.util.Optional<Long> recordActionableForAutoApply(Long organizationId, Long propertyId,
                                                                 String moduleKey, Long reservationId,
                                                                 String title, String motif,
                                                                 String actionType, String actionParams,
                                                                 Long estimatedImpactCents, String severity) {
        return createActionable(organizationId, propertyId, moduleKey, reservationId,
                title, motif, actionType, actionParams, estimatedImpactCents, severity, false)
                .map(SupervisionSuggestion::getId);
    }

    private java.util.Optional<SupervisionSuggestion> createActionable(
            Long organizationId, Long propertyId, String moduleKey, Long reservationId,
            String title, String motif, String actionType, String actionParams,
            Long estimatedImpactCents, String severity) {
        return createActionable(organizationId, propertyId, moduleKey, reservationId,
                title, motif, actionType, actionParams, estimatedImpactCents, severity, true);
    }

    private java.util.Optional<SupervisionSuggestion> createActionable(
            Long organizationId, Long propertyId, String moduleKey, Long reservationId,
            String title, String motif, String actionType, String actionParams,
            Long estimatedImpactCents, String severity, boolean notifyPending) {
        if (organizationId == null || propertyId == null || moduleKey == null
                || title == null || title.isBlank()) {
            throw new IllegalArgumentException(
                    "Suggestion actionnable incomplete (org/logement/module/titre requis)");
        }
        String safeTitle = truncate(title.strip(), TITLE_MAX);
        boolean dup = repository.existsByOrganizationIdAndPropertyIdAndModuleKeyAndTitleAndStatus(
                organizationId, propertyId, moduleKey, safeTitle, SupervisionSuggestion.STATUS_PENDING);
        if (dup) {
            return java.util.Optional.empty();
        }
        // Cooldown : une carte identique récemment IGNORÉE ne réapparaît pas au scan suivant
        // (respecte le choix de l'opérateur ; re-remontera après DISMISS_COOLDOWN si ça persiste).
        boolean recentlyDismissed = repository
                .existsByOrganizationIdAndPropertyIdAndModuleKeyAndTitleAndStatusAndDismissedAtAfter(
                        organizationId, propertyId, moduleKey, safeTitle,
                        SupervisionSuggestion.STATUS_DISMISSED, clock.instant().minus(DISMISS_COOLDOWN));
        if (recentlyDismissed) {
            return java.util.Optional.empty();
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
        if (notifyPending) {
            notifyIfActionable(organizationId, safeTitle, motif, severity);
        }
        return java.util.Optional.of(s);
    }

    /**
     * Notification hors-écran (B2, anti « action manquée ») : prévient les admins/managers
     * de l'organisation qu'une carte HITL actionnable warning/critical vient d'être créée —
     * pour ne pas la manquer si l'opérateur n'est pas sur l'écran de supervision. Best-effort
     * (outbox tx-safe) : n'échoue jamais l'enregistrement. Les cartes informationnelles
     * ({@link #record}) ne notifient pas — évite le bruit des scans.
     */
    private void notifyIfActionable(Long organizationId, String title, String motif, String severity) {
        if (!"warning".equalsIgnoreCase(severity) && !"critical".equalsIgnoreCase(severity)) {
            return;
        }
        try {
            notificationService.notifyAdminsAndManagersByOrgId(organizationId,
                    NotificationKey.SUPERVISION_SUGGESTION, title,
                    motif != null && !motif.isBlank() ? motif
                            : "Une action de supervision attend votre validation.",
                    "/planning");
        } catch (Exception e) {
            log.debug("supervision suggestion notification failed (org={}): {}", organizationId, e.getMessage());
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

    /**
     * Compteurs de cartes HITL en attente pour les pastilles du planning (org-scopé) :
     * total (badge du menu) + détail par logement (badge de cellule). Agrège les
     * DEUX sources visibles dans la file de la constellation — suggestions des scans
     * autonomes ET cartes de demande de service impayée (« à régler ») — pour que la
     * pastille corresponde au « en attente » du HUD. Le total est la somme du détail.
     *
     * <p>Le rappel payout J-1 (org-level, per-user, transitoire) n'est pas compté.</p>
     */
    @Transactional(readOnly = true)
    public com.clenzy.dto.SupervisionPendingCountsDto pendingCounts(Long organizationId) {
        Instant now = Instant.now();
        java.util.Map<Long, Long> byProperty = new java.util.LinkedHashMap<>();
        // Suggestions des scans autonomes en attente.
        for (Object[] row : repository.countPendingByProperty(
                organizationId, SupervisionSuggestion.STATUS_PENDING, now)) {
            byProperty.merge((Long) row[0], (Long) row[1], Long::sum);
        }
        // Cartes de demande de service impayée (source dominante des cartes « à régler »).
        unpaidServiceRequestCardService.pendingCountsByProperty(organizationId)
                .forEach((propertyId, count) -> byProperty.merge(propertyId, count, Long::sum));
        long total = byProperty.values().stream().mapToLong(Long::longValue).sum();
        return new com.clenzy.dto.SupervisionPendingCountsDto(total, byProperty);
    }

    /** Rejette une suggestion (ownership org-scopé). No-op si absente/autre org. */
    @Transactional
    public void dismiss(Long organizationId, Long suggestionId) {
        repository.findByIdAndOrganizationId(suggestionId, organizationId).ifPresent(s -> {
            s.setStatus(SupervisionSuggestion.STATUS_DISMISSED);
            s.setDismissedAt(clock.instant()); // base du cooldown anti-re-suggestion
            repository.save(s);
            // Temps réel (B6) : carte rejetée → retirée chez les autres opérateurs.
            realtimePublisher.publishPendingResolved(s.getPropertyId(), suggestionId, "edited", null);
        });
    }

    /**
     * Remplace les paramètres d'une suggestion de prix par ceux édités dans la modale
     * (yield multi-segment) avant application. Force {@code actionType = PRICE_DROP} pour
     * qu'une carte advisory (occupation faible sans action) devienne applicable. Org-scopé,
     * PENDING uniquement. {@code apply} est ensuite appelé séparément (proxy → sa propre tx).
     */
    @Transactional
    public void setCustomPriceParams(Long organizationId, Long suggestionId, String actionParamsJson) {
        SupervisionSuggestion s = repository.findByIdAndOrganizationId(suggestionId, organizationId)
                .orElseThrow(() -> new NotFoundException("Suggestion introuvable : " + suggestionId));
        if (!SupervisionSuggestion.STATUS_PENDING.equals(s.getStatus())) {
            throw new IllegalStateException("Suggestion déjà traitée");
        }
        s.setActionType(SupervisionActionType.PRICE_DROP);
        s.setActionParams(actionParamsJson);
        repository.save(s);
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
     *
     * @param appliedBy auteur tracé de l'application : {@code user:<keycloakId>}
     *                  (bouton humain) ou {@link SupervisionSuggestion#APPLIED_BY_AUTO}
     *                  (auto-application Vague 1) — persisté par le CAS et visible
     *                  de l'exécuteur (protections renforcées en mode auto).
     */
    public void apply(Long organizationId, Long suggestionId, String appliedBy) {
        SupervisionSuggestion suggestion = transactionTemplate.execute(status -> {
            SupervisionSuggestion s = repository.findByIdAndOrganizationId(suggestionId, organizationId)
                    .orElseThrow(() -> new NotFoundException("Suggestion introuvable : " + suggestionId));
            if (s.getActionType() == null) {
                throw new IllegalArgumentException("Cette suggestion n'est pas actionnable");
            }
            int transitioned = repository.markApplied(suggestionId, organizationId, clock.instant(), appliedBy);
            if (transitioned == 0) {
                throw new IllegalArgumentException("Suggestion déjà traitée");
            }
            // Reflète l'auteur sur l'instance en mémoire (le CAS est un UPDATE bulk) :
            // l'exécuteur s'en sert pour durcir les protections du chemin auto.
            s.setAppliedBy(appliedBy);
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
        // Temps réel (B6) : carte appliquée → poussée aux autres opérateurs (best-effort).
        realtimePublisher.publishPendingResolved(suggestion.getPropertyId(), suggestionId, "validated", null);
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
                s.getSeverity(),
                s.getActionParams());
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        String trimmed = value.strip();
        return trimmed.length() <= max ? trimmed : trimmed.substring(0, max);
    }
}
