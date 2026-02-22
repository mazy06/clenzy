package com.clenzy.controller;

import com.clenzy.dto.PortfolioDto;
import com.clenzy.dto.PortfolioClientDto;
import com.clenzy.dto.PortfolioStatsDto;
import com.clenzy.dto.PortfolioTeamDto;
import com.clenzy.model.TeamRole;
import com.clenzy.model.User;
import com.clenzy.service.PortfolioService;
import com.clenzy.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.access.AccessDeniedException;

@RestController
@RequestMapping("/api/portfolios")
@PreAuthorize("isAuthenticated()")
public class PortfolioController {

    private final PortfolioService portfolioService;
    private final UserRepository userRepository;

    public PortfolioController(PortfolioService portfolioService,
                               UserRepository userRepository) {
        this.portfolioService = portfolioService;
        this.userRepository = userRepository;
    }

    /**
     * Resout un managerId qui peut etre un Long (ID numerique) ou un UUID Keycloak.
     */
    private Long resolveManagerId(String managerId) {
        try {
            return Long.parseLong(managerId);
        } catch (NumberFormatException e) {
            return userRepository.findByKeycloakId(managerId)
                    .map(User::getId)
                    .orElseThrow(() -> new IllegalArgumentException("Manager non trouve: " + managerId));
        }
    }

    /**
     * Verifie si l'utilisateur authentifie a un role plateforme staff (SUPER_ADMIN, SUPER_MANAGER).
     */
    private boolean isAdminOrManager(Jwt jwt) {
        Map<String, Object> realmAccess = jwt.getClaim("realm_access");
        if (realmAccess == null) return false;
        @SuppressWarnings("unchecked")
        List<String> roles = (List<String>) realmAccess.get("roles");
        return roles != null && (roles.contains("SUPER_ADMIN") || roles.contains("SUPER_MANAGER"));
    }

    /**
     * Verifie que l'utilisateur authentifie est le manager concerne ou un admin plateforme.
     */
    private void validateManagerAccess(Jwt jwt, Long managerId) {
        // Admin plateforme a acces a tout
        Map<String, Object> realmAccess = jwt.getClaim("realm_access");
        if (realmAccess != null) {
            @SuppressWarnings("unchecked")
            List<String> roles = (List<String>) realmAccess.get("roles");
            if (roles != null && roles.contains("SUPER_ADMIN")) return;
        }
        // Le manager ne peut acceder qu'a ses propres portfolios
        String keycloakId = jwt.getSubject();
        User user = userRepository.findByKeycloakId(keycloakId).orElse(null);
        if (user == null || !user.getId().equals(managerId)) {
            throw new AccessDeniedException("Vous n'avez pas acces aux portfolios de ce manager");
        }
    }

    /**
     * Créer un nouveau portefeuille — ADMIN ou MANAGER uniquement
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
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
     * Mettre à jour un portefeuille — ADMIN ou MANAGER uniquement
     */
    @PutMapping("/{portfolioId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
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
     * Récupérer un portefeuille par son ID — ADMIN ou MANAGER uniquement
     */
    @GetMapping("/{portfolioId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<PortfolioDto> getPortfolioById(
            @PathVariable Long portfolioId,
            @AuthenticationPrincipal Jwt jwt) {
        try {
            PortfolioDto portfolio = portfolioService.getPortfolioById(portfolioId);
            return ResponseEntity.ok(portfolio);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Récupérer tous les portefeuilles d'un manager — ownership: son propre ID ou ADMIN
     */
    @GetMapping("/manager/{managerId}")
    public ResponseEntity<List<PortfolioDto>> getPortfoliosByManager(
            @PathVariable String managerId,
            @AuthenticationPrincipal Jwt jwt) {
        try {
            Long resolvedId = resolveManagerId(managerId);
            validateManagerAccess(jwt, resolvedId);
            List<PortfolioDto> portfolios = portfolioService.getPortfoliosByManager(resolvedId);
            return ResponseEntity.ok(portfolios);
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Statistiques des portefeuilles d'un manager — ownership: son propre ID ou ADMIN
     */
    @GetMapping("/manager/{managerId}/stats")
    public ResponseEntity<PortfolioStatsDto> getStatsByManager(
            @PathVariable String managerId,
            @AuthenticationPrincipal Jwt jwt) {
        try {
            Long resolvedId = resolveManagerId(managerId);
            validateManagerAccess(jwt, resolvedId);
            PortfolioStatsDto stats = portfolioService.getStatsByManager(resolvedId);
            return ResponseEntity.ok(stats);
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(403).build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Récupérer tous les portefeuilles actifs — ADMIN uniquement
     */
    @GetMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<List<PortfolioDto>> getAllActivePortfolios() {
        try {
            List<PortfolioDto> portfolios = portfolioService.getAllActivePortfolios();
            return ResponseEntity.ok(portfolios);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Ajouter un client au portefeuille — ADMIN ou MANAGER uniquement
     */
    @PostMapping("/{portfolioId}/clients")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
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
     * Retirer un client du portefeuille — ADMIN ou MANAGER uniquement
     */
    @DeleteMapping("/{portfolioId}/clients/{clientId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
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
     * Ajouter un membre d'équipe au portefeuille — ADMIN ou MANAGER uniquement
     */
    @PostMapping("/{portfolioId}/team")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
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
     * Retirer un membre d'équipe du portefeuille — ADMIN ou MANAGER uniquement
     */
    @DeleteMapping("/{portfolioId}/team/{teamMemberId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
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
     * Récupérer les clients d'un portefeuille — ADMIN ou MANAGER uniquement
     */
    @GetMapping("/{portfolioId}/clients")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<List<PortfolioClientDto>> getPortfolioClients(
            @PathVariable Long portfolioId,
            @AuthenticationPrincipal Jwt jwt) {
        try {
            List<PortfolioClientDto> clients = portfolioService.getPortfolioClients(portfolioId);
            return ResponseEntity.ok(clients);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Récupérer les membres d'équipe d'un portefeuille — ADMIN ou MANAGER uniquement
     */
    @GetMapping("/{portfolioId}/team")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<List<PortfolioTeamDto>> getPortfolioTeamMembers(
            @PathVariable Long portfolioId,
            @AuthenticationPrincipal Jwt jwt) {
        try {
            List<PortfolioTeamDto> teamMembers = portfolioService.getPortfolioTeamMembers(portfolioId);
            return ResponseEntity.ok(teamMembers);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Trouver le manager responsable d'un HOST — ADMIN ou MANAGER uniquement
     */
    @GetMapping("/find-manager/host/{hostId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
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
     * Trouver le manager responsable d'un membre d'équipe — ADMIN ou MANAGER uniquement
     */
    @GetMapping("/find-manager/team-member/{teamMemberId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
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
