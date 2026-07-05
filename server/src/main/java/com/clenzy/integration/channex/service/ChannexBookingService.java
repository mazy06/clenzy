package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.config.ChannexMetrics;
import com.clenzy.integration.channex.dto.ChannexBookingDto;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.Guest;
import com.clenzy.model.GuestChannel;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.CalendarEngine;
import com.clenzy.service.GuestService;
import com.clenzy.service.NotificationService;
import com.clenzy.model.NotificationKey;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Logique metier de traitement des bookings recus via webhook Channex.
 *
 * <p>Gere 3 evenements :</p>
 * <ul>
 *   <li><b>booking_new</b> : creer une Reservation Clenzy + bloquer le calendrier</li>
 *   <li><b>booking_modification</b> : retrouver la reservation existante + appliquer
 *     les changements (dates, prix, guest count)</li>
 *   <li><b>booking_cancellation</b> : passer la reservation en CANCELLED + liberer
 *     le calendrier</li>
 * </ul>
 *
 * <p><b>Idempotence :</b> chaque action s'appuie sur l'{@code external_uid} de
 * la {@link Reservation} = {@code "channex:" + channex_booking_id}. Un webhook
 * recu en double pour la meme reservation est detecte et skipped silencieusement.</p>
 *
 * <p>Reference plan : {@code docs/strategy/channex-integration-plan.md} Sprint 4.</p>
 */
@Service
public class ChannexBookingService {

    private static final Logger log = LoggerFactory.getLogger(ChannexBookingService.class);
    /** Prefix utilise dans Reservation.externalUid pour distinguer la source Channex. */
    public static final String EXTERNAL_UID_PREFIX = "channex:";

    private final ChannexPropertyMappingRepository mappingRepository;
    private final ReservationRepository reservationRepository;
    private final PropertyRepository propertyRepository;
    private final GuestService guestService;
    private final CalendarEngine calendarEngine;
    private final NotificationService notificationService;
    private final ChannexMetrics metrics;
    private final com.clenzy.integration.channex.client.ChannexClient channexClient;

    public ChannexBookingService(ChannexPropertyMappingRepository mappingRepository,
                                   ReservationRepository reservationRepository,
                                   PropertyRepository propertyRepository,
                                   GuestService guestService,
                                   CalendarEngine calendarEngine,
                                   NotificationService notificationService,
                                   ChannexMetrics metrics,
                                   com.clenzy.integration.channex.client.ChannexClient channexClient) {
        this.mappingRepository = mappingRepository;
        this.reservationRepository = reservationRepository;
        this.propertyRepository = propertyRepository;
        this.guestService = guestService;
        this.calendarEngine = calendarEngine;
        this.notificationService = notificationService;
        this.metrics = metrics;
        this.channexClient = channexClient;
    }

    // ─── New booking ────────────────────────────────────────────────────────

    /**
     * Cree une Reservation Clenzy depuis un payload Channex {@code booking_new}.
     *
     * <p>Idempotent : si une reservation existe deja avec l'externalUid attendu,
     * on retourne celle existante sans rien modifier.</p>
     */
    @Transactional
    public Reservation handleNewBooking(ChannexBookingDto booking) {
        validateBookingPayload(booking);

        ChannexPropertyMapping mapping = resolveMappingOrThrow(booking.propertyId());
        Long orgId = mapping.getOrganizationId();
        String externalUid = EXTERNAL_UID_PREFIX + booking.id();

        // Idempotence : booking deja persiste ?
        Optional<Reservation> existing = reservationRepository.findByExternalUidAndPropertyId(
            externalUid, mapping.getClenzyPropertyId()
        );
        if (existing.isPresent()) {
            log.info("ChannexBooking: booking {} deja persiste (reservation #{}) — skip",
                booking.id(), existing.get().getId());
            metrics.recordBookingProcessed("duplicate_skip");
            return existing.get();
        }

        Property property = propertyRepository.findById(mapping.getClenzyPropertyId())
            .orElseThrow(() -> new IllegalStateException(
                "Property " + mapping.getClenzyPropertyId() + " mappee Channex mais introuvable en DB"));

        Guest guest = findOrCreateGuest(booking, orgId);
        Reservation reservation = buildReservationFromBooking(booking, property, guest, orgId, externalUid);
        reservation = reservationRepository.save(reservation);

        // Bloquer le calendrier (peut lever une exception en cas de conflit — ce qui est attendu :
        // alerte critique pour intervention manuelle).
        try {
            calendarEngine.book(
                mapping.getClenzyPropertyId(),
                booking.arrivalDate(),
                booking.departureDate(),
                reservation.getId(),
                orgId,
                resolveCalendarSource(booking.otaName()),
                "channex-webhook"
            );
        } catch (Exception e) {
            log.error("ChannexBooking: CONFLIT calendrier pour booking {} (reservation #{}, property {}). "
                + "Reservation creee MAIS dates non bloquees — intervention manuelle requise. Cause: {}",
                booking.id(), reservation.getId(), mapping.getClenzyPropertyId(), e.getMessage());
        }

        log.info("ChannexBooking: reservation {} creee depuis {} (ota={}, dates {}->{}, total {} {})",
            reservation.getConfirmationCode(), booking.id(),
            booking.otaName(), booking.arrivalDate(), booking.departureDate(),
            booking.amount(), booking.currency());
        metrics.recordBookingProcessed("new");

        // Sprint A1 (Quick Win) — Acknowledge le booking aupres de Channex.
        // Sans ack, Channex re-envoie un event non_acked_booking et certains OTAs
        // (Airbnb notamment) interpretent ca comme "reservation perdue" -> escalations.
        // Best-effort : un echec d'ack n'invalide pas la reservation deja creee.
        try {
            channexClient.acknowledgeBooking(booking.id());
        } catch (Exception e) {
            log.warn("ChannexBooking: ack KO booking={} (sera re-tente sur non_acked_booking event): {}",
                booking.id(), e.getMessage());
        }

        // Notifier l'equipe
        try {
            notificationService.notifyAdminsAndManagersByOrgId(
                orgId,
                NotificationKey.RESERVATION_CREATED,
                "Nouvelle reservation via " + (booking.otaName() != null ? booking.otaName() : "Channex"),
                String.format("%s du %s au %s (%s %s)",
                    property.getName(), booking.arrivalDate(), booking.departureDate(),
                    booking.amount(), booking.currency()),
                "/reservations?highlight=" + reservation.getId()
            );
        } catch (Exception e) {
            log.warn("ChannexBooking: notification echouee pour reservation #{}: {}",
                reservation.getId(), e.getMessage());
        }

        return reservation;
    }

    // ─── Modification ───────────────────────────────────────────────────────

    /**
     * Applique une modification a une reservation existante (dates, prix, guest).
     */
    @Transactional
    public Optional<Reservation> handleModification(ChannexBookingDto booking) {
        validateBookingPayload(booking);
        ChannexPropertyMapping mapping = resolveMappingOrThrow(booking.propertyId());
        String externalUid = EXTERNAL_UID_PREFIX + booking.id();

        Optional<Reservation> opt = reservationRepository.findByExternalUidAndPropertyId(
            externalUid, mapping.getClenzyPropertyId()
        );
        if (opt.isEmpty()) {
            log.warn("ChannexBooking: modification recue pour booking {} introuvable cote Clenzy — "
                + "creation a la volee", booking.id());
            return Optional.of(handleNewBooking(booking));
        }

        Reservation reservation = opt.get();
        boolean datesChanged = !reservation.getCheckIn().equals(booking.arrivalDate())
            || !reservation.getCheckOut().equals(booking.departureDate());

        if (datesChanged) {
            // Liberer les anciennes dates avant de re-bloquer les nouvelles
            calendarEngine.cancel(reservation.getId(), reservation.getOrganizationId(), "channex-webhook");
            reservation.setCheckIn(booking.arrivalDate());
            reservation.setCheckOut(booking.departureDate());
        }

        if (booking.totalGuests() > 0) reservation.setGuestCount(booking.totalGuests());
        // Ventilation adultes/enfants (0314) : Channex fournit l'occupation par chambre.
        if (booking.adults() != null) reservation.setAdultsCount(booking.adults());
        if (booking.taxableChildren() != null) reservation.setChildrenCount(booking.taxableChildren());
        if (booking.amount() != null) reservation.setTotalPrice(booking.amount());

        reservationRepository.save(reservation);

        if (datesChanged) {
            try {
                calendarEngine.book(
                    mapping.getClenzyPropertyId(),
                    booking.arrivalDate(),
                    booking.departureDate(),
                    reservation.getId(),
                    reservation.getOrganizationId(),
                    resolveCalendarSource(booking.otaName()),
                    "channex-webhook"
                );
            } catch (Exception e) {
                log.error("ChannexBooking: conflit lors du re-blocage apres modification booking {}: {}",
                    booking.id(), e.getMessage());
            }
        }

        log.info("ChannexBooking: reservation #{} modifiee depuis {} (dates_changed={})",
            reservation.getId(), booking.id(), datesChanged);
        metrics.recordBookingProcessed("modification");
        return Optional.of(reservation);
    }

    // ─── Cancellation ───────────────────────────────────────────────────────

    /**
     * Annule une reservation existante et libere le calendrier.
     */
    @Transactional
    public Optional<Reservation> handleCancellation(ChannexBookingDto booking) {
        if (booking == null || booking.id() == null || booking.propertyId() == null) {
            log.warn("ChannexBooking: cancellation payload incomplet, skip");
            return Optional.empty();
        }

        ChannexPropertyMapping mapping = resolveMappingOrThrow(booking.propertyId());
        String externalUid = EXTERNAL_UID_PREFIX + booking.id();

        Optional<Reservation> opt = reservationRepository.findByExternalUidAndPropertyId(
            externalUid, mapping.getClenzyPropertyId()
        );
        if (opt.isEmpty()) {
            log.warn("ChannexBooking: cancellation pour booking {} inconnu — skip", booking.id());
            return Optional.empty();
        }

        Reservation reservation = opt.get();
        if ("cancelled".equalsIgnoreCase(reservation.getStatus())) {
            log.info("ChannexBooking: reservation #{} deja CANCELLED, skip", reservation.getId());
            return Optional.of(reservation);
        }

        reservation.setStatus("cancelled");
        reservationRepository.save(reservation);

        try {
            calendarEngine.cancel(reservation.getId(), reservation.getOrganizationId(), "channex-webhook");
        } catch (Exception e) {
            log.error("ChannexBooking: erreur liberation calendrier reservation #{}: {}",
                reservation.getId(), e.getMessage());
        }

        log.info("ChannexBooking: reservation #{} annulee depuis Channex booking {}",
            reservation.getId(), booking.id());
        metrics.recordBookingProcessed("cancellation");

        try {
            notificationService.notifyAdminsAndManagersByOrgId(
                reservation.getOrganizationId(),
                NotificationKey.RESERVATION_CANCELLED,
                "Reservation annulee via " + (booking.otaName() != null ? booking.otaName() : "Channex"),
                "Reservation #" + reservation.getId() + " annulee depuis l'OTA. Calendrier libere automatiquement.",
                "/reservations?highlight=" + reservation.getId()
            );
        } catch (Exception e) {
            log.warn("ChannexBooking: notification annulation echouee: {}", e.getMessage());
        }

        return Optional.of(reservation);
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    private void validateBookingPayload(ChannexBookingDto booking) {
        if (booking == null) {
            throw new IllegalArgumentException("ChannexBookingDto null");
        }
        if (booking.id() == null || booking.propertyId() == null) {
            throw new IllegalArgumentException("ChannexBookingDto manque id ou propertyId");
        }
        if (booking.arrivalDate() == null || booking.departureDate() == null) {
            throw new IllegalArgumentException("ChannexBookingDto manque les dates");
        }
        if (!booking.arrivalDate().isBefore(booking.departureDate())) {
            throw new IllegalArgumentException("arrivalDate doit etre strictement avant departureDate");
        }
    }

    private ChannexPropertyMapping resolveMappingOrThrow(String channexPropertyId) {
        return mappingRepository.findByChannexPropertyIdAnyOrg(channexPropertyId)
            .orElseThrow(() -> new IllegalStateException(
                "Aucun ChannexPropertyMapping pour channex_property_id=" + channexPropertyId));
    }

    private Guest findOrCreateGuest(ChannexBookingDto booking, Long orgId) {
        String firstName = booking.customer() != null && booking.customer().name() != null
            ? booking.customer().name() : "Guest";
        String lastName = booking.customer() != null && booking.customer().surname() != null
            ? booking.customer().surname() : "";
        String email = booking.customer() != null ? booking.customer().email() : null;
        String phone = booking.customer() != null ? booking.customer().phone() : null;
        return guestService.findOrCreate(firstName, lastName, email, phone,
            resolveGuestChannel(booking.otaName()), null, orgId);
    }

    private Reservation buildReservationFromBooking(ChannexBookingDto booking, Property property,
                                                      Guest guest, Long orgId, String externalUid) {
        Reservation r = new Reservation();
        r.setOrganizationId(orgId);
        r.setProperty(property);
        r.setGuest(guest);
        r.setGuestName((guest.getFirstName() != null ? guest.getFirstName() : "")
            + " " + (guest.getLastName() != null ? guest.getLastName() : "").trim());
        r.setGuestCount(booking.totalGuests());
        r.setAdultsCount(booking.adults());
        r.setChildrenCount(booking.taxableChildren());
        r.setCheckIn(booking.arrivalDate());
        r.setCheckOut(booking.departureDate());
        r.setCheckInTime(property.getDefaultCheckInTime());
        r.setCheckOutTime(property.getDefaultCheckOutTime());
        r.setStatus("confirmed");
        r.setSource("channex");
        r.setSourceName(booking.otaName() != null ? booking.otaName() : "Channex");
        r.setTotalPrice(booking.amount());
        r.setCurrency(booking.currency() != null ? booking.currency().toUpperCase() : property.getDefaultCurrency());
        r.setRoomRevenue(booking.amount());
        r.setExternalUid(externalUid);
        // OTA reservation code (visible au guest) — utile pour le support
        r.setConfirmationCode(booking.otaReservationCode() != null
            ? booking.otaReservationCode() : ("CHX-" + booking.id().substring(0, Math.min(8, booking.id().length()))));
        // Le guest a deja paye sur l'OTA — on marque PAID
        r.setPaymentStatus(PaymentStatus.PAID);
        r.setPaidAt(LocalDateTime.now());
        return r;
    }

    /**
     * Mapping nom OTA Channex -> GuestChannel Clenzy.
     * Defaut DIRECT pour les OTAs non listees (mieux que de jeter une exception).
     */
    private static GuestChannel resolveGuestChannel(String otaName) {
        if (otaName == null) return GuestChannel.DIRECT;
        String n = otaName.toLowerCase();
        if (n.contains("airbnb")) return GuestChannel.AIRBNB;
        if (n.contains("booking")) return GuestChannel.BOOKING;
        if (n.contains("vrbo") || n.contains("homeaway") || n.contains("abritel")) return GuestChannel.VRBO;
        // Expedia, Trip.com, HomeToGo, Almosafer, etc. : pas de canal dedie → marquer OTHER
        return GuestChannel.OTHER;
    }

    private static String resolveCalendarSource(String otaName) {
        if (otaName == null) return "channex";
        return ("channex-" + otaName.toLowerCase()).replaceAll("[^a-z0-9_-]", "_");
    }
}
