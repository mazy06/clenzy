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

    /** Même règle que l'attribution verrouillée, en lecture pour les suggestions. */
    @Query(value = "SELECT NOT public.baitly_assignee_accepts_property('team', :teamId, :propertyType)", nativeQuery = true)
    boolean rejectsPropertyType(@Param("teamId") Long teamId, @Param("propertyType") String propertyType);


    @Modifying
    @Query("DELETE FROM TeamCoverageZone tcz WHERE tcz.teamId = :teamId AND tcz.organizationId = :orgId")
    void deleteByTeamIdAndOrganizationId(@Param("teamId") Long teamId, @Param("orgId") Long orgId);


    @Query(value = "SELECT t.id FROM teams t WHERE t.organization_id = :orgId "
        + "AND public.baitly_team_covers(t.id, 'FR', :dept, NULL, NULL)", nativeQuery = true)
    List<Long> findTeamIdsByDepartment(@Param("dept") String department, @Param("orgId") Long orgId);

    @Query(value = "SELECT t.id FROM teams t WHERE t.organization_id = :orgId "
        + "AND public.baitly_team_covers(t.id, 'FR', :dept, :arr, NULL)", nativeQuery = true)
    List<Long> findTeamIdsByDepartmentAndArrondissement(
        @Param("dept") String department, @Param("arr") String arrondissement, @Param("orgId") Long orgId);

    @Query(value = "SELECT t.id FROM teams t WHERE t.organization_id = :orgId "
        + "AND public.baitly_team_covers(t.id, :country, NULL, NULL, :city)", nativeQuery = true)
    List<Long> findTeamIdsByCountryAndCity(
        @Param("country") String country, @Param("city") String city, @Param("orgId") Long orgId);
}
