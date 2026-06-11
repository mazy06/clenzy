package com.clenzy.dto;

/**
 * Contenu binaire d'une piece jointe de message de contact, pret pour
 * le telechargement HTTP. Le nom et le content-type proviennent des
 * metadonnees JSONB du message (pas du fichier stocke).
 */
public record ContactAttachmentContentDto(
        String originalName,
        String contentType,
        byte[] data
) {}
