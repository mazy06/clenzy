package com.clenzy.integration.channex.dto;

/**
 * Reponse de {@code POST /api/integrations/channex/import/setup-oauth}.
 *
 * <p>Permet a un utilisateur qui n'a pas encore de propriete dans le hub de
 * distribution de connecter son compte OTA (Airbnb, Booking, ...) DIRECTEMENT
 * depuis Clenzy, sans avoir a creer manuellement une propriete Clenzy au
 * prealable.</p>
 *
 * <p>Cote backend, une propriete Channex "pivot" {@code [Clenzy Hub] OAuth Bridge}
 * est creee (ou reutilisee si deja presente) pour servir de container pour
 * l'OAuth. Apres l'OAuth, Channex cree automatiquement des properties pour
 * chaque listing detecte du compte OTA — la pivot reste vide et n'est pas
 * mappee a Clenzy (donc n'apparait pas dans la discovery).</p>
 *
 * @param embedUrl          URL signee a charger dans une iframe Channex
 * @param expiresInSeconds  duree de validite du token initial (15 min Channex)
 * @param pivotPropertyId   UUID Channex de la property pivot utilisee
 *                          (utile pour cleanup futur)
 */
public record ChannexOauthSetupResponse(
    String embedUrl,
    int expiresInSeconds,
    String pivotPropertyId
) {
    public static ChannexOauthSetupResponse of(String embedUrl, String pivotPropertyId) {
        return new ChannexOauthSetupResponse(embedUrl, 15 * 60, pivotPropertyId);
    }
}
