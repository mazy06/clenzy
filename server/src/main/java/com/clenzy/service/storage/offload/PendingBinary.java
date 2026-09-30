package com.clenzy.service.storage.offload;

/**
 * Un fichier encore hors du stockage objet, lu pour y être déplacé.
 *
 * @param organizationId organisation propriétaire (préfixe de la clé ; {@code null} si la clé est déjà connue)
 * @param contentType    type MIME
 * @param data           octets du fichier
 * @param currentRef     référence actuelle : clé déjà choisie, chemin sur le disque ou valeur remplacée
 */
public record PendingBinary(Long organizationId, String contentType, byte[] data, String currentRef) {
}
