package com.clenzy.repository;

import com.clenzy.model.PortfolioClient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PortfolioClientRepository extends JpaRepository<PortfolioClient, Long> {
    
    /**
     * Trouver tous les clients assignés à un portefeuille
     */
    List<PortfolioClient> findByPortfolioIdAndIsActiveTrue(Long portfolioId);
    
    /**
     * Trouver tous les portefeuilles d'un client
     */
    List<PortfolioClient> findByClientIdAndIsActiveTrue(Long clientId);
    
    /**
     * Vérifier si un client est assigné à un portefeuille spécifique
     */
    boolean existsByPortfolioIdAndClientIdAndIsActiveTrue(Long portfolioId, Long clientId);
    
    /**
     * Vérifier si un client est assigné à un portefeuille spécifique (sans vérifier isActive)
     */
    boolean existsByPortfolioIdAndClientId(Long portfolioId, Long clientId);
    
    /**
     * Trouver l'assignation d'un client à un portefeuille
     */
    Optional<PortfolioClient> findByPortfolioIdAndClientIdAndIsActiveTrue(Long portfolioId, Long clientId);
    
    /**
     * Trouver l'assignation d'un client à un portefeuille (sans vérifier isActive)
     */
    Optional<PortfolioClient> findByPortfolioIdAndClientId(Long portfolioId, Long clientId);
}