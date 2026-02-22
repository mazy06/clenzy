package com.clenzy.dto;

import java.time.Instant;

/**
 * DTO representant les metadonnees d'un fichier de backup base de donnees.
 */
public record BackupInfoDto(
    String filename,
    long sizeBytes,
    Instant createdAt
) {}
