package com.clenzy.dto.keyexchange;

/**
 * Photo d'emplacement d'un point de remise des cles.
 *
 * @param id  identifiant (suppression)
 * @param url chemin relatif du binaire, servi avec l'authentification de l'utilisateur
 */
public record KeyExchangePointPhotoDto(Long id, String url) {

    public static String dataUrl(Long pointId, Long photoId) {
        return "/api/key-exchange/points/" + pointId + "/photos/" + photoId + "/data";
    }
}
