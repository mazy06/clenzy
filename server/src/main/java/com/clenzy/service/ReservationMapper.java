package com.clenzy.service;

import com.clenzy.dto.ReservationDto;
import com.clenzy.model.Guest;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.GuestRepository;
import com.clenzy.repository.PropertyRepository;
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

    public ReservationMapper(PropertyRepository propertyRepository,
                             GuestRepository guestRepository) {
        this.propertyRepository = propertyRepository;
        this.guestRepository = guestRepository;
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
            entity.getTotalPrice() != null ? entity.getTotalPrice().doubleValue() : 0.0,
            entity.getConfirmationCode(),
            entity.getNotes(),
            entity.getCleaningFee() != null ? entity.getCleaningFee().doubleValue() : null,
            entity.getTouristTaxAmount() != null ? entity.getTouristTaxAmount().doubleValue() : null,
            null, // createCleaning — input-only field, never returned
            entity.getPaymentLinkSentAt() != null ? entity.getPaymentLinkSentAt().toString() : null,
            entity.getPaymentLinkEmail(),
            entity.getHiddenFromPlanning()
        );
    }

    /**
     * Applique les champs du DTO sur l'entite (create ou update).
     * Ne modifie PAS id, organizationId, source, createdAt.
     */
    public void apply(ReservationDto dto, Reservation entity) {
        if (dto.propertyId() != null && entity.getProperty() == null) {
            Property property = propertyRepository.findById(dto.propertyId())
                    .orElseThrow(() -> new RuntimeException("Propriete introuvable: " + dto.propertyId()));
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
        if (dto.guestCount() != null) entity.setGuestCount(dto.guestCount());
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
