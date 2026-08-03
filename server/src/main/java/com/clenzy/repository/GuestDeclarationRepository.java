package com.clenzy.repository;

import com.clenzy.model.GuestDeclaration;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface GuestDeclarationRepository extends JpaRepository<GuestDeclaration, Long> {

    /** Toutes les declarations d'une reservation (principal + accompagnants), tri stable. */
    List<GuestDeclaration> findByReservationIdOrderByIdAsc(Long reservationId);

    /**
     * Fiches COMPLÉTÉES non encore télédéclarées d'un logement (scanner POLICE_DECLARE
     * de la constellation, agent Conformité).
     */
    @org.springframework.data.jpa.repository.Query(
            "SELECT d FROM GuestDeclaration d JOIN FETCH d.reservation r "
            + "WHERE d.organizationId = :orgId AND r.property.id = :propertyId "
            + "AND d.status = :status AND d.submittedToProvider = false")
    List<GuestDeclaration> findSubmittableByProperty(
            @org.springframework.data.repository.query.Param("orgId") Long orgId,
            @org.springframework.data.repository.query.Param("propertyId") Long propertyId,
            @org.springframework.data.repository.query.Param("status") com.clenzy.model.DeclarationStatus status);

    // --- Purge (fiche de police, 180 j) ---

    /**
     * Compte (lecture seule) les declarations purgeables : {@code created_at <= cutoff}
     * (borne haute incluse, contrat {@code PurgeSource.countExpired}).
     */
    long countByCreatedAtLessThanEqual(LocalDateTime cutoff);

    /**
     * Selectionne, en tri stable par id, au plus {@code pageable.pageSize} ids de declarations
     * dont le {@code created_at} est {@code <= cutoff}. Le service les supprime ensuite par batch
     * borne ({@link JpaRepository#deleteAllByIdInBatch}) dans une transaction propre.
     */
    @Query("SELECT d.id FROM GuestDeclaration d WHERE d.createdAt <= :cutoff ORDER BY d.id ASC")
    List<Long> findIdsCreatedBefore(@Param("cutoff") LocalDateTime cutoff, Pageable pageable);
}
