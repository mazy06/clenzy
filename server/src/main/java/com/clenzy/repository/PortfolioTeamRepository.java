package com.clenzy.repository;

import com.clenzy.model.PortfolioTeam;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface PortfolioTeamRepository extends JpaRepository<PortfolioTeam, Long> {
    
    // Trouver tous les membres d'équipe d'un portefeuille
    List<PortfolioTeam> findByPortfolioId(Long portfolioId);
    
    // Trouver tous les membres d'équipe actifs d'un portefeuille
    List<PortfolioTeam> findByPortfolioIdAndIsActiveTrue(Long portfolioId);
    
    // Trouver un membre d'équipe spécifique dans un portefeuille
    Optional<PortfolioTeam> findByPortfolioIdAndTeamMemberId(Long portfolioId, Long teamMemberId);
    
    // Vérifier si un membre d'équipe existe dans un portefeuille
    boolean existsByPortfolioIdAndTeamMemberId(Long portfolioId, Long teamMemberId);
    
    // Trouver le portefeuille d'un membre d'équipe
    Optional<PortfolioTeam> findByTeamMemberIdAndIsActiveTrue(Long teamMemberId);
    
    // Trouver les membres d'équipe par rôle
    List<PortfolioTeam> findByPortfolioIdAndRoleInTeam(Long portfolioId, String roleInTeam);
}
