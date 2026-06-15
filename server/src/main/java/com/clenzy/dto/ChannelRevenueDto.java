package com.clenzy.dto;

import java.math.BigDecimal;

/**
 * Revenus par canal (source de reservation) sur le mois courant.
 *
 * @param source      cle technique normalisee (airbnb, booking, direct, other)
 * @param label       libelle lisible pour l'affichage
 * @param amount      revenu encaisse du canal sur le mois courant
 * @param pct         part en % du total du mois courant (0-100, 1 decimale)
 * @param comparePct  part en % du meme canal sur le mois precedent, null si N/A
 */
public record ChannelRevenueDto(
    String source,
    String label,
    BigDecimal amount,
    double pct,
    Double comparePct
) {}
