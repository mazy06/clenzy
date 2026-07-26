package com.clenzy.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * Un chemin de code dont les requêtes s'exécutent sans contexte tenant — audit sécurité
 * 2026-07-26, plan REM-T-01.
 *
 * <p>Une fois la Row-Level Security active, ces requêtes ne lèveront pas d'erreur : elles
 * renverront <b>zéro ligne</b>. Chaque ligne de cette table désigne donc un endroit à
 * traiter avant l'activation, et le compteur {@link #occurrences} permet de prioriser —
 * un chemin emprunté des milliers de fois par jour est plus urgent qu'un chemin marginal.
 *
 * <p>Pas d'{@code organizationId} : ces constats sont techniques et transverses. Ils
 * décrivent du code, pas des données de tenant.
 */
@Entity
@Table(name = "rls_audit_findings")
public class RlsAuditFinding {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Première frame applicative de la pile — le code à corriger. */
    @Column(nullable = false, length = 512)
    private String origin;

    @Column(name = "table_name", nullable = false, length = 128)
    private String tableName;

    /** Extrait borné : identifie l'appel, ne sert pas à le rejouer. */
    @Column(name = "sql_excerpt", length = 512)
    private String sqlExcerpt;

    @Column(name = "first_seen_at", nullable = false)
    private LocalDateTime firstSeenAt = LocalDateTime.now();

    @Column(name = "last_seen_at", nullable = false)
    private LocalDateTime lastSeenAt = LocalDateTime.now();

    @Column(nullable = false)
    private long occurrences = 1L;

    /**
     * Marqué traité par un opérateur. La ligne est conservée : si le chemin réapparaît
     * après correction, {@link #lastSeenAt} repassera devant cette date — c'est ce qui
     * distingue « corrigé » de « corrigé puis régressé ».
     */
    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getOrigin() { return origin; }
    public void setOrigin(String origin) { this.origin = origin; }
    public String getTableName() { return tableName; }
    public void setTableName(String tableName) { this.tableName = tableName; }
    public String getSqlExcerpt() { return sqlExcerpt; }
    public void setSqlExcerpt(String sqlExcerpt) { this.sqlExcerpt = sqlExcerpt; }
    public LocalDateTime getFirstSeenAt() { return firstSeenAt; }
    public void setFirstSeenAt(LocalDateTime firstSeenAt) { this.firstSeenAt = firstSeenAt; }
    public LocalDateTime getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(LocalDateTime lastSeenAt) { this.lastSeenAt = lastSeenAt; }
    public long getOccurrences() { return occurrences; }
    public void setOccurrences(long occurrences) { this.occurrences = occurrences; }
    public LocalDateTime getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(LocalDateTime resolvedAt) { this.resolvedAt = resolvedAt; }
}
