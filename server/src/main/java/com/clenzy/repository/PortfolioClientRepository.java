package com.clenzy.repository;

import com.clenzy.model.PortfolioClient;
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
public interface PortfolioClientRepository extends JpaRepository<PortfolioClient, Long> {
    
    /**
     * Requêtes optimisées avec cache
     */
    @Query("SELECT pc FROM PortfolioClient pc WHERE pc.portfolio.id = :portfolioId AND pc.isActive = true")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<PortfolioClient> findByPortfolioIdAndIsActiveTrue(@Param("portfolioId") Long portfolioId);
    
    @Query("SELECT pc FROM PortfolioClient pc WHERE pc.client.id = :clientId AND pc.isActive = true")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<PortfolioClient> findByClientIdAndIsActiveTrue(@Param("clientId") Long clientId);
    
    @Query("SELECT pc FROM PortfolioClient pc WHERE pc.portfolio.id = :portfolioId AND pc.client.id = :clientId AND pc.isActive = true")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Optional<PortfolioClient> findByPortfolioIdAndClientIdAndIsActiveTrue(@Param("portfolioId") Long portfolioId, @Param("clientId") Long clientId);
    
    @Query("SELECT pc FROM PortfolioClient pc WHERE pc.portfolio.id = :portfolioId AND pc.client.id = :clientId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Optional<PortfolioClient> findByPortfolioIdAndClientId(@Param("portfolioId") Long portfolioId, @Param("clientId") Long clientId);
    
    /**
     * Requêtes avec pagination optimisée
     */
    @Query("SELECT pc FROM PortfolioClient pc WHERE pc.portfolio.id = :portfolioId AND pc.isActive = true")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<PortfolioClient> findByPortfolioIdAndIsActiveTrueWithPagination(@Param("portfolioId") Long portfolioId, Pageable pageable);
    
    @Query("SELECT pc FROM PortfolioClient pc WHERE pc.client.id = :clientId AND pc.isActive = true")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<PortfolioClient> findByClientIdAndIsActiveTrueWithPagination(@Param("clientId") Long clientId, Pageable pageable);
    
    /**
     * Requêtes de comptage optimisées
     */
    @Query("SELECT COUNT(pc) FROM PortfolioClient pc WHERE pc.portfolio.id = :portfolioId AND pc.isActive = true")
    long countByPortfolioIdAndIsActiveTrue(@Param("portfolioId") Long portfolioId);
    
    @Query("SELECT COUNT(pc) FROM PortfolioClient pc WHERE pc.client.id = :clientId AND pc.isActive = true")
    long countByClientIdAndIsActiveTrue(@Param("clientId") Long clientId);
    
    @Query("SELECT COUNT(pc) FROM PortfolioClient pc WHERE pc.portfolio.id = :portfolioId")
    long countByPortfolioId(@Param("portfolioId") Long portfolioId);
    
    @Query("SELECT COUNT(pc) FROM PortfolioClient pc WHERE pc.client.id = :clientId")
    long countByClientId(@Param("clientId") Long clientId);
    
    /**
     * Vérifications d'existence optimisées
     */
    @Query("SELECT CASE WHEN COUNT(pc) > 0 THEN true ELSE false END FROM PortfolioClient pc WHERE pc.portfolio.id = :portfolioId AND pc.client.id = :clientId AND pc.isActive = true")
    boolean existsByPortfolioIdAndClientIdAndIsActiveTrue(@Param("portfolioId") Long portfolioId, @Param("clientId") Long clientId);
    
    @Query("SELECT CASE WHEN COUNT(pc) > 0 THEN true ELSE false END FROM PortfolioClient pc WHERE pc.portfolio.id = :portfolioId AND pc.client.id = :clientId")
    boolean existsByPortfolioIdAndClientId(@Param("portfolioId") Long portfolioId, @Param("clientId") Long clientId);
    
    /**
     * Requêtes pour les IDs seulement
     */
    @Query("SELECT pc.client.id FROM PortfolioClient pc WHERE pc.portfolio.id = :portfolioId AND pc.isActive = true")
    List<Long> findClientIdsByPortfolioIdAndIsActiveTrue(@Param("portfolioId") Long portfolioId);
    
    @Query("SELECT pc.portfolio.id FROM PortfolioClient pc WHERE pc.client.id = :clientId AND pc.isActive = true")
    List<Long> findPortfolioIdsByClientIdAndIsActiveTrue(@Param("clientId") Long clientId);
}