package com.clenzy.model;

/**
 * Qui pilote les prix nuit d'une property — Phase 3 OTA pricing.
 *
 * <ul>
 *   <li>{@link #CLENZY}  : Clenzy est la source de verite. Le PriceEngine
 *       resoud les prix + push vers l'OTA (comportement par defaut). Les
 *       modifications cote OTA seront ecrasees au prochain push.</li>
 *   <li>{@link #OTA}     : l'OTA est la source de verite. Le scheduler de
 *       reconciliation pull les rates Channex en {@link RateOverride} ; le
 *       push Clenzy → Channex est desactive. Cas typique : host qui a un
 *       outil de pricing dynamique externe (Pricelabs, Wheelhouse) connecte
 *       a Airbnb directement, on ne veut pas que Clenzy ecrase.</li>
 *   <li>{@link #MANUAL}  : aucune sync auto. Ni push ni pull. L'admin gere
 *       les prix a la main dans les 2 systemes.</li>
 * </ul>
 */
public enum PriceSourceOfTruth {
    CLENZY,
    OTA,
    MANUAL
}
