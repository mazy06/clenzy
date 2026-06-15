package com.clenzy.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Requête de simulation de prix multi-pays (CLZ-P0-18).
 *
 * <p>Le serveur recalcule toujours l'hébergement HT depuis le {@code PriceEngine} : aucun montant
 * n'est accepté du client (audit #1). Les paramètres de taxe de séjour sont fournis par l'appelant
 * car ils sont spécifiques à la commune (France) ou au régime (KSA) et ne sont pas modélisés en
 * base : à défaut, la taxe de séjour est nulle.</p>
 *
 * @param propertyId          bien concerné (ownership validé côté service)
 * @param checkIn             date d'arrivée (incluse)
 * @param checkOut            date de départ (exclue) — {@code nights = checkOut - checkIn}
 * @param guests              nombre de voyageurs (≥ 1)
 * @param childrenUnder       âge d'exonération enfants (taxe de séjour) — 0 si non applicable
 * @param touristTaxPerPerson France : montant fixe par personne et par nuit (taux communal), nullable
 * @param touristTaxPercentage KSA : pourcentage du tarif nuitée (sinon défaut du calculateur), nullable
 */
public record PriceSimulationRequest(
    Long propertyId,
    LocalDate checkIn,
    LocalDate checkOut,
    int guests,
    int childrenUnder,
    BigDecimal touristTaxPerPerson,
    BigDecimal touristTaxPercentage
) {
}
