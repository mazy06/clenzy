package com.clenzy.integration.channex.dto;

/**
 * Reponse de l'endpoint d'embedding Channex.
 *
 * <p>Contient l'URL signee a injecter dans une {@code <iframe>} cote frontend
 * Clenzy. La URL contient un {@code oauth_session_key} a usage unique valable
 * 15 minutes — apres consommation par la iframe, la session devient permanente
 * jusqu'a fermeture de l'onglet.</p>
 *
 * @param url        URL complete a mettre dans {@code <iframe src=...>}
 * @param expiresInSeconds duree de validite du token initial (15 min selon Channex)
 */
public record ChannexEmbedUrlResponse(String url, int expiresInSeconds) {

    /** Construit une reponse avec le TTL standard Channex de 15 minutes. */
    public static ChannexEmbedUrlResponse of(String url) {
        return new ChannexEmbedUrlResponse(url, 15 * 60);
    }
}
