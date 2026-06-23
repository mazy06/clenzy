package com.clenzy.booking.service;

import com.clenzy.booking.dto.BookingInquiryRequestDto;
import com.clenzy.booking.model.BookingInquiry;
import com.clenzy.booking.repository.BookingInquiryRepository;
import com.clenzy.model.NotificationKey;
import com.clenzy.service.NotificationService;
import com.clenzy.util.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;

/**
 * Enregistre les demandes de réservation (« devis ») du booking engine PUBLIC et notifie le host
 * (in-app). Parcours « Demande de devis » — SANS paiement immédiat ; le host répond hors ligne / par devis.
 * Org-scopé via orgId explicite (contexte public, comme la capture de leads).
 */
@Service
public class BookingInquiryService {

    private final BookingInquiryRepository repository;
    private final NotificationService notificationService;
    private final Clock clock;

    public BookingInquiryService(BookingInquiryRepository repository,
                                 NotificationService notificationService,
                                 Clock clock) {
        this.repository = repository;
        this.notificationService = notificationService;
        this.clock = clock;
    }

    @Transactional
    public void create(Long orgId, BookingInquiryRequestDto dto) {
        if (dto.email() == null || dto.email().isBlank()) {
            throw new IllegalArgumentException("email obligatoire pour une demande de réservation");
        }
        BookingInquiry inquiry = new BookingInquiry();
        inquiry.setOrganizationId(orgId);
        inquiry.setPropertyId(dto.propertyId());
        inquiry.setCheckIn(dto.checkIn());
        inquiry.setCheckOut(dto.checkOut());
        inquiry.setGuests(dto.guests());
        inquiry.setName(dto.name() != null ? dto.name().trim() : null);
        inquiry.setEmail(dto.email().trim());
        inquiry.setPhone(dto.phone() != null ? dto.phone().trim() : null);
        inquiry.setMessage(dto.message());
        inquiry.setStatus("NEW");
        inquiry.setCreatedAt(clock.instant());
        repository.save(inquiry);

        // Notification host (in-app). Inputs utilisateur ÉCHAPPÉS (règle sécurité #4). Notif DB = pas
        // d'appel externe en transaction (règle audit #2 respectée).
        final String who = StringUtils.escapeHtml(
            inquiry.getName() != null && !inquiry.getName().isBlank() ? inquiry.getName() : inquiry.getEmail());
        final String dates = (inquiry.getCheckIn() != null && inquiry.getCheckOut() != null)
            ? " — " + inquiry.getCheckIn() + " → " + inquiry.getCheckOut() : "";
        final String guests = inquiry.getGuests() != null ? ", " + inquiry.getGuests() + " voyageur(s)" : "";
        notificationService.notifyAdminsAndManagersByOrgId(
            orgId,
            NotificationKey.BOOKING_INQUIRY_RECEIVED,
            "Nouvelle demande de réservation",
            who + dates + guests,
            null
        );
    }
}
