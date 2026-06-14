package com.clenzy.model;

/**
 * Types d'anomalies détectées par le moteur de surveillance (Phase 4 différenciation).
 * Ensemble ouvert : on commence par l'intégrité calendrier (double-booking).
 */
public enum AnomalyType {
    /** Deux réservations confirmées qui se chevauchent sur le même bien (sur-réservation). */
    DOUBLE_BOOKING
}
