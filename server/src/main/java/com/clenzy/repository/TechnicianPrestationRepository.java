package com.clenzy.repository;

import com.clenzy.model.TechnicianPrestation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface TechnicianPrestationRepository extends JpaRepository<TechnicianPrestation, Long> {

    List<TechnicianPrestation> findByOrganizationIdAndUserIdOrderByInterventionTypeAsc(Long organizationId, Long userId);

    void deleteByOrganizationIdAndUserId(Long organizationId, Long userId);

    /** Ids des utilisateurs de l'org qui PROPOSENT (actif) au moins un des types donnés. */
    @Query("SELECT DISTINCT t.userId FROM TechnicianPrestation t "
            + "WHERE t.organizationId = :orgId AND t.enabled = true AND t.interventionType IN :types")
    List<Long> findUserIdsOffering(@Param("orgId") Long orgId, @Param("types") Collection<String> types);
}
