package com.clenzy.integration.compliance.model;

/**
 * Providers de conformite legale (declaration voyageurs aupres des autorites).
 *
 * <p>3 marches Clenzy : France, Maroc, Arabie Saoudite. Chacun a une
 * obligation legale de declarer les voyageurs aux autorites locales.</p>
 */
public enum ComplianceProviderType {
    /** Chekin — SaaS qui automatise la declaration police FR/ES/IT/PT. */
    CHEKIN,
    /** Connecteur direct DGSN Maroc (fiche d'identification voyageur). */
    POLICE_MA,
    /** Connecteur direct Absher Arabie Saoudite (MOI + Tawakkalna). */
    ABSHER_KSA
}
