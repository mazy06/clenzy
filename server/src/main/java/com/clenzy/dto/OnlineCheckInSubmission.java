package com.clenzy.dto;

import jakarta.validation.constraints.NotBlank;

public record OnlineCheckInSubmission(
    @NotBlank String firstName,
    @NotBlank String lastName,
    String email,
    String phone,
    String idDocumentNumber,
    String idDocumentType,
    String estimatedArrivalTime,
    String specialRequests,
    Integer numberOfGuests,
    String additionalGuests
) {}
