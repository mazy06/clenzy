package com.clenzy.util;

import java.util.Map;
import java.util.Set;

/**
 * Utilitaire pour verifier la compatibilite entre le type d'intervention d'une equipe
 * et le type de service d'une demande.
 *
 * Mapping :
 * - CLEANING  -> types de nettoyage
 * - MAINTENANCE -> types de maintenance/reparation
 * - OTHER -> types divers (jardinage, desinsectisation, etc.)
 */
public final class InterventionTypeMatcher {

    private static final Map<String, Set<String>> TYPE_MAP = Map.of(
        "CLEANING", Set.of(
            "CLEANING", "EXPRESS_CLEANING", "DEEP_CLEANING", "WINDOW_CLEANING",
            "FLOOR_CLEANING", "KITCHEN_CLEANING", "BATHROOM_CLEANING",
            "DISINFECTION", "RESTORATION"
        ),
        "MAINTENANCE", Set.of(
            "PREVENTIVE_MAINTENANCE", "EMERGENCY_REPAIR", "ELECTRICAL_REPAIR",
            "PLUMBING_REPAIR", "HVAC_REPAIR", "APPLIANCE_REPAIR"
        ),
        "OTHER", Set.of(
            "GARDENING", "EXTERIOR_CLEANING", "PEST_CONTROL", "OTHER"
        )
    );

    private InterventionTypeMatcher() {
        // Utility class
    }

    /**
     * Verifie si une equipe avec un type d'intervention donne est compatible
     * avec un type de service specifique.
     *
     * @param teamInterventionType Le type d'intervention de l'equipe (CLEANING, MAINTENANCE, OTHER)
     * @param serviceType          Le type de service de la demande (CLEANING, EXPRESS_CLEANING, etc.)
     * @return true si compatible, false sinon
     */
    public static boolean isCompatible(String teamInterventionType, String serviceType) {
        if (teamInterventionType == null || serviceType == null) {
            return false;
        }

        String upperTeamType = teamInterventionType.toUpperCase();
        String upperServiceType = serviceType.toUpperCase();

        Set<String> compatibleTypes = TYPE_MAP.get(upperTeamType);
        if (compatibleTypes == null) {
            return false;
        }

        return compatibleTypes.contains(upperServiceType);
    }
}
