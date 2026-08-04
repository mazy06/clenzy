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
    /**
     * Proprietaire TIERS disposant d'un compte : une PARTIE au contrat de
     * gestion, pas un membre de l'organisation.
     *
     * <p>Sans lui, un proprietaire invite dans une conciergerie etait mappe sur
     * {@link #HOST} — donc indiscernable, en permissions, du patron de l'org ;
     * seule la coincidence {@code property.owner_id} les separait, verifiee a la
     * main dans chaque controleur. Son perimetre est celui de SES biens : il
     * consulte, il decide ce qui engage son patrimoine (travaux, mandat,
     * releve), il n'exploite pas — tarifs, calendrier, menage et messages
     * voyageurs restent l'objet du mandat.</p>
     *
     * <p>Le chemin nominal reste le portail par jeton, sans compte : ce role ne
     * sert qu'au proprietaire qui en veut un.</p>
     */
    PROPERTY_OWNER("Proprietaire", "Proprietaire d'un bien confie en gestion"),
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

    /**
     * Vrai si le role est borne aux logements dont l'utilisateur est
     * proprietaire — le perimetre, et non le catalogue de permissions, est ce
     * qui distingue ces profils. {@link #HOST} y figure : un hote independant
     * n'exploite que ses propres biens.
     */
    public boolean isOwnerScoped() {
        return this == HOST || this == PROPERTY_OWNER;
    }

    @Override
    public String toString() {
        return displayName;
    }
}
