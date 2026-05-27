package com.clenzy.service.agent;

/**
 * Reference vers une piece jointe stockee, transmise du controller (chat body)
 * a l'orchestrateur. Le service resoudra le {@link #storageKey} en bytes via
 * {@code PhotoStorageService.retrieve} avant de fournir le base64 au LLM.
 *
 * @param storageKey cle de stockage (jamais null)
 * @param mediaType  type MIME (image/jpeg, image/png, image/gif, image/webp)
 * @param url        URL d'affichage applicative ({@code /api/assistant/attachments/<key>}),
 *                   optionnelle — utilisee pour persister la reference et la
 *                   re-rendre cote frontend dans l'historique.
 * @param name       nom original du fichier (informatif)
 */
public record AttachmentRef(
        String storageKey,
        String mediaType,
        String url,
        String name
) {
}
