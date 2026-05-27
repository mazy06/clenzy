package com.clenzy.config.ai;

import java.util.Objects;

/**
 * Piece jointe d'un message utilisateur — image attachee pour le vision support.
 *
 * <p>Strategie de stockage : on porte SOIT une cle de stockage applicative
 * (qui sera resolue via {@code PhotoStorageService.retrieve} pour recuperer
 * les bytes), SOIT directement le payload base64 ({@code base64Data} non-null)
 * pour les cas ou la donnee est deja en memoire (tests, conversion en cours).</p>
 *
 * <p>Le {@link #mediaType} doit suivre le format MIME standard supporte par
 * Anthropic Vision : {@code image/jpeg}, {@code image/png}, {@code image/gif},
 * {@code image/webp}. Limite Anthropic : 5MB par image.</p>
 *
 * <p>Le {@code type} est un enum textuel (extensible plus tard si on ajoute
 * d'autres formats : PDF, audio, ...) — pour l'instant un seul cas {@code IMAGE}.</p>
 *
 * @param type        type d'attachment (actuellement "IMAGE")
 * @param storageKey  cle pour {@code PhotoStorageService.retrieve} (peut etre null si base64Data fourni)
 * @param mediaType   type MIME (ex: "image/jpeg")
 * @param base64Data  payload base64 deja prepare (peut etre null si storageKey fourni)
 */
public record MessageAttachment(
        String type,
        String storageKey,
        String mediaType,
        String base64Data
) {

    public static final String TYPE_IMAGE = "IMAGE";

    public MessageAttachment {
        Objects.requireNonNull(type, "type cannot be null");
        Objects.requireNonNull(mediaType, "mediaType cannot be null");
        if (storageKey == null && base64Data == null) {
            throw new IllegalArgumentException(
                    "MessageAttachment doit porter soit storageKey soit base64Data");
        }
    }

    /** Attachment IMAGE avec donnees base64 deja prepares (cas inline / tests). */
    public static MessageAttachment imageBase64(String mediaType, String base64Data) {
        return new MessageAttachment(TYPE_IMAGE, null, mediaType, base64Data);
    }

    /** Attachment IMAGE par reference vers le storage applicatif. */
    public static MessageAttachment imageStorageKey(String storageKey, String mediaType) {
        return new MessageAttachment(TYPE_IMAGE, storageKey, mediaType, null);
    }
}
