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
    @jakarta.validation.Valid List<SelectedServiceOptionDto> serviceOptions,
    @jakarta.validation.constraints.Size(max=64) String voucherCode,
    @jakarta.validation.constraints.Min(0) Integer children
) {
    public BookingCheckoutRequest(Long propertyId,Long organizationId,BigDecimal amount,String checkIn,String checkOut,
            Integer guests,String customerEmail,String customerName,List<SelectedServiceOptionDto> serviceOptions) {
        this(propertyId,organizationId,amount,checkIn,checkOut,guests,customerEmail,customerName,serviceOptions,null,0);
    }
}
