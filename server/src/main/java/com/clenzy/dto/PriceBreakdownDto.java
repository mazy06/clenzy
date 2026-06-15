package com.clenzy.dto;

import java.math.BigDecimal;

/**
 * Ventilation de prix TTC par pays (CLZ-P0-18) : hébergement HT + TVA + taxe de séjour.
 *
 * <p>Permet d'afficher un prix TTC en plus du HT dans la simulation/devis, conformément à
 * l'obligation d'affichage TTC du marché concerné (FR/MA/KSA). Tous les montants sont en
 * {@code currency} (devise du pays du bien).</p>
 *
 * @param countryCode            pays appliqué (ISO 3166-1 alpha-2)
 * @param currency               devise des montants (EUR/MAD/SAR)
 * @param nights                 nombre de nuits
 * @param accommodationHt        hébergement hors taxe
 * @param vatRate                taux de TVA appliqué (ex : 0.1000)
 * @param vatName                libellé de la TVA (ex : « TVA hébergement »)
 * @param vatAmount              montant de TVA sur l'hébergement
 * @param accommodationTtc       hébergement TTC ({@code accommodationHt + vatAmount})
 * @param touristTax             taxe de séjour / municipality fee (hors TVA, collectée à part)
 * @param touristTaxDescription  détail lisible de la taxe de séjour
 * @param grandTotalTtc          total à payer ({@code accommodationTtc + touristTax})
 */
public record PriceBreakdownDto(
    String countryCode,
    String currency,
    int nights,
    BigDecimal accommodationHt,
    BigDecimal vatRate,
    String vatName,
    BigDecimal vatAmount,
    BigDecimal accommodationTtc,
    BigDecimal touristTax,
    String touristTaxDescription,
    BigDecimal grandTotalTtc
) {
}
