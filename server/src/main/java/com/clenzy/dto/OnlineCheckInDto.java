package com.clenzy.dto;

import com.clenzy.model.OnlineCheckIn;
import com.clenzy.model.OnlineCheckInStatus;
import java.time.LocalDateTime;

public record OnlineCheckInDto(
    Long id,
    Long reservationId,
    String token,
    OnlineCheckInStatus status,
    String firstName,
    String lastName,
    String estimatedArrivalTime,
    Integer numberOfGuests,
    LocalDateTime startedAt,
    LocalDateTime completedAt,
    LocalDateTime expiresAt,
    String checkInLink
) {
    public static OnlineCheckInDto from(OnlineCheckIn c, String checkInLink) {
        return new OnlineCheckInDto(
            c.getId(), c.getReservation().getId(), c.getToken().toString(),
            c.getStatus(), c.getFirstName(), c.getLastName(),
            c.getEstimatedArrivalTime(), c.getNumberOfGuests(),
            c.getStartedAt(), c.getCompletedAt(), c.getExpiresAt(), checkInLink
        );
    }
}
