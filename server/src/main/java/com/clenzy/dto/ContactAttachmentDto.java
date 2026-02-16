package com.clenzy.dto;

/**
 * Metadonnees d'une piece jointe dans un message de contact.
 */
public record ContactAttachmentDto(
        String id,
        String filename,
        String originalName,
        long size,
        String contentType,
        String storagePath
) {}
