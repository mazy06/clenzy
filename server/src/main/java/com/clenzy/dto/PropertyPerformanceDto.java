package com.clenzy.dto;

import java.math.BigDecimal;

/**
 * Performance d'un logement sur une fenêtre glissante (score global + sous-métriques),
 * exposée au tooltip du planning et à la carte « Performance par logement ».
 *
 * <p>Calculée côté serveur à partir des vraies données (réservations + coûts
 * d'intervention réels) : contrairement au calcul front historique, l'occupation
 * est plafonnée à 100 % et la marge n'est plus faussée par des coûts vides.</p>
 *
 * @param propertyId    logement concerné
 * @param name          nom du logement (pour le classement du dashboard)
 * @param score         score global 0–100 (occupation 40 % + RevPAN 30 % + marge 30 %)
 * @param revPan        revenu par logement disponible = revenu / jours de la fenêtre (devise de base EUR)
 * @param occupancyRate taux d'occupation en % (0–100, plafonné)
 * @param revenue       revenu de la fenêtre, proraté aux nuits comprises (devise de base EUR)
 * @param netMargin     marge nette en % (0–100) = (revenu − coûts) / revenu
 * @param windowDays    taille de la fenêtre glissante en jours
 */
public record PropertyPerformanceDto(
        Long propertyId,
        String name,
        int score,
        BigDecimal revPan,
        double occupancyRate,
        BigDecimal revenue,
        double netMargin,
        int windowDays
) {
}
