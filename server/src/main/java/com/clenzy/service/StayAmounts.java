package com.clenzy.service;

import com.clenzy.model.Reservation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;

/**
 * Ventilation du montant ENCAISSE d'une reservation ({@code totalPrice}) :
 * hebergement, menage, prestations complementaires et taxe de sejour.
 *
 * <p>Source unique de la facture fiscale ({@link InvoiceGeneratorService}) et du
 * detail du PDF FACTURE ({@code ReservationTagResolver}) : les deux documents d'une
 * meme vente ne peuvent pas diverger, et leurs lignes totalisent ce que le guest a paye.</p>
 *
 * <p>L'hebergement est deduit du total : {@code totalPrice} − menage − taxe de sejour
 * − prestations, plancher 0. {@code roomRevenue} n'est volontairement PAS utilise :
 * null en saisie manuelle (le total inclut alors menage + taxe, qui etaient factures
 * deux fois), pris AVANT voucher par le booking engine, egal au total a l'import
 * Channex et jamais rafraichi a la modification. {@code totalPrice} est le seul
 * montant que tous les canaux tiennent a jour (voucher deduit, revision Channex
 * appliquee).</p>
 *
 * @param accommodation  part hebergement (TTC), jamais negative
 * @param cleaningFee    frais de menage encaisses (TTC)
 * @param serviceOptions prestations complementaires vendues au checkout du booking engine (TTC)
 * @param touristTax     taxe de sejour encaissee (hors TVA)
 */
public record StayAmounts(BigDecimal accommodation, BigDecimal cleaningFee,
                          BigDecimal serviceOptions, BigDecimal touristTax) {

    private static final Logger log = LoggerFactory.getLogger(StayAmounts.class);

    public static StayAmounts of(Reservation reservation) {
        BigDecimal cleaningFee = positiveOrZero(reservation.getCleaningFee());
        BigDecimal serviceOptions = positiveOrZero(reservation.getServiceOptionsTotal());
        BigDecimal touristTax = positiveOrZero(reservation.getTouristTaxAmount());

        BigDecimal accommodation = positiveOrZero(reservation.getTotalPrice())
            .subtract(cleaningFee).subtract(touristTax).subtract(serviceOptions);
        if (accommodation.compareTo(BigDecimal.ZERO) < 0) {
            log.warn("Reservation {} : menage + taxe de sejour + prestations ({}) depassent le total "
                + "encaisse ({}), part hebergement ramenee a 0", reservation.getId(),
                cleaningFee.add(touristTax).add(serviceOptions), reservation.getTotalPrice());
            accommodation = BigDecimal.ZERO;
        }
        return new StayAmounts(accommodation, cleaningFee, serviceOptions, touristTax);
    }

    private static BigDecimal positiveOrZero(BigDecimal amount) {
        return amount != null && amount.compareTo(BigDecimal.ZERO) > 0 ? amount : BigDecimal.ZERO;
    }
}
