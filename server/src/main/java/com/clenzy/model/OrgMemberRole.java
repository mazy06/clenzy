package com.clenzy.model;

/**
 * Role d'un membre au sein d'une Organisation.
 *
 * Hierarchie :
 *   OWNER > ADMIN > MANAGER > SUPERVISOR > roles operationnels > MEMBER
 *
 * Les roles operationnels (HOUSEKEEPER, TECHNICIAN, LAUNDRY, EXTERIOR_TECH, HOST)
 * n'ont pas de hierarchie entre eux.
 */
public enum OrgMemberRole {

    // ── Direction ───────────────────────────────────────────────────────────
    OWNER,          // Createur de l'organisation, controle total
    ADMIN,          // Peut gerer les parametres, membres et facturation
    MANAGER,        // Gestion des operations et plannings

    // ── Encadrement ─────────────────────────────────────────────────────────
    SUPERVISOR,     // Gere une equipe de prestataires

    // ── Operationnel ────────────────────────────────────────────────────────
    HOUSEKEEPER,    // Nettoyage des logements
    TECHNICIAN,     // Maintenance et reparations
    LAUNDRY,        // Blanchisserie / gestion du linge
    EXTERIOR_TECH,  // Entretien exterieur (jardin, piscine, etc.)
    HOST,           // Proprietaire de logements rattache a l'organisation

    // ── Basique ─────────────────────────────────────────────────────────────
    MEMBER;         // Membre standard (acces minimum)

    // ── Helpers ─────────────────────────────────────────────────────────────

    /**
     * Peut gerer l'organisation (parametres, membres, facturation).
     */
    public boolean canManageOrg() {
        return this == OWNER || this == ADMIN;
    }

    /**
     * Peut gerer les equipes et les plannings.
     */
    public boolean canManageTeams() {
        return canManageOrg() || this == MANAGER || this == SUPERVISOR;
    }

    /**
     * Peut creer/gerer des interventions.
     */
    public boolean canManageInterventions() {
        return canManageTeams() || this == TECHNICIAN || this == HOUSEKEEPER
                || this == LAUNDRY || this == EXTERIOR_TECH;
    }

    /**
     * Peut voir les rapports financiers.
     */
    public boolean canViewFinancials() {
        return canManageOrg() || this == MANAGER;
    }

    /**
     * Peut inviter de nouveaux membres dans l'organisation.
     */
    public boolean canInviteMembers() {
        return canManageOrg() || this == MANAGER;
    }
}
