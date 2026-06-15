package com.clenzy.dto;

import java.util.List;

/**
 * Donnees du widget dashboard « Revenus par canal » pour l'organisation
 * courante (mois ou annee en cours, comparaison periode precedente).
 *
 * <p>Revenu RESERVE (reservations non annulees) regroupe par source. Derive des
 * donnees DB de l'org (Reservation), org-scope. Les reversements proprietaires
 * sont calcules cote client (carte « Gestion &amp; reversements »).</p>
 */
public record BillingOverviewDto(
    String currency,
    List<ChannelRevenueDto> channels
) {}
