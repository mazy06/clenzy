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
    @Query("SELECT pc FROM PortfolioClient pc WHERE pc.portfolio.id = :portfolioId AND pc.isActive = true AND pc.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<PortfolioClient> findByPortfolioIdAndIsActiveTrue(@Param("portfolioId") Long portfolioId, @Param("orgId") Long orgId);

    @Query("SELECT pc FROM PortfolioClient pc WHERE pc.client.id = :clientId AND pc.isActive = true AND pc.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<PortfolioClient> findByClientIdAndIsActiveTrue(@Param("clientId") Long clientId, @Param("orgId") Long orgId);

    @Query("SELECT pc FROM PortfolioClient pc WHERE pc.portfolio.id = :portfolioId AND pc.client.id = :clientId AND pc.isActive = true AND pc.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Optional<PortfolioClient> findByPortfolioIdAndClientIdAndIsActiveTrue(@Param("portfolioId") Long portfolioId, @Param("clientId") Long clientId, @Param("orgId") Long orgId);

    @Query("SELECT pc FROM PortfolioClient pc WHERE pc.portfolio.id = :portfolioId AND pc.client.id = :clientId AND pc.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Optional<PortfolioClient> findByPortfolioIdAndClientId(@Param("portfolioId") Long portfolioId, @Param("clientId") Long clientId, @Param("orgId") Long orgId);

    /**
     * Requêtes avec pagination optimisée
     */
    @Query("SELECT pc FROM PortfolioClient pc WHERE pc.portfolio.id = :portfolioId AND pc.isActive = true AND pc.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<PortfolioClient> findByPortfolioIdAndIsActiveTrueWithPagination(@Param("portfolioId") Long portfolioId, Pageable pageable, @Param("orgId") Long orgId);

    @Query("SELECT pc FROM PortfolioClient pc WHERE pc.client.id = :clientId AND pc.isActive = true AND pc.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<PortfolioClient> findByClientIdAndIsActiveTrueWithPagination(@Param("clientId") Long clientId, Pageable pageable, @Param("orgId") Long orgId);

    /**
     * Requêtes de comptage optimisées
     */
    @Query("SELECT COUNT(pc) FROM PortfolioClient pc WHERE pc.portfolio.id = :portfolioId AND pc.isActive = true AND pc.organizationId = :orgId")
    long countByPortfolioIdAndIsActiveTrue(@Param("portfolioId") Long portfolioId, @Param("orgId") Long orgId);

    @Query("SELECT COUNT(pc) FROM PortfolioClient pc WHERE pc.client.id = :clientId AND pc.isActive = true AND pc.organizationId = :orgId")
    long countByClientIdAndIsActiveTrue(@Param("clientId") Long clientId, @Param("orgId") Long orgId);

    @Query("SELECT COUNT(pc) FROM PortfolioClient pc WHERE pc.portfolio.id = :portfolioId AND pc.organizationId = :orgId")
    long countByPortfolioId(@Param("portfolioId") Long portfolioId, @Param("orgId") Long orgId);

    @Query("SELECT COUNT(pc) FROM PortfolioClient pc WHERE pc.client.id = :clientId AND pc.organizationId = :orgId")
    long countByClientId(@Param("clientId") Long clientId, @Param("orgId") Long orgId);

    /**
     * Vérifications d'existence optimisées
     */
    @Query("SELECT CASE WHEN COUNT(pc) > 0 THEN true ELSE false END FROM PortfolioClient pc WHERE pc.portfolio.id = :portfolioId AND pc.client.id = :clientId AND pc.isActive = true AND pc.organizationId = :orgId")
    boolean existsByPortfolioIdAndClientIdAndIsActiveTrue(@Param("portfolioId") Long portfolioId, @Param("clientId") Long clientId, @Param("orgId") Long orgId);

    @Query("SELECT CASE WHEN COUNT(pc) > 0 THEN true ELSE false END FROM PortfolioClient pc WHERE pc.portfolio.id = :portfolioId AND pc.client.id = :clientId AND pc.organizationId = :orgId")
    boolean existsByPortfolioIdAndClientId(@Param("portfolioId") Long portfolioId, @Param("clientId") Long clientId, @Param("orgId") Long orgId);

    /**
     * Requêtes pour les IDs seulement
     */
    @Query("SELECT pc.client.id FROM PortfolioClient pc WHERE pc.portfolio.id = :portfolioId AND pc.isActive = true AND pc.organizationId = :orgId")
    List<Long> findClientIdsByPortfolioIdAndIsActiveTrue(@Param("portfolioId") Long portfolioId, @Param("orgId") Long orgId);

    @Query("SELECT pc.portfolio.id FROM PortfolioClient pc WHERE pc.client.id = :clientId AND pc.isActive = true AND pc.organizationId = :orgId")
    List<Long> findPortfolioIdsByClientIdAndIsActiveTrue(@Param("clientId") Long clientId, @Param("orgId") Long orgId);
}
