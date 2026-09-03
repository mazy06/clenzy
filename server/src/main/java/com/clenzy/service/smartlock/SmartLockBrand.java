package com.clenzy.service.smartlock;

/**
 * Marques de serrures connectees supportees par Baitly.
 *
 * <p>Toutes n'ont pas d'implementation de {@link SmartLockProvider} : seules
 * {@link #NUKI} (via {@code NukiSmartLockProvider}) et {@link #TUYA} (traitee a
 * part, directement par {@code TuyaApiService}) sont cablees. {@link #TTLOCK} et
 * {@link #YALE} sont declarees mais sans provider — les selectionner fait echouer
 * la generation de code sur
 * {@code SmartLockProviderRegistry.getRequiredProvider}.</p>
 */
public enum SmartLockBrand {
    TUYA,
    NUKI,
    TTLOCK,
    YALE,

    /**
     * Serrure fictive, pour eprouver le circuit de bout en bout sans compte
     * fabricant. Servie par {@code SimulationSmartLockProvider}, qui n'existe
     * que hors production et seulement si on l'a explicitement demande.
     *
     * <p>Ce n'est pas une marque : c'est un banc d'essai. Une serrure reelle ne
     * doit jamais porter cette valeur.</p>
     */
    SIMULATION
}
