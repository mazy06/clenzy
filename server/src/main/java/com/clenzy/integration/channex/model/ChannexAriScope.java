package com.clenzy.integration.channex.model;

/**
 * Ce qu'un changement doit reellement pousser vers Channex.
 *
 * <p>Baitly poussait <b>systematiquement</b> availability ET rates a chaque
 * flush, quelle que soit la nature du changement. La certification Channex l'a
 * refuse le 2026-08-14 sur sept scenarios : « Expected exactly one update
 * (Property.UpdateRestrictions), found: ["Property.UpdateRestrictions",
 * "Property.UpdateAvailability"] ». Un changement de prix ne doit toucher que
 * les tarifs ; un blocage de dates, que la disponibilite.</p>
 *
 * <p>La portee voyage donc depuis l'evenement calendrier jusqu'au batcher, qui
 * ne pousse que le canal concerne.</p>
 */
public enum ChannexAriScope {

    /** Disponibilite seule — reservation, annulation, blocage de dates. */
    AVAILABILITY,

    /** Tarifs et restrictions — changement de prix, restriction de sejour. */
    RATES,

    /** Les deux — resynchronisation manuelle, ou fusion de changements de nature differente. */
    BOTH;

    public boolean includesAvailability() {
        return this == AVAILABILITY || this == BOTH;
    }

    public boolean includesRates() {
        return this == RATES || this == BOTH;
    }

    /**
     * Fusion de deux portees accumulees sur la meme fenetre de flush.
     *
     * <p>Deux natures differentes dans la meme fenetre donnent {@code BOTH} :
     * les deux canaux ont vraiment change, deux appels sont alors legitimes.</p>
     */
    public ChannexAriScope merge(ChannexAriScope other) {
        if (other == null || other == this) return this;
        return BOTH;
    }

    /**
     * Portee deduite du champ {@code action} de l'evenement calendrier.
     *
     * <p>Les actions reellement emises, verifiees le 2026-08-14 :</p>
     * <ul>
     *   <li>tarifs — {@code PRICE_UPDATED} (CalendarEngine), {@code RATE_UPDATED}
     *       (RateOverrideService, RatePlanService), {@code RATE_DISTRIBUTION}
     *       (RateDistributionService), {@code RESTRICTION_*} (BookingRestrictionService),
     *       et depuis le 2026-08-14 {@code BLOCKED} / {@code UNBLOCKED} ;</li>
     *   <li>disponibilite — {@code BOOKED}, {@code CANCELLED} (CalendarEngine).</li>
     * </ul>
     *
     * <p>Un blocage manuel est passe du cote TARIFS parce qu'il ne consomme pas
     * d'inventaire : il ferme la vente par {@code stop_sell}, qui voyage dans le
     * payload des restrictions. Seule une reservation retire l'unite du stock et
     * touche donc {@code availability}.</p>
     *
     * <p>{@code RATE_UPDATED} merite l'attention : c'est l'action d'un
     * changement de prix depuis l'ecran Tarification — le scenario n°2 de la
     * certification. Une premiere version de cette methode ne reconnaissait que
     * « PRICE » et l'aurait laisse pousser les deux canaux, donc echouer.</p>
     *
     * <p>Une action inconnue vaut {@link #BOTH} : mieux vaut un appel de trop
     * qu'une mise a jour perdue. Le jour ou un nouveau type d'evenement
     * apparait, la synchronisation reste correcte — seule la certification
     * signalerait le doublon, ce qui est le bon ordre de priorite.</p>
     */
    public static ChannexAriScope fromCalendarAction(String action) {
        if (action == null) return BOTH;
        String normalized = action.trim().toUpperCase(java.util.Locale.ROOT);
        if (normalized.startsWith("RESTRICTION")
            || normalized.contains("PRICE")
            || normalized.contains("RATE")) {
            return RATES;
        }
        return switch (normalized) {
            // Ferment la vente sans retirer l'unite du stock -> stop_sell, cote rates.
            case "BLOCKED", "UNBLOCKED" -> RATES;
            // Consomment (ou liberent) l'inventaire.
            case "BOOKED", "CANCELLED", "RELEASED" -> AVAILABILITY;
            default -> BOTH;
        };
    }
}
