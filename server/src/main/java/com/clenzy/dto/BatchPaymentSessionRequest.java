package com.clenzy.dto;

import jakarta.validation.constraints.NotEmpty;

import java.math.BigDecimal;
import java.util.List;

/**
 * Reglement d'un LOT d'interventions en une seule session.
 *
 * <p>DTO distinct de {@link PaymentSessionRequest} plutot qu'un champ de plus :
 * ce dernier declare {@code @NotNull @Positive Long interventionId}, et un appel
 * groupe echouait donc a la validation. Le planning envoyait bien
 * {@code interventionIds} — un champ que le serveur ne connaissait pas : il
 * recevait un identifiant nul et refusait le paiement.</p>
 *
 * @param interventionIds interventions a regler ensemble
 * @param totalAmount     total affiche a l'ecran — simple cross-check, le
 *                        serveur recalcule (regle audit n°1)
 * @param returnUrl       ecran d'ou part le paiement
 */
public record BatchPaymentSessionRequest(
        @NotEmpty(message = "Au moins une intervention est requise")
        List<Long> interventionIds,
        BigDecimal totalAmount,
        String returnUrl) {
}
