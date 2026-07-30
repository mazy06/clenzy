package com.clenzy.dto;

import com.clenzy.model.ActivityProvider;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/**
 * Une ligne de rapport d'affiliation a enregistrer.
 *
 * <p>Forme volontairement neutre : chaque programme (Viator, GetYourGuide,
 * Klook) publie ses conversions dans son propre format et via son propre canal
 * — export CSV, API de reporting, parfois rien d'automatisable. Un connecteur
 * par programme viendra alimenter ce point d'entree ; le moteur de repartition
 * n'a pas a connaitre leurs particularites.</p>
 *
 * @param externalBookingId reference de la reservation chez le programme —
 *                          cle d'idempotence, un rapport se rejoue
 * @param grossCommission   commission versee par le programme
 * @param propertyId        logement rattache, pour crediter le bon proprietaire
 */
public record ImportAffiliateEarningRequest(
    @NotNull ActivityProvider provider,
    @NotNull String externalBookingId,
    @NotNull BigDecimal grossCommission,
    String currency,
    Long propertyId
) {}
