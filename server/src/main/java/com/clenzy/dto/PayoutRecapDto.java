package com.clenzy.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Ce qu'il faut savoir avant d'approuver un reversement.
 *
 * <p>Le bouton d'approbation portait un montant et rien d'autre. Approuver
 * quatre mille euros sans voir à qui ils vont, ce qu'ils recouvrent, ni par quel
 * canal ils partiront, ce n'est pas une décision — c'est une signature à
 * l'aveugle.</p>
 *
 * <p><b>Le détail du calcul est reconstitué, pas recalculé.</b> Les montants
 * viennent du reversement tel qu'il a été figé ; les séjours et les dépenses
 * sont ceux qui le composent. Si le récapitulatif recalculait, il pourrait
 * afficher un total différent de celui qu'on s'apprête à approuver.</p>
 *
 * @param destination compte de destination, <b>masqué</b> — un IBAN est chiffré
 *                    en base, et l'afficher en entier sur un tableau de bord
 *                    n'apporte rien qu'un risque
 */
public record PayoutRecapDto(
        Long payoutId,
        String beneficiaryName,
        String beneficiaryEmail,
        LocalDate periodStart,
        LocalDate periodEnd,

        BigDecimal grossRevenue,
        /** Taux appliqué, en pourcentage lisible (20.00 et non 0.20). */
        BigDecimal commissionRate,
        BigDecimal commissionAmount,
        BigDecimal expenses,
        BigDecimal netAmount,
        String currency,

        String payoutMethod,
        String destination,
        /** Vrai si le moyen de versement est prêt à recevoir le virement. */
        boolean destinationReady,

        List<CoveredStay> stays,
        List<IncludedExpense> deductions) {

    /** Un séjour dont le revenu entre dans ce reversement. */
    public record CoveredStay(
            Long reservationId,
            String guestName,
            String propertyName,
            LocalDate checkIn,
            LocalDate checkOut,
            BigDecimal totalPrice) {}

    /** Une dépense déduite du reversement. */
    public record IncludedExpense(
            Long expenseId,
            String description,
            String category,
            LocalDate expenseDate,
            BigDecimal amount) {}
}
