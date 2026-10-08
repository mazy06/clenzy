package com.clenzy.integration.direct.dto;

import jakarta.validation.constraints.*;
import java.time.LocalDate;

/** Une promotion de séjour se calcule sur ses dates et sa devise, jamais sur un total client. */
public record BaitlyDirectPromoPreview(@NotBlank @Size(max=50) String code,@NotNull Long propertyId,
    @NotNull @FutureOrPresent LocalDate checkIn,@NotNull @Future LocalDate checkOut,
    @Min(1) int guests,@Min(0) int children,@NotBlank @Email String email) {}
