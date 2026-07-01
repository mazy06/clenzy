package com.clenzy.model;

/**
 * Niveau d'autonomie d'un module (agent) de la constellation Superviseur.
 *
 * <p>Aligné sur le type front {@code AutonomyLevel} ('suggest'|'notify'|'full').
 * Persisté en STRING. Défaut au lancement : {@link #SUGGEST} (l'agent propose,
 * l'humain valide) — décision produit : démarrage conservateur.</p>
 */
public enum SupervisionAutonomy {
    /** Suggérer : propose, l'humain décide (défaut sûr). */
    SUGGEST,
    /** Agir puis notifier : agit puis informe. */
    NOTIFY,
    /** Auto : pleine autonomie (jamais sur argent/annulations/guest au lancement). */
    FULL;

    /** Valeur réseau (lowercase) consommée par le front. */
    public String toWire() {
        return name().toLowerCase();
    }

    /** Parse une valeur réseau ('suggest'|'notify'|'full'), repli {@link #SUGGEST}. */
    public static SupervisionAutonomy fromWire(String wire) {
        if (wire == null || wire.isBlank()) {
            return SUGGEST;
        }
        try {
            return valueOf(wire.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return SUGGEST;
        }
    }
}
