package com.clenzy.integration.channex.dto;

/**
 * Reponse de l'endpoint Clenzy {@code POST /properties/{id}/ota-channels}.
 *
 * <p>Renvoie l'ID du channel Channex fraichement cree + l'URL signee qui
 * ouvre directement ce channel dans l'iframe Channex (pour que l'utilisateur
 * n'ait plus qu'a faire l'OAuth final + mapping).</p>
 *
 * @param channelId UUID Channex du channel cree (ex: pour link/edit ulterieurs)
 * @param channelTitle libelle du channel ("Airbnb - Marrakech")
 * @param channelName  nom Channex de l'OTA ("Airbnb", "BookingCom", ...)
 * @param embedUrl URL iframe a charger pour la finalisation OAuth/mapping
 * @param expiresInSeconds duree de validite du token de l'embedUrl (15 min Channex)
 */
public record ChannexOtaChannelResponse(
    String channelId,
    String channelTitle,
    String channelName,
    String embedUrl,
    int expiresInSeconds
) {
    public static ChannexOtaChannelResponse of(String channelId, String channelTitle,
                                                  String channelName, String embedUrl) {
        return new ChannexOtaChannelResponse(channelId, channelTitle, channelName, embedUrl, 15 * 60);
    }
}
