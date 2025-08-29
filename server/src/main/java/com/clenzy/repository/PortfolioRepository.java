package com.clenzy.repository;

import com.clenzy.model.Portfolio;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PortfolioRepository extends JpaRepository<Portfolio, Long> {
    
    // Trouver tous les portefeuilles d'un manager
    List<Portfolio> findByManagerId(Long managerId);
    
    // Trouver tous les portefeuilles actifs
    List<Portfolio> findByIsActiveTrue();
    
    // Trouver tous les portefeuilles d'un manager actifs
    List<Portfolio> findByManagerIdAndIsActiveTrue(Long managerId);
}
