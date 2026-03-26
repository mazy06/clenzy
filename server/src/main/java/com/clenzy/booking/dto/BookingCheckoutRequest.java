package com.clenzy.booking.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.util.List;

public record BookingCheckoutRequest(
    @NotNull Long propertyId,
    @NotNull Long organizationId,
    @NotNull @Positive BigDecimal amount,
    @NotNull String checkIn,
    @NotNull String checkOut,
    @NotNull Integer guests,
    String customerEmail,
    String customerName,
    @jakarta.validation.Valid List<SelectedServiceOptionDto> serviceOptions
) {}
