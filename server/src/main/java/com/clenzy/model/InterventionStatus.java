package com.clenzy.model;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

public enum InterventionStatus {
    PENDING("En attente"),
    AWAITING_VALIDATION("En attente de validation"),
    AWAITING_PAYMENT("En attente de paiement"),
    IN_PROGRESS("En cours"),
    COMPLETED("Terminé"),
    CANCELLED("Annulé");

    private final String displayName;

    InterventionStatus(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }

    private static final Map<InterventionStatus, Set<InterventionStatus>> ALLOWED_TRANSITIONS = Map.of(
        PENDING, EnumSet.of(AWAITING_VALIDATION, IN_PROGRESS, CANCELLED),
        AWAITING_VALIDATION, EnumSet.of(AWAITING_PAYMENT, IN_PROGRESS, CANCELLED),
        AWAITING_PAYMENT, EnumSet.of(IN_PROGRESS, CANCELLED),
        IN_PROGRESS, EnumSet.of(COMPLETED, CANCELLED),
        COMPLETED, EnumSet.of(IN_PROGRESS),   // reopen only
        CANCELLED, EnumSet.noneOf(InterventionStatus.class)
    );

    public boolean canTransitionTo(InterventionStatus target) {
        Set<InterventionStatus> allowed = ALLOWED_TRANSITIONS.get(this);
        return allowed != null && allowed.contains(target);
    }

    public static InterventionStatus fromString(String status) {
        if (status == null) return null;

        for (InterventionStatus s : InterventionStatus.values()) {
            if (s.name().equals(status.toUpperCase())) {
                return s;
            }
        }
        throw new IllegalArgumentException("Statut invalide: " + status);
    }
}
