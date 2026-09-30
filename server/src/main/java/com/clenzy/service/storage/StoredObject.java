package com.clenzy.service.storage;

/**
 * Un fichier déjà écrit sur le stockage, dont il reste à enregistrer la clé en base.
 *
 * @param key              clé de stockage (ex. {@code org/42/photos/<uuid>})
 * @param contentType      type MIME
 * @param size             taille en octets
 * @param originalFilename nom d'origine du fichier envoyé (peut être {@code null})
 */
public record StoredObject(String key, String contentType, long size, String originalFilename) {
}
