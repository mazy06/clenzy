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

    @Modifying
    @Query("DELETE FROM TeamWeeklyAvailability a WHERE a.teamId = :teamId AND a.organizationId = :orgId")
    void deleteByTeamIdAndOrganizationId(@Param("teamId") Long teamId, @Param("orgId") Long orgId);
}
