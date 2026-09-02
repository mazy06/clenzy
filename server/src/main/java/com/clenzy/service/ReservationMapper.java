package com.clenzy.service;

import com.clenzy.dto.ReservationDto;
import com.clenzy.model.Guest;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.GuestRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.agent.analytics.ChannelCommissionResolver;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Mapper Reservation entity <-> ReservationDto.
 * Centralise la conversion pour eviter la duplication dans le controller.
 */
@Component
public class ReservationMapper {

    private final PropertyRepository propertyRepository;
    private final GuestRepository guestRepository;
    /** La base ne stocke qu'une cle opaque : l'URL servable se fabrique ici. */
    private final GuestPhotoUrlResolver photoUrls;
    private final ChannelCommissionResolver commissionResolver;

    public ReservationMapper(PropertyRepository propertyRepository,
                             GuestRepository guestRepository,
                             GuestPhotoUrlResolver photoUrls,
                             ChannelCommissionResolver commissionResolver) {
        this.propertyRepository = propertyRepository;
        this.guestRepository = guestRepository;
        this.photoUrls = photoUrls;
        this.commissionResolver = commissionResolver;
    }

    /**
     * Commission du canal sur ce sejour : le montant reellement remonte quand il
     * existe, sinon une estimation au taux par defaut.
     *
     * <p>Le calcul est delegue a {@link ChannelCommissionResolver} plutot que
     * reproduit ici : la regle « reel sinon estime » sert deja aux analytics et
     * a la facturation, et deux implementations divergeraient.</p>
     *
     * @return {@code null} sur une vente directe, ou faute de prix a estimer
     */
    private Double resolveOtaFee(Reservation entity) {
        if (entity.getOtaFeeAmount() != null) {
            return entity.getOtaFeeAmount().doubleValue();
        }
        BigDecimal gross = entity.getTotalPrice();
        if (gross == null) {
            return null;
        }
        BigDecimal estimated = commissionResolver.commissionOf(entity, gross);
        return estimated == null || estimated.signum() <= 0 ? null : estimated.doubleValue();
    }

    public ReservationDto toDto(Reservation entity) {
        Guest guest = entity.getGuest();
        return new ReservationDto(
            entity.getId(),
            entity.getProperty() != null ? entity.getProperty().getId() : null,
            entity.getProperty() != null ? entity.getProperty().getName() : "",
            entity.getGuestName() != null ? entity.getGuestName() : "",
            guest != null ? guest.getId() : null,
            guest != null ? guest.getEmail() : null,
            guest != null ? guest.getPhone() : null,
            entity.getGuestCount() != null ? entity.getGuestCount() : 1,
            entity.getCheckIn() != null ? entity.getCheckIn().toString() : null,
            entity.getCheckOut() != null ? entity.getCheckOut().toString() : null,
            entity.getCheckInTime() != null ? entity.getCheckInTime() : "15:00",
            entity.getCheckOutTime() != null ? entity.getCheckOutTime() : "11:00",
            entity.getStatus(),
            entity.getSource(),
            entity.getSourceName(),
            entity.isCollectedByChannel(),
            entity.getTotalPrice() != null ? entity.getTotalPrice().doubleValue() : 0.0,
            entity.getConfirmationCode(),
            entity.getNotes(),
            entity.getCleaningFee() != null ? entity.getCleaningFee().doubleValue() : null,
            entity.getTouristTaxAmount() != null ? entity.getTouristTaxAmount().doubleValue() : null,
            null, // createCleaning — input-only field, never returned
            entity.getPaymentLinkSentAt() != null ? entity.getPaymentLinkSentAt().toString() : null,
            entity.getPaymentLinkEmail(),
            entity.getHiddenFromPlanning(),
            entity.getPaymentStatus() != null ? entity.getPaymentStatus().name() : null,
            entity.getPaidAt() != null ? entity.getPaidAt().toString() : null,
            entity.getIntervention() != null ? entity.getIntervention().getId() : null,
            entity.getAdultsCount(),
            entity.getChildrenCount(),
            resolveOtaFee(entity),
            // Sortie seule : le champ n'est jamais relu depuis le DTO en entree.
            commissionResolver.isEstimated(entity),
            guest != null ? photoUrls.publicUrl(guest.getId(), guest.getAvatarUrl()) : null
        );
    }

    /**
     * Applique les champs du DTO sur l'entite (create ou update).
     * Ne modifie PAS id, organizationId, source, createdAt.
     */
    public void apply(ReservationDto dto, Reservation entity) {
        // Assignation OU relogement : la garde historique « property == null » ignorait
        // silencieusement tout changement de logement en update (le front affichait un
        // succès, la réservation ne bougeait pas — bug relogement 2026-08).
        if (dto.propertyId() != null
                && (entity.getProperty() == null
                    || !dto.propertyId().equals(entity.getProperty().getId()))) {
            Property property = propertyRepository.findById(dto.propertyId())
                    .orElseThrow(() -> new RuntimeException("Propriete introuvable: " + dto.propertyId()));
            // findById contourne le filtre Hibernate (règle audit n°3) : en update,
            // l'entité porte déjà son org — un logement d'une AUTRE organisation ne
            // peut jamais être assigné, quel que soit l'appelant.
            if (entity.getOrganizationId() != null
                    && !entity.getOrganizationId().equals(property.getOrganizationId())) {
                throw new RuntimeException("Acces refuse : logement hors de votre organisation");
            }
            entity.setProperty(property);
        }
        if (dto.guestId() != null) {
            guestRepository.findById(dto.guestId()).ifPresent(guest -> {
                entity.setGuest(guest);
                // Auto-remplir guestName si absent dans le DTO
                if (dto.guestName() == null || dto.guestName().isBlank()) {
                    entity.setGuestName(guest.getFullName());
                }
            });
        }
        if (dto.guestName() != null && !dto.guestName().isBlank()) {
            entity.setGuestName(dto.guestName());
        }
        // Propager guestEmail / guestPhone vers l'entite Guest
        if (dto.guestEmail() != null && !dto.guestEmail().isBlank() && entity.getGuest() != null) {
            entity.getGuest().setEmail(dto.guestEmail().trim());
            guestRepository.save(entity.getGuest());
        }
        if (dto.guestPhone() != null && !dto.guestPhone().isBlank() && entity.getGuest() != null) {
            entity.getGuest().setPhone(dto.guestPhone().trim());
            guestRepository.save(entity.getGuest());
        }
        if (dto.guestCount() != null) entity.setGuestCount(dto.guestCount());
        if (dto.adultsCount() != null) entity.setAdultsCount(dto.adultsCount());
        if (dto.childrenCount() != null) entity.setChildrenCount(dto.childrenCount());
        if (dto.checkIn() != null) entity.setCheckIn(LocalDate.parse(dto.checkIn()));
        if (dto.checkOut() != null) entity.setCheckOut(LocalDate.parse(dto.checkOut()));
        if (dto.checkInTime() != null) entity.setCheckInTime(dto.checkInTime());
        if (dto.checkOutTime() != null) entity.setCheckOutTime(dto.checkOutTime());
        if (dto.totalPrice() != null) entity.setTotalPrice(BigDecimal.valueOf(dto.totalPrice()));
        if (dto.cleaningFee() != null) entity.setCleaningFee(BigDecimal.valueOf(dto.cleaningFee()));
        if (dto.touristTaxAmount() != null) entity.setTouristTaxAmount(BigDecimal.valueOf(dto.touristTaxAmount()));
        if (dto.notes() != null) entity.setNotes(dto.notes());
        if (dto.confirmationCode() != null) entity.setConfirmationCode(dto.confirmationCode());
    }
}
