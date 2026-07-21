package com.clenzy.integration.channex.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Agregateur des pushes ARI par propriete — exigence de certification Channex.
 *
 * <p>La doc impose : (1) batcher les changements quasi simultanes par propriete
 * (fenetre 30-60 s) au lieu d'un appel API par evenement ; (2) respecter les
 * rate limits <b>par propriete</b> (10 req restrictions&amp;prix + 10 req
 * availability / minute) ; (3) backoff ~1 minute sur 429.</p>
 *
 * <p>Fonctionnement : les events Kafka {@code calendar.updates} n'appellent
 * plus l'API — ils {@link #enqueue} leur plage de dates ici. Un flush
 * periodique (defaut 30 s) fusionne les plages accumulees par propriete et
 * declenche UN push (availability + rates) par propriete due. La cadence de
 * flush borne mecaniquement les appels a ≤2+2/min/propriete, tres en-deca
 * des limites Channex.</p>
 *
 * <p>Echec de push (429, 5xx, transport) : la plage est re-enfilee avec un
 * differe de {@code retrySeconds} (defaut 60 s — le backoff demande par la
 * doc, sans bloquer de thread). Apres {@code maxAttempts} tentatives, on
 * s'arrete : le mapping est deja en ERROR et le filet
 * {@code retryFailedMappings} (horaire) + la reconciliation planifiee
 * reprennent la main.</p>
 *
 * <p>Redemarrage : l'etat est en memoire — une plage non flushee au shutdown
 * est perdue pour ce cycle, puis rattrapee par les schedulers de
 * reconciliation (rates 60 min / restrictions 180 min) et le watchdog.</p>
 *
 * <p>PAS de @SchedulerLock sur {@code flush()} (choix delibere — mise en place
 * ShedLock 2026-07-21) : la queue {@code pending} est un etat <b>in-memory par
 * instance</b>. En multi-instance, chaque instance DOIT flusher sa propre queue
 * (celle alimentee par les events Kafka qu'elle a consommes) ; un verrou
 * partage bloquerait le flush des autres instances et laisserait leurs plages
 * en attente jusqu'au filet de reconciliation.</p>
 */
@Component
public class ChannexAriBatcher {

    private static final Logger log = LoggerFactory.getLogger(ChannexAriBatcher.class);

    /** Tentatives max avant de laisser la main aux filets de reconciliation. */
    private static final int MAX_ATTEMPTS = 5;

    private final ChannexSyncService syncService;
    private final Clock clock;
    private final long retrySeconds;

    /** Plages en attente, cle = clenzyPropertyId. */
    private final ConcurrentHashMap<Long, PendingRange> pending = new ConcurrentHashMap<>();

    public ChannexAriBatcher(ChannexSyncService syncService,
                             Clock clock,
                             org.springframework.core.env.Environment env) {
        this.syncService = syncService;
        this.clock = clock;
        this.retrySeconds = env.getProperty("clenzy.channex.ari-retry-seconds", Long.class, 60L);
    }

    /**
     * Accumule une plage de dates a pousser pour une propriete. Les plages
     * successives sont fusionnees en leur enveloppe [min(from), max(to)] :
     * pousser une plage plus large que necessaire est correct (les valeurs
     * sont recalculees depuis CalendarEngine/PriceEngine au flush).
     */
    public void enqueue(Long propertyId, Long orgId, LocalDate from, LocalDate to) {
        pending.merge(propertyId,
            new PendingRange(orgId, from, to, Instant.EPOCH, 0),
            (current, incoming) -> new PendingRange(
                current.orgId(),
                current.from().isBefore(incoming.from()) ? current.from() : incoming.from(),
                current.to().isAfter(incoming.to()) ? current.to() : incoming.to(),
                current.nextAttemptAt(),
                current.attempts()));
        log.debug("ChannexAriBatcher: enqueue property={} [{}, {}]", propertyId, from, to);
    }

    /** Nombre de proprietes en attente de flush (observabilite/tests). */
    public int pendingCount() {
        return pending.size();
    }

    /**
     * Flush periodique : pousse chaque propriete due (nextAttemptAt atteint).
     * La cadence ({@code clenzy.channex.ari-flush-seconds}, defaut 30 s) EST la
     * fenetre de batching demandee par la doc Channex.
     */
    @Scheduled(fixedDelayString = "#{${clenzy.channex.ari-flush-seconds:30} * 1000}",
               initialDelayString = "#{${clenzy.channex.ari-flush-seconds:30} * 1000}")
    public void flush() {
        if (pending.isEmpty()) return;
        Instant now = clock.instant();

        List<Map.Entry<Long, PendingRange>> due = new ArrayList<>();
        for (Map.Entry<Long, PendingRange> entry : pending.entrySet()) {
            if (!entry.getValue().nextAttemptAt().isAfter(now)) {
                due.add(entry);
            }
        }

        for (Map.Entry<Long, PendingRange> entry : due) {
            Long propertyId = entry.getKey();
            // remove() : les events arrives PENDANT le push re-creeront une entree
            // (aucune perte — au pire un push redondant au flush suivant).
            PendingRange range = pending.remove(propertyId);
            if (range == null) continue;

            ChannexSyncService.ChannexSyncResult result;
            try {
                result = syncService.processCalendarRange(
                    propertyId, range.orgId(), range.from(), range.to());
            } catch (Exception e) {
                // Erreur inattendue (hors ChannexException, deja absorbee par le
                // sync service) : on retente comme un echec de push classique.
                log.error("ChannexAriBatcher: flush KO property={}: {}", propertyId, e.getMessage());
                result = new ChannexSyncService.ChannexSyncResult(false, e.getMessage(), 0, 0);
            }

            if (!result.success()) {
                requeueAfterFailure(propertyId, range, result.message());
            }
        }
    }

    /** Re-enfile une plage en echec avec backoff (doc Channex : ~1 min sur 429). */
    private void requeueAfterFailure(Long propertyId, PendingRange failed, String reason) {
        int attempts = failed.attempts() + 1;
        if (attempts >= MAX_ATTEMPTS) {
            // Mapping deja marque ERROR par le sync service : retryFailedMappings
            // (horaire) et les schedulers de reconciliation prennent le relais.
            log.error("ChannexAriBatcher: abandon apres {} tentatives property={} [{}, {}] ({}) — "
                + "relais aux filets de reconciliation", attempts, propertyId,
                failed.from(), failed.to(), reason);
            return;
        }
        Instant nextAttempt = clock.instant().plusSeconds(retrySeconds);
        PendingRange retry = new PendingRange(
            failed.orgId(), failed.from(), failed.to(), nextAttempt, attempts);
        // merge : si des events sont arrives entre-temps, fusionner les plages
        // et conserver le differe (on ne re-pousse pas avant le backoff).
        pending.merge(propertyId, retry, (current, incoming) -> new PendingRange(
            incoming.orgId(),
            current.from().isBefore(incoming.from()) ? current.from() : incoming.from(),
            current.to().isAfter(incoming.to()) ? current.to() : incoming.to(),
            incoming.nextAttemptAt(),
            incoming.attempts()));
        log.warn("ChannexAriBatcher: push KO property={} ({}), retry #{} dans {}s",
            propertyId, reason, attempts, retrySeconds);
    }

    private record PendingRange(Long orgId, LocalDate from, LocalDate to,
                                Instant nextAttemptAt, int attempts) {}
}
