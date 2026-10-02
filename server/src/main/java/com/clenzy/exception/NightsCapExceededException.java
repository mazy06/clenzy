package com.clenzy.exception;

/**
 * Levee quand un sejour ferait depasser le plafond annuel de nuitees d'une residence
 * principale (France). Mappee en HTTP 422 avec {@code code = NIGHTS_CAP_EXCEEDED} et
 * {@code overridable = true} : l'interface propose alors de DEROGER explicitement
 * (re-soumission avec {@code overrideNightsCap=true}), derogation notifiee a l'organisation.
 */
public class NightsCapExceededException extends RuntimeException {

    public static final String CODE = "NIGHTS_CAP_EXCEEDED";

    private final Long propertyId;

    public NightsCapExceededException(Long propertyId, String detail) {
        super("Plafond annuel de nuitées dépassé — " + detail);
        this.propertyId = propertyId;
    }

    public Long getPropertyId() { return propertyId; }
}
