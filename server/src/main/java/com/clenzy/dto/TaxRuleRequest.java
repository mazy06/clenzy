package com.clenzy.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * DTO pour la creation ou mise a jour d'une regle fiscale.
 */
public record TaxRuleRequest(
    @NotBlank @Size(max = 3)
    String countryCode,

    @NotBlank @Size(max = 30)
    String taxCategory,

    @NotNull @DecimalMin("0.0000") @DecimalMax("1.0000")
    BigDecimal taxRate,

    @NotBlank @Size(max = 50)
    String taxName,

    @NotNull
    LocalDate effectiveFrom,

    LocalDate effectiveTo,

    String description
) {}
