package com.clenzy.integration.channel.model;

import java.time.LocalDate;

/**
 * Represente un jour calendrier cote channel (lecture seule).
 * Utilise par la reconciliation pour comparer avec le calendrier PMS.
 *
 * @param date       la date du jour
 * @param status     statut cote channel : "AVAILABLE", "BOOKED", "BLOCKED"
 * @param externalId reference booking cote channel si applicable (peut etre null)
 */
public record ChannelCalendarDay(
        LocalDate date,
        String status,
        String externalId
) {}
