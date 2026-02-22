package com.clenzy.model;

/**
 * Role de l'utilisateur sur la PLATEFORME Clenzy.
 *
 * Trois niveaux :
 *   1. Plateforme  : SUPER_ADMIN, SUPER_MANAGER  (equipe Clenzy)
 *   2. Organisation: roles metier geres via OrgMemberRole
 *   3. Independant : HOST utilise le catalogue Clenzy
 */
public enum UserRole {

    // ── Plateforme (equipe Clenzy) ──────────────────────────────────────────
    SUPER_ADMIN("Super Admin", "Acces complet a la plateforme Clenzy"),
    SUPER_MANAGER("Super Manager", "Gestion des operations de la plateforme"),

    // ── Roles metier (utilisables en org ou en independant) ─────────────────
    HOST("Hote", "Proprietaire de logements"),
    TECHNICIAN("Technicien", "Maintenance et reparations"),
    HOUSEKEEPER("Housekeeper", "Nettoyage des logements"),
    SUPERVISOR("Superviseur", "Gere une equipe de techniciens/housekeepers"),
    LAUNDRY("Blanchisserie", "Gestion du linge et blanchisserie"),
    EXTERIOR_TECH("Tech. Exterieur", "Entretien exterieur (jardin, piscine, etc.)");

    private final String displayName;
    private final String description;

    UserRole(String displayName, String description) {
        this.displayName = displayName;
        this.description = description;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getDescription() {
        return description;
    }

    // ── Helpers plateforme ──────────────────────────────────────────────────

    /**
     * Vrai si le role correspond a un admin plateforme.
     */
    public boolean isPlatformAdmin() {
        return this == SUPER_ADMIN;
    }

    /**
     * Vrai si le role fait partie du staff plateforme (SUPER_ADMIN, SUPER_MANAGER).
     */
    public boolean isPlatformStaff() {
        return this == SUPER_ADMIN || this == SUPER_MANAGER;
    }

    @Override
    public String toString() {
        return displayName;
    }
}
