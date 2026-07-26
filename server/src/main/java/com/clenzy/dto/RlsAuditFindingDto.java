package com.clenzy.dto;

import com.clenzy.model.RlsAuditFinding;

import java.time.LocalDateTime;

/**
 * Un chemin dont les requetes s'executent sans contexte tenant — plan REM-T-01.
 *
 * <p>{@code occurrences} sert a prioriser : un chemin emprunte des milliers de fois par
 * jour est plus urgent qu'un chemin marginal.
 */
public record RlsAuditFindingDto(
        Long id,
        String origin,
        String tableName,
        String sqlExcerpt,
        LocalDateTime firstSeenAt,
        LocalDateTime lastSeenAt,
        long occurrences,
        LocalDateTime resolvedAt
) {
    public static RlsAuditFindingDto from(RlsAuditFinding f) {
        return new RlsAuditFindingDto(
                f.getId(), f.getOrigin(), f.getTableName(), f.getSqlExcerpt(),
                f.getFirstSeenAt(), f.getLastSeenAt(), f.getOccurrences(), f.getResolvedAt());
    }
}
