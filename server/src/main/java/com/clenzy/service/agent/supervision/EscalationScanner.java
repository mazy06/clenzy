package com.clenzy.service.agent.supervision;

import com.clenzy.model.Conversation;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ConversationRepository;
import com.clenzy.repository.ReservationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Règles de scan DÉTERMINISTES d'escalade (vague C de la constellation métiers) :
 * <ul>
 *   <li><b>Chevauchement de réservations</b> (agent Synchronisation) : deux séjours
 *       actifs se recouvrent (annulation OTA rejouée, course d'imports iCal…) → carte
 *       {@code OVERBOOKING_RESOLVE} « Résoudre » — l'agent recommande de GARDER la
 *       réservation créée en premier et de replacer l'autre ;</li>
 *   <li><b>Conversation chaude sans réponse</b> (agent Communication) : ≥
 *       {@value #HOT_MIN_INBOUND} messages entrants en {@value #HOT_WINDOW_MINUTES} min,
 *       dernier message entrant, personne d'assigné → carte
 *       {@code CONVERSATION_TAKEOVER} « Reprendre la main » (la validation ASSIGNE la
 *       conversation à l'opérateur qui clique).</li>
 * </ul>
 *
 * <p>Zéro coût token. Dédup par intitulé (ids). Best-effort par règle.</p>
 */
@Service
public class EscalationScanner {

    private static final Logger log = LoggerFactory.getLogger(EscalationScanner.class);

    static final int HOT_WINDOW_MINUTES = 30;
    static final int HOT_MIN_INBOUND = 3;

    private final ReservationRepository reservationRepository;
    private final ConversationRepository conversationRepository;
    private final SupervisionSuggestionService suggestionService;
    private final Clock clock;

    public EscalationScanner(ReservationRepository reservationRepository,
                             ConversationRepository conversationRepository,
                             SupervisionSuggestionService suggestionService,
                             Clock clock) {
        this.reservationRepository = reservationRepository;
        this.conversationRepository = conversationRepository;
        this.suggestionService = suggestionService;
        this.clock = clock;
    }

    /** Évalue les deux règles pour un logement. */
    public void scanProperty(Long orgId, Long propertyId) {
        if (orgId == null || propertyId == null) {
            return;
        }
        try {
            scanOverlaps(orgId, propertyId);
        } catch (Exception e) {
            log.debug("overbooking scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
        try {
            scanHotConversations(orgId, propertyId);
        } catch (Exception e) {
            log.debug("hot conversation scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
    }

    private void scanOverlaps(Long orgId, Long propertyId) {
        final List<Object[]> pairs = reservationRepository
                .findOverlappingPairsByProperty(propertyId, orgId, LocalDate.now(clock));
        for (Object[] pair : pairs) {
            final Reservation first = (Reservation) pair[0];
            final Reservation second = (Reservation) pair[1];
            // Recommandation : GARDER la réservation créée en premier (elle a « pris »
            // les nuits), replacer l'autre — l'opérateur reste juge (carte HITL).
            final boolean firstOlder = first.getCreatedAt() == null || second.getCreatedAt() == null
                    || !first.getCreatedAt().isAfter(second.getCreatedAt());
            final Reservation keep = firstOlder ? first : second;
            final Reservation cancel = firstOlder ? second : first;
            suggestionService.recordActionable(
                    orgId, propertyId, "sync",
                    "Chevauchement #" + keep.getId() + " × #" + cancel.getId(),
                    "Les réservations #" + keep.getId() + " (" + keep.getCheckIn() + " → "
                            + keep.getCheckOut() + ", " + sourceLabel(keep) + ") et #" + cancel.getId()
                            + " (" + cancel.getCheckIn() + " → " + cancel.getCheckOut() + ", "
                            + sourceLabel(cancel) + ") se recouvrent. « Résoudre » garde la plus "
                            + "ancienne (#" + keep.getId() + ") et annule #" + cancel.getId()
                            + " — calendrier libéré, à replacer avec le voyageur.",
                    SupervisionActionType.OVERBOOKING_RESOLVE,
                    "{\"cancelReservationId\":" + cancel.getId()
                            + ",\"keepReservationId\":" + keep.getId() + "}",
                    null, "critical");
        }
    }

    private void scanHotConversations(Long orgId, Long propertyId) {
        final LocalDateTime since = LocalDateTime.now(clock).minusMinutes(HOT_WINDOW_MINUTES);
        final List<Conversation> hot = conversationRepository
                .findHotUnassignedByProperty(orgId, propertyId, since, HOT_MIN_INBOUND);
        for (Conversation conversation : hot) {
            final String who = conversation.getGuest() != null
                    && conversation.getGuest().getFullName() != null
                    ? conversation.getGuest().getFullName()
                    : "un voyageur";
            suggestionService.recordActionable(
                    orgId, propertyId, "com",
                    "Conversation à reprendre (conversation #" + conversation.getId() + ")",
                    HOT_MIN_INBOUND + " messages ou plus de " + who + " en "
                            + HOT_WINDOW_MINUTES + " minutes, le dernier sans réponse et personne "
                            + "d'assigné. « Reprendre la main » vous assigne la conversation — "
                            + "l'agent s'efface, c'est vous qui répondez.",
                    SupervisionActionType.CONVERSATION_TAKEOVER,
                    "{\"conversationId\":" + conversation.getId() + "}",
                    null, "warning");
        }
    }

    private static String sourceLabel(Reservation reservation) {
        return reservation.getSource() != null && !reservation.getSource().isBlank()
                ? reservation.getSource() : "source inconnue";
    }
}
