package com.clenzy.integration.channex.dto;

import jakarta.validation.constraints.Size;

/**
 * Requete de connexion d'une property Clenzy a Channex.
 *
 * <p>Deux modes possibles, controles par le champ {@link #mode} :</p>
 * <ul>
 *   <li><b>{@code AUTO_CREATE}</b> (recommande) — Clenzy cree automatiquement
 *       la Property + Room Type + Rate Plan cote Channex via 3 appels API,
 *       en derivant les attributs de la Property Clenzy (title, country,
 *       currency, max guests). Les 3 IDs Channex doivent etre laisses null.</li>
 *   <li><b>{@code IMPORT_EXISTING}</b> — l'utilisateur a deja cree les 3
 *       entites cote dashboard Channex et fournit leurs UUIDs. Utile pour
 *       reconnecter une property apres une suppression de mapping, ou si
 *       l'utilisateur veut des proprietes Channex configurees manuellement.</li>
 * </ul>
 *
 * <p>La validation est faite cote service ({@link com.clenzy.integration.channex.service.ChannexConnectService})
 * car elle depend du mode choisi (les 3 IDs sont requis uniquement en mode IMPORT).</p>
 */
public record ChannexConnectRequest(
    Mode mode,

    @Size(max = 64) String channexPropertyId,
    @Size(max = 64) String channexRoomTypeId,
    @Size(max = 64) String channexDefaultRatePlanId
) {

    public enum Mode {
        AUTO_CREATE,
        IMPORT_EXISTING
    }

    /**
     * Mode effectif. Si {@code mode} est null (compat clients anciens), heuristique
     * sur la presence des 3 IDs : tous fournis = IMPORT_EXISTING, sinon AUTO_CREATE.
     */
    public Mode effectiveMode() {
        if (mode != null) return mode;
        return hasAllIds() ? Mode.IMPORT_EXISTING : Mode.AUTO_CREATE;
    }

    public boolean hasAllIds() {
        return !isBlank(channexPropertyId)
            && !isBlank(channexRoomTypeId)
            && !isBlank(channexDefaultRatePlanId);
    }

    private static boolean isBlank(String s) { return s == null || s.isBlank(); }

    /** Factory : import IDs existants. */
    public static ChannexConnectRequest importExisting(String propertyId, String roomTypeId, String ratePlanId) {
        return new ChannexConnectRequest(Mode.IMPORT_EXISTING, propertyId, roomTypeId, ratePlanId);
    }

    /** Factory : auto-create (Clenzy gere tout). */
    public static ChannexConnectRequest autoCreate() {
        return new ChannexConnectRequest(Mode.AUTO_CREATE, null, null, null);
    }
}
