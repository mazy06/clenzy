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

    /**
     * Transitions autorisees.
     *
     * <p><b>Le controle du travail rendu passe par AWAITING_VALIDATION.</b>
     * L'intervenant qui a fini SOUMET ({@code IN_PROGRESS → AWAITING_VALIDATION})
     * avec ses photos et sa duree ; un gestionnaire examine, puis valide
     * ({@code → AWAITING_PAYMENT}, le solde devient du) ou refuse
     * ({@code → IN_PROGRESS}, reprise).</p>
     *
     * <p>Le chemin direct {@code IN_PROGRESS → COMPLETED} reste ouvert : toutes
     * les interventions ne se facturent pas, et une regie interne n'a rien a
     * faire valider. C'est la SOUMISSION qui appelle le controle, pas la fin des
     * travaux.</p>
     */
    private static final Map<InterventionStatus, Set<InterventionStatus>> ALLOWED_TRANSITIONS = Map.of(
        PENDING, EnumSet.of(AWAITING_VALIDATION, IN_PROGRESS, CANCELLED),
        // Le refus renvoie en IN_PROGRESS : le travail est a reprendre, pas a
        // recommencer depuis rien.
        AWAITING_VALIDATION, EnumSet.of(AWAITING_PAYMENT, IN_PROGRESS, CANCELLED),
        AWAITING_PAYMENT, EnumSet.of(IN_PROGRESS, COMPLETED, CANCELLED),
        // La soumission pour controle manquait : l'intervenant ne pouvait que
        // clore lui-meme, ce qui court-circuitait toute verification.
        IN_PROGRESS, EnumSet.of(AWAITING_VALIDATION, COMPLETED, CANCELLED),
        COMPLETED, EnumSet.of(IN_PROGRESS),   // reopen only
        CANCELLED, EnumSet.noneOf(InterventionStatus.class)
    );

    public boolean canTransitionTo(InterventionStatus target) {
        Set<InterventionStatus> allowed = ALLOWED_TRANSITIONS.get(this);
        return allowed != null && allowed.contains(target);
    }

    public void assertCanTransitionTo(InterventionStatus target) {
        if (!canTransitionTo(target)) {
            throw new IllegalStateException(
                "Transition invalide : " + this.name() + " -> " + target.name()
                + ". Transitions autorisees depuis " + this.name() + " : " + ALLOWED_TRANSITIONS.getOrDefault(this, Set.of()));
        }
    }

    public static InterventionStatus fromString(String status) {
        if (status == null) return null;

        for (InterventionStatus s : InterventionStatus.values()) {
            if (s.name().equalsIgnoreCase(status)) {
                return s;
            }
        }
        throw new IllegalArgumentException("Statut invalide: " + status);
    }
}
