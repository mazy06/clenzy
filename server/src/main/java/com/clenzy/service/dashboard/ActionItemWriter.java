package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.model.ActionItem;
import com.clenzy.model.NotificationKey;
import com.clenzy.repository.ActionItemRepository;
import com.clenzy.service.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;

/**
 * Écriture des actions qu'aucune requête ne peut découvrir.
 *
 * <p>Un litige bancaire, un virement refusé, un lien de paiement expiré : ces
 * faits nous sont appris <b>une seule fois</b>, par un webhook. Ils
 * n'apparaissent nulle part dans nos données, et repartaient sans laisser de
 * trace. Ils sont donc écrits ici, avec {@code source = EVENT}, ce qui interdit
 * au balayage de réconciliation de les refermer : lui ne saurait pas les
 * retrouver, et les ferait disparaître dès son premier passage.</p>
 *
 * <p>Deux garanties que chaque appelant aurait dû redémontrer sinon :</p>
 * <ul>
 *   <li><b>Idempotence</b> — un webhook est livré plusieurs fois par
 *       conception ; un même événement ne produit qu'une ligne.</li>
 *   <li><b>Transaction propre</b> — {@code REQUIRES_NEW} : l'enregistrement ne
 *       doit pas être emporté par le rollback du traitement métier qui
 *       l'entoure. Une action perdue est une action invisible.</li>
 * </ul>
 */
@Service
public class ActionItemWriter {

    private static final Logger log = LoggerFactory.getLogger(ActionItemWriter.class);

    private final ActionItemRepository repository;
    private final NotificationService notificationService;
    private final Clock clock;

    public ActionItemWriter(ActionItemRepository repository,
                            NotificationService notificationService,
                            Clock clock) {
        this.repository = repository;
        this.notificationService = notificationService;
        this.clock = clock;
    }

    /** Description d'une action apprise de l'extérieur. */
    public record EventAction(
            Long organizationId,
            ActionItemKind kind,
            /** Identifiant chez l'émetteur — la clé d'idempotence. */
            String subjectRef,
            String severity,
            String title,
            String detail,
            Long targetId,
            BigDecimal amount,
            String currency,
            /** Échéance imposée, {@code null} s'il n'y en a pas. */
            Instant deadlineAt,
            String actionType) {
    }

    /**
     * Enregistre l'action, ou complète celle qui existe déjà.
     *
     * @return l'action ouverte, ou {@code null} si l'organisation est inconnue
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public ActionItem record(EventAction event) {
        if (event.organizationId() == null
                || event.subjectRef() == null || event.subjectRef().isBlank()) {
            // Sans organisation de rattachement, l'action n'aurait aucune surface
            // où apparaître : mieux vaut la journaliser que la perdre dans une
            // ligne orpheline.
            log.error("SECURITE : action {} ignoree, org ou reference absente (ref={})",
                    event.kind(), event.subjectRef());
            return null;
        }

        final Instant now = clock.instant();
        final ActionItem item = repository.findByOrganizationIdAndKindAndSubjectRef(
                        event.organizationId(), event.kind().name(), event.subjectRef())
                .orElseGet(ActionItem::new);
        final boolean isNew = item.getId() == null;

        if (isNew) {
            item.setOrganizationId(event.organizationId());
            item.setKind(event.kind().name());
            item.setSubjectRef(event.subjectRef());
            item.setSource(ActionItem.SOURCE_EVENT);
            item.setFirstSeenAt(now);
        } else if (ActionItem.STATUS_RESOLVED.equals(item.getStatus())) {
            // Rouverte par un nouvel événement : le litige repart, la décision
            // précédente ne vaut plus.
            item.setResolvedAt(null);
            item.setResolvedBy(null);
        }

        item.setStatus(ActionItem.STATUS_OPEN);
        item.setSeverity(event.severity() == null ? "critical" : event.severity());
        item.setTitle(event.title());
        item.setDetail(event.detail());
        item.setTargetId(event.targetId());
        item.setAmount(event.amount());
        item.setCurrency(event.currency());
        item.setDeadlineAt(event.deadlineAt());
        item.setActionType(event.actionType());
        item.setBadge(deadlineBadge(event.deadlineAt(), now));
        item.setLastSeenAt(now);

        final ActionItem saved = repository.save(item);

        if (isNew) {
            log.warn("Action {} ouverte org={} ref={} echeance={}",
                    event.kind(), event.organizationId(), event.subjectRef(), event.deadlineAt());
            notify(saved);
        }
        return saved;
    }

    /** Referme l'action quand l'émetteur annonce l'issue. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void resolve(Long orgId, ActionItemKind kind, String subjectRef, String resolvedBy) {
        if (orgId == null || subjectRef == null) return;
        repository.findByOrganizationIdAndKindAndSubjectRef(orgId, kind.name(), subjectRef)
                .filter(item -> ActionItem.STATUS_OPEN.equals(item.getStatus()))
                .ifPresent(item -> {
                    item.setStatus(ActionItem.STATUS_RESOLVED);
                    item.setResolvedAt(clock.instant());
                    item.setResolvedBy(resolvedBy);
                    repository.save(item);
                    log.info("Action {} resolue org={} ref={}", kind, orgId, subjectRef);
                });
    }

    /**
     * Clôture manuelle depuis l'écran.
     *
     * <p>Réservée aux actions nées d'un <b>événement</b>. Une action déduite des
     * données ne se clôt pas à la main : sa cause étant toujours vraie, le
     * balayage suivant la rouvrirait, et l'utilisateur croirait son geste sans
     * effet. Elle disparaît quand on traite ce qui la produit, pas quand on la
     * raye.</p>
     *
     * <p>L'organisation est vérifiée explicitement : {@code findById} contourne
     * le filtre Hibernate, et un identifiant d'action se devine.</p>
     */
    @Transactional
    public void resolveById(Long actionItemId, Long orgId, String resolvedBy) {
        final ActionItem item = repository.findById(actionItemId)
                .orElseThrow(() -> new IllegalArgumentException("Action introuvable"));
        if (orgId == null || !orgId.equals(item.getOrganizationId())) {
            throw new AccessDeniedException("Action hors organisation");
        }
        if (ActionItem.SOURCE_DERIVED.equals(item.getSource())) {
            throw new IllegalStateException(
                    "Cette action disparaitra d'elle-meme lorsque sa cause aura ete traitee");
        }
        if (!ActionItem.STATUS_OPEN.equals(item.getStatus())) return;

        item.setStatus(ActionItem.STATUS_RESOLVED);
        item.setResolvedAt(clock.instant());
        item.setResolvedBy(resolvedBy);
        repository.save(item);
        log.info("Action {} close manuellement par {}", item.getKind(), resolvedBy);
    }

    /** « J-3 » quand une échéance court, rien sinon. */
    private static String deadlineBadge(Instant deadline, Instant now) {
        if (deadline == null) return null;
        final long days = java.time.temporal.ChronoUnit.DAYS.between(now, deadline);
        return days < 0 ? "échue" : "J-" + days;
    }

    /**
     * Prévient la gestion.
     *
     * <p>Best-effort : un envoi qui échoue ne doit pas empêcher l'action d'être
     * enregistrée — c'est l'enregistrement qui la rend rattrapable, la
     * notification n'est qu'un raccourci.</p>
     */
    private void notify(ActionItem item) {
        try {
            notificationService.notifyAdminsAndManagers(
                    NotificationKey.PAYMENT_INCIDENT_OPENED,
                    item.getTitle() == null ? "Action requise" : item.getTitle(),
                    item.getDetail() == null ? item.getKind() : item.getDetail(),
                    "/dashboard");
        } catch (Exception e) {
            log.warn("Notification d'action non envoyee : {}", e.getMessage());
        }
    }
}
