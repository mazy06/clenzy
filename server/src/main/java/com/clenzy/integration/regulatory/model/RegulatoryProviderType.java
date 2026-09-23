package com.clenzy.integration.regulatory.model;

/**
 * Plateformes de declaration reglementaire d'ACTIVITE — inventaire, tarifs,
 * sejours.
 *
 * <p>A ne pas confondre avec
 * {@link com.clenzy.integration.compliance.model.ComplianceProviderType}, qui
 * couvre la declaration de VOYAGEURS (Shomoos, DGSN). Un meme pays peut relever
 * des deux : l'Arabie saoudite declare ses voyageurs a Shomoos et son activite
 * a la NTMP, aupres de deux ministeres differents.</p>
 */
public enum RegulatoryProviderType {
    /**
     * National Tourism Monitoring Platform — ministere du Tourisme saoudien.
     * Service « Private Accommodation Units » : types d'unite, disponibilite,
     * tarifs journaliers, reservations, etat d'exploitation.
     */
    NTMP
}
