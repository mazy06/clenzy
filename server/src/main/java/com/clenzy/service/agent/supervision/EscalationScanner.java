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
    /** Fenêtre de fraîcheur de l'incident bloquant (relogement, M11 v1). */
    static final int RELODGE_INCIDENT_HOURS = 72;

    private final ReservationRepository reservationRepository;
    private final ConversationRepository conversationRepository;
    private final com.clenzy.repository.GuestDeclarationRepository guestDeclarationRepository;
    private final com.clenzy.repository.InterventionRepository interventionRepository;
    private final com.clenzy.repository.PropertyRepository propertyRepository;
    private final com.clenzy.repository.CalendarDayRepository calendarDayRepository;
    private final SupervisionSuggestionService suggestionService;
    private final Clock clock;

    public EscalationScanner(ReservationRepository reservationRepository,
                             ConversationRepository conversationRepository,
                             com.clenzy.repository.GuestDeclarationRepository guestDeclarationRepository,
                             com.clenzy.repository.InterventionRepository interventionRepository,
                             com.clenzy.repository.PropertyRepository propertyRepository,
                             com.clenzy.repository.CalendarDayRepository calendarDayRepository,
                             SupervisionSuggestionService suggestionService,
                             Clock clock) {
        this.reservationRepository = reservationRepository;
        this.conversationRepository = conversationRepository;
        this.guestDeclarationRepository = guestDeclarationRepository;
        this.interventionRepository = interventionRepository;
        this.propertyRepository = propertyRepository;
        this.calendarDayRepository = calendarDayRepository;
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
        try {
            scanRelodgeNeeded(orgId, propertyId);
        } catch (Exception e) {
            log.debug("relodge scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
        try {
            scanPossibleNoShow(orgId, propertyId);
        } catch (Exception e) {
            log.debug("no-show scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
    }

    /**
     * No-show possible (M7, agent Synchronisation) : séjour confirmé arrivé depuis
     * ≥ 1 jour, pas terminé, non marqué — et AUCUN signe de vie : aucune déclaration
     * voyageur ET aucun message entrant depuis l'arrivée. Les deux signaux sont
     * nommés dans le motif (c'est un faisceau, pas une preuve) ; la décision reste
     * humaine et la déclaration OTA manuelle.
     */
    private void scanPossibleNoShow(Long orgId, Long propertyId) {
        final LocalDate today = LocalDate.now(clock);
        for (Reservation stay : reservationRepository
                .findCurrentOrNextByPropertyId(propertyId, today, orgId)) {
            if (!"confirmed".equalsIgnoreCase(stay.getStatus()) || stay.isNoShow()
                    || stay.getCheckIn() == null || stay.getCheckOut() == null
                    || stay.getCheckIn().isAfter(today.minusDays(1))
                    || !stay.getCheckOut().isAfter(today)) {
                continue;
            }
            final boolean hasDeclaration = !guestDeclarationRepository
                    .findByReservationIdOrderByIdAsc(stay.getId()).isEmpty();
            if (hasDeclaration) {
                continue;
            }
            final boolean hasInbound = conversationRepository.hasInboundMessageSince(
                    stay.getId(), orgId, stay.getCheckIn().atStartOfDay());
            if (hasInbound) {
                continue;
            }
            suggestionService.recordActionableStrict(
                    orgId, propertyId, "sync", stay.getId(),
                    "No-show possible (réservation #" + stay.getId() + ")",
                    "Arrivée prévue le " + stay.getCheckIn() + ", aucun signe de vie depuis : "
                            + "pas de fiche voyageur déposée, aucun message reçu. « Marquer "
                            + "no-show » libère les nuits restantes pour la revente — la "
                            + "déclaration sur le canal d'origine reste à faire par vos soins "
                            + "(fenêtre de 48 h chez la plupart des OTA).",
                    SupervisionActionType.NOSHOW_MARK,
                    "{\"reservationId\":" + stay.getId() + "}", null, "warning");
        }
    }

    /**
     * Relogement (M11 v1, agent Voyageur) : incident maintenance BLOQUANT (priorité
     * haute, ouvert, < {@value #RELODGE_INCIDENT_HOURS} h) × séjour confirmé en cours
     * ou arrivant demain × logement de repli LIBRE sur la fenêtre restante (capacité
     * suffisante, même ville si connue). La carte propose — le transfert n'a lieu
     * qu'au clic « Reloger » de l'opérateur, jamais automatiquement.
     */
    private void scanRelodgeNeeded(Long orgId, Long propertyId) {
        final LocalDateTime now = LocalDateTime.now(clock);
        final boolean blockingIncident = interventionRepository
                .findByPropertyAndCreatedBetween(propertyId, orgId,
                        now.minusHours(RELODGE_INCIDENT_HOURS), now).stream()
                .anyMatch(i -> i.getType() != null && i.getType().contains("MAINTENANCE")
                        && "HIGH".equalsIgnoreCase(i.getPriority())
                        && com.clenzy.service.automation.CreateMaintenanceInterventionExecutor
                                .openStatuses().contains(i.getStatus()));
        if (!blockingIncident) {
            return;
        }
        final LocalDate today = LocalDate.now(clock);
        final Reservation stay = reservationRepository
                .findCurrentOrNextByPropertyId(propertyId, today, orgId).stream()
                .filter(r -> "confirmed".equalsIgnoreCase(r.getStatus()))
                .filter(r -> r.getCheckIn() != null && r.getCheckOut() != null
                        && !r.getCheckIn().isAfter(today.plusDays(1))
                        && r.getCheckOut().isAfter(today))
                .findFirst().orElse(null);
        if (stay == null) {
            return; // pas de séjour affecté — l'incident suit le circuit maintenance normal
        }
        final var origin = stay.getProperty();
        final LocalDate from = today.isAfter(stay.getCheckIn()) ? today : stay.getCheckIn();
        final var target = propertyRepository.findByOrganizationId(orgId).stream()
                .filter(p -> !propertyId.equals(p.getId()))
                .filter(p -> p.getMaxGuests() == null || stay.getGuestCount() == null
                        || p.getMaxGuests() >= stay.getGuestCount())
                .filter(p -> origin == null || origin.getCity() == null
                        || origin.getCity().equalsIgnoreCase(p.getCity()))
                .filter(p -> calendarDayRepository
                        .findUnavailableDatesInRange(p.getId(), from, stay.getCheckOut(), orgId)
                        .isEmpty())
                .findFirst().orElse(null);
        if (target == null) {
            return; // aucun repli libre — rien d'honnête à proposer
        }
        suggestionService.recordActionableStrict(
                orgId, propertyId, "gst", stay.getId(),
                "Relogement à valider (réservation #" + stay.getId() + ")",
                "Incident bloquant sur ce logement pendant le séjour ("
                        + stay.getCheckIn() + " → " + stay.getCheckOut() + "). « "
                        + target.getName() + " » est libre sur la fenêtre restante. « Reloger » "
                        + "déplace le séjour (calendrier, ménage, codes) et informe le voyageur "
                        + "par email — un conflit apparu entre-temps refuse l'opération.",
                SupervisionActionType.RELODGE_TRANSFER,
                "{\"reservationId\":" + stay.getId()
                        + ",\"targetPropertyId\":" + target.getId() + "}",
                null, "critical");
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
