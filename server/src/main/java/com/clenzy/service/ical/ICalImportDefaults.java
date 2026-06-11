package com.clenzy.service.ical;

/**
 * Heures par defaut quand la propriete ne definit pas les siennes.
 * Utilisees a la fois pour la reservation importee ({@link ICalReservationImporter})
 * ET pour la fenetre de menage (guestCheckinTime, {@link ICalCleaningScheduler}) —
 * les deux doivent rester alignees (T-BP-09), d'ou la definition unique ici.
 */
public final class ICalImportDefaults {

    public static final String DEFAULT_CHECK_IN_TIME = "15:00";
    public static final String DEFAULT_CHECK_OUT_TIME = "11:00";

    private ICalImportDefaults() {
    }
}
