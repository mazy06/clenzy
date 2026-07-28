package com.clenzy.integration.minut.repository;

import com.clenzy.integration.minut.model.MinutConnection;
import com.clenzy.integration.minut.model.MinutConnection.MinutConnectionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;

@Repository
public interface MinutConnectionRepository extends JpaRepository<MinutConnection, Long> {

    Optional<MinutConnection> findByUserId(String userId);

    Optional<MinutConnection> findByMinutUserId(String minutUserId);

    List<MinutConnection> findByStatus(MinutConnectionStatus status);

    boolean existsByUserId(String userId);

    /** Connexions Minut muettes : révoquées, en erreur, ou jeton expiré. */
    @Query("""
            SELECT c FROM MinutConnection c
            WHERE c.organizationId = :orgId
              AND (c.status <> com.clenzy.integration.minut.model.MinutConnection$MinutConnectionStatus.ACTIVE
                   OR (c.tokenExpiresAt IS NOT NULL AND c.tokenExpiresAt < :now))
            """)
    List<MinutConnection> findBrokenForOrg(@Param("orgId") Long orgId,
                                           @Param("now") LocalDateTime now);
}
