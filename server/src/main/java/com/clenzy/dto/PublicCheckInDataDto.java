package com.clenzy.dto;

import com.clenzy.model.OnlineCheckIn;
import com.clenzy.model.OnlineCheckInStatus;

public record PublicCheckInDataDto(
    OnlineCheckInStatus status,
    String propertyName,
    String checkInDate,
    String checkOutDate,
    String guestName
) {
    public static PublicCheckInDataDto from(OnlineCheckIn c) {
        String propName = c.getReservation().getProperty() != null
            ? c.getReservation().getProperty().getName() : "";
        String checkIn = c.getReservation().getCheckIn() != null
            ? c.getReservation().getCheckIn().toString() : "";
        String checkOut = c.getReservation().getCheckOut() != null
            ? c.getReservation().getCheckOut().toString() : "";
        return new PublicCheckInDataDto(c.getStatus(), propName, checkIn, checkOut,
            c.getReservation().getGuestName());
    }
}
