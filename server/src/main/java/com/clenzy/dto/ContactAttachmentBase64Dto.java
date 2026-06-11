package com.clenzy.dto;

/**
 * Piece jointe de message de contact encodee en data URI base64
 * (affichage inline mobile sans headers d'auth).
 */
public record ContactAttachmentBase64Dto(
        String dataUri,
        String contentType,
        String originalName,
        long size
) {}
