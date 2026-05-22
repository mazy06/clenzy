package com.clenzy.integration.kyc.model;

/**
 * Providers de KYC / verification d'identite supportes.
 *
 * <p>Tous utilisent une authentification API key. Pertinents pour le
 * marche MENA (Sumsub est le leader, accepte par les banques saoudiennes)
 * autant qu'Europe (Veriff, Onfido).</p>
 */
public enum KycProviderType {
    /** Sumsub — leader MENA, accepte par les banques saoudiennes + EU. */
    SUMSUB,
    /** Veriff — bon rapport qualite/prix, couverture EU + MENA. */
    VERIFF,
    /** Onfido — premium, qualite UX, global. */
    ONFIDO
}
