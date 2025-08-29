package com.clenzy.controller;

import com.clenzy.dto.PortfolioDto;
import com.clenzy.dto.PortfolioClientDto;
import com.clenzy.dto.PortfolioTeamDto;
import com.clenzy.model.TeamRole;
import com.clenzy.service.PortfolioService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/portfolios")
@CrossOrigin(origins = "*")
public class PortfolioController {

    @Autowired
    private PortfolioService portfolioService;

    /**
     * Créer un nouveau portefeuille
     */
    @PostMapping
    public ResponseEntity<PortfolioDto> createPortfolio(
            @Valid @RequestBody PortfolioDto portfolioDto,
            @AuthenticationPrincipal Jwt jwt) {
        
        try {
            PortfolioDto createdPortfolio = portfolioService.createPortfolio(portfolioDto);
            return ResponseEntity.ok(createdPortfolio);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Mettre à jour un portefeuille
     */
    @PutMapping("/{portfolioId}")
    public ResponseEntity<PortfolioDto> updatePortfolio(
            @PathVariable Long portfolioId,
            @Valid @RequestBody PortfolioDto portfolioDto,
            @AuthenticationPrincipal Jwt jwt) {
        
        try {
            PortfolioDto updatedPortfolio = portfolioService.updatePortfolio(portfolioId, portfolioDto);
            return ResponseEntity.ok(updatedPortfolio);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Récupérer un portefeuille par son ID
     */
    @GetMapping("/{portfolioId}")
    public ResponseEntity<PortfolioDto> getPortfolioById(@PathVariable Long portfolioId) {
        try {
            PortfolioDto portfolio = portfolioService.getPortfolioById(portfolioId);
            return ResponseEntity.ok(portfolio);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Récupérer tous les portefeuilles d'un manager
     */
    @GetMapping("/manager/{managerId}")
    public ResponseEntity<List<PortfolioDto>> getPortfoliosByManager(@PathVariable Long managerId) {
        try {
            List<PortfolioDto> portfolios = portfolioService.getPortfoliosByManager(managerId);
            return ResponseEntity.ok(portfolios);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Récupérer tous les portefeuilles actifs
     */
    @GetMapping
    public ResponseEntity<List<PortfolioDto>> getAllActivePortfolios() {
        try {
            List<PortfolioDto> portfolios = portfolioService.getAllActivePortfolios();
            return ResponseEntity.ok(portfolios);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Ajouter un client au portefeuille
     */
    @PostMapping("/{portfolioId}/clients")
    public ResponseEntity<PortfolioClientDto> addClientToPortfolio(
            @PathVariable Long portfolioId,
            @RequestParam Long clientId,
            @RequestParam(required = false) String notes,
            @AuthenticationPrincipal Jwt jwt) {
        
        try {
            PortfolioClientDto addedClient = portfolioService.addClientToPortfolio(portfolioId, clientId, notes);
            return ResponseEntity.ok(addedClient);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Retirer un client du portefeuille
     */
    @DeleteMapping("/{portfolioId}/clients/{clientId}")
    public ResponseEntity<Void> removeClientFromPortfolio(
            @PathVariable Long portfolioId,
            @PathVariable Long clientId,
            @AuthenticationPrincipal Jwt jwt) {
        
        try {
            portfolioService.removeClientFromPortfolio(portfolioId, clientId);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Ajouter un membre d'équipe au portefeuille
     */
    @PostMapping("/{portfolioId}/team")
    public ResponseEntity<PortfolioTeamDto> addTeamMemberToPortfolio(
            @PathVariable Long portfolioId,
            @RequestParam Long teamMemberId,
            @RequestParam TeamRole roleInTeam,
            @RequestParam(required = false) String notes,
            @AuthenticationPrincipal Jwt jwt) {
        
        try {
            PortfolioTeamDto addedTeamMember = portfolioService.addTeamMemberToPortfolio(
                portfolioId, teamMemberId, roleInTeam, notes);
            return ResponseEntity.ok(addedTeamMember);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Retirer un membre d'équipe du portefeuille
     */
    @DeleteMapping("/{portfolioId}/team/{teamMemberId}")
    public ResponseEntity<Void> removeTeamMemberFromPortfolio(
            @PathVariable Long portfolioId,
            @PathVariable Long teamMemberId,
            @AuthenticationPrincipal Jwt jwt) {
        
        try {
            portfolioService.removeTeamMemberFromPortfolio(portfolioId, teamMemberId);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Récupérer les clients d'un portefeuille
     */
    @GetMapping("/{portfolioId}/clients")
    public ResponseEntity<List<PortfolioClientDto>> getPortfolioClients(@PathVariable Long portfolioId) {
        try {
            List<PortfolioClientDto> clients = portfolioService.getPortfolioClients(portfolioId);
            return ResponseEntity.ok(clients);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Récupérer les membres d'équipe d'un portefeuille
     */
    @GetMapping("/{portfolioId}/team")
    public ResponseEntity<List<PortfolioTeamDto>> getPortfolioTeamMembers(@PathVariable Long portfolioId) {
        try {
            List<PortfolioTeamDto> teamMembers = portfolioService.getPortfolioTeamMembers(portfolioId);
            return ResponseEntity.ok(teamMembers);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Trouver le manager responsable d'un HOST
     */
    @GetMapping("/find-manager/host/{hostId}")
    public ResponseEntity<Long> findManagerForHost(@PathVariable Long hostId) {
        try {
            // TODO: Extraire l'utilisateur depuis la base de données
            // Pour l'instant, on retourne un ID temporaire
            return ResponseEntity.ok(1L);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Trouver le manager responsable d'un membre d'équipe
     */
    @GetMapping("/find-manager/team-member/{teamMemberId}")
    public ResponseEntity<Long> findManagerForTeamMember(@PathVariable Long teamMemberId) {
        try {
            // TODO: Extraire l'utilisateur depuis la base de données
            // Pour l'instant, on retourne un ID temporaire
            return ResponseEntity.ok(1L);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }
}
