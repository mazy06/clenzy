package com.clenzy.marketplace.model;

/** Sens d'une regle d'exposition : ouvrir ou fermer. */
public enum ExposureEffect {
    /** Rend la fiche visible malgre une fermeture plus generale. */
    ALLOW,
    /** Retire la fiche de la vue de l'organisation visee, ou de toutes. */
    DENY
}
