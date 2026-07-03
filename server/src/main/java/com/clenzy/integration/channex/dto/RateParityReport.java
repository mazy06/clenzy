package com.clenzy.integration.channex.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Rapport de parite tarifaire (S2) : comparaison, jour par jour, du prix attendu
 * (PriceEngine local, source de verite Baitly) avec le prix publie sur les canaux
 * OTA via Channex.
 *
 * <p><b>Limite Channex</b> : Channex expose UN tarif par rate plan (endpoint
 * {@code GET /restrictions}), consomme par tous les canaux connectes — il n'y a
 * pas de lecture de prix specifique a un canal. Chaque {@link ChannelParity}
 * porte donc le nom du canal (slug OTA) et le rate plan dont il consomme les
 * tarifs ; plusieurs canaux branches sur le meme rate plan partagent les memes
 * chiffres.</p>
 *
 * @param propertyId       propriete Baitly comparee
 * @param propertyName     nom d'affichage de la propriete
 * @param from             premier jour compare (inclus)
 * @param to               dernier jour compare (inclus)
 * @param thresholdPercent seuil de disparite en % (ecart relatif au prix local)
 * @param note             raison d'un rapport vide (pas de mapping, Channex
 *                         indisponible…), null si la comparaison a eu lieu
 * @param channels         resultat par canal (vide si note non nulle)
 */
public record RateParityReport(
        Long propertyId,
        String propertyName,
        LocalDate from,
        LocalDate to,
        BigDecimal thresholdPercent,
        String note,
        List<ChannelParity> channels) {

    public RateParityReport {
        channels = channels != null ? List.copyOf(channels) : List.of();
    }

    /**
     * Parite d'un canal.
     *
     * @param channel             slug OTA Channex (ex : airbnb, booking_com) ou
     *                            {@code channex} si aucun canal OTA n'est enregistre
     * @param ratePlanId          rate plan Channex dont les tarifs sont compares
     * @param daysCompared        jours ou local ET canal avaient un prix comparable
     * @param daysInDisparity     jours dont l'ecart relatif depasse le seuil
     * @param maxDeviationPercent ecart maximum observe en % (scale 2), null si
     *                            aucun jour comparable
     * @param sampleDates         echantillon des pires dates en disparite (max 5)
     */
    public record ChannelParity(
            String channel,
            String ratePlanId,
            int daysCompared,
            int daysInDisparity,
            BigDecimal maxDeviationPercent,
            List<DisparitySample> sampleDates) {

        public ChannelParity {
            sampleDates = sampleDates != null ? List.copyOf(sampleDates) : List.of();
        }
    }

    /** Une date en disparite : prix local attendu vs prix publie cote canal. */
    public record DisparitySample(
            LocalDate date,
            BigDecimal localPrice,
            BigDecimal channelPrice,
            BigDecimal deviationPercent) {
    }

    /** Vrai si au moins un canal a au moins un jour en disparite. */
    public boolean hasDisparity() {
        return channels.stream().anyMatch(c -> c.daysInDisparity() > 0);
    }

    /** Nombre maximum de jours en disparite sur un canal (0 si aucun). */
    public int maxDisparityDays() {
        return channels.stream().mapToInt(ChannelParity::daysInDisparity).max().orElse(0);
    }

    /** Ecart maximum observe tous canaux confondus, null si aucun jour comparable. */
    public BigDecimal maxDeviationPercent() {
        return channels.stream()
                .map(ChannelParity::maxDeviationPercent)
                .filter(java.util.Objects::nonNull)
                .max(BigDecimal::compareTo)
                .orElse(null);
    }

    /** Slugs des canaux en disparite (pour les notifications / le sujet automation). */
    public List<String> channelsInDisparity() {
        return channels.stream()
                .filter(c -> c.daysInDisparity() > 0)
                .map(ChannelParity::channel)
                .toList();
    }
}
