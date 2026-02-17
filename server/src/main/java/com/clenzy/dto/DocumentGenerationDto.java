package com.clenzy.dto;

import com.clenzy.model.DocumentGeneration;

import java.time.LocalDateTime;

public record DocumentGenerationDto(
        Long id,
        Long templateId,
        String templateName,
        String documentType,
        Long referenceId,
        String referenceType,
        String userId,
        String userEmail,
        String fileName,
        Long fileSize,
        String status,
        String emailTo,
        String emailStatus,
        LocalDateTime emailSentAt,
        String errorMessage,
        Integer generationTimeMs,
        LocalDateTime createdAt,
        // ─── Conformite NF ──────────────────────
        String legalNumber,
        String documentHash,
        boolean locked,
        LocalDateTime lockedAt,
        Long correctsId
) {
    public static DocumentGenerationDto fromEntity(DocumentGeneration entity) {
        return new DocumentGenerationDto(
                entity.getId(),
                entity.getTemplate() != null ? entity.getTemplate().getId() : null,
                entity.getTemplate() != null ? entity.getTemplate().getName() : null,
                entity.getDocumentType() != null ? entity.getDocumentType().name() : null,
                entity.getReferenceId(),
                entity.getReferenceType() != null ? entity.getReferenceType().name() : null,
                entity.getUserId(),
                entity.getUserEmail(),
                entity.getFileName(),
                entity.getFileSize(),
                entity.getStatus() != null ? entity.getStatus().name() : null,
                entity.getEmailTo(),
                entity.getEmailStatus(),
                entity.getEmailSentAt(),
                entity.getErrorMessage(),
                entity.getGenerationTimeMs(),
                entity.getCreatedAt(),
                entity.getLegalNumber(),
                entity.getDocumentHash(),
                entity.isLocked(),
                entity.getLockedAt(),
                entity.getCorrectsId()
        );
    }
}
