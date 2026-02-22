package com.clenzy.service;

import com.clenzy.dto.ReservationDto;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
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

    public ReservationMapper(PropertyRepository propertyRepository) {
        this.propertyRepository = propertyRepository;
    }

    public ReservationDto toDto(Reservation entity) {
        return new ReservationDto(
            entity.getId(),
            entity.getProperty() != null ? entity.getProperty().getId() : null,
            entity.getProperty() != null ? entity.getProperty().getName() : "",
            entity.getGuestName() != null ? entity.getGuestName() : "",
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
            entity.getNotes()
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
        if (dto.guestName() != null) entity.setGuestName(dto.guestName());
        if (dto.guestCount() != null) entity.setGuestCount(dto.guestCount());
        if (dto.checkIn() != null) entity.setCheckIn(LocalDate.parse(dto.checkIn()));
        if (dto.checkOut() != null) entity.setCheckOut(LocalDate.parse(dto.checkOut()));
        if (dto.checkInTime() != null) entity.setCheckInTime(dto.checkInTime());
        if (dto.checkOutTime() != null) entity.setCheckOutTime(dto.checkOutTime());
        if (dto.totalPrice() != null) entity.setTotalPrice(BigDecimal.valueOf(dto.totalPrice()));
        if (dto.notes() != null) entity.setNotes(dto.notes());
        if (dto.confirmationCode() != null) entity.setConfirmationCode(dto.confirmationCode());
    }
}
