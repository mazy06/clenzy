package com.clenzy.service;

import com.clenzy.config.SyncMetrics;
import com.clenzy.exception.CalendarConflictException;
import com.clenzy.exception.CalendarLockException;
import com.clenzy.exception.RestrictionViolationException;
import com.clenzy.model.*;
import com.clenzy.repository.CalendarCommandRepository;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import io.micrometer.core.instrument.Timer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Moteur calendrier transactionnel.
 *
 * Serialise les ecritures par propriete via pg_advisory_xact_lock(property_id).
 * Chaque mutation est loggee dans calendar_commands (write-ahead log).
 *
 * Convention de plages :
 * - book/block/unblock/updatePrice : [from, to) — to exclusif
 *   En location courte duree, le jour de checkout est disponible pour un nouveau check-in.
 *
 * orgId est passe en parametre (et non via TenantContext) pour supporter
 * les appels depuis les Kafka consumers (hors contexte HTTP).
 */
@Service
@Transactional
public class CalendarEngine {

    private static final Logger log = LoggerFactory.getLogger(CalendarEngine.class);

    private final CalendarDayRepository calendarDayRepository;
    private final CalendarCommandRepository calendarCommandRepository;
    private final PropertyRepository propertyRepository;
    private final ReservationRepository reservationRepository;
    private final OutboxPublisher outboxPublisher;
    private final RestrictionEngine restrictionEngine;
    private final PriceEngine priceEngine;
    private final SyncMetrics syncMetrics;

    public CalendarEngine(CalendarDayRepository calendarDayRepository,
                          CalendarCommandRepository calendarCommandRepository,
                          PropertyRepository propertyRepository,
                          ReservationRepository reservationRepository,
                          OutboxPublisher outboxPublisher,
                          RestrictionEngine restrictionEngine,
                          PriceEngine priceEngine,
                          SyncMetrics syncMetrics) {
        this.calendarDayRepository = calendarDayRepository;
        this.calendarCommandRepository = calendarCommandRepository;
        this.propertyRepository = propertyRepository;
        this.reservationRepository = reservationRepository;
        this.outboxPublisher = outboxPublisher;
        this.restrictionEngine = restrictionEngine;
        this.priceEngine = priceEngine;
        this.syncMetrics = syncMetrics;
    }

    // ----------------------------------------------------------------
    // BOOK : reserver des dates [checkIn, checkOut)
    // ----------------------------------------------------------------

    /**
     * Reserve les jours [checkIn, checkOut) pour une propriete.
     * Leve CalendarConflictException si au moins un jour n'est pas AVAILABLE.
     * Leve CalendarLockException si le lock ne peut pas etre acquis.
     *
     * @param propertyId    propriete cible
     * @param checkIn       premier jour reserve (inclus)
     * @param checkOut      jour de depart (exclus — disponible pour un nouveau check-in)
     * @param reservationId id de la reservation (peut etre null si pas encore persistee)
     * @param orgId         organization du tenant
     * @param source        source de la reservation (MANUAL, AIRBNB, ICAL, etc.)
     * @param actorId       keycloakId de l'acteur ou "system"
     * @return liste des CalendarDay crees/modifies
     */
    public List<CalendarDay> book(Long propertyId, LocalDate checkIn, LocalDate checkOut,
                                   Long reservationId, Long orgId, String source, String actorId) {
        Timer.Sample sample = syncMetrics.startTimer();
        MDC.put("propertyId", String.valueOf(propertyId));
        try {
            log.debug("CalendarEngine.book: propertyId={}, checkIn={}, checkOut={}, orgId={}", propertyId, checkIn, checkOut, orgId);

            // 1. Acquérir le lock
            acquireLock(propertyId);

            // 2. Valider les restrictions de reservation (G8)
            RestrictionEngine.ValidationResult restrictionResult =
                    restrictionEngine.validate(propertyId, checkIn, checkOut, orgId);
            if (!restrictionResult.isValid()) {
                throw new RestrictionViolationException(propertyId, checkIn, checkOut, restrictionResult.getViolations());
            }

            // 3. Verifier les conflits
            long conflicts = calendarDayRepository.countConflicts(propertyId, checkIn, checkOut, orgId);
            if (conflicts > 0) {
                syncMetrics.incrementConflictDetected();
                log.warn("CalendarEngine.book: {} conflit(s) detecte(s) pour propriete {} entre {} et {}",
                        conflicts, propertyId, checkIn, checkOut);
                throw new CalendarConflictException(propertyId, checkIn, checkOut, conflicts);
            }

            // 4. Recuperer la propriete et la reservation
            Property property = propertyRepository.findById(propertyId)
                    .orElseThrow(() -> new RuntimeException("Propriete introuvable: " + propertyId));
            Reservation reservation = resolveReservation(reservationId);

            // 5. Resoudre les prix par nuit via le PriceEngine (G7)
            Map<LocalDate, BigDecimal> priceMap = priceEngine.resolvePriceRange(propertyId, checkIn, checkOut, orgId);

            // 6. UPSERT les CalendarDays
            List<CalendarDay> days = upsertDays(property, checkIn, checkOut, orgId);
            for (CalendarDay day : days) {
                day.setStatus(CalendarDayStatus.BOOKED);
                day.setReservation(reservation);
                day.setSource(source != null ? source : "MANUAL");
                BigDecimal resolvedPrice = priceMap.get(day.getDate());
                if (resolvedPrice != null) {
                    day.setNightlyPrice(resolvedPrice);
                } else if (day.getNightlyPrice() == null && property.getNightlyPrice() != null) {
                    day.setNightlyPrice(property.getNightlyPrice());
                }
            }
            calendarDayRepository.saveAll(days);

            // 7. Log la commande
            logCommand(orgId, propertyId, CalendarCommandType.BOOK, checkIn, checkOut,
                    source, reservationId, actorId, null);

            // 8. Publier l'event dans l'outbox (meme transaction)
            outboxPublisher.publishCalendarEvent("CALENDAR_BOOKED", propertyId, orgId,
                    buildPayload("BOOKED", propertyId, checkIn, checkOut, source, reservationId));

            log.info("CalendarEngine.book: {} jours reserves pour propriete {} [{}, {})",
                    days.size(), propertyId, checkIn, checkOut);
            return days;
        } catch (CalendarLockException e) {
            syncMetrics.incrementLockContention();
            throw e;
        } finally {
            syncMetrics.recordCalendarOperation("book", sample);
            MDC.remove("propertyId");
        }
    }

    // ----------------------------------------------------------------
    // CANCEL : annuler une reservation (liberer les jours)
    // ----------------------------------------------------------------

    /**
     * Annule les jours lies a une reservation (remet en AVAILABLE).
     *
     * @param reservationId id de la reservation a annuler
     * @param orgId         organization du tenant
     * @param actorId       keycloakId de l'acteur ou "system"
     * @return nombre de jours liberes
     */
    public int cancel(Long reservationId, Long orgId, String actorId) {
        Timer.Sample sample = syncMetrics.startTimer();
        try {
            log.debug("CalendarEngine.cancel: reservationId={}, orgId={}", reservationId, orgId);

            Reservation reservation = reservationRepository.findById(reservationId)
                    .orElseThrow(() -> new RuntimeException("Reservation introuvable: " + reservationId));

            Long propertyId = reservation.getProperty().getId();
            MDC.put("propertyId", String.valueOf(propertyId));

            acquireLock(propertyId);

            int released = calendarDayRepository.releaseByReservation(reservationId, orgId);

            logCommand(orgId, propertyId, CalendarCommandType.CANCEL,
                    reservation.getCheckIn(), reservation.getCheckOut(),
                    "CANCEL", reservationId, actorId, null);

            outboxPublisher.publishCalendarEvent("CALENDAR_CANCELLED", propertyId, orgId,
                    buildPayload("CANCELLED", propertyId, reservation.getCheckIn(), reservation.getCheckOut(), "CANCEL", reservationId));

            log.info("CalendarEngine.cancel: {} jour(s) libere(s) pour reservation {} (propriete {})",
                    released, reservationId, propertyId);
            return released;
        } catch (CalendarLockException e) {
            syncMetrics.incrementLockContention();
            throw e;
        } finally {
            syncMetrics.recordCalendarOperation("cancel", sample);
            MDC.remove("propertyId");
        }
    }

    // ----------------------------------------------------------------
    // BLOCK : bloquer des dates [from, to)
    // ----------------------------------------------------------------

    /**
     * Bloque les jours [from, to) pour une propriete.
     * Refuse si des jours BOOKED existent dans la plage.
     *
     * @param propertyId propriete cible
     * @param from       premier jour bloque (inclus)
     * @param to         dernier jour (exclus)
     * @param orgId      organization du tenant
     * @param source     source du blocage (MANUAL, AIRBNB, etc.)
     * @param notes      raison du blocage (optionnel)
     * @param actorId    keycloakId de l'acteur ou "system"
     * @return liste des CalendarDay bloques
     */
    public List<CalendarDay> block(Long propertyId, LocalDate from, LocalDate to,
                                    Long orgId, String source, String notes, String actorId) {
        Timer.Sample sample = syncMetrics.startTimer();
        MDC.put("propertyId", String.valueOf(propertyId));
        try {
            log.debug("CalendarEngine.block: propertyId={}, from={}, to={}, orgId={}", propertyId, from, to, orgId);

            acquireLock(propertyId);

            long bookedCount = calendarDayRepository.countBookedInRange(propertyId, from, to, orgId);
            if (bookedCount > 0) {
                syncMetrics.incrementConflictDetected();
                throw new CalendarConflictException(propertyId, from, to, bookedCount);
            }

            Property property = propertyRepository.findById(propertyId)
                    .orElseThrow(() -> new RuntimeException("Propriete introuvable: " + propertyId));

            List<CalendarDay> days = upsertDays(property, from, to, orgId);
            for (CalendarDay day : days) {
                day.setStatus(CalendarDayStatus.BLOCKED);
                day.setSource(source != null ? source : "MANUAL");
                day.setNotes(notes);
                day.setReservation(null);
            }
            calendarDayRepository.saveAll(days);

            logCommand(orgId, propertyId, CalendarCommandType.BLOCK, from, to,
                    source, null, actorId, notes != null ? "{\"notes\":\"" + notes.replace("\"", "\\\"") + "\"}" : null);

            outboxPublisher.publishCalendarEvent("CALENDAR_BLOCKED", propertyId, orgId,
                    buildPayload("BLOCKED", propertyId, from, to, source, null));

            log.info("CalendarEngine.block: {} jour(s) bloque(s) pour propriete {} [{}, {})",
                    days.size(), propertyId, from, to);
            return days;
        } catch (CalendarLockException e) {
            syncMetrics.incrementLockContention();
            throw e;
        } finally {
            syncMetrics.recordCalendarOperation("block", sample);
            MDC.remove("propertyId");
        }
    }

    // ----------------------------------------------------------------
    // UNBLOCK : debloquer des dates [from, to)
    // ----------------------------------------------------------------

    /**
     * Debloque les jours [from, to) pour une propriete.
     * Seuls les jours avec status=BLOCKED sont affectes.
     *
     * @param propertyId propriete cible
     * @param from       premier jour a debloquer (inclus)
     * @param to         dernier jour (exclus)
     * @param orgId      organization du tenant
     * @param actorId    keycloakId de l'acteur ou "system"
     * @return nombre de jours debloques
     */
    public int unblock(Long propertyId, LocalDate from, LocalDate to,
                       Long orgId, String actorId) {
        Timer.Sample sample = syncMetrics.startTimer();
        MDC.put("propertyId", String.valueOf(propertyId));
        try {
            log.debug("CalendarEngine.unblock: propertyId={}, from={}, to={}, orgId={}", propertyId, from, to, orgId);

            acquireLock(propertyId);

            List<CalendarDay> blockedDays = calendarDayRepository.findBlockedInRange(propertyId, from, to, orgId);
            for (CalendarDay day : blockedDays) {
                day.setStatus(CalendarDayStatus.AVAILABLE);
                day.setSource("MANUAL");
                day.setNotes(null);
            }
            calendarDayRepository.saveAll(blockedDays);

            logCommand(orgId, propertyId, CalendarCommandType.UNBLOCK, from, to,
                    "MANUAL", null, actorId, null);

            outboxPublisher.publishCalendarEvent("CALENDAR_UNBLOCKED", propertyId, orgId,
                    buildPayload("UNBLOCKED", propertyId, from, to, "MANUAL", null));

            log.info("CalendarEngine.unblock: {} jour(s) debloque(s) pour propriete {} [{}, {})",
                    blockedDays.size(), propertyId, from, to);
            return blockedDays.size();
        } catch (CalendarLockException e) {
            syncMetrics.incrementLockContention();
            throw e;
        } finally {
            syncMetrics.recordCalendarOperation("unblock", sample);
            MDC.remove("propertyId");
        }
    }

    // ----------------------------------------------------------------
    // UPDATE_PRICE : mettre a jour le prix par nuit [from, to)
    // ----------------------------------------------------------------

    /**
     * Met a jour le prix par nuit sur les jours [from, to) d'une propriete.
     * Cree les CalendarDays s'ils n'existent pas encore.
     *
     * @param propertyId propriete cible
     * @param from       premier jour (inclus)
     * @param to         dernier jour (exclus)
     * @param price      nouveau prix par nuit
     * @param orgId      organization du tenant
     * @param actorId    keycloakId de l'acteur ou "system"
     */
    public void updatePrice(Long propertyId, LocalDate from, LocalDate to,
                            BigDecimal price, Long orgId, String actorId) {
        Timer.Sample sample = syncMetrics.startTimer();
        MDC.put("propertyId", String.valueOf(propertyId));
        try {
            log.debug("CalendarEngine.updatePrice: propertyId={}, from={}, to={}, price={}, orgId={}",
                    propertyId, from, to, price, orgId);

            acquireLock(propertyId);

            Property property = propertyRepository.findById(propertyId)
                    .orElseThrow(() -> new RuntimeException("Propriete introuvable: " + propertyId));

            List<CalendarDay> days = upsertDays(property, from, to, orgId);
            for (CalendarDay day : days) {
                day.setNightlyPrice(price);
            }
            calendarDayRepository.saveAll(days);

            String payload = price != null ? "{\"price\":" + price.toPlainString() + "}" : null;
            logCommand(orgId, propertyId, CalendarCommandType.UPDATE_PRICE, from, to,
                    "MANUAL", null, actorId, payload);

            outboxPublisher.publishCalendarEvent("CALENDAR_PRICE_UPDATED", propertyId, orgId,
                    buildPayload("PRICE_UPDATED", propertyId, from, to, "MANUAL", null));

            log.info("CalendarEngine.updatePrice: prix mis a jour sur {} jour(s) pour propriete {} [{}, {})",
                    days.size(), propertyId, from, to);
        } catch (CalendarLockException e) {
            syncMetrics.incrementLockContention();
            throw e;
        } finally {
            syncMetrics.recordCalendarOperation("updatePrice", sample);
            MDC.remove("propertyId");
        }
    }

    // ----------------------------------------------------------------
    // LINK_RESERVATION : lier une reservation aux CalendarDays
    // ----------------------------------------------------------------

    /**
     * Met a jour le reservation_id sur les CalendarDays d'une plage.
     * Appele apres la sauvegarde de la reservation pour lier les jours
     * qui ont ete marques BOOKED sans reservation_id.
     *
     * @param propertyId    propriete cible
     * @param checkIn       premier jour (inclus)
     * @param checkOut      jour de depart (exclus)
     * @param reservationId id de la reservation a lier
     * @param orgId         organization du tenant
     */
    public void linkReservation(Long propertyId, LocalDate checkIn, LocalDate checkOut,
                                 Long reservationId, Long orgId) {
        calendarDayRepository.linkReservation(propertyId, checkIn, checkOut, reservationId, orgId);
        log.debug("CalendarEngine.linkReservation: reservation {} liee aux jours [{}, {}) de propriete {}",
                reservationId, checkIn, checkOut, propertyId);
    }

    // ================================================================
    // Methodes internes
    // ================================================================

    /**
     * Acquiert le lock advisory transactionnel sur la propriete.
     * Leve CalendarLockException si le lock est deja pris.
     */
    private void acquireLock(Long propertyId) {
        boolean locked = calendarDayRepository.acquirePropertyLock(propertyId);
        if (!locked) {
            throw new CalendarLockException(propertyId);
        }
    }

    /**
     * UPSERT pattern : recupere les CalendarDays existants dans la plage [from, to),
     * et cree les manquants.
     *
     * @return liste complete des jours dans la plage (existants + nouveaux)
     */
    private List<CalendarDay> upsertDays(Property property, LocalDate from, LocalDate to, Long orgId) {
        // Bornes : [from, to) → on va de from a to-1 (inclus)
        LocalDate lastDay = to.minusDays(1);

        // Recuperer les jours existants
        List<CalendarDay> existing = calendarDayRepository.findByPropertyAndDateRange(
                property.getId(), from, lastDay, orgId);

        // Indexer par date pour acces O(1)
        Map<LocalDate, CalendarDay> byDate = existing.stream()
                .collect(Collectors.toMap(CalendarDay::getDate, d -> d));

        // Generer la liste complete
        List<CalendarDay> result = new ArrayList<>();
        for (LocalDate date = from; date.isBefore(to); date = date.plusDays(1)) {
            CalendarDay day = byDate.get(date);
            if (day == null) {
                // Creer un nouveau jour
                day = new CalendarDay(property, date, CalendarDayStatus.AVAILABLE, orgId);
            }
            result.add(day);
        }
        return result;
    }

    /**
     * Resout une reservation par son ID (nullable).
     */
    private Reservation resolveReservation(Long reservationId) {
        if (reservationId == null) return null;
        return reservationRepository.findById(reservationId).orElse(null);
    }

    /**
     * Construit le payload JSON pour un event outbox calendrier.
     */
    private String buildPayload(String action, Long propertyId, LocalDate from, LocalDate to,
                                 String source, Long reservationId) {
        StringBuilder sb = new StringBuilder("{");
        sb.append("\"action\":\"").append(action).append("\"");
        sb.append(",\"propertyId\":").append(propertyId);
        sb.append(",\"from\":\"").append(from).append("\"");
        sb.append(",\"to\":\"").append(to).append("\"");
        if (source != null) sb.append(",\"source\":\"").append(source).append("\"");
        if (reservationId != null) sb.append(",\"reservationId\":").append(reservationId);
        sb.append(",\"timestamp\":\"").append(java.time.Instant.now()).append("\"");
        sb.append("}");
        return sb.toString();
    }

    /**
     * Log une commande dans la table calendar_commands.
     */
    private void logCommand(Long orgId, Long propertyId, CalendarCommandType type,
                            LocalDate from, LocalDate to, String source,
                            Long reservationId, String actorId, String payload) {
        CalendarCommand command = new CalendarCommand(orgId, propertyId, type, from, to,
                source != null ? source : "MANUAL");
        command.setReservationId(reservationId);
        command.setActorId(actorId);
        command.setPayload(payload);
        command.setStatus("EXECUTED");
        calendarCommandRepository.save(command);
    }
}
