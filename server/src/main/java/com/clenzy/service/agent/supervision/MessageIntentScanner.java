package com.clenzy.service.agent.supervision;

import com.clenzy.model.CalendarDay;
import com.clenzy.model.Conversation;
import com.clenzy.model.MessageIntent;
import com.clenzy.model.Reservation;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.ConversationRepository;
import com.clenzy.repository.MessageIntentRepository;
import com.clenzy.service.PriceEngine;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * M8 — cartes issues des intentions de messages ({@link MessageIntent}, écrites par
 * le classifieur LLM). Le scanner reste 100 % DÉTERMINISTE : il ne consomme aucun
 * token, il croise les intents déjà persistés avec le calendrier et les tarifs.
 * L'intent est un signal ; la faisabilité (calendrier libre, dates disponibles)
 * est vérifiée ICI puis RE-vérifiée à l'apply.
 */
@Component
public class MessageIntentScanner {

    private static final Logger log = LoggerFactory.getLogger(MessageIntentScanner.class);

    /** Seuil de confiance du plan M8 pour les cartes actionnables. */
    static final BigDecimal MIN_CONFIDENCE = new BigDecimal("0.75");
    /** Réclamation : seuil plus haut — reprendre la main est une interruption humaine. */
    static final BigDecimal COMPLAINT_CONFIDENCE = new BigDecimal("0.85");
    /** Fenêtre de fraîcheur des intents considérés (heures). */
    static final int INTENT_WINDOW_HOURS = 48;

    private final MessageIntentRepository messageIntentRepository;
    private final ConversationRepository conversationRepository;
    private final CalendarDayRepository calendarDayRepository;
    private final PriceEngine priceEngine;
    private final SupervisionSuggestionService suggestionService;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public MessageIntentScanner(MessageIntentRepository messageIntentRepository,
                                ConversationRepository conversationRepository,
                                CalendarDayRepository calendarDayRepository,
                                PriceEngine priceEngine,
                                SupervisionSuggestionService suggestionService,
                                ObjectMapper objectMapper,
                                Clock clock) {
        this.messageIntentRepository = messageIntentRepository;
        this.conversationRepository = conversationRepository;
        this.calendarDayRepository = calendarDayRepository;
        this.priceEngine = priceEngine;
        this.suggestionService = suggestionService;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    /** Best-effort par règle : une règle qui casse n'empêche pas les autres. */
    public void scanProperty(Long orgId, Long propertyId) {
        try {
            scanLateCheckoutRequests(orgId, propertyId);
        } catch (Exception e) {
            log.debug("late-checkout scan failed org={} property={}: {}", orgId, propertyId, e.getMessage());
        }
        try {
            scanStayChangeRequests(orgId, propertyId);
        } catch (Exception e) {
            log.debug("stay-change scan failed org={} property={}: {}", orgId, propertyId, e.getMessage());
        }
        try {
            scanComplaints(orgId, propertyId);
        } catch (Exception e) {
            log.debug("complaint scan failed org={} property={}: {}", orgId, propertyId, e.getMessage());
        }
    }

    // ─── LATE_CHECKOUT_REQUEST → LATE_CHECKOUT_APPROVAL (com) ───────────────

    private void scanLateCheckoutRequests(Long orgId, Long propertyId) {
        for (MessageIntent intent : recentIntents(orgId, propertyId,
                MessageIntent.Intent.LATE_CHECKOUT_REQUEST, MIN_CONFIDENCE)) {
            final Reservation reservation = activeReservationOf(orgId, intent);
            if (reservation == null || reservation.getCheckOut() == null
                    || reservation.getCheckOut().isBefore(LocalDate.now(clock))) {
                continue;
            }
            final String requestedTime = extractedField(intent, "requestedTime");
            final String guest = reservation.getGuestName() != null
                    ? reservation.getGuestName() : "Le voyageur";
            if (isDepartureDayFree(orgId, propertyId, reservation)) {
                suggestionService.recordActionableStrict(orgId, propertyId, "com",
                        reservation.getId(),
                        "Late check-out demandé (réservation #" + reservation.getId() + ")",
                        guest + " demande un départ tardif"
                                + (requestedTime != null ? " (" + requestedTime + ")" : "")
                                + " le " + reservation.getCheckOut()
                                + ". Aucune arrivée ni blocage ce jour-là : accorder est sans risque"
                                + " — la réponse part dans la conversation et l'accord est tracé"
                                + " sur la réservation.",
                        SupervisionActionType.LATE_CHECKOUT_APPROVAL,
                        "{\"conversationId\":" + intent.getConversationId()
                                + ",\"reservationId\":" + reservation.getId()
                                + (requestedTime != null ? ",\"requestedTime\":\"" + requestedTime + "\"" : "")
                                + "}",
                        null, "info");
            } else {
                suggestionService.record(orgId, propertyId, "com", "late_checkout_busy",
                        "Late check-out demandé mais journée chargée (réservation #" + reservation.getId() + ")",
                        guest + " demande un départ tardif le " + reservation.getCheckOut()
                                + ", mais une arrivée ou un blocage existe ce jour-là."
                                + " À arbitrer dans la conversation (proposer une consigne bagages ?).",
                        reservation.getId(), "warning");
            }
        }
    }

    /** Le jour du départ est libre : aucune ligne calendrier étrangère à CE séjour. */
    private boolean isDepartureDayFree(Long orgId, Long propertyId, Reservation reservation) {
        final List<CalendarDay> days = calendarDayRepository.findByPropertyAndDateRange(
                propertyId, reservation.getCheckOut(), reservation.getCheckOut(), orgId);
        return days.stream().allMatch(day -> day.getReservation() != null
                && day.getReservation().getId().equals(reservation.getId()));
    }

    // ─── STAY_CHANGE_REQUEST → STAY_MODIFICATION v1 (gst) ───────────────────

    private void scanStayChangeRequests(Long orgId, Long propertyId) {
        for (MessageIntent intent : recentIntents(orgId, propertyId,
                MessageIntent.Intent.STAY_CHANGE_REQUEST, MIN_CONFIDENCE)) {
            final Reservation reservation = activeReservationOf(orgId, intent);
            if (reservation == null) {
                continue;
            }
            final LocalDate newCheckIn = extractedDate(intent, "newCheckIn");
            final LocalDate newCheckOut = extractedDate(intent, "newCheckOut");
            final String guest = reservation.getGuestName() != null
                    ? reservation.getGuestName() : "Le voyageur";
            if (newCheckIn == null || newCheckOut == null || !newCheckOut.isAfter(newCheckIn)) {
                // Dates non extraites : la demande existe mais rien à chiffrer — info.
                suggestionService.record(orgId, propertyId, "gst", "stay_change_unclear",
                        "Modification de séjour demandée (réservation #" + reservation.getId() + ")",
                        guest + " demande à modifier son séjour sans dates précises."
                                + " Clarifier dans la conversation avant de chiffrer.",
                        reservation.getId(), "info");
                continue;
            }
            if (!isRangeFreeForReservation(orgId, propertyId, reservation, newCheckIn, newCheckOut)) {
                suggestionService.record(orgId, propertyId, "gst", "stay_change_unavailable",
                        "Modification demandée mais dates indisponibles (réservation #" + reservation.getId() + ")",
                        guest + " demande " + newCheckIn + " → " + newCheckOut
                                + " ; ces dates ne sont pas libres. Proposer une alternative"
                                + " dans la conversation.",
                        reservation.getId(), "warning");
                continue;
            }
            final BigDecimal newTotal = nightlyTotal(propertyId, orgId, newCheckIn, newCheckOut);
            final BigDecimal delta = newTotal != null && reservation.getTotalPrice() != null
                    ? newTotal.subtract(reservation.getTotalPrice()) : null;
            suggestionService.recordActionableStrict(orgId, propertyId, "gst",
                    reservation.getId(),
                    "Modification de séjour chiffrable (réservation #" + reservation.getId() + ")",
                    guest + " demande " + newCheckIn + " → " + newCheckOut
                            + ". Dates disponibles."
                            + (newTotal != null ? " Nouveau total estimé " + newTotal + " €"
                                    + (delta != null ? " (différentiel " + (delta.signum() >= 0 ? "+" : "") + delta + " €)" : "")
                                    + "." : "")
                            + " « Envoyer » répond avec ce chiffrage (accord de principe) ;"
                            + " la modification effective reste à faire depuis la réservation.",
                    SupervisionActionType.STAY_MODIFICATION,
                    "{\"conversationId\":" + intent.getConversationId()
                            + ",\"reservationId\":" + reservation.getId()
                            + ",\"newCheckIn\":\"" + newCheckIn + "\",\"newCheckOut\":\"" + newCheckOut + "\"}",
                    null, "info");
        }
    }

    /** Nuits [from, to) libres, en ignorant les lignes du séjour à déplacer. */
    private boolean isRangeFreeForReservation(Long orgId, Long propertyId, Reservation reservation,
                                              LocalDate checkIn, LocalDate checkOut) {
        final List<CalendarDay> days = calendarDayRepository.findByPropertyAndDateRange(
                propertyId, checkIn, checkOut.minusDays(1), orgId);
        return days.stream().allMatch(day -> day.getReservation() != null
                && day.getReservation().getId().equals(reservation.getId()));
    }

    private BigDecimal nightlyTotal(Long propertyId, Long orgId, LocalDate checkIn, LocalDate checkOut) {
        try {
            return priceEngine.resolvePriceRange(propertyId, checkIn, checkOut.minusDays(1), orgId)
                    .values().stream()
                    .filter(java.util.Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
        } catch (Exception e) {
            log.debug("price resolution failed property={}: {}", propertyId, e.getMessage());
            return null;
        }
    }

    // ─── COMPLAINT → CONVERSATION_TAKEOVER (com) ─────────────────────────────

    private void scanComplaints(Long orgId, Long propertyId) {
        for (MessageIntent intent : recentIntents(orgId, propertyId,
                MessageIntent.Intent.COMPLAINT, COMPLAINT_CONFIDENCE)) {
            final Conversation conversation = conversationRepository
                    .findByIdAndOrganizationId(intent.getConversationId(), orgId).orElse(null);
            if (conversation == null || conversation.getAssignedToKeycloakId() != null) {
                continue;
            }
            suggestionService.recordActionable(orgId, propertyId, "com",
                    "Réclamation à reprendre (conversation #" + conversation.getId() + ")",
                    "Le dernier message du voyageur est une réclamation (détection IA à haute"
                            + " confiance) et personne n'a la main sur la conversation."
                            + " Reprendre évite qu'une réponse automatique aggrave la situation.",
                    SupervisionActionType.CONVERSATION_TAKEOVER,
                    "{\"conversationId\":" + conversation.getId() + "}",
                    null, "warning");
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private List<MessageIntent> recentIntents(Long orgId, Long propertyId,
                                              MessageIntent.Intent intent, BigDecimal minConfidence) {
        final LocalDateTime since = LocalDateTime.now(clock).minusHours(INTENT_WINDOW_HOURS);
        return messageIntentRepository.findRecentByPropertyAndIntent(
                orgId, propertyId, intent, minConfidence, since);
    }

    /** Réservation du fil, encore active (non annulée, checkout pas passé). */
    private Reservation activeReservationOf(Long orgId, MessageIntent intent) {
        final Conversation conversation = conversationRepository
                .findByIdAndOrganizationId(intent.getConversationId(), orgId).orElse(null);
        if (conversation == null) {
            return null;
        }
        final Reservation reservation = conversation.getReservation();
        if (reservation == null || reservation.getCheckOut() == null
                || reservation.getCheckOut().isBefore(LocalDate.now(clock))) {
            return null;
        }
        final String status = reservation.getStatus();
        if (status != null && (status.equalsIgnoreCase("CANCELLED") || status.equalsIgnoreCase("REFUSED"))) {
            return null;
        }
        return reservation;
    }

    private String extractedField(MessageIntent intent, String field) {
        if (intent.getExtracted() == null) {
            return null;
        }
        try {
            final JsonNode node = objectMapper.readTree(intent.getExtracted()).get(field);
            if (node == null || node.isNull()) {
                return null;
            }
            final String value = node.asText().strip();
            return value.isEmpty() || value.equalsIgnoreCase("null") ? null : value;
        } catch (Exception e) {
            return null;
        }
    }

    private LocalDate extractedDate(MessageIntent intent, String field) {
        final String value = extractedField(intent, field);
        if (value == null) {
            return null;
        }
        try {
            return LocalDate.parse(value);
        } catch (Exception e) {
            return null;
        }
    }
}
