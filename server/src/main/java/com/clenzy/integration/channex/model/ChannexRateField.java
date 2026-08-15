package com.clenzy.integration.channex.model;

import java.util.EnumSet;
import java.util.Locale;
import java.util.Set;

/**
 * Champ du payload « rates » qu'un changement doit reellement porter.
 *
 * <p>{@link ChannexAriScope} dit <b>quel canal</b> pousser (disponibilite ou
 * tarifs) ; cet ensemble dit <b>quels champs</b> mettre dans le payload tarifs.
 * Sans lui, chaque push partait avec les sept champs renseignes pour chaque
 * date. La certification du 2026-08-15 l'a releve sur quatre scenarios :
 * « Update also carries all declared restrictions (closed_to_arrival,
 * closed_to_departure, max_stay, min_stay_arrival, min_stay_through,
 * stop_sell); this looks like a <b>snapshot-based update rather than a
 * rate-only delta</b> ».</p>
 *
 * <p>C'est la surcorrection du tour precedent : le refus du 2026-08-14
 * reprochait des restrictions <i>absentes</i> (« 154/181 restriction objects
 * are missing »), on a donc rempli tous les champs partout. Channex attend
 * l'inverse — les restrictions declarees quand on <i>pose</i> une restriction,
 * et rien d'autre quand on change un prix.</p>
 *
 * <p>Regle : un push ne porte que ce que l'action a change. Un prix ->
 * {@code rate} seul ; un sejour minimum -> {@code min_stay_*} seuls ; un
 * blocage -> {@code stop_sell} seul.</p>
 */
public enum ChannexRateField {

    RATE,
    MIN_STAY,
    MAX_STAY,
    CLOSED_TO_ARRIVAL,
    CLOSED_TO_DEPARTURE,
    STOP_SELL;

    /** Les quatre champs portes par une {@code BookingRestriction}. */
    public static final Set<ChannexRateField> RESTRICTION_FIELDS =
        java.util.Collections.unmodifiableSet(EnumSet.of(
            MIN_STAY, MAX_STAY, CLOSED_TO_ARRIVAL, CLOSED_TO_DEPARTURE));

    /** Instantane complet — resynchronisation manuelle et full sync. */
    public static final Set<ChannexRateField> ALL =
        java.util.Collections.unmodifiableSet(EnumSet.allOf(ChannexRateField.class));

    /**
     * Champs deduits du champ {@code action} de l'evenement calendrier.
     *
     * <p>Les actions reconnues sont celles de
     * {@link ChannexAriScope#fromCalendarAction(String)} — les deux methodes
     * lisent la meme source et doivent rester coherentes.</p>
     *
     * <p>Pour une action de restriction, on renvoie les quatre champs
     * possibles : le service filtrera ensuite sur ceux reellement <b>non nuls</b>
     * dans la {@code BookingRestriction}. C'est ce qui distingue le scenario
     * « sejour minimum seul » (un champ) du scenario « restrictions
     * combinees » (plusieurs) sans que l'action ait besoin de le dire.</p>
     *
     * <p>Une action inconnue vaut {@link #ALL} : mieux vaut un champ de trop
     * qu'une valeur perdue. Le desagrement est un avertissement de
     * certification, pas une desynchronisation.</p>
     */
    public static Set<ChannexRateField> fromCalendarAction(String action) {
        if (action == null) return ALL;
        String normalized = action.trim().toUpperCase(Locale.ROOT);
        if (normalized.startsWith("RESTRICTION")) {
            return RESTRICTION_FIELDS;
        }
        if (normalized.contains("PRICE") || normalized.contains("RATE")) {
            return EnumSet.of(RATE);
        }
        return switch (normalized) {
            // Ferment la vente sans toucher a l'inventaire ni au prix.
            case "BLOCKED", "UNBLOCKED" -> EnumSet.of(STOP_SELL);
            default -> ALL;
        };
    }

    /**
     * Union de deux ensembles accumules sur la meme fenetre de flush.
     *
     * <p>Union et non intersection : deux changements de nature differente dans
     * la meme fenetre ont tous deux besoin de partir. Le payload fusionne porte
     * alors plus d'un champ, ce qui est exact — c'est bien ce qui a change.</p>
     */
    public static Set<ChannexRateField> merge(Set<ChannexRateField> a, Set<ChannexRateField> b) {
        if (a == null || a.isEmpty()) return b == null ? ALL : b;
        if (b == null || b.isEmpty()) return a;
        EnumSet<ChannexRateField> union = EnumSet.copyOf(a);
        union.addAll(b);
        return union;
    }
}
