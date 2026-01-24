package com.clenzy.repository;

import com.clenzy.model.PortfolioTeam;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import jakarta.persistence.QueryHint;
import java.util.List;
import java.util.Optional;

@Repository
public interface PortfolioTeamRepository extends JpaRepository<PortfolioTeam, Long> {
    
    /**
     * Requêtes optimisées avec cache
     */
    @Query("SELECT pt FROM PortfolioTeam pt WHERE pt.portfolio.id = :portfolioId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<PortfolioTeam> findByPortfolioId(@Param("portfolioId") Long portfolioId);
    
    @Query("SELECT pt FROM PortfolioTeam pt WHERE pt.portfolio.id = :portfolioId AND pt.isActive = true")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<PortfolioTeam> findByPortfolioIdAndIsActiveTrue(@Param("portfolioId") Long portfolioId);
    
    @Query("SELECT pt FROM PortfolioTeam pt WHERE pt.portfolio.id = :portfolioId AND pt.teamMember.id = :teamMemberId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Optional<PortfolioTeam> findByPortfolioIdAndTeamMemberId(@Param("portfolioId") Long portfolioId, @Param("teamMemberId") Long teamMemberId);
    
    @Query("SELECT pt FROM PortfolioTeam pt WHERE pt.teamMember.id = :teamMemberId AND pt.isActive = true")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Optional<PortfolioTeam> findByTeamMemberIdAndIsActiveTrue(@Param("teamMemberId") Long teamMemberId);
    
    @Query("SELECT pt FROM PortfolioTeam pt WHERE pt.portfolio.id = :portfolioId AND pt.roleInTeam = :roleInTeam")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<PortfolioTeam> findByPortfolioIdAndRoleInTeam(@Param("portfolioId") Long portfolioId, @Param("roleInTeam") String roleInTeam);
    
    /**
     * Requêtes avec pagination optimisée
     */
    @Query("SELECT pt FROM PortfolioTeam pt WHERE pt.portfolio.id = :portfolioId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<PortfolioTeam> findByPortfolioIdWithPagination(@Param("portfolioId") Long portfolioId, Pageable pageable);
    
    @Query("SELECT pt FROM PortfolioTeam pt WHERE pt.portfolio.id = :portfolioId AND pt.isActive = true")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<PortfolioTeam> findByPortfolioIdAndIsActiveTrueWithPagination(@Param("portfolioId") Long portfolioId, Pageable pageable);
    
    @Query("SELECT pt FROM PortfolioTeam pt WHERE pt.portfolio.id = :portfolioId AND pt.roleInTeam = :roleInTeam")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<PortfolioTeam> findByPortfolioIdAndRoleInTeamWithPagination(@Param("portfolioId") Long portfolioId, @Param("roleInTeam") String roleInTeam, Pageable pageable);
    
    /**
     * Requêtes de comptage optimisées
     */
    @Query("SELECT COUNT(pt) FROM PortfolioTeam pt WHERE pt.portfolio.id = :portfolioId")
    long countByPortfolioId(@Param("portfolioId") Long portfolioId);
    
    @Query("SELECT COUNT(pt) FROM PortfolioTeam pt WHERE pt.portfolio.id = :portfolioId AND pt.isActive = true")
    long countByPortfolioIdAndIsActiveTrue(@Param("portfolioId") Long portfolioId);
    
    @Query("SELECT COUNT(pt) FROM PortfolioTeam pt WHERE pt.teamMember.id = :teamMemberId AND pt.isActive = true")
    long countByTeamMemberIdAndIsActiveTrue(@Param("teamMemberId") Long teamMemberId);
    
    @Query("SELECT COUNT(pt) FROM PortfolioTeam pt WHERE pt.portfolio.id = :portfolioId AND pt.roleInTeam = :roleInTeam")
    long countByPortfolioIdAndRoleInTeam(@Param("portfolioId") Long portfolioId, @Param("roleInTeam") String roleInTeam);
    
    /**
     * Vérifications d'existence optimisées
     */
    @Query("SELECT CASE WHEN COUNT(pt) > 0 THEN true ELSE false END FROM PortfolioTeam pt WHERE pt.portfolio.id = :portfolioId AND pt.teamMember.id = :teamMemberId")
    boolean existsByPortfolioIdAndTeamMemberId(@Param("portfolioId") Long portfolioId, @Param("teamMemberId") Long teamMemberId);
    
    @Query("SELECT CASE WHEN COUNT(pt) > 0 THEN true ELSE false END FROM PortfolioTeam pt WHERE pt.portfolio.id = :portfolioId AND pt.teamMember.id = :teamMemberId AND pt.isActive = true")
    boolean existsByPortfolioIdAndTeamMemberIdAndIsActiveTrue(@Param("portfolioId") Long portfolioId, @Param("teamMemberId") Long teamMemberId);
    
    /**
     * Requêtes pour les IDs seulement
     */
    @Query("SELECT pt.teamMember.id FROM PortfolioTeam pt WHERE pt.portfolio.id = :portfolioId AND pt.isActive = true")
    List<Long> findTeamMemberIdsByPortfolioIdAndIsActiveTrue(@Param("portfolioId") Long portfolioId);
    
    @Query("SELECT pt.portfolio.id FROM PortfolioTeam pt WHERE pt.teamMember.id = :teamMemberId AND pt.isActive = true")
    List<Long> findPortfolioIdsByTeamMemberIdAndIsActiveTrue(@Param("teamMemberId") Long teamMemberId);
}
