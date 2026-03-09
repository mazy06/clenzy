package com.clenzy.integration.hubspot.service;

import com.clenzy.integration.hubspot.dto.HubSpotContactDto;
import com.clenzy.integration.hubspot.dto.HubSpotDealDto;
import com.clenzy.repository.GuestRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.model.Guest;
import com.clenzy.model.Reservation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Service de synchronisation entre les entites Clenzy et HubSpot.
 * Synchronise les guests en contacts et les reservations en deals.
 */
@Service
@ConditionalOnProperty(name = "clenzy.hubspot.api-key")
public class HubSpotSyncService {

    private static final Logger log = LoggerFactory.getLogger(HubSpotSyncService.class);

    private final HubSpotApiService hubSpotApiService;
    private final GuestRepository guestRepository;
    private final ReservationRepository reservationRepository;

    public HubSpotSyncService(HubSpotApiService hubSpotApiService,
                               GuestRepository guestRepository,
                               ReservationRepository reservationRepository) {
        this.hubSpotApiService = hubSpotApiService;
        this.guestRepository = guestRepository;
        this.reservationRepository = reservationRepository;
    }

    /**
     * Synchronise un guest Clenzy vers un contact HubSpot.
     * Cree ou met a jour le contact dans HubSpot.
     *
     * @param guestId identifiant du guest Clenzy
     * @param orgId   identifiant de l'organisation
     */
    public void syncGuestToContact(Long guestId, Long orgId) {
        Guest guest = guestRepository.findById(guestId)
            .orElseThrow(() -> new IllegalArgumentException("Guest non trouve: " + guestId));

        log.info("Synchronisation guest {} vers HubSpot (org: {})", guestId, orgId);

        HubSpotContactDto contactDto = new HubSpotContactDto(
            guest.getEmail(),
            guest.getFirstName(),
            guest.getLastName(),
            guest.getPhone(),
            null,
            Map.of(
                "clenzy_guest_id", String.valueOf(guestId),
                "clenzy_org_id", String.valueOf(orgId)
            )
        );

        String contactId = hubSpotApiService.createOrUpdateContact(contactDto);
        log.info("Guest {} synchronise vers HubSpot contact {}", guestId, contactId);
    }

    /**
     * Synchronise une reservation Clenzy vers un deal HubSpot.
     * Cree un deal dans HubSpot avec les informations de la reservation.
     *
     * @param reservationId identifiant de la reservation
     * @param orgId         identifiant de l'organisation
     */
    public void syncReservationToDeal(Long reservationId, Long orgId) {
        Reservation reservation = reservationRepository.findById(reservationId)
            .orElseThrow(() -> new IllegalArgumentException("Reservation non trouvee: " + reservationId));

        log.info("Synchronisation reservation {} vers HubSpot deal (org: {})", reservationId, orgId);

        HubSpotDealDto dealDto = new HubSpotDealDto(
            "Reservation #" + reservationId,
            reservation.getTotalPrice() != null ? reservation.getTotalPrice().toString() : "0",
            "appointmentscheduled",
            "default",
            reservation.getCheckOut() != null ? reservation.getCheckOut().toString() : null,
            null,
            Map.of(
                "clenzy_reservation_id", String.valueOf(reservationId),
                "clenzy_org_id", String.valueOf(orgId)
            )
        );

        String dealId = hubSpotApiService.createDeal(dealDto);
        log.info("Reservation {} synchronisee vers HubSpot deal {}", reservationId, dealId);
    }
}
