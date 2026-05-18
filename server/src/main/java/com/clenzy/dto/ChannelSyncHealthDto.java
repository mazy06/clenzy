package com.clenzy.dto;

/**
 * Etat de sante de la synchronisation multi-canaux pour une propriete.
 *
 * - synced : nombre de canaux ayant ete sync recemment (lastSyncAt < 24h)
 * - total  : nombre total de canaux connectes et actifs (Airbnb + iCal/PMS)
 */
public record ChannelSyncHealthDto(
    Long propertyId,
    int synced,
    int total
) {}
