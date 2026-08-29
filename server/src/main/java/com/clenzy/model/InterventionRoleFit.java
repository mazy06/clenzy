package com.clenzy.model;

import java.util.Set;

/**
 * Compatibilite entre le METIER d'un intervenant et le TYPE d'une intervention.
 *
 * <p>L'assignation manuelle ne verifiait que l'appelant — admin ou manager —,
 * jamais que la cible sait faire le travail. Un ménage pouvait donc atterrir sur
 * un technicien : le tarif ménage ne s'y applique pas, le score qualité ne
 * compte pas la mission, et le versement automatique ne se déclenche jamais.
 * L'assignation automatique, elle, filtrait déjà sur {@code HOUSEKEEPER}.</p>
 *
 * <p><b>Volontairement permissif.</b> Refuser une assignation legitime coûte
 * plus cher que d'en laisser passer une douteuse : seuls les couples
 * franchement incompatibles sont bloques. Un type inconnu, {@code OTHER},
 * {@code RESTORATION} ou un role d'encadrement passent toujours.</p>
 */
public final class InterventionRoleFit {

    private InterventionRoleFit() {}

    /** Le nettoyage sous toutes ses formes — le metier des gouvernantes. */
    private static final Set<InterventionType> CLEANING = Set.of(
            InterventionType.CLEANING,
            InterventionType.EXPRESS_CLEANING,
            InterventionType.DEEP_CLEANING,
            InterventionType.WINDOW_CLEANING,
            InterventionType.FLOOR_CLEANING,
            InterventionType.KITCHEN_CLEANING,
            InterventionType.BATHROOM_CLEANING,
            InterventionType.DISINFECTION);

    /** Maintenance et reparations — le metier des techniciens. */
    private static final Set<InterventionType> TRADE = Set.of(
            InterventionType.PREVENTIVE_MAINTENANCE,
            InterventionType.EMERGENCY_REPAIR,
            InterventionType.ELECTRICAL_REPAIR,
            InterventionType.PLUMBING_REPAIR,
            InterventionType.HVAC_REPAIR,
            InterventionType.APPLIANCE_REPAIR);

    /** Exterieurs — jardin, façades, nuisibles. */
    private static final Set<InterventionType> EXTERIOR = Set.of(
            InterventionType.GARDENING,
            InterventionType.EXTERIOR_CLEANING,
            InterventionType.PEST_CONTROL);

    /**
     * Ce role peut-il prendre ce type d'intervention ?
     *
     * @param role rôle de l'intervenant ; {@code null} passe (rien a verifier)
     * @param rawType type brut de l'intervention ; inconnu ou {@code null} passe
     */
    public static boolean accepts(UserRole role, String rawType) {
        if (role == null || rawType == null || rawType.isBlank()) {
            return true;
        }
        InterventionType type = InterventionType.fromString(rawType);
        // `fromString` retombe sur OTHER pour un type inconnu : on ne bloque pas
        // sur une valeur qu'on n'a pas su lire.
        if (type == null || type == InterventionType.OTHER || type == InterventionType.RESTORATION) {
            return true;
        }

        return switch (role) {
            // Encadrement et plateforme : ils couvrent tout, y compris en renfort.
            case SUPER_ADMIN, SUPER_MANAGER, HOST, SUPERVISOR, PROPERTY_OWNER -> true;
            case HOUSEKEEPER, LAUNDRY -> CLEANING.contains(type);
            // Un technicien assure aussi l'exterieur : les deux metiers se
            // recouvrent largement sur le terrain.
            case TECHNICIAN -> TRADE.contains(type) || EXTERIOR.contains(type);
            case EXTERIOR_TECH -> EXTERIOR.contains(type) || TRADE.contains(type);
        };
    }

    /** Message d'erreur explicite : le gestionnaire doit savoir quoi corriger. */
    public static String rejectionMessage(UserRole role, String rawType) {
        InterventionType type = InterventionType.fromString(rawType);
        return "Assignation incoherente : une intervention de type "
                + (type != null ? type.getDisplayName() : rawType)
                + " ne releve pas du metier " + role.getDisplayName()
                + ". Choisissez un intervenant dont le metier correspond, ou changez le type.";
    }
}
