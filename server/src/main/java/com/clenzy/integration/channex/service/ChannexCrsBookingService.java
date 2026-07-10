package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.Guest;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Phase C2 — Booking CRS : pousse les reservations DIRECTES Baitly vers
 * Channex ({@code POST /bookings}, {@code ota_name: "Offline"}).
 *
 * <p>Interets : (1) coherence multi-canal — la resa directe apparait dans
 * Channex comme les resas OTA ; (2) c'est LE moyen de creer les bookings de
 * test de la certification (test n°11) sans compte OTA de test.</p>
 *
 * <p>Pre-requis : app {@code booking_crs} installee sur la property (via
 * l'Applications API — C1). Pas de double-decompte d'availability : nos pushes
 * ARI envoient des valeurs ABSOLUES par date (0/1) recalculees depuis
 * CalendarEngine, qui a deja bloque les nuits de cette resa.</p>
 *
 * <p>Garde-fous :</p>
 * <ul>
 *   <li>jamais de re-push d'une resa VENANT de Channex (source channex —
 *       boucle infinie sinon) ;</li>
 *   <li>idempotence : resa deja poussee ({@code channexCrsBookingId} non null)
 *       → pas de nouveau POST ;</li>
 *   <li>appel HTTP HORS transaction (regle audit n°2) : lecture + build en
 *       transaction courte, POST/PUT hors transaction, persistance de l'id en
 *       nouvelle transaction.</li>
 * </ul>
 */
@Service
public class ChannexCrsBookingService {

    private static final Logger log = LoggerFactory.getLogger(ChannexCrsBookingService.class);

    private final ChannexClient channexClient;
    private final ChannexPropertyMappingRepository mappingRepository;
    private final ReservationRepository reservationRepository;

    public ChannexCrsBookingService(ChannexClient channexClient,
                                    ChannexPropertyMappingRepository mappingRepository,
                                    ReservationRepository reservationRepository) {
        this.channexClient = channexClient;
        this.mappingRepository = mappingRepository;
        this.reservationRepository = reservationRepository;
    }

    /** Bilan d'un push CRS. */
    public record CrsPushResult(String status, String channexBookingId, String detail) {}

    /**
     * Pousse une reservation directe vers Channex. Idempotent : si deja
     * poussee, retourne l'id existant sans nouveau POST.
     */
    public CrsPushResult pushReservation(Long reservationId, Long orgId) {
        // 1. Lecture + validations (transaction implicite courte via repository)
        Reservation reservation = loadOwnedReservation(reservationId, orgId);

        if (reservation.getExternalUid() != null
            && reservation.getExternalUid().startsWith(ChannexBookingService.EXTERNAL_UID_PREFIX)) {
            return new CrsPushResult("skipped_ota_booking", null,
                "Reservation venue de Channex — jamais re-poussee (boucle)");
        }
        if (reservation.getChannexCrsBookingId() != null) {
            return new CrsPushResult("already_pushed", reservation.getChannexCrsBookingId(),
                "Deja poussee au CRS");
        }
        ChannexPropertyMapping mapping = mappingRepository
            .findByClenzyPropertyId(reservation.getProperty().getId(), orgId)
            .orElseThrow(() -> new IllegalStateException(
                "Aucun mapping Channex pour la propriete " + reservation.getProperty().getId()));

        Map<String, Object> payload = buildCrsPayload(reservation, mapping);

        // 2. Appel Channex HORS transaction (audit n°2)
        String channexBookingId = channexClient.createCrsBooking(payload);

        // 3. Persistance de l'id en transaction dediee
        if (channexBookingId != null) {
            saveCrsBookingId(reservationId, orgId, channexBookingId);
        }
        log.info("ChannexCRS: reservation #{} poussee (channexBookingId={})",
            reservationId, channexBookingId);
        return new CrsPushResult("pushed", channexBookingId, null);
    }

    /**
     * Annule cote Channex un booking CRS deja pousse ({@code PUT /bookings/:id}
     * avec {@code status: "cancelled"}). La reservation Clenzy elle-meme est
     * annulee par le flux normal — ceci ne synchronise que le miroir Channex.
     */
    public CrsPushResult cancelPushedReservation(Long reservationId, Long orgId) {
        Reservation reservation = loadOwnedReservation(reservationId, orgId);
        String channexBookingId = reservation.getChannexCrsBookingId();
        if (channexBookingId == null) {
            return new CrsPushResult("not_pushed", null,
                "Reservation jamais poussee au CRS — rien a annuler cote Channex");
        }
        ChannexPropertyMapping mapping = mappingRepository
            .findByClenzyPropertyId(reservation.getProperty().getId(), orgId)
            .orElseThrow(() -> new IllegalStateException(
                "Aucun mapping Channex pour la propriete " + reservation.getProperty().getId()));

        Map<String, Object> payload = buildCrsPayload(reservation, mapping);
        payload.put("status", "cancelled");

        channexClient.updateCrsBooking(channexBookingId, payload);
        log.info("ChannexCRS: reservation #{} annulee cote Channex (booking={})",
            reservationId, channexBookingId);
        return new CrsPushResult("cancelled", channexBookingId, null);
    }

    // ─── Internals ──────────────────────────────────────────────────────────
    // PAS de @Transactional ici : ces methodes sont auto-invoquees (meme classe,
    // proxy contourne — audit n°6). Chaque appel repository porte sa propre
    // transaction, suffisant pour ces operations mono-statement ; le POST/PUT
    // Channex reste ainsi hors de toute transaction DB (audit n°2).

    private Reservation loadOwnedReservation(Long reservationId, Long orgId) {
        Reservation reservation = reservationRepository.findById(reservationId)
            .orElseThrow(() -> new IllegalStateException("Reservation introuvable : " + reservationId));
        // findById contourne le filtre Hibernate : validation d'org explicite (audit n°3)
        if (!orgId.equals(reservation.getOrganizationId())) {
            throw new org.springframework.security.access.AccessDeniedException(
                "Reservation " + reservationId + " hors de l'organisation " + orgId);
        }
        return reservation;
    }

    private void saveCrsBookingId(Long reservationId, Long orgId, String channexBookingId) {
        Reservation reservation = loadOwnedReservation(reservationId, orgId);
        reservation.setChannexCrsBookingId(channexBookingId);
        reservationRepository.save(reservation);
    }

    /**
     * Construit le payload CRS (doc Booking CRS API). Le prix par nuit est
     * derive du total : repartition HALF_UP avec ajustement de la DERNIERE
     * nuit pour que la somme des nuits == total exact (jamais de centimes
     * perdus — regle argent).
     */
    private Map<String, Object> buildCrsPayload(Reservation reservation,
                                                ChannexPropertyMapping mapping) {
        LocalDate checkIn = reservation.getCheckIn();
        LocalDate checkOut = reservation.getCheckOut();
        long nights = ChronoUnit.DAYS.between(checkIn, checkOut);
        if (nights <= 0) {
            throw new IllegalStateException("Reservation " + reservation.getId()
                + " sans nuitee (checkIn=" + checkIn + ", checkOut=" + checkOut + ")");
        }

        BigDecimal total = reservation.getTotalPrice() != null
            ? reservation.getTotalPrice() : BigDecimal.ZERO;
        BigDecimal perNight = total.divide(BigDecimal.valueOf(nights), 2, RoundingMode.HALF_UP);

        Map<String, Object> days = new LinkedHashMap<>();
        BigDecimal allocated = BigDecimal.ZERO;
        for (LocalDate d = checkIn; d.isBefore(checkOut); d = d.plusDays(1)) {
            boolean last = d.equals(checkOut.minusDays(1));
            BigDecimal nightPrice = last ? total.subtract(allocated) : perNight;
            days.put(d.toString(), nightPrice.setScale(2, RoundingMode.HALF_UP).toPlainString());
            allocated = allocated.add(nightPrice);
        }

        Guest guest = reservation.getGuest();
        Map<String, Object> customer = new LinkedHashMap<>();
        customer.put("name", guest != null && guest.getFirstName() != null ? guest.getFirstName() : "Guest");
        customer.put("surname", guest != null && guest.getLastName() != null ? guest.getLastName() : "");
        if (guest != null && guest.getEmail() != null) customer.put("mail", guest.getEmail());
        if (guest != null && guest.getPhone() != null) customer.put("phone", guest.getPhone());

        Map<String, Object> occupancy = new LinkedHashMap<>();
        occupancy.put("adults", reservation.getAdultsCount() != null
            ? reservation.getAdultsCount() : Math.max(1, reservation.getGuestCount()));
        occupancy.put("children", reservation.getChildrenCount() != null
            ? reservation.getChildrenCount() : 0);
        occupancy.put("infants", 0);

        Map<String, Object> room = new LinkedHashMap<>();
        room.put("room_type_id", mapping.getChannexRoomTypeId());
        room.put("rate_plan_id", mapping.getChannexDefaultRatePlanId());
        room.put("days", days);
        room.put("occupancy", occupancy);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("property_id", mapping.getChannexPropertyId());
        payload.put("ota_name", "Offline");
        payload.put("ota_reservation_code", reservation.getConfirmationCode() != null
            ? reservation.getConfirmationCode() : ("BAITLY-" + reservation.getId()));
        payload.put("arrival_date", checkIn.toString());
        payload.put("departure_date", checkOut.toString());
        payload.put("currency", reservation.getCurrency() != null
            ? reservation.getCurrency().toUpperCase() : "EUR");
        payload.put("customer", customer);
        payload.put("rooms", List.of(room));
        return payload;
    }
}
