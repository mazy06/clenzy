package com.clenzy.dto;

import java.math.BigDecimal;

/**
 * Performance d'un logement sur une fenêtre glissante (score global + sous-métriques),
 * exposée au tooltip du planning et à la carte « Performance par logement ».
 *
 * <p>Calculée côté serveur à partir des vraies données (réservations, calendrier + coûts
 * d'intervention réels) avec les définitions standard de {@code AccommodationKpis} :
 * contrairement au calcul front historique, l'occupation est plafonnée à 100 % et la
 * marge n'est plus faussée par des coûts vides.</p>
 *
 * @param propertyId    logement concerné
 * @param name          nom du logement (pour le classement du dashboard)
 * @param score         score global 0–100 (occupation 40 % + RevPAN 30 % + marge 30 %)
 * @param revPan        revenu par nuit disponible = revenu / nuits disponibles (nuits de la fenêtre
 *                      hors blocages BLOCKED / MAINTENANCE non vendus ; devise de base EUR)
 * @param occupancyRate taux d'occupation en % = nuits vendues / nuits disponibles (0–100, plafonné)
 * @param revenue       CA hébergement de la fenêtre (hors ménage, taxe de séjour et options),
 *                      proraté aux nuits comprises (devise de base EUR)
 * @param costs         coûts d'intervention réels de la fenêtre (devise de base EUR)
 * @param netMargin     marge nette en % (0–100) = (revenu − coûts) / revenu
 * @param windowDays    taille de la fenêtre glissante en nuits (la dernière étant celle de ce soir)
 */
public record PropertyPerformanceDto(
        Long propertyId,
        String name,
        int score,
        BigDecimal revPan,
        double occupancyRate,
        BigDecimal revenue,
        BigDecimal costs,
        double netMargin,
        int windowDays
) {
}
