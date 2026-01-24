package com.clenzy.repository;

import com.clenzy.model.ManagerTeam;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import jakarta.persistence.QueryHint;
import java.util.List;

@Repository
public interface ManagerTeamRepository extends JpaRepository<ManagerTeam, Long> {
    
    /**
     * Requêtes optimisées avec cache
     */
    @Query("SELECT mt FROM ManagerTeam mt WHERE mt.managerId = :managerId AND mt.isActive = true")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<ManagerTeam> findByManagerIdAndIsActiveTrue(@Param("managerId") Long managerId);
    
    @Query("SELECT mt FROM ManagerTeam mt WHERE mt.teamId = :teamId AND mt.isActive = true")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<ManagerTeam> findByTeamIdAndIsActiveTrue(@Param("teamId") Long teamId);
    
    @Query("SELECT mt FROM ManagerTeam mt WHERE mt.managerId = :managerId AND mt.teamId = :teamId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    ManagerTeam findByManagerIdAndTeamId(@Param("managerId") Long managerId, @Param("teamId") Long teamId);
    
    @Query("SELECT mt FROM ManagerTeam mt WHERE mt.managerId = :managerId AND mt.teamId = :teamId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<ManagerTeam> findAllByManagerIdAndTeamId(@Param("managerId") Long managerId, @Param("teamId") Long teamId);
    
    /**
     * Requêtes avec pagination optimisée
     */
    @Query("SELECT mt FROM ManagerTeam mt WHERE mt.managerId = :managerId AND mt.isActive = true")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<ManagerTeam> findByManagerIdAndIsActiveTrueWithPagination(@Param("managerId") Long managerId, Pageable pageable);
    
    @Query("SELECT mt FROM ManagerTeam mt WHERE mt.teamId = :teamId AND mt.isActive = true")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<ManagerTeam> findByTeamIdAndIsActiveTrueWithPagination(@Param("teamId") Long teamId, Pageable pageable);
    
    /**
     * Requêtes de comptage optimisées
     */
    @Query("SELECT COUNT(mt) FROM ManagerTeam mt WHERE mt.managerId = :managerId AND mt.isActive = true")
    long countByManagerIdAndIsActiveTrue(@Param("managerId") Long managerId);
    
    @Query("SELECT COUNT(mt) FROM ManagerTeam mt WHERE mt.teamId = :teamId AND mt.isActive = true")
    long countByTeamIdAndIsActiveTrue(@Param("teamId") Long teamId);
    
    @Query("SELECT COUNT(mt) FROM ManagerTeam mt WHERE mt.managerId = :managerId")
    long countByManagerId(@Param("managerId") Long managerId);
    
    @Query("SELECT COUNT(mt) FROM ManagerTeam mt WHERE mt.teamId = :teamId")
    long countByTeamId(@Param("teamId") Long teamId);
    
    /**
     * Vérifications d'existence optimisées
     */
    @Query("SELECT CASE WHEN COUNT(mt) > 0 THEN true ELSE false END FROM ManagerTeam mt WHERE mt.managerId = :managerId AND mt.teamId = :teamId AND mt.isActive = true")
    boolean existsByManagerIdAndTeamIdAndIsActiveTrue(@Param("managerId") Long managerId, @Param("teamId") Long teamId);
    
    @Query("SELECT CASE WHEN COUNT(mt) > 0 THEN true ELSE false END FROM ManagerTeam mt WHERE mt.managerId = :managerId AND mt.teamId = :teamId")
    boolean existsByManagerIdAndTeamId(@Param("managerId") Long managerId, @Param("teamId") Long teamId);
    
    /**
     * Requêtes pour les IDs seulement
     */
    @Query("SELECT mt.teamId FROM ManagerTeam mt WHERE mt.managerId = :managerId AND mt.isActive = true")
    List<Long> findTeamIdsByManagerIdAndIsActiveTrue(@Param("managerId") Long managerId);
    
    @Query("SELECT mt.managerId FROM ManagerTeam mt WHERE mt.teamId = :teamId AND mt.isActive = true")
    List<Long> findManagerIdsByTeamIdAndIsActiveTrue(@Param("teamId") Long teamId);
}
