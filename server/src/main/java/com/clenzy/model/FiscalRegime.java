package com.clenzy.model;

/**
 * Regime fiscal d'une organisation.
 * Determine les obligations de declaration et les seuils d'exoneration.
 */
public enum FiscalRegime {
    /** Regime standard - TVA collectee et deductible */
    STANDARD,
    /** Micro-entreprise - franchise de TVA sous seuil */
    MICRO_ENTERPRISE,
    /** Regime simplifie - declaration simplifiee */
    SIMPLIFIED
}
