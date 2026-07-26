package com.clenzy.repository;

import com.clenzy.model.RlsAuditFinding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Inventaire des chemins echappant a la RLS — audit securite 2026-07-26, plan REM-T-01.
 */
public interface RlsAuditFindingRepository extends JpaRepository<RlsAuditFinding, Long> {

    Optional<RlsAuditFinding> findByOriginAndTableName(String origin, String tableName);

    List<RlsAuditFinding> findAllByOrderByOccurrencesDesc();

    long countByResolvedAtIsNull();

    /**
     * Accumulation idempotente : cree la ligne ou incremente l'existante.
     *
     * <p>En UPSERT natif plutot qu'en lecture-puis-ecriture : le vidage du tampon peut
     * concourir avec un autre noeud, et un check-then-act ferait perdre des constats
     * (regle CLAUDE.md n°8).
     *
     * <p>{@code resolved_at} est remis a NULL si le chemin reapparait : un constat qui
     * revient apres correction est un constat ouvert, pas un historique.
     */
    @Modifying
    @Query(value = """
            INSERT INTO rls_audit_findings
                   (origin, table_name, sql_excerpt, first_seen_at, last_seen_at, occurrences)
            VALUES (:origin, :tableName, :sqlExcerpt, :seenAt, :seenAt, :occurrences)
            ON CONFLICT (origin, table_name) DO UPDATE
               SET last_seen_at = EXCLUDED.last_seen_at,
                   occurrences  = rls_audit_findings.occurrences + EXCLUDED.occurrences,
                   sql_excerpt  = COALESCE(rls_audit_findings.sql_excerpt, EXCLUDED.sql_excerpt),
                   resolved_at  = NULL
            """, nativeQuery = true)
    void upsert(@Param("origin") String origin,
                @Param("tableName") String tableName,
                @Param("sqlExcerpt") String sqlExcerpt,
                @Param("seenAt") LocalDateTime seenAt,
                @Param("occurrences") long occurrences);
}
