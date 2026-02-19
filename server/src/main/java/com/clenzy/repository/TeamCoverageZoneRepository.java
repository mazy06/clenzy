package com.clenzy.repository;

import com.clenzy.model.TeamCoverageZone;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TeamCoverageZoneRepository extends JpaRepository<TeamCoverageZone, Long> {

    List<TeamCoverageZone> findByTeamId(Long teamId);

    @Modifying
    @Query("DELETE FROM TeamCoverageZone tcz WHERE tcz.teamId = :teamId AND tcz.organizationId = :orgId")
    void deleteByTeamIdAndOrganizationId(@Param("teamId") Long teamId, @Param("orgId") Long orgId);

    /**
     * Trouver les IDs des equipes couvrant un departement
     */
    @Query("SELECT DISTINCT tcz.teamId FROM TeamCoverageZone tcz WHERE tcz.department = :dept AND tcz.organizationId = :orgId")
    List<Long> findTeamIdsByDepartment(@Param("dept") String department, @Param("orgId") Long orgId);

    /**
     * Trouver les IDs des equipes couvrant un departement et un arrondissement.
     * Retourne aussi les equipes qui couvrent le departement entier (arrondissement IS NULL).
     */
    @Query("SELECT DISTINCT tcz.teamId FROM TeamCoverageZone tcz " +
           "WHERE tcz.department = :dept " +
           "AND (tcz.arrondissement IS NULL OR tcz.arrondissement = :arr) " +
           "AND tcz.organizationId = :orgId")
    List<Long> findTeamIdsByDepartmentAndArrondissement(
        @Param("dept") String department,
        @Param("arr") String arrondissement,
        @Param("orgId") Long orgId
    );
}
