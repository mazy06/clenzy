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
    /**
     * Connecteur direct Absher Arabie Saoudite (MOI + Tawakkalna).
     * Conservé en standby : Absher est la plateforme de services citoyens ;
     * l'enregistrement des voyageurs du secteur hébergement passe par
     * {@link #SHOMOOS} — c'est SHOMOOS que le resolver mappe au pays SA.
     */
    ABSHER_KSA,
    /**
     * Shomoos (شموس) — plateforme nationale saoudienne d'enregistrement des
     * voyageurs pour le secteur de l'hébergement (obligatoire pour les
     * établissements licenciés, contrôlée par le ministère de l'Intérieur /
     * du Tourisme). Provider applicable pour le pays SA.
     */
    SHOMOOS
}
