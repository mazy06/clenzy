package com.clenzy.repository;

import com.clenzy.model.PortfolioClient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface PortfolioClientRepository extends JpaRepository<PortfolioClient, Long> {
    
    // Trouver tous les clients d'un portefeuille
    List<PortfolioClient> findByPortfolioId(Long portfolioId);
    
    // Trouver tous les clients actifs d'un portefeuille
    List<PortfolioClient> findByPortfolioIdAndIsActiveTrue(Long portfolioId);
    
    // Trouver un client spécifique dans un portefeuille
    Optional<PortfolioClient> findByPortfolioIdAndClientId(Long portfolioId, Long clientId);
    
    // Vérifier si un client existe dans un portefeuille
    boolean existsByPortfolioIdAndClientId(Long portfolioId, Long clientId);
    
    // Trouver le portefeuille d'un client
    Optional<PortfolioClient> findByClientIdAndIsActiveTrue(Long clientId);
}
