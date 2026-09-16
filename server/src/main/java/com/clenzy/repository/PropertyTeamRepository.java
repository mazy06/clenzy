package com.clenzy.repository;

import com.clenzy.model.PropertyTeam;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PropertyTeamRepository extends JpaRepository<PropertyTeam, Long> {

    @Query("SELECT pt FROM PropertyTeam pt LEFT JOIN FETCH pt.team WHERE pt.propertyId = :propertyId AND pt.organizationId = :orgId ORDER BY pt.priority ASC, pt.id ASC")
    List<PropertyTeam> findAllByPropertyId(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    /** Compatibilité de la fiche historique : dernière liaison, sans limiter les candidats métier. */
    default Optional<PropertyTeam> findByPropertyId(Long propertyId, Long orgId) {
        return findAllByPropertyId(propertyId, orgId).stream().findFirst();
    }

    @Query("SELECT pt FROM PropertyTeam pt LEFT JOIN FETCH pt.team WHERE pt.propertyId IN :propertyIds AND pt.organizationId = :orgId")
    List<PropertyTeam> findByPropertyIdIn(@Param("propertyIds") List<Long> propertyIds, @Param("orgId") Long orgId);

    List<PropertyTeam> findByTeamId(Long teamId);

    boolean existsByPropertyId(Long propertyId);

    @Modifying
    @Query("DELETE FROM PropertyTeam pt WHERE pt.propertyId = :propertyId AND pt.organizationId = :orgId")
    void deleteByPropertyIdAndOrganizationId(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);
}
