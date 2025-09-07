package com.clenzy.repository;

import com.clenzy.model.ManagerTeam;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ManagerTeamRepository extends JpaRepository<ManagerTeam, Long> {
    
    @Query("SELECT mt FROM ManagerTeam mt WHERE mt.managerId = :managerId AND mt.isActive = true")
    List<ManagerTeam> findByManagerIdAndIsActiveTrue(@Param("managerId") Long managerId);
    
    @Query("SELECT mt FROM ManagerTeam mt WHERE mt.teamId = :teamId AND mt.isActive = true")
    List<ManagerTeam> findByTeamIdAndIsActiveTrue(@Param("teamId") Long teamId);
    
    @Query("SELECT CASE WHEN COUNT(mt) > 0 THEN true ELSE false END FROM ManagerTeam mt WHERE mt.managerId = :managerId AND mt.teamId = :teamId AND mt.isActive = true")
    boolean existsByManagerIdAndTeamIdAndIsActiveTrue(@Param("managerId") Long managerId, @Param("teamId") Long teamId);
    
    @Query("SELECT mt FROM ManagerTeam mt WHERE mt.managerId = :managerId AND mt.teamId = :teamId")
    ManagerTeam findByManagerIdAndTeamId(@Param("managerId") Long managerId, @Param("teamId") Long teamId);
    
    @Query("SELECT mt FROM ManagerTeam mt WHERE mt.managerId = :managerId AND mt.teamId = :teamId")
    List<ManagerTeam> findAllByManagerIdAndTeamId(@Param("managerId") Long managerId, @Param("teamId") Long teamId);
}
