package com.clenzy.repository;

import com.clenzy.model.TeamCoverageZone;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TeamCoverageZoneRepository extends JpaRepository<TeamCoverageZone, Long> {

    List<TeamCoverageZone> findByTeamId(Long teamId);

    void deleteByTeamId(Long teamId);

    /**
     * Trouver les IDs des equipes couvrant un departement
     */
    @Query("SELECT DISTINCT tcz.teamId FROM TeamCoverageZone tcz WHERE tcz.department = :dept")
    List<Long> findTeamIdsByDepartment(@Param("dept") String department);

    /**
     * Trouver les IDs des equipes couvrant un departement et un arrondissement.
     * Retourne aussi les equipes qui couvrent le departement entier (arrondissement IS NULL).
     */
    @Query("SELECT DISTINCT tcz.teamId FROM TeamCoverageZone tcz " +
           "WHERE tcz.department = :dept " +
           "AND (tcz.arrondissement IS NULL OR tcz.arrondissement = :arr)")
    List<Long> findTeamIdsByDepartmentAndArrondissement(
        @Param("dept") String department,
        @Param("arr") String arrondissement
    );
}
