package com.clenzy.service.agent.supervision;

import com.clenzy.model.GuestMessageLog;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.repository.GuestMessageLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Regle de scan DETERMINISTE (module Communication « com ») : pour chaque reservation
 * d'un logement ayant un envoi voyageur en echec RECENT et NON resolu (aucun envoi du
 * meme type abouti depuis), emet une carte HITL INFORMATIONNELLE de l'agent
 * Communication. Complement curatif du scanner preventif
 * {@link GuestEmailMissingScanner} (qui n'alerte QU'AVANT le check-in, fenetre 3 j) :
 * ici on couvre les echecs deja survenus — « Pas de destinataire pour le canal EMAIL »,
 * canal indisponible, erreur SMTP — qui n'etaient visibles QUE dans l'onglet
 * Documents › Historique, sans aucune alerte constellation/pastille.
 *
 * <p>Un echec est considere RESOLU des qu'un envoi du meme type de template a abouti
 * (SENT/DELIVERED) apres l'echec — renvoi manuel depuis l'Historique ou retry. La carte
 * correspondante est alors auto-fermee au scan suivant. Idem si la reservation est
 * annulee ou si l'echec sort de la fenetre de {@value #LOOKBACK_DAYS} jours.</p>
 *
 * <p>Zero cout token (heuristique pure, pas d'appel LLM). Deduplication assuree par
 * {@link SupervisionSuggestionService#record} (titre stable par reservation).
 * Best-effort : toute erreur est absorbee (jamais sur le chemin critique d'un scan).</p>
 */
@Service
public class GuestMessageFailedScanner {

    private static final Logger log = LoggerFactory.getLogger(GuestMessageFailedScanner.class);

    private static final String MODULE_COM = "com";
    private static final String TOOL_NAME = "guest_message_failed";
    /** Fenetre de scan : alignee sur le TTL 7 j des cartes de suggestion. */
    private static final int LOOKBACK_DAYS = 7;
    private static final String SEVERITY_WARNING = "warning";
    private static final String STATUS_CANCELLED = "cancelled";

    private final GuestMessageLogRepository messageLogRepository;
    private final SupervisionSuggestionService suggestionService;
    private final Clock clock;

    public GuestMessageFailedScanner(GuestMessageLogRepository messageLogRepository,
                                     SupervisionSuggestionService suggestionService,
                                     Clock clock) {
        this.messageLogRepository = messageLogRepository;
        this.suggestionService = suggestionService;
        this.clock = clock;
    }

    /**
     * Evalue la regle pour un logement : auto-resout les cartes obsoletes puis emet
     * une carte par reservation ayant au moins un echec d'envoi non resolu.
     */
    public void scanProperty(Long orgId, Long propertyId) {
        if (orgId == null || propertyId == null) {
            return;
        }
        try {
            final LocalDateTime since = LocalDateTime.now(clock).minusDays(LOOKBACK_DAYS);
            final List<GuestMessageLog> failedLogs =
                    messageLogRepository.findRecentFailedByProperty(orgId, propertyId, since);

            // Un seul echec retenu par reservation : le plus recent non resolu
            // (la liste est triee createdAt DESC). Les echecs supplementaires de la
            // meme reservation ne servent qu'au comptage dans le motif.
            final Map<Long, GuestMessageLog> unresolvedByReservation = new LinkedHashMap<>();
            final Map<Long, Integer> unresolvedCount = new LinkedHashMap<>();
            for (GuestMessageLog failure : failedLogs) {
                if (resolved(failure)) {
                    continue;
                }
                unresolvedByReservation.putIfAbsent(reservationId(failure), failure);
                unresolvedCount.merge(reservationId(failure), 1, Integer::sum);
            }

            // Auto-resolution : ferme toute carte PENDING dont la reservation n'a plus
            // d'echec non resolu (renvoi reussi, annulation, ou hors fenetre).
            for (SupervisionSuggestion card : suggestionService.findPendingByTool(orgId, propertyId, TOOL_NAME)) {
                if (card.getReservationId() == null
                        || !unresolvedByReservation.containsKey(card.getReservationId())) {
                    suggestionService.dismiss(orgId, card.getId());
                }
            }

            // Emission (dedup PENDING par intitule stable dans le service).
            unresolvedByReservation.forEach((reservationId, failure) ->
                    emitFailure(orgId, propertyId, failure, unresolvedCount.get(reservationId)));
        } catch (Exception e) {
            log.debug("guest message failed scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
    }

    /**
     * Echec resolu = reservation annulee, template inconnu (ne devrait pas arriver,
     * tous les chemins de {@code createLog} portent un template), ou envoi du meme
     * type abouti APRES l'echec.
     */
    private boolean resolved(GuestMessageLog failure) {
        if (reservationId(failure) == null || failure.getTemplate() == null
                || failure.getTemplate().getType() == null) {
            return true;
        }
        if (STATUS_CANCELLED.equalsIgnoreCase(failure.getReservation().getStatus())) {
            return true;
        }
        return messageLogRepository.existsDeliveredAfter(
                reservationId(failure), failure.getTemplate().getType(), failure.getCreatedAt());
    }

    /**
     * Id de reservation via l'entite fetchee (JOIN FETCH dans la requete du scan) —
     * {@code getReservationId()} n'est peuple que par la DB ({@code insertable=false})
     * et resterait null sur une entite construite hors persistence (tests).
     */
    private static Long reservationId(GuestMessageLog failure) {
        return failure.getReservation() != null ? failure.getReservation().getId() : null;
    }

    private void emitFailure(Long orgId, Long propertyId, GuestMessageLog failure, int count) {
        final String templateName = failure.getTemplate() != null
                && failure.getTemplate().getName() != null
                ? failure.getTemplate().getName() : "Message voyageur";
        // Titre STABLE par reservation (sans date ni detail d'erreur) → dedup fiable
        // sur (org, logement, module, titre) tant que la carte est en attente.
        final String title = "Échec d'envoi voyageur — réservation #" + reservationId(failure);
        final String detail = failure.getErrorMessage() != null && !failure.getErrorMessage().isBlank()
                ? failure.getErrorMessage() : "erreur d'envoi";
        final String extra = count > 1
                ? " (" + count + " envois en échec pour cette réservation)" : "";
        final String motif = String.format(
                "« %s » n'a pas pu être envoyé via %s : %s%s. Corrige la fiche voyageur ou "
                        + "relance l'envoi depuis Documents › Historique.",
                templateName, failure.getChannel(), detail, extra);
        suggestionService.record(orgId, propertyId, MODULE_COM, TOOL_NAME, title, motif,
                reservationId(failure), SEVERITY_WARNING);
    }
}
