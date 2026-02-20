package com.clenzy.model;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * Statut d'une demande de service
 */
public enum RequestStatus {
    PENDING("En attente"),
    APPROVED("Approuvé"),
    DEVIS_ACCEPTED("Devis accepté"),
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
        PENDING, EnumSet.of(APPROVED, REJECTED, CANCELLED),
        APPROVED, EnumSet.of(DEVIS_ACCEPTED, IN_PROGRESS, CANCELLED),
        DEVIS_ACCEPTED, EnumSet.of(IN_PROGRESS, CANCELLED),
        IN_PROGRESS, EnumSet.of(COMPLETED, CANCELLED),
        COMPLETED, EnumSet.noneOf(RequestStatus.class),
        CANCELLED, EnumSet.noneOf(RequestStatus.class),
        REJECTED, EnumSet.of(PENDING)   // re-submit
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
