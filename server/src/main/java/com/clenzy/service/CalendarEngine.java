package com.clenzy.service;

import com.clenzy.config.SyncMetrics;
import com.clenzy.exception.CalendarConflictException;
import com.clenzy.exception.CalendarLockException;
import com.clenzy.exception.RestrictionViolationException;
import com.clenzy.model.*;
import com.clenzy.repository.CalendarCommandRepository;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RateOverrideRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import io.micrometer.core.instrument.Timer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.security.access.AccessDeniedException;
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

    /** Source des overrides crees par une mise a jour manuelle du prix. */
    static final String MANUAL_OVERRIDE_SOURCE = "MANUAL";

    /**
     * Prefixe de source des overrides crees par un import de prix OTA inbound
     * (Airbnb, Booking.com, Expedia/VRBO). La source complete est
     * {@code OTA:<CHANNEL>} (ex: {@code OTA:AIRBNB}) afin de tracer le canal
     * d'origine — voir {@link #updateExternalPrice}.
     */
    static final String OTA_OVERRIDE_SOURCE_PREFIX = "OTA:";

    private final CalendarDayRepository calendarDayRepository;
    private final CalendarCommandRepository calendarCommandRepository;
    private final PropertyRepository propertyRepository;
    private final ReservationRepository reservationRepository;
    private final OutboxPublisher outboxPublisher;
    private final RestrictionEngine restrictionEngine;
    private final PriceEngine priceEngine;
    private final RateOverrideRepository rateOverrideRepository;
    private final SyncMetrics syncMetrics;
    private final OrganizationAccessGuard organizationAccessGuard;

    public CalendarEngine(CalendarDayRepository calendarDayRepository,
                          CalendarCommandRepository calendarCommandRepository,
                          PropertyRepository propertyRepository,
                          ReservationRepository reservationRepository,
                          OutboxPublisher outboxPublisher,
                          RestrictionEngine restrictionEngine,
                          PriceEngine priceEngine,
                          RateOverrideRepository rateOverrideRepository,
                          SyncMetrics syncMetrics,
                          OrganizationAccessGuard organizationAccessGuard) {
        this.calendarDayRepository = calendarDayRepository;
        this.calendarCommandRepository = calendarCommandRepository;
        this.propertyRepository = propertyRepository;
        this.reservationRepository = reservationRepository;
        this.outboxPublisher = outboxPublisher;
        this.restrictionEngine = restrictionEngine;
        this.priceEngine = priceEngine;
        this.rateOverrideRepository = rateOverrideRepository;
        this.syncMetrics = syncMetrics;
        this.organizationAccessGuard = organizationAccessGuard;
    }

    // ----------------------------------------------------------------
    // READ : lectures calendrier (deplacees de CalendarController, T-ARCH-01)
    // ----------------------------------------------------------------

    /**
     * Calendrier jour par jour d'une propriete sur la plage [from, to].
     * L'absence de ligne = jour disponible (convention Clenzy).
     */
    @Transactional(readOnly = true)
    public List<CalendarDay> getDays(Long propertyId, LocalDate from, LocalDate to, Long orgId) {
        return calendarDayRepository.findByPropertyAndDateRange(propertyId, from, to, orgId);
    }

    /**
     * Jours BLOCKED / MAINTENANCE de plusieurs proprietes (planning batch).
     * La requete est bornee a l'organisation passee en parametre.
     */
    @Transactional(readOnly = true)
    public List<CalendarDay> getBlockedOrMaintenanceDays(List<Long> propertyIds, LocalDate from,
                                                         LocalDate to, Long orgId) {
        return calendarDayRepository.findBlockedOrMaintenanceForProperties(propertyIds, from, to, orgId);
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
            // Ownership (regle audit 2026-06 #3) : findById contourne le filtre Hibernate.
            organizationAccessGuard.requireSameOrganization(property.getOrganizationId(), orgId,
                    "Propriete " + propertyId + " hors de l'organisation " + orgId);
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
                    buildPayload("BOOKED", propertyId, orgId, checkIn, checkOut, source, reservationId));

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

            // Ownership (regle audit 2026-06 #3) : findById contourne le filtre Hibernate.
            organizationAccessGuard.requireSameOrganization(reservation.getProperty().getOrganizationId(), orgId,
                    "Reservation " + reservationId + " hors de l'organisation " + orgId);

            Long propertyId = reservation.getProperty().getId();
            MDC.put("propertyId", String.valueOf(propertyId));

            acquireLock(propertyId);

            int released = calendarDayRepository.releaseByReservation(reservationId, orgId);

            logCommand(orgId, propertyId, CalendarCommandType.CANCEL,
                    reservation.getCheckIn(), reservation.getCheckOut(),
                    "CANCEL", reservationId, actorId, null);

            outboxPublisher.publishCalendarEvent("CALENDAR_CANCELLED", propertyId, orgId,
                    buildPayload("CANCELLED", propertyId, orgId, reservation.getCheckIn(), reservation.getCheckOut(), "CANCEL", reservationId));

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
    // MOVE : deplacer une reservation (liberer puis re-reserver)
    // ----------------------------------------------------------------

    /**
     * Parametres d'un deplacement de reservation (changement de dates
     * et/ou de propriete sur une reservation qui bloque le calendrier).
     */
    public record ReservationMove(Long reservationId, Long orgId,
                                  Long oldPropertyId, LocalDate oldCheckIn, LocalDate oldCheckOut,
                                  Long newPropertyId, LocalDate newCheckIn, LocalDate newCheckOut,
                                  String source, String actorId) {}

    /**
     * Deplace une reservation : libere les anciens jours puis re-reserve les
     * nouveaux, le tout sous le(s) lock(s) advisory et dans la MEME transaction.
     * Si la nouvelle plage n'est pas disponible, l'exception annule aussi la
     * liberation (rollback complet — la reservation reste sur ses anciens jours).
     *
     * Publie deux events outbox : CALENDAR_CANCELLED (ancienne plage) puis
     * CALENDAR_BOOKED (nouvelle plage) — memes types que cancel()/book(),
     * donc aucun impact sur les consumers de sync channels.
     *
     * @throws CalendarConflictException si la nouvelle plage n'est pas disponible
     * @throws CalendarLockException     si un lock ne peut pas etre acquis
     */
    public List<CalendarDay> move(ReservationMove move) {
        Timer.Sample sample = syncMetrics.startTimer();
        MDC.put("propertyId", String.valueOf(move.newPropertyId()));
        try {
            log.debug("CalendarEngine.move: reservationId={}, propriete {} [{}, {}) -> propriete {} [{}, {})",
                    move.reservationId(), move.oldPropertyId(), move.oldCheckIn(), move.oldCheckOut(),
                    move.newPropertyId(), move.newCheckIn(), move.newCheckOut());

            acquireMoveLocks(move.oldPropertyId(), move.newPropertyId());

            int released = calendarDayRepository.releaseByReservation(move.reservationId(), move.orgId());
            logCommand(move.orgId(), move.oldPropertyId(), CalendarCommandType.CANCEL,
                    move.oldCheckIn(), move.oldCheckOut(), "CANCEL", move.reservationId(), move.actorId(), null);
            outboxPublisher.publishCalendarEvent("CALENDAR_CANCELLED", move.oldPropertyId(), move.orgId(),
                    buildPayload("CANCELLED", move.oldPropertyId(), move.orgId(),
                            move.oldCheckIn(), move.oldCheckOut(), "CANCEL", move.reservationId()));

            // book() re-acquiert le meme lock advisory (re-entrant dans la meme
            // transaction), valide restrictions + conflits, re-reserve les jours,
            // log la commande BOOK et publie CALENDAR_BOOKED.
            List<CalendarDay> days = book(move.newPropertyId(), move.newCheckIn(), move.newCheckOut(),
                    move.reservationId(), move.orgId(), move.source(), move.actorId());

            log.info("CalendarEngine.move: reservation {} deplacee — {} jour(s) libere(s), {} jour(s) re-reserve(s)",
                    move.reservationId(), released, days.size());
            return days;
        } catch (CalendarLockException e) {
            syncMetrics.incrementLockContention();
            throw e;
        } finally {
            syncMetrics.recordCalendarOperation("move", sample);
            MDC.remove("propertyId");
        }
    }

    /**
     * Acquiert les locks advisory des deux proprietes d'un move
     * (ordre croissant d'id pour eviter un deadlock croise).
     */
    private void acquireMoveLocks(Long oldPropertyId, Long newPropertyId) {
        if (oldPropertyId.equals(newPropertyId)) {
            acquireLock(oldPropertyId);
            return;
        }
        acquireLock(Math.min(oldPropertyId, newPropertyId));
        acquireLock(Math.max(oldPropertyId, newPropertyId));
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

            // Ownership (regle audit 2026-06 #3) : findById contourne le filtre Hibernate.
            // Le propertyId peut etre controle par l'appelant (ex: tool LLM block_calendar_day) ;
            // refuser si la propriete n'appartient pas a l'organisation du caller, sinon
            // pollution de calendrier cross-org + outbox event sur une org tierce.
            if (property.getOrganizationId() != null && !property.getOrganizationId().equals(orgId)) {
                throw new AccessDeniedException(
                        "Propriete " + propertyId + " hors de l'organisation " + orgId);
            }

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
                    buildPayload("BLOCKED", propertyId, orgId, from, to, source, null));

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
                    buildPayload("UNBLOCKED", propertyId, orgId, from, to, "MANUAL", null));

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
     * <p>N'ecrit QUE calendar_days.nightly_price (affichage calendrier) — chemin
     * bas niveau partage. Les appelants qui veulent que le prix soit VISIBLE du
     * {@link PriceEngine} (facturation, devis booking engine, push OTA) doivent
     * passer par une variante qui cree en plus un {@link RateOverride} :
     * {@link #updateManualPrice} (source MANUAL, saisie utilisateur) ou
     * {@link #updateExternalPrice} (source OTA:&lt;channel&gt;, imports OTA inbound)
     * — audit Z5-BUGS-04.</p>
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
            // Ownership (regle audit 2026-06 #3) : findById contourne le filtre Hibernate.
            organizationAccessGuard.requireSameOrganization(property.getOrganizationId(), orgId,
                    "Propriete " + propertyId + " hors de l'organisation " + orgId);

            List<CalendarDay> days = upsertDays(property, from, to, orgId);
            for (CalendarDay day : days) {
                day.setNightlyPrice(price);
            }
            calendarDayRepository.saveAll(days);

            String payload = price != null ? "{\"price\":" + price.toPlainString() + "}" : null;
            logCommand(orgId, propertyId, CalendarCommandType.UPDATE_PRICE, from, to,
                    "MANUAL", null, actorId, payload);

            outboxPublisher.publishCalendarEvent("CALENDAR_PRICE_UPDATED", propertyId, orgId,
                    buildPayload("PRICE_UPDATED", propertyId, orgId, from, to, "MANUAL", null));

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

    /**
     * Met a jour MANUELLEMENT le prix par nuit sur les jours [from, to).
     *
     * <p>En plus de l'ecriture calendrier ({@link #updatePrice}), cree/met a jour
     * un {@link RateOverride} source MANUAL par date (audit Z5-BUGS-04) : le prix
     * manuel devient ainsi visible du {@link PriceEngine} (priorite au-dessus des
     * plans) — il est facture au guest (devis booking engine), pousse aux OTA, et
     * n'est plus ecrase par {@link #book} puisque la resolution PriceEngine le
     * retourne desormais en priorite.</p>
     *
     * @param propertyId propriete cible
     * @param from       premier jour (inclus)
     * @param to         dernier jour (exclus)
     * @param price      nouveau prix par nuit (requis)
     * @param orgId      organization du tenant
     * @param actorId    keycloakId de l'acteur ou "system"
     */
    public void updateManualPrice(Long propertyId, LocalDate from, LocalDate to,
                                  BigDecimal price, Long orgId, String actorId) {
        // Ecriture calendrier (lock advisory, command log, event outbox)
        updatePrice(propertyId, from, to, price, orgId, actorId);

        if (price == null) {
            return;
        }

        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new RuntimeException("Propriete introuvable: " + propertyId));

        // Batch : charger les overrides existants de la plage puis upsert par date
        Map<LocalDate, RateOverride> existingByDate = rateOverrideRepository
                .findByPropertyIdAndDateRange(propertyId, from, to, orgId).stream()
                .collect(Collectors.toMap(RateOverride::getDate, o -> o));

        List<RateOverride> toSave = new ArrayList<>();
        for (LocalDate date = from; date.isBefore(to); date = date.plusDays(1)) {
            RateOverride override = existingByDate.get(date);
            if (override == null) {
                override = new RateOverride(property, date, price, MANUAL_OVERRIDE_SOURCE, orgId);
                override.setCreatedBy(actorId);
            } else {
                override.setNightlyPrice(price);
                override.setSource(MANUAL_OVERRIDE_SOURCE);
            }
            toSave.add(override);
        }
        rateOverrideRepository.saveAll(toSave);

        log.info("CalendarEngine.updateManualPrice: {} override(s) MANUAL pour propriete {} [{}, {})",
                toSave.size(), propertyId, from, to);
    }

    /**
     * Met a jour le prix par nuit IMPORTE D'UN OTA sur les jours [from, to).
     *
     * <p>Miroir de {@link #updateManualPrice} pour les imports OTA inbound
     * (Airbnb, Booking.com, Expedia/VRBO — audit Z5-BUGS-04, reliquat) : en plus
     * de l'ecriture calendrier ({@link #updatePrice}), cree/met a jour un
     * {@link RateOverride} de source {@code OTA:<channel>} par date. Le prix
     * importe devient ainsi VISIBLE du {@link PriceEngine} (priorite override,
     * au-dessus des plans) — facture au guest, repercute aux devis.</p>
     *
     * <p>Anti-boucle yield : le yield management ({@link AdvancedRateManager})
     * n'ecrase QUE les overrides de source {@code YIELD_RULE} ; un override
     * {@code OTA:*} est donc preserve (exclusion deja en place, source != YIELD_RULE).</p>
     *
     * <p>Anti-boucle push : cette methode reutilise l'event outbox emis par
     * {@link #updatePrice} ({@code CALENDAR_PRICE_UPDATED}). Elle n'introduit
     * AUCUN event/push supplementaire par rapport au comportement anterieur
     * (qui appelait deja {@link #updatePrice}). Le fan-out OUTBOUND existant
     * vers les channels reste donc inchange (voir note de boucle dans le
     * rapport de mission).</p>
     *
     * @param propertyId propriete cible
     * @param from       premier jour (inclus)
     * @param to         dernier jour (exclus)
     * @param price      nouveau prix par nuit (requis ; un null est ignore comme
     *                   sur {@link #updateManualPrice})
     * @param orgId      organization du tenant
     * @param actorId    identifiant de l'acteur (ex: "airbnb-webhook")
     * @param channel    canal OTA d'origine (ex: "AIRBNB", "BOOKING", "VRBO") ;
     *                   sert a construire la source {@code OTA:<channel>}
     */
    public void updateExternalPrice(Long propertyId, LocalDate from, LocalDate to,
                                    BigDecimal price, Long orgId, String actorId, String channel) {
        // Ecriture calendrier (lock advisory, command log, event outbox)
        updatePrice(propertyId, from, to, price, orgId, actorId);

        if (price == null) {
            return;
        }

        final String overrideSource = OTA_OVERRIDE_SOURCE_PREFIX
                + (channel != null ? channel.trim().toUpperCase(Locale.ROOT) : "UNKNOWN");

        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new RuntimeException("Propriete introuvable: " + propertyId));

        // Batch : charger les overrides existants de la plage puis upsert par date
        Map<LocalDate, RateOverride> existingByDate = rateOverrideRepository
                .findByPropertyIdAndDateRange(propertyId, from, to, orgId).stream()
                .collect(Collectors.toMap(RateOverride::getDate, o -> o));

        List<RateOverride> toSave = new ArrayList<>();
        for (LocalDate date = from; date.isBefore(to); date = date.plusDays(1)) {
            RateOverride override = existingByDate.get(date);
            if (override == null) {
                override = new RateOverride(property, date, price, overrideSource, orgId);
                override.setCreatedBy(actorId);
            } else if (MANUAL_OVERRIDE_SOURCE.equals(override.getSource())) {
                // Un prix fixe manuellement par l'hote prime sur un import OTA :
                // on ne l'ecrase pas (symetrie inverse de la garde yield, qui
                // preserve deja tout override non YIELD_RULE).
                log.debug("CalendarEngine.updateExternalPrice: override MANUAL existant pour"
                                + " propriete {} date {}, import {} ignore sur ce jour",
                        propertyId, date, overrideSource);
                continue;
            } else {
                override.setNightlyPrice(price);
                override.setSource(overrideSource);
            }
            toSave.add(override);
        }
        rateOverrideRepository.saveAll(toSave);

        log.info("CalendarEngine.updateExternalPrice: {} override(s) {} pour propriete {} [{}, {})",
                toSave.size(), overrideSource, propertyId, from, to);
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
    private String buildPayload(String action, Long propertyId, Long orgId, LocalDate from, LocalDate to,
                                 String source, Long reservationId) {
        StringBuilder sb = new StringBuilder("{");
        sb.append("\"action\":\"").append(action).append("\"");
        sb.append(",\"propertyId\":").append(propertyId);
        if (orgId != null) sb.append(",\"orgId\":").append(orgId);
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
