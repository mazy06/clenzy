package com.clenzy.integration.pennylane.repository;

import com.clenzy.integration.pennylane.model.PennylaneConnection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.time.Instant;

@Repository
public interface PennylaneConnectionRepository extends JpaRepository<PennylaneConnection, Long> {

    Optional<PennylaneConnection> findByOrganizationId(Long organizationId);

    Optional<PennylaneConnection> findByOrganizationIdAndStatus(
        Long organizationId, PennylaneConnection.Status status);

    /** Métadonnées uniquement : ne fusionne jamais les identifiants OAuth d'un ancien snapshot. */
    @Modifying
    @Transactional
    @Query("UPDATE PennylaneConnection c SET c.lastSyncAt = :startedAt, c.updatedAt = :recordedAt "
            + "WHERE c.organizationId = :org AND c.status = 'ACTIVE' "
            + "AND (c.connectedAt IS NULL OR c.connectedAt <= :startedAt) "
            + "AND (c.lastSyncAt IS NULL OR c.lastSyncAt <= :startedAt)")
    int recordSyncAttempt(@Param("org") Long organizationId, @Param("startedAt") Instant startedAt,
                          @Param("recordedAt") Instant recordedAt);
}
