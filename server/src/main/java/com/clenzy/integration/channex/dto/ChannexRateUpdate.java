package com.clenzy.integration.channex.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Update de tarif pour une date donnee sur un rate_plan Channex.
 *
 * <p><b>Une restriction declaree doit etre presente sur CHAQUE date.</b> Un
 * champ nul est omis du payload, et la certification Channex compte les
 * absences : le 2026-08-14 elle a refuse le full sync avec « 154/181 restriction
 * objects are missing the declared restriction "min_stay_through" » (les 27
 * dates couvertes par une restriction explicite les portaient, les 154 autres
 * non) et « 181/181 ... "min_stay_arrival" » / « ... "stop_sell" ». C'est a
 * l'appelant de resoudre une valeur effective pour chaque date — les defauts de
 * la propriete quand aucune restriction ne s'applique — plutot que de laisser
 * des nuls.</p>
 *
 * @param channexPropertyId       Property ID cote Channex
 * @param channexRatePlanId       Rate plan ID (issu du mapping Clenzy)
 * @param date                    Date concernee
 * @param rate                    Tarif principal (currency: celle de la property)
 * @param minStayThrough          Sejour minimum pour une nuit traversee
 * @param minStayArrival          Sejour minimum pour une arrivee ce jour
 * @param closedToArrival         Si true, pas de check-in autorise ce jour
 * @param closedToDeparture       Si true, pas de check-out autorise ce jour
 * @param maxStay                 Sejour maximum (0 = pas de limite, convention Channex)
 * @param stopSell                Si true, date fermee a la vente sur ce rate plan
 */
public record ChannexRateUpdate(
    String channexPropertyId,
    String channexRatePlanId,
    LocalDate date,
    BigDecimal rate,
    Integer minStayThrough,
    Integer minStayArrival,
    Boolean closedToArrival,
    Boolean closedToDeparture,
    Integer maxStay,
    Boolean stopSell
) {
    public ChannexRateUpdate {
        // `rate` peut etre NUL : c'est ainsi qu'un delta l'omet du payload
        // (cf. ChannexRateField). Une mise a jour de sejour minimum seul ne doit
        // pas embarquer le prix — « Min stay update also carries other fields
        // [...]; it should contain only min stay », certification 2026-08-15.
        //
        // L'invariant d'origine l'exigeait, ce qui etait juste tant que chaque
        // push portait tout. Depuis le passage en delta il faisait echouer le
        // push entier : « rate must be >= 0, got null », releve au rejeu du
        // scenario 8 le 2026-08-15 — les tests unitaires ne couvraient pas ce
        // chemin.
        if (rate != null && rate.signum() < 0) {
            throw new IllegalArgumentException("rate must be >= 0, got " + rate);
        }
        // Une entree sans aucun champ ne veut rien dire et serait rejetee par
        // Channex : mieux vaut echouer ici, ou la cause est lisible.
        if (rate == null && minStayThrough == null && minStayArrival == null
            && closedToArrival == null && closedToDeparture == null
            && maxStay == null && stopSell == null) {
            throw new IllegalArgumentException(
                "ChannexRateUpdate sans aucun champ a pousser (date " + date + ")");
        }
    }

    /** Sans {@code stop_sell} — appelants anterieurs a son ajout. */
    public ChannexRateUpdate(String channexPropertyId, String channexRatePlanId, LocalDate date,
                             BigDecimal rate, Integer minStayThrough, Integer minStayArrival,
                             Boolean closedToArrival, Boolean closedToDeparture, Integer maxStay) {
        this(channexPropertyId, channexRatePlanId, date, rate, minStayThrough, minStayArrival,
            closedToArrival, closedToDeparture, maxStay, null);
    }

    /** Update simplifie : juste le tarif sans restrictions. */
    public static ChannexRateUpdate rateOnly(String propertyId, String ratePlanId,
                                              LocalDate date, BigDecimal rate) {
        return new ChannexRateUpdate(propertyId, ratePlanId, date, rate,
            null, null, null, null, null, null);
    }
}
