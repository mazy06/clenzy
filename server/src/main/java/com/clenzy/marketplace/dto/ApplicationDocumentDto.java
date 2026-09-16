package com.clenzy.marketplace.dto;

import com.clenzy.model.ProviderDocument;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Une piece deposee, telle que le candidat la voit.
 *
 * <p>La cle de stockage n'y figure pas : elle designe le binaire et n'a rien a
 * faire dans une reponse publique. {@code reviewNote} en revanche est
 * DELIBEREMENT expose — c'est le motif de refus, et le candidat ne peut pas
 * corriger ce qu'on ne lui dit pas.</p>
 */
public record ApplicationDocumentDto(
    Long id,
    String documentType,
    String fileName,
    Long fileSize,
    LocalDate expiresAt,
    String status,
    String reviewNote,
    LocalDateTime createdAt
) {
    public static ApplicationDocumentDto from(ProviderDocument document) {
        return new ApplicationDocumentDto(
            document.getId(),
            document.getDocumentType() != null ? document.getDocumentType().name() : null,
            document.getFileName(),
            document.getFileSize(),
            document.getExpiresAt(),
            document.getStatus() != null ? document.getStatus().name() : null,
            document.getReviewNote(),
            document.getCreatedAt());
    }
}
