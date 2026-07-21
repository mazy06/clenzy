package com.clenzy.service.ical;

import com.clenzy.dto.ICalImportDto.ICalEventPreview;
import com.clenzy.model.Guest;
import com.clenzy.model.ICalFeed;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.GuestService;
import com.clenzy.service.PriceEngine;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Import d'un evenement iCal vers une Reservation : dedoublonnage par UID scope au
 * feed, creation (pricing dynamique, guest, masquage des annulees chevauchantes)
 * ou annulation cascade si l'evenement est passe CANCELLED cote OTA.
 */
@Component
public class ICalReservationImporter {

    private static final Logger log = LoggerFactory.getLogger(ICalReservationImporter.class);

    /** Noms de guest generiques produits par les plateformes OTA (iCal) */
    private static final Set<String> GENERIC_GUEST_NAMES = Set.of(
            "reserved", "not available", "unavailable", "blocked",
            "airbnb", "booking.com", "vrbo", "homeaway"
    );

    private final ReservationRepository reservationRepository;
    private final PriceEngine priceEngine;
    private final GuestService guestService;
    private final TenantContext tenantContext;
    private final ICalReservationCanceller reservationCanceller;

    public ICalReservationImporter(ReservationRepository reservationRepository,
                                   PriceEngine priceEngine,
                                   GuestService guestService,
                                   TenantContext tenantContext,
                                   ICalReservationCanceller reservationCanceller) {
        this.reservationRepository = reservationRepository;
        this.priceEngine = priceEngine;
        this.guestService = guestService;
        this.tenantContext = tenantContext;
        this.reservationCanceller = reservationCanceller;
    }

    /**
     * Precharge la table de dedoublonnage UID -> reservation, scope au feed
     * (Z6-SECBUGS-06). Les reservations rattachees a un AUTRE feed de la meme
     * propriete sont exclues : un channel manager peut reutiliser le meme UID
     * sur deux canaux, et la reservation du second canal ne doit pas etre
     * silencieusement skippee. Les reservations sans feed restent dedupliquees
     * (feed supprime puis recree : la FK reservations.ical_feed_id est
     * ON DELETE SET NULL) — priorite aux reservations rattachees a CE feed.
     */
    public void preloadKnownFeedReservations(ICalImportSession session) {
        Long feedId = session.feed.getId();
        for (Reservation reservation : reservationRepository.findByPropertyId(
                session.property.getId(), session.orgId)) {
            ICalFeed reservationFeed = reservation.getIcalFeed();
            if (reservationFeed != null && !feedId.equals(reservationFeed.getId())) {
                continue; // reservation d'un AUTRE feed : pas un doublon pour ce feed
            }
            String uid = reservation.getExternalUid();
            if (uid != null) {
                if (reservationFeed != null || !session.knownUidToReservationId.containsKey(uid)) {
                    session.knownUidToReservationId.put(uid, reservation.getId());
                }
            } else {
                // Sans UID : repli sur la cle dates (priorite a CE feed comme pour l'UID).
                String dateKey = dateKey(reservation.getCheckIn(), reservation.getCheckOut());
                if (reservationFeed != null || !session.knownDateKeyToReservationId.containsKey(dateKey)) {
                    session.knownDateKeyToReservationId.put(dateKey, reservation.getId());
                }
            }
        }
    }

    /** Cle de dedoublonnage de repli pour les evenements sans UID. */
    private static String dateKey(LocalDate checkIn, LocalDate checkOut) {
        return checkIn + "_" + checkOut;
    }

    /**
     * Importe un evenement : dedoublonnage par UID, puis creation ou annulation de
     * la reservation. Retourne l'id de la Reservation concernee (existante ou creee)
     * pour la suite du pipeline (demande de menage).
     */
    public Long importEvent(ICalImportSession session, ICalEventPreview event) {
        Long reservationId = findExistingReservationId(session, event);
        if (reservationId != null) {
            handleExistingReservation(session, event, reservationId);
            return reservationId;
        }
        return createReservationFromEvent(session, event);
    }

    /**
     * Dedoublonnage par UID scope au feed (cf. {@link #preloadKnownFeedReservations}) :
     * retourne l'id de la Reservation si elle existe deja pour CE feed.
     */
    private Long findExistingReservationId(ICalImportSession session, ICalEventPreview event) {
        if (event.getUid() != null) {
            return session.knownUidToReservationId.get(event.getUid());
        }
        // Pas d'UID : repli sur la cle dates pour eviter une duplication au re-import.
        if (event.getDtStart() == null) {
            return null;
        }
        LocalDate checkOut = event.getDtEnd() != null ? event.getDtEnd() : event.getDtStart().plusDays(1);
        return session.knownDateKeyToReservationId.get(dateKey(event.getDtStart(), checkOut));
    }

    /** Reservation deja existante — verifier si annulee cote OTA, sinon skip. */
    private void handleExistingReservation(ICalImportSession session, ICalEventPreview event, Long reservationId) {
        Reservation existing = reservationRepository.findById(reservationId).orElse(null);
        if (existing != null && "cancelled".equals(event.getStatus())
                && !"cancelled".equals(existing.getStatus())) {
            reservationCanceller.cancelReservationWithCascade(existing, session);
            session.cancelled++;
            return;
        }
        if (existing != null && "cancelled".equals(existing.getStatus())
                && !"cancelled".equals(event.getStatus())) {
            // L'UID est revenu actif dans le feed alors que la reservation est annulee
            // localement : pas de reactivation automatique (risque de re-bloquer des
            // dates revendues) — visibilite operateur via ce warn.
            log.warn("iCal sync: reservation #{} (uid={}) annulee cote PMS mais active dans le feed — reactivation manuelle requise",
                    existing.getId(), existing.getExternalUid());
        }
        session.skipped++;
    }

    /** Cree la Reservation a partir de l'evenement iCal et planifie la facture OTA. */
    private Long createReservationFromEvent(ICalImportSession session, ICalEventPreview event) {
        Reservation reservation = buildReservation(session, event);
        reservation = reservationRepository.save(reservation);
        Long reservationId = reservation.getId();

        // Dedup intra-batch : un meme UID (ou, a defaut, memes dates) repete dans ce
        // feed sera skippe au lieu d'etre reduplique.
        if (event.getUid() != null) {
            session.knownUidToReservationId.put(event.getUid(), reservationId);
        } else {
            session.knownDateKeyToReservationId.put(
                    dateKey(reservation.getCheckIn(), reservation.getCheckOut()), reservationId);
        }

        // Auto-facture OTA : reservation de canal externe (deja payee). Facturee APRES
        // le commit (date facture = maintenant ≈ date d'import). Pas de backfill : seules
        // les reservations nouvellement creees ici sont concernees (dedup par UID en amont).
        if (session.otaPaidSource && reservation.getTotalPrice() != null
                && reservation.getTotalPrice().compareTo(BigDecimal.ZERO) > 0) {
            session.reservationsToInvoice.add(reservationId);
        }

        linkGuest(session, reservation);
        hideCancelledOverlapping(session, reservation);

        session.imported++;
        return reservationId;
    }

    private Reservation buildReservation(ICalImportSession session, ICalEventPreview event) {
        Property property = session.property;
        Reservation reservation = new Reservation();
        reservation.setProperty(property);

        // Si le guest name est generique ("Reserved", "Not available", etc.),
        // on l'incremente pour individualiser chaque fiche client
        String guestName = disambiguateGuestName(event.getGuestName(), property.getId(), session.guestNameCounters);
        reservation.setGuestName(guestName);
        reservation.setGuestCount(property.getMaxGuests() != null ? property.getMaxGuests() : 2);
        reservation.setCheckIn(event.getDtStart());
        LocalDate checkOut = event.getDtEnd() != null ? event.getDtEnd() : event.getDtStart().plusDays(1);
        reservation.setCheckOut(checkOut);
        // Utiliser les heures par defaut de la propriete, sinon fallback global
        String defaultCheckIn = property.getDefaultCheckInTime() != null
                ? property.getDefaultCheckInTime() : ICalImportDefaults.DEFAULT_CHECK_IN_TIME;
        String defaultCheckOut = property.getDefaultCheckOutTime() != null
                ? property.getDefaultCheckOutTime() : ICalImportDefaults.DEFAULT_CHECK_OUT_TIME;
        reservation.setCheckInTime(defaultCheckIn);
        reservation.setCheckOutTime(defaultCheckOut);
        // Utiliser le statut parse depuis l'iCal (CONFIRMED/TENTATIVE/CANCELLED).
        // Si absent (la plupart des OTA ne le fournissent pas), defaut = "confirmed" :
        // les blocages ("Not available", "Blocked") sont deja filtres en amont (type
        // "blocked"), donc tout evenement restant est une vraie reservation OTA = booking
        // confirme. "pending" excluait a tort ces reservations des traitements filtres sur
        // "confirmed" (livret d'accueil, envoi auto des instructions check-in, revenus).
        String importedStatus = event.getStatus() != null ? event.getStatus() : "confirmed";
        if ("cancelled".equalsIgnoreCase(importedStatus)) {
            reservation.markCancelled();
        } else {
            reservation.setStatus(importedStatus);
        }
        reservation.setSource(session.sourceKey);
        reservation.setSourceName(session.request.getSourceName());
        reservation.setConfirmationCode(event.getConfirmationCode());
        reservation.setExternalUid(event.getUid());
        reservation.setIcalFeed(session.feed);
        reservation.setNotes(event.getDescription());
        reservation.setOrganizationId(tenantContext.getOrganizationId());

        applyDynamicPrice(session, reservation, checkOut);
        return reservation;
    }

    /**
     * Calcule le prix total via le moteur de pricing dynamique.
     * Resout les overrides, rate plans (promo/seasonal/base) et fallback property.nightlyPrice.
     */
    private void applyDynamicPrice(ICalImportSession session, Reservation reservation, LocalDate checkOut) {
        Map<LocalDate, BigDecimal> priceMap = priceEngine.resolvePriceRange(
                session.property.getId(), reservation.getCheckIn(), checkOut, session.orgId);
        BigDecimal totalPrice = BigDecimal.ZERO;
        for (LocalDate date = reservation.getCheckIn(); date.isBefore(checkOut); date = date.plusDays(1)) {
            BigDecimal nightlyPrice = priceMap.get(date);
            if (nightlyPrice != null) {
                totalPrice = totalPrice.add(nightlyPrice);
            }
        }
        if (totalPrice.compareTo(BigDecimal.ZERO) > 0) {
            reservation.setTotalPrice(totalPrice);
        }
    }

    /** Cree/lie le Guest des l'import pour que guestEmail soit persistable via PUT. */
    private void linkGuest(ICalImportSession session, Reservation reservation) {
        String guestName = reservation.getGuestName();
        if (reservation.getGuest() != null || guestName == null || guestName.isBlank()) {
            return;
        }
        try {
            Guest guest = guestService.findOrCreateFromName(guestName, session.sourceKey, session.orgId);
            if (guest != null) {
                reservation.setGuest(guest);
                reservationRepository.save(reservation);
            }
        } catch (Exception e) {
            // Comptage explicite dans le resultat de sync : sans fiche Guest, le guestEmail
            // n'est pas persistable (PUT) — l'echec ne doit pas etre silencieux.
            log.error("Impossible de creer le Guest pour reservation #{}: {}",
                    reservation.getId(), e.getMessage());
            session.errors.add("Guest non lie pour la reservation #" + reservation.getId()
                    + " : " + e.getMessage());
        }
    }

    /** Auto-masque les reservations annulees qui chevauchent la nouvelle. */
    private void hideCancelledOverlapping(ICalImportSession session, Reservation reservation) {
        List<Reservation> cancelledOverlapping = reservationRepository.findCancelledOverlapping(
                session.property.getId(), reservation.getCheckIn(), reservation.getCheckOut(),
                tenantContext.getRequiredOrganizationId());
        for (Reservation cancelledRes : cancelledOverlapping) {
            cancelledRes.setHiddenFromPlanning(true);
            reservationRepository.save(cancelledRes);
            log.info("Auto-masque reservation annulee #{} (chevauche nouvelle OTA #{})",
                    cancelledRes.getId(), reservation.getId());
        }
    }

    /**
     * Si le nom du guest est generique (ex: "Reserved" via Airbnb iCal),
     * on l'incremente en "Reserved #1", "Reserved #2", etc.
     * Utilise un compteur local (en memoire) + le count en base pour garantir
     * un numero unique meme au sein d'un meme batch d'import.
     */
    private String disambiguateGuestName(String originalName, Long propertyId,
                                          Map<String, Long> counters) {
        if (originalName == null || originalName.isBlank()) {
            originalName = "Reserved";
        }

        String nameLower = originalName.trim().toLowerCase();
        if (!GENERIC_GUEST_NAMES.contains(nameLower)) {
            return originalName.trim(); // Nom reel, on ne touche pas
        }

        String counterKey = propertyId + "_" + nameLower;

        if (!counters.containsKey(counterKey)) {
            // Premiere occurrence dans ce batch : initialiser depuis la base
            long orgId = tenantContext.getRequiredOrganizationId();
            long dbCount = reservationRepository.countByGuestNameStartingWithAndPropertyId(
                    originalName.trim(), propertyId, orgId);
            counters.put(counterKey, dbCount);
        }

        long next = counters.merge(counterKey, 1L, Long::sum);
        return originalName.trim() + " #" + next;
    }
}
