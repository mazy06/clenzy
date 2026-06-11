package com.clenzy.service.email;

import com.clenzy.model.UserRole;

import java.util.Locale;

/**
 * Libelles francais des roles pour les emails (invitation, bienvenue).
 *
 * <p>Derive de l'enum {@link UserRole} (T-SOLID-9) : un role ajoute a l'enum
 * est automatiquement couvert via {@link UserRole#getDisplayName()}. Seuls les
 * libelles email HISTORIQUES qui divergent du displayName de l'enum sont
 * surcharges ici (rendu strictement identique a l'ancien switch String de
 * {@code EmailService}), plus les pseudo-roles hors enum (OWNER, MEMBER —
 * roles d'organisation/membership, pas des {@link UserRole} plateforme).</p>
 */
public final class RoleEmailLabels {

    private RoleEmailLabels() { /* util class */ }

    /**
     * Libelle email d'un role. {@code null} → "Membre" ; valeur inconnue →
     * renvoyee telle quelle (comportement historique).
     */
    public static String displayName(String role) {
        if (role == null) return "Membre";
        String normalized = role.toUpperCase(Locale.ROOT);

        // Pseudo-roles hors enum plateforme (membership / legacy)
        if ("OWNER".equals(normalized)) return "Proprietaire";
        if ("MEMBER".equals(normalized)) return "Membre";

        final UserRole userRole;
        try {
            userRole = UserRole.valueOf(normalized);
        } catch (IllegalArgumentException e) {
            return role;
        }
        return switch (userRole) {
            // Libelles email historiques divergents du displayName de l'enum
            case SUPER_ADMIN -> "Super Administrateur";
            case HOUSEKEEPER -> "Agent de menage";
            case HOST -> "Proprietaire";
            default -> userRole.getDisplayName();
        };
    }
}
