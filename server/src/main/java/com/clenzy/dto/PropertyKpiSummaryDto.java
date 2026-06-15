package com.clenzy.dto;

import java.math.BigDecimal;

/**
 * KPI operationnels par propriete pour les cartes de la liste (mois courant).
 *
 * @param propertyId            id de la propriete
 * @param occupancyRate         taux d'occupation du mois courant, 0..1 (cape a 1.0)
 * @param adr                   tarif journalier moyen = revenu mois / nuits reservees mois (0 si aucune)
 * @param revenue               revenu alloue au mois courant (au prorata des nuits)
 * @param operationalStatus     "occupied" si une resa couvre aujourd'hui, sinon "available"
 * @param currentCheckOut       date ISO yyyy-MM-dd du check-out de la resa en cours, ou null
 * @param currentCheckOutTime   heure de check-out (ex "11:00"), ou null
 * @param activeInterventionType "cleaning" | "maintenance" si une intervention IN_PROGRESS existe, sinon null
 */
public record PropertyKpiSummaryDto(
    Long propertyId,
    double occupancyRate,
    BigDecimal adr,
    BigDecimal revenue,
    String operationalStatus,
    String currentCheckOut,
    String currentCheckOutTime,
    String activeInterventionType
) {}
