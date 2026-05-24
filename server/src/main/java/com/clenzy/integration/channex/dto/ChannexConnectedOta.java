package com.clenzy.integration.channex.dto;

/**
 * Infos d'un channel OTA actuellement connecte cote hub de distribution.
 *
 * <p>Affiche dans la vue "Gerer les OTAs connectes" du modal Distribution Clenzy.
 * Permet a l'utilisateur de voir ses connexions OTA actives (Airbnb, Booking, ...)
 * et de les deconnecter (suppression du channel + tokens OAuth).</p>
 *
 * @param channelId         UUID du channel dans le hub
 * @param title             titre libre du channel ("New AirBNB Channel", ...)
 * @param otaName           nom de l'OTA ("Airbnb", "BookingCom", "VrboCom", ...)
 * @param isActive          true si le user a finalise l'OAuth (Save dans le wizard)
 * @param hasOauthToken     true si des tokens OAuth sont stockes (auth reussie)
 * @param attachedPropertyTitle titre de la property hub liee (peut etre la pivot Clenzy)
 * @param attachedPropertyId    UUID de la property hub liee
 */
public record ChannexConnectedOta(
    String channelId,
    String title,
    String otaName,
    boolean isActive,
    boolean hasOauthToken,
    String attachedPropertyTitle,
    String attachedPropertyId
) {}
