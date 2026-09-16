package com.clenzy.repository;

import com.clenzy.model.TeamWeeklyAvailability;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TeamWeeklyAvailabilityRepository extends JpaRepository<TeamWeeklyAvailability, Long> {

    List<TeamWeeklyAvailability> findByTeamIdOrderByDayOfWeekAscStartTimeAsc(Long teamId);

    /** Verdict seul : ni horaires ni motifs d'absence d'une autre organisation. */
    @Query(value = "SELECT public.baitly_team_declared_available(:teamId, :start, :finish)", nativeQuery = true)
    boolean isDeclaredAvailable(@Param("teamId") Long teamId,
                               @Param("start") java.time.LocalDateTime start,
                               @Param("finish") java.time.LocalDateTime finish);

    @Query(value = "SELECT public.baitly_user_declared_available(:userId, :start, :finish)", nativeQuery = true)
    boolean isUserDeclaredAvailable(@Param("userId") Long userId,
                                   @Param("start") java.time.LocalDateTime start,
                                   @Param("finish") java.time.LocalDateTime finish);

    @Modifying
    @Query("DELETE FROM TeamWeeklyAvailability a WHERE a.teamId = :teamId AND a.organizationId = :orgId")
    void deleteByTeamIdAndOrganizationId(@Param("teamId") Long teamId, @Param("orgId") Long orgId);
}
