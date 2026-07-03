package com.clenzy.dto;

import com.clenzy.model.TouristTaxConfig.TaxCalculationMode;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Ligne de rapport de taxe de séjour : le calcul pour UNE réservation.
 *
 * <p>Formule v1 (documentée dans {@code TouristTaxService}) :
 * {@code taxAmount} = base selon le mode du barème × (1 + surtaxes %),
 * arrondi HALF_UP à 2 décimales. {@code taxablePersons} = {@code guestCount}
 * de la réservation (pas de ventilation adultes/enfants en v1).</p>
 */
public record TouristTaxReportLineDto(
    Long reservationId,
    Long propertyId,
    String propertyName,
    String guestName,
    LocalDate checkIn,
    LocalDate checkOut,
    int nights,
    int taxablePersons,
    String communeName,
    TaxCalculationMode calculationMode,
    BigDecimal baseAmount,
    BigDecimal surchargeAmount,
    BigDecimal taxAmount,
    String currency
) {}
