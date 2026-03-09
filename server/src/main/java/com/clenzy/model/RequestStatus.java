package com.clenzy.model;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * Statut d'une demande de service.
 * Workflow : PENDING → AWAITING_PAYMENT → IN_PROGRESS → COMPLETED
 */
public enum RequestStatus {
    PENDING("En attente"),
    ASSIGNED("Assignée"),
    AWAITING_PAYMENT("En attente de paiement"),
    IN_PROGRESS("En cours"),
    COMPLETED("Terminé"),
    CANCELLED("Annulé"),
    REJECTED("Rejeté");

    private final String displayName;

    RequestStatus(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }

    private static final Map<RequestStatus, Set<RequestStatus>> ALLOWED_TRANSITIONS = Map.of(
        PENDING, EnumSet.of(AWAITING_PAYMENT, REJECTED, CANCELLED),
        ASSIGNED, EnumSet.of(AWAITING_PAYMENT, PENDING, CANCELLED),  // legacy — kept for backward compat
        AWAITING_PAYMENT, EnumSet.of(IN_PROGRESS, PENDING, CANCELLED),
        IN_PROGRESS, EnumSet.of(COMPLETED, CANCELLED),
        COMPLETED, EnumSet.noneOf(RequestStatus.class),
        CANCELLED, EnumSet.noneOf(RequestStatus.class),
        REJECTED, EnumSet.of(PENDING)
    );

    public boolean canTransitionTo(RequestStatus target) {
        Set<RequestStatus> allowed = ALLOWED_TRANSITIONS.get(this);
        return allowed != null && allowed.contains(target);
    }

    public static RequestStatus fromString(String status) {
        if (status == null) return null;

        for (RequestStatus s : RequestStatus.values()) {
            if (s.name().equals(status.toUpperCase())) {
                return s;
            }
        }
        throw new IllegalArgumentException("Statut invalide: " + status);
    }
}
