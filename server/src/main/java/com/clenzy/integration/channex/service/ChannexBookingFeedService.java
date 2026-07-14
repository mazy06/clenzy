package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.config.ChannexMetrics;
import com.clenzy.integration.channex.dto.ChannexBookingDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Consommateur du feed de booking revisions Channex — flux PRIMAIRE de
 * reception des reservations (doc Channex / certification PMS, test n°11).
 *
 * <p>Pattern impose par la doc : les webhooks {@code booking_*} ne sont que des
 * DECLENCHEURS (ordre non garanti, livraison best-effort) ; la source de verite
 * est {@code GET /booking_revisions/feed} qui re-sert toute revision non
 * acquittee. Le cycle par revision est strictement :</p>
 * <ol>
 *   <li>lire la revision depuis le feed ;</li>
 *   <li>persister la Reservation Clenzy ({@link ChannexBookingService} —
 *       transaction commitee au retour du proxy) ;</li>
 *   <li>PUIS acquitter via {@code POST /booking_revisions/:id/ack}.</li>
 * </ol>
 *
 * <p>Une revision dont la persistance echoue n'est PAS acquittee : Channex la
 * re-sert au prochain passage (webhook suivant ou scheduler de rattrapage), et
 * alerte via {@code non_acked_booking} au bout de 30 minutes.</p>
 *
 * <p>Reentrance : un seul traitement de feed a la fois (tryLock) — le webhook
 * et le scheduler peuvent se chevaucher, le second passe son tour (le feed
 * re-servira ce qui reste).</p>
 */
@Service
public class ChannexBookingFeedService {

    private static final Logger log = LoggerFactory.getLogger(ChannexBookingFeedService.class);

    /** Taille de page du feed (max Channex = 100). */
    private static final int FEED_PAGE_SIZE = 100;
    /** Garde-fou anti-boucle : nb max de pages traitees par passage. */
    private static final int MAX_PAGES_PER_RUN = 20;

    private final ChannexClient channexClient;
    private final ChannexBookingService bookingService;
    private final ChannexMetrics metrics;
    private final ObjectMapper objectMapper;
    private final ReentrantLock runLock = new ReentrantLock();

    public ChannexBookingFeedService(ChannexClient channexClient,
                                     ChannexBookingService bookingService,
                                     ChannexMetrics metrics,
                                     ObjectMapper objectMapper) {
        this.channexClient = channexClient;
        this.bookingService = bookingService;
        this.metrics = metrics;
        this.objectMapper = objectMapper;
    }

    /**
     * Draine le feed des revisions non acquittees : persiste puis acke chaque
     * revision, page par page, jusqu'a feed vide (ou garde-fou atteint).
     *
     * <p>Une revision en echec est memorisee pour le passage courant (skip aux
     * pages suivantes — sinon boucle infinie puisqu'elle reste dans le feed) et
     * sera re-tentee au prochain passage.</p>
     */
    public FeedProcessingResult processFeed() {
        if (!runLock.tryLock()) {
            log.debug("ChannexFeed: traitement deja en cours, skip");
            return new FeedProcessingResult(0, 0, 0, true);
        }
        try {
            return drainFeed();
        } finally {
            runLock.unlock();
        }
    }

    private FeedProcessingResult drainFeed() {
        int processed = 0;
        int acked = 0;
        Set<String> failedRevisionIds = new HashSet<>();

        for (int page = 0; page < MAX_PAGES_PER_RUN; page++) {
            List<JsonNode> revisions;
            try {
                revisions = channexClient.fetchBookingRevisionsFeed(FEED_PAGE_SIZE);
            } catch (Exception e) {
                log.error("ChannexFeed: lecture du feed KO: {}", e.getMessage());
                metrics.recordBookingProcessed("feed_fetch_error");
                break;
            }
            if (revisions.isEmpty()) break;

            boolean progressed = false;
            for (JsonNode revisionNode : revisions) {
                String revisionId = revisionNode.path("id").asText(null);
                if (revisionId == null || failedRevisionIds.contains(revisionId)) continue;

                processed++;
                if (processRevision(revisionId, revisionNode)) {
                    acked++;
                    progressed = true;
                } else {
                    failedRevisionIds.add(revisionId);
                }
            }
            // Plus aucune revision traitable dans cette page (que des echecs) :
            // inutile de re-fetcher, le feed renverrait les memes.
            if (!progressed) break;
        }

        if (processed > 0 || !failedRevisionIds.isEmpty()) {
            log.info("ChannexFeed: passage termine — {} revisions traitees, {} ackees, {} en echec",
                processed, acked, failedRevisionIds.size());
        }
        return new FeedProcessingResult(processed, acked, failedRevisionIds.size(), false);
    }

    /**
     * Traite UNE revision : persistance (transaction du proxy
     * {@link ChannexBookingService}) puis ack. Retourne false en cas d'echec —
     * la revision reste dans le feed et sera re-servie.
     */
    private boolean processRevision(String revisionId, JsonNode revisionNode) {
        ChannexBookingDto dto;
        try {
            JsonNode attributes = revisionNode.path("attributes");
            dto = objectMapper.treeToValue(
                attributes.isObject() ? attributes : revisionNode, ChannexBookingDto.class);
        } catch (Exception e) {
            log.error("ChannexFeed: revision {} illisible ({}) — non ackee, investigation requise",
                revisionId, e.getMessage());
            metrics.recordBookingProcessed("revision_parse_error");
            return false;
        }

        try {
            dispatchByStatus(dto);
        } catch (Exception e) {
            log.error("ChannexFeed: persistance KO revision={} booking={} status={}: {}",
                revisionId, dto.stableBookingId(), dto.status(), e.getMessage());
            metrics.recordBookingProcessed("revision_persist_error");
            return false;
        }

        // Ack APRES persistance reussie (commit fait au retour du proxy transactionnel).
        try {
            channexClient.ackBookingRevision(revisionId);
            return true;
        } catch (Exception e) {
            // La reservation est en base ; l'ack sera re-tente au prochain passage
            // (l'idempotence par externalUid rend le re-traitement inoffensif).
            log.warn("ChannexFeed: ack KO revision={} (re-tente au prochain passage): {}",
                revisionId, e.getMessage());
            metrics.recordBookingProcessed("revision_ack_error");
            return false;
        }
    }

    private void dispatchByStatus(ChannexBookingDto dto) {
        String status = dto.status() != null ? dto.status().toLowerCase() : "new";
        switch (status) {
            case "cancelled" -> bookingService.handleCancellation(dto);
            case "modified" -> bookingService.handleModification(dto);
            // "new" + statuts inconnus : traiter comme une creation (idempotent).
            default -> bookingService.handleNewBooking(dto);
        }
    }

    /**
     * @param processed  revisions vues sur ce passage
     * @param acked      revisions persistees + acquittees
     * @param failed     revisions en echec (re-servies au prochain passage)
     * @param skippedRun true si le passage a ete saute (traitement deja en cours)
     */
    public record FeedProcessingResult(int processed, int acked, int failed, boolean skippedRun) {}
}
