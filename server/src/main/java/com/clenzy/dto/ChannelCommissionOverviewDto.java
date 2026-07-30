package com.clenzy.dto;

import java.math.BigDecimal;

/**
 * Vue d'ensemble de la commission d'un canal de reservation : ce que Baitly
 * applique en repli, et ce que le canal a reellement factures sur la periode.
 *
 * <p>L'ecran de parametrage n'affichait qu'un taux unique, sans dire s'il etait
 * suppose ou constate. Or les deux coexistent : Channex remonte la commission
 * reelle ({@code ota_commission}) pour Booking.com et Airbnb, tandis que les
 * sejours iCal ou anterieurs a cette bascule retombent sur un taux de reference.
 * Confondre les deux donne une marge affichee dont on ne sait pas si elle est
 * mesuree ou devinee.</p>
 *
 * @param channel        canal normalise ({@code airbnb}, {@code booking}, {@code vrbo},
 *                       {@code expedia}, {@code direct})
 * @param label          libelle affichable
 * @param referenceRate  taux applique en l'absence de commission reelle, en pourcentage
 * @param observedRate   taux reellement constate sur la periode, en pourcentage,
 *                       ou {@code null} si aucun sejour n'a remonte sa commission
 * @param stayCount      sejours non annules du canal sur la periode
 * @param realFeeCount   parmi eux, ceux dont la commission reelle est connue
 * @param editable       true si le taux est parametrable (booking engine uniquement :
 *                       les taux OTA sont fixes par la plateforme, pas par l'hote)
 */
public record ChannelCommissionOverviewDto(
    String channel,
    String label,
    BigDecimal referenceRate,
    BigDecimal observedRate,
    long stayCount,
    long realFeeCount,
    boolean editable
) {}
