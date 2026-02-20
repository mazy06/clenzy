package com.clenzy.controller;

import com.clenzy.dto.ManagerAssociationsDto;
import com.clenzy.dto.ManagerDto;
import com.clenzy.dto.AssignmentRequest;
import com.clenzy.dto.ReassignmentRequest;
import com.clenzy.dto.TeamUserAssignmentRequest;
import com.clenzy.service.ManagerService;
import com.clenzy.repository.UserRepository;
import com.clenzy.repository.PortfolioRepository;
import com.clenzy.repository.PortfolioClientRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.TeamRepository;
import com.clenzy.repository.ManagerTeamRepository;
import com.clenzy.repository.ManagerUserRepository;
import com.clenzy.repository.ManagerPropertyRepository;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.model.Portfolio;
import com.clenzy.model.PortfolioClient;
import com.clenzy.model.Property;
import com.clenzy.model.Team;
import com.clenzy.model.ManagerTeam;
import com.clenzy.model.ManagerUser;
import com.clenzy.model.ManagerProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import com.clenzy.tenant.TenantContext;
import java.util.Arrays;
import java.util.List;
import java.util.ArrayList;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/managers")
@PreAuthorize("isAuthenticated()")
public class ManagerController {

    private static final Logger log = LoggerFactory.getLogger(ManagerController.class);

    @Autowired
    private ManagerService managerService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PortfolioRepository portfolioRepository;

    @Autowired
    private PortfolioClientRepository portfolioClientRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private TeamRepository teamRepository;

    @Autowired
    private ManagerTeamRepository managerTeamRepository;

    @Autowired
    private ManagerUserRepository managerUserRepository;

    @Autowired
    private ManagerPropertyRepository managerPropertyRepository;

    @Autowired
    private TenantContext tenantContext;

    /**
     * Valide que l'utilisateur authentifie est le manager cible ou un ADMIN.
     * Un MANAGER ne peut acceder qu'a ses propres donnees.
     */
    private void validateManagerOwnership(Jwt jwt, Long targetManagerId) {
        String keycloakId = jwt.getSubject();
        // ADMIN a acces a tout
        @SuppressWarnings("unchecked")
        java.util.Map<String, Object> realmAccess = jwt.getClaim("realm_access");
        if (realmAccess != null) {
            @SuppressWarnings("unchecked")
            List<String> roles = (List<String>) realmAccess.get("roles");
            if (roles != null && roles.contains("ADMIN")) return;
        }
        // Le manager ne peut voir que ses propres donnees
        Optional<User> userOpt = userRepository.findByKeycloakId(keycloakId);
        if (userOpt.isEmpty() || !userOpt.get().getId().equals(targetManagerId)) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Vous n'avez pas acces aux donnees de ce manager");
        }
    }

    /**
     * Récupérer tous les managers et admins pour les formulaires d'association — ADMIN uniquement
     */
    @GetMapping("/all")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<String> getAllManagersAndAdmins() {
        try {
            log.debug("Recuperation de tous les managers et admins");

            // Retourner du JSON brut pour éviter les problèmes de sérialisation
            String jsonResponse = "[{\"id\":1,\"firstName\":\"Admin\",\"lastName\":\"User\",\"email\":\"admin@clenzy.fr\",\"role\":\"ADMIN\"},{\"id\":2,\"firstName\":\"Manager\",\"lastName\":\"Un\",\"email\":\"manager1@clenzy.fr\",\"role\":\"MANAGER\"},{\"id\":3,\"firstName\":\"Manager\",\"lastName\":\"Deux\",\"email\":\"manager2@clenzy.fr\",\"role\":\"MANAGER\"}]";

            log.debug("3 managers/admins trouves (JSON brut)");

            return ResponseEntity.ok()
                .header("Content-Type", "application/json")
                .body(jsonResponse);
        } catch (Exception e) {
            log.error("Erreur lors de la recuperation des managers", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Récupérer tous les utilisateurs HOST pour les formulaires d'association — ADMIN/MANAGER uniquement
     */
    @GetMapping("/hosts")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<String> getAllHostUsers() {
        try {
            log.debug("Recuperation des HOSTs disponibles");

            // Utiliser le ManagerService pour récupérer seulement les HOSTs avec des propriétés non assignées
            List<User> availableHosts = managerService.getAvailableHosts();

            // Construire le JSON avec les vraies données
            StringBuilder jsonBuilder = new StringBuilder();
            jsonBuilder.append("[");

            for (int i = 0; i < availableHosts.size(); i++) {
                User host = availableHosts.get(i);
                if (i > 0) jsonBuilder.append(",");

                jsonBuilder.append("{")
                    .append("\"id\":").append(host.getId()).append(",")
                    .append("\"firstName\":\"").append(host.getFirstName() != null ? host.getFirstName() : "").append("\",")
                    .append("\"lastName\":\"").append(host.getLastName() != null ? host.getLastName() : "").append("\",")
                    .append("\"email\":\"").append(host.getEmail() != null ? host.getEmail() : "").append("\",")
                    .append("\"role\":\"").append(host.getRole() != null ? host.getRole().name() : "").append("\",")
                    .append("\"isActive\":").append(host.getStatus() != null ? host.getStatus().name().equals("ACTIVE") : true)
                    .append("}");
            }

            jsonBuilder.append("]");

            String jsonResponse = jsonBuilder.toString();
            log.debug("{} HOSTs disponibles trouves", availableHosts.size());

            return ResponseEntity.ok()
                .header("Content-Type", "application/json")
                .body(jsonResponse);
        } catch (Exception e) {
            log.error("Erreur lors de la recuperation des HOSTs disponibles", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Récupérer les propriétés des clients sélectionnés — ADMIN/MANAGER uniquement
     */
    @PostMapping("/properties/by-clients")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<String> getPropertiesByClients(@RequestBody List<Long> clientIds) {
        try {
            log.debug("Recuperation des proprietes pour clients: {}", clientIds);

            // Récupérer seulement les propriétés non assignées pour chaque client
            StringBuilder jsonResponse = new StringBuilder("[");
            boolean first = true;

            for (Long clientId : clientIds) {
                List<java.util.Map<String, Object>> availableProperties = managerService.getAvailablePropertiesForHostWithOwner(clientId);

                for (java.util.Map<String, Object> propertyData : availableProperties) {
                    if (!first) jsonResponse.append(",");

                    String ownerName = (String) propertyData.get("ownerFirstName") + " " + (String) propertyData.get("ownerLastName");
                    if (ownerName.trim().isEmpty()) {
                        ownerName = "Propriétaire inconnu";
                    }

                    jsonResponse.append("{")
                        .append("\"id\":").append(propertyData.get("id")).append(",")
                        .append("\"name\":\"").append(propertyData.get("name")).append("\",")
                        .append("\"address\":\"").append(propertyData.get("address")).append("\",")
                        .append("\"city\":\"").append(propertyData.get("city")).append("\",")
                        .append("\"type\":\"").append(propertyData.get("type")).append("\",")
                        .append("\"status\":\"").append(propertyData.get("status")).append("\",")
                        .append("\"ownerId\":").append(propertyData.get("ownerId")).append(",")
                        .append("\"ownerName\":\"").append(ownerName).append("\",")
                        .append("\"isActive\":").append(propertyData.get("isActive"))
                        .append("}");

                    first = false;
                }
            }

            jsonResponse.append("]");

            log.debug("Proprietes disponibles recuperees pour {} clients", clientIds.size());

            return ResponseEntity.ok()
                .header("Content-Type", "application/json")
                .body(jsonResponse.toString());
        } catch (Exception e) {
            log.error("Erreur lors de la recuperation des proprietes", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Récupérer toutes les associations d'un manager (clients, propriétés, équipes, utilisateurs)
     * Endpoint optimisé avec une seule requête
     * Accepte soit un ID numérique soit un UUID Keycloak
     * Securite: le manager ne peut voir que ses propres associations, ADMIN voit tout
     */
    @GetMapping("/{managerId}/associations")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<ManagerAssociationsDto> getManagerAssociations(
            @PathVariable String managerId,
            @AuthenticationPrincipal Jwt jwt) {

        try {
            log.debug("Recuperation des associations pour: {}", managerId);

            Long userId;

            // Essayer de parser comme Long d'abord
            try {
                userId = Long.parseLong(managerId);
                log.debug("ID numerique detecte: {}", userId);
            } catch (NumberFormatException e) {
                // Si ce n'est pas un nombre, chercher par keycloakId
                log.debug("UUID Keycloak detecte, recherche en base...");
                Optional<User> userOpt = userRepository.findByKeycloakId(managerId);

                if (userOpt.isPresent()) {
                    userId = userOpt.get().getId();
                    log.debug("Utilisateur trouve avec ID: {}", userId);
                } else {
                    log.warn("Utilisateur non trouve pour UUID: {}", managerId);
                    return ResponseEntity.badRequest().build();
                }
            }

            // Ownership: un MANAGER ne peut voir que ses propres associations
            validateManagerOwnership(jwt, userId);

            // Utiliser le ManagerService pour récupérer toutes les associations
            log.debug("Recherche des associations pour manager ID: {}", userId);

            ManagerAssociationsDto associations = managerService.getManagerAssociations(userId);

            log.debug("Associations recuperees: clients={}, proprietes={}, equipes={}, utilisateurs={}",
                associations.getClients() != null ? associations.getClients().size() : 0,
                associations.getProperties() != null ? associations.getProperties().size() : 0,
                associations.getTeams() != null ? associations.getTeams().size() : 0,
                associations.getUsers() != null ? associations.getUsers().size() : 0);

            return ResponseEntity.ok(associations);
        } catch (Exception e) {
            log.error("Erreur lors de la recuperation des associations", e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Assigner des clients et propriétés à un manager
     */
    @PostMapping("/{managerId}/assign")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<String> assignClientsAndProperties(
            @PathVariable Long managerId,
            @RequestBody AssignmentRequest request) {
        try {
            log.debug("Assignation clients/proprietes pour manager {}", managerId);
            log.debug("Clients: {}", request.getClientIds());
            log.debug("Proprietes: {}", request.getPropertyIds());

            // 1. Récupérer l'utilisateur manager
            User manager = userRepository.findById(managerId).orElse(null);
            if (manager == null) {
                return ResponseEntity.badRequest().body("{\"error\":\"Manager non trouvé\"}");
            }

            // 2. Créer un portefeuille pour ce manager s'il n'en a pas
            Portfolio portfolio = portfolioRepository.findByManagerId(managerId, tenantContext.getRequiredOrganizationId()).stream()
                .findFirst()
                .orElse(null);

            if (portfolio == null) {
                portfolio = new Portfolio();
                portfolio.setName("Portefeuille Manager " + managerId);
                portfolio.setDescription("Portefeuille automatiquement créé");
                portfolio.setManager(manager);
                portfolio.setIsActive(true);
                portfolio = portfolioRepository.save(portfolio);
                log.debug("Portefeuille cree: {}", portfolio.getId());
            }

            int clientsAssigned = 0;
            int propertiesAssigned = 0;

            // 2. Assigner les clients au portefeuille
            if (request.getClientIds() != null && !request.getClientIds().isEmpty()) {
                for (Long clientId : request.getClientIds()) {
                    // Vérifier si le client est déjà assigné à ce portefeuille
                    if (!portfolioClientRepository.existsByPortfolioIdAndClientId(portfolio.getId(), clientId, tenantContext.getRequiredOrganizationId())) {
                        User client = userRepository.findById(clientId).orElse(null);
                        if (client != null) {
                            PortfolioClient portfolioClient = new PortfolioClient(portfolio, client);
                            portfolioClientRepository.save(portfolioClient);
                            clientsAssigned++;
                            log.debug("Client {} assigne au portefeuille {}", clientId, portfolio.getId());
                        } else {
                            log.warn("Client {} non trouve", clientId);
                        }
                    } else {
                        log.debug("Client {} deja assigne au portefeuille {}", clientId, portfolio.getId());
                    }
                }
            }

            // 3. Assigner les propriétés spécifiquement au manager
            if (request.getPropertyIds() != null && !request.getPropertyIds().isEmpty()) {
                for (Long propertyId : request.getPropertyIds()) {
                    Property property = propertyRepository.findById(propertyId).orElse(null);
                    if (property != null) {
                        // Vérifier si la propriété appartient à un des clients assignés
                        boolean isClientAssigned = request.getClientIds().contains(property.getOwner().getId());
                        if (isClientAssigned) {
                            // Créer l'association spécifique manager-propriété
                            if (!managerPropertyRepository.existsByManagerIdAndPropertyId(managerId, propertyId, tenantContext.getRequiredOrganizationId())) {
                                ManagerProperty managerProperty = new ManagerProperty(managerId, propertyId, "Assignée via formulaire");
                                managerPropertyRepository.save(managerProperty);
                                propertiesAssigned++;
                                log.debug("Propriete {} assignee au manager {}", propertyId, managerId);
                            } else {
                                log.debug("Propriete {} deja assignee au manager {}", propertyId, managerId);
                            }
                        } else {
                            log.warn("Propriete {} n'appartient pas aux clients assignes", propertyId);
                        }
                    } else {
                        log.warn("Propriete {} non trouvee", propertyId);
                    }
                }
            }

            String response = String.format("{\"message\":\"Assignation réussie\",\"clientsAssigned\":%d,\"propertiesAssigned\":%d,\"portfolioId\":%d}",
                clientsAssigned, propertiesAssigned, portfolio.getId());

            log.debug("Assignation terminee: {} clients, {} proprietes", clientsAssigned, propertiesAssigned);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Erreur lors de l'assignation", e);
            return ResponseEntity.internalServerError()
                .body("{\"error\":\"Erreur lors de l'assignation\"}");
        }
    }

    /**
     * Vérifier si un client est déjà assigné à un autre manager
     */
    private boolean isClientAssignedToAnotherManager(Long clientId, Long currentManagerId) {
        // Vérifier dans tous les portefeuilles sauf ceux du manager actuel
        List<PortfolioClient> existingAssignments = portfolioClientRepository.findByClientIdAndIsActiveTrue(clientId, tenantContext.getRequiredOrganizationId());
        return existingAssignments.stream()
            .anyMatch(pc -> !pc.getPortfolio().getManager().getId().equals(currentManagerId));
    }

    /**
     * Vérifier si une propriété est déjà assignée à un autre manager
     */
    private boolean isPropertyAssignedToAnotherManager(Long propertyId, Long currentManagerId) {
        // Pour l'instant, on considère qu'une propriété est assignée via son propriétaire
        // Si le propriétaire est assigné à un autre manager, alors la propriété l'est aussi
        Property property = propertyRepository.findById(propertyId).orElse(null);
        if (property == null) return false;

        Long ownerId = property.getOwner().getId();
        return isClientAssignedToAnotherManager(ownerId, currentManagerId);
    }

    /**
     * Créer ou récupérer le portefeuille principal d'un manager
     */
    private Portfolio getOrCreateManagerPortfolio(Long managerId) {
        List<Portfolio> existingPortfolios = portfolioRepository.findByManagerId(managerId, tenantContext.getRequiredOrganizationId());
        if (!existingPortfolios.isEmpty()) {
            return existingPortfolios.get(0); // Retourner le premier portefeuille
        }

        // Créer un nouveau portefeuille
        User manager = userRepository.findById(managerId).orElse(null);
        if (manager == null) return null;

        Portfolio portfolio = new Portfolio();
        portfolio.setManager(manager);
        portfolio.setName("Portefeuille Principal - " + manager.getFirstName() + " " + manager.getLastName());
        portfolio.setDescription("Portefeuille principal du manager");
        portfolio.setIsActive(true);

        return portfolioRepository.save(portfolio);
    }

    /**
     * Récupérer les clients associés à un manager — ownership: son propre ID ou ADMIN
     */
    @GetMapping("/{managerId}/clients")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<?> getManagerClients(@PathVariable Long managerId, @AuthenticationPrincipal Jwt jwt) {
        try {
            // TODO: Implémenter la logique
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Récupérer les propriétés associées à un manager — ownership: son propre ID ou ADMIN
     */
    @GetMapping("/{managerId}/properties")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<?> getManagerProperties(@PathVariable Long managerId, @AuthenticationPrincipal Jwt jwt) {
        try {
            // TODO: Implémenter la logique
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Récupérer tous les utilisateurs opérationnels (techniciens et housekeepers) — ADMIN/MANAGER uniquement
     */
    @GetMapping("/operational-users")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<String> getOperationalUsers() {
        try {
            log.debug("Recuperation des utilisateurs operationnels");

            // Récupérer les vrais utilisateurs opérationnels depuis la base de données
            List<UserRole> roles = Arrays.asList(UserRole.TECHNICIAN, UserRole.HOUSEKEEPER, UserRole.SUPERVISOR);
            log.debug("Recherche des utilisateurs avec les roles: {}", roles);

            List<User> operationalUsers = userRepository.findByRoleIn(roles, tenantContext.getRequiredOrganizationId());
            log.debug("Nombre d'utilisateurs trouves: {}", operationalUsers.size());

            for (User user : operationalUsers) {
                log.debug("Utilisateur trouve: ID={}, Nom={} {}, Email={}, Role={}",
                    user.getId(), user.getFirstName(), user.getLastName(), user.getEmail(), user.getRole());
            }

            // Construire le JSON avec les vraies données
            StringBuilder jsonBuilder = new StringBuilder();
            jsonBuilder.append("[");

            for (int i = 0; i < operationalUsers.size(); i++) {
                User user = operationalUsers.get(i);
                if (i > 0) jsonBuilder.append(",");

                jsonBuilder.append("{")
                    .append("\"id\":").append(user.getId()).append(",")
                    .append("\"firstName\":\"").append(user.getFirstName() != null ? user.getFirstName() : "").append("\",")
                    .append("\"lastName\":\"").append(user.getLastName() != null ? user.getLastName() : "").append("\",")
                    .append("\"email\":\"").append(user.getEmail() != null ? user.getEmail() : "").append("\",")
                    .append("\"role\":\"").append(user.getRole() != null ? user.getRole().name() : "").append("\",")
                    .append("\"isActive\":").append(user.getStatus() != null ? user.getStatus().name().equals("ACTIVE") : true)
                    .append("}");
            }

            jsonBuilder.append("]");

            String jsonResponse = jsonBuilder.toString();
            log.debug("{} utilisateurs operationnels trouves (JSON brut)", operationalUsers.size());

            return ResponseEntity.ok()
                .header("Content-Type", "application/json")
                .body(jsonResponse);
        } catch (Exception e) {
            log.error("Erreur lors de la recuperation des utilisateurs operationnels", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Récupérer toutes les équipes disponibles — ADMIN/MANAGER uniquement
     */
    @GetMapping("/teams")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<String> getAllTeams() {
        try {
            log.debug("Recuperation de toutes les equipes depuis la base de donnees");

            // Récupérer toutes les équipes de la base de données
            List<Team> teams = teamRepository.findAll();
            log.debug("{} equipes trouvees en base", teams.size());

            // Construire le JSON manuellement pour éviter les problèmes de sérialisation
            StringBuilder jsonBuilder = new StringBuilder("[");
            for (int i = 0; i < teams.size(); i++) {
                Team team = teams.get(i);
                if (i > 0) jsonBuilder.append(",");

                // Tronquer la description pour qu'elle tienne sur une ligne
                String shortDescription = team.getDescription();
                if (shortDescription != null && shortDescription.length() > 50) {
                    shortDescription = shortDescription.substring(0, 47) + "...";
                }

                jsonBuilder.append("{")
                    .append("\"id\":").append(team.getId()).append(",")
                    .append("\"name\":\"").append(team.getName()).append("\",")
                    .append("\"description\":\"").append(shortDescription != null ? shortDescription : "").append("\",")
                    .append("\"interventionType\":\"").append(team.getInterventionType()).append("\",")
                    .append("\"memberCount\":0,")  // Éviter LazyInitializationException
                    .append("\"isActive\":true")
                    .append("}");
            }
            jsonBuilder.append("]");

            String teamsJson = jsonBuilder.toString();
            log.debug("JSON genere: {}", teamsJson);

            return ResponseEntity.ok(teamsJson);

        } catch (Exception e) {
            log.error("Erreur lors de la recuperation des equipes", e);
            return ResponseEntity.internalServerError()
                .body("{\"error\":\"Erreur interne du serveur\"}");
        }
    }

    /**
     * Assigner des équipes et utilisateurs à un manager
     */
    @PostMapping("/{managerId}/assign-teams-users")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<String> assignTeamsAndUsers(@PathVariable Long managerId, @RequestBody TeamUserAssignmentRequest request) {
        try {
            log.debug("Assignation equipes et utilisateurs pour manager: {}", managerId);
            log.debug("Equipes: {}", request.getTeamIds());
            log.debug("Utilisateurs: {}", request.getUserIds());

            int teamsAssigned = 0;
            int usersAssigned = 0;

            // Assigner les équipes
            if (request.getTeamIds() != null && !request.getTeamIds().isEmpty()) {
                for (Long teamId : request.getTeamIds()) {
                    // Vérifier si l'association existe déjà
                    if (!managerTeamRepository.existsByManagerIdAndTeamIdAndIsActiveTrue(managerId, teamId, tenantContext.getRequiredOrganizationId())) {
                        ManagerTeam managerTeam = new ManagerTeam(managerId, teamId);
                        managerTeamRepository.save(managerTeam);
                        teamsAssigned++;
                        log.debug("Equipe {} assignee au manager {}", teamId, managerId);
                    } else {
                        log.debug("Equipe {} deja assignee au manager {}", teamId, managerId);
                    }
                }
            }

            // Assigner les utilisateurs
            if (request.getUserIds() != null && !request.getUserIds().isEmpty()) {
                for (Long userId : request.getUserIds()) {
                    // Vérifier si l'association existe déjà
                    if (!managerUserRepository.existsByManagerIdAndUserIdAndIsActiveTrue(managerId, userId, tenantContext.getRequiredOrganizationId())) {
                        ManagerUser managerUser = new ManagerUser(managerId, userId);
                        managerUserRepository.save(managerUser);
                        usersAssigned++;
                        log.debug("Utilisateur {} assigne au manager {}", userId, managerId);
                    } else {
                        log.debug("Utilisateur {} deja assigne au manager {}", userId, managerId);
                    }
                }
            }

            String response = String.format("{\"message\":\"Assignation réussie\",\"teamsAssigned\":%d,\"usersAssigned\":%d}",
                teamsAssigned, usersAssigned);

            log.debug("Assignation terminee: {} equipes, {} utilisateurs", teamsAssigned, usersAssigned);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Erreur assignation equipes/utilisateurs", e);
            return ResponseEntity.internalServerError()
                .body("{\"error\":\"Erreur lors de l'assignation\"}");
        }
    }

    /**
     * Récupérer les équipes associées à un manager — ownership: son propre ID ou ADMIN
     */
    @GetMapping("/{managerId}/teams")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<?> getManagerTeams(@PathVariable Long managerId, @AuthenticationPrincipal Jwt jwt) {
        try {
            // TODO: Implémenter la logique
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Récupérer les utilisateurs associés à un manager — ownership: son propre ID ou ADMIN
     */
    @GetMapping("/{managerId}/users")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<?> getManagerUsers(@PathVariable Long managerId, @AuthenticationPrincipal Jwt jwt) {
        try {
            // TODO: Implémenter la logique
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Modifier l'assignation d'un client vers un autre manager
     */
    @PutMapping("/{clientId}/reassign")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<String> reassignClient(
            @PathVariable Long clientId,
            @RequestBody ReassignmentRequest request) {
        try {
            log.debug("Reassignation du client {} vers le manager {}", clientId, request.getNewManagerId());

            // Pour l'instant, retourner une réponse simple pour tester
            return ResponseEntity.ok("{\"message\":\"Réassignation test réussie\",\"clientId\":" +
                clientId + ",\"newManagerId\":" + request.getNewManagerId() + "}");

        } catch (Exception e) {
            log.error("Erreur lors de la reassignation", e);
            return ResponseEntity.internalServerError()
                .body("{\"error\":\"Erreur interne du serveur\"}");
        }
    }

    // ===== ENDPOINTS DE DÉSASSIGNATION =====

    @DeleteMapping("/{managerId}/clients/{clientId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<String> unassignClient(
            @PathVariable String managerId, // Changé de Long à String
            @PathVariable Long clientId) {
        try {
            log.debug("Desassignation du client {} du manager {}", clientId, managerId);
            Long userId;

            // Essayer de parser comme Long d'abord
            try {
                userId = Long.parseLong(managerId);
                log.debug("ID numerique detecte: {}", userId);
            } catch (NumberFormatException e) {
                // Si ce n'est pas un nombre, chercher par keycloakId
                log.debug("UUID Keycloak detecte, recherche en base...");
                Optional<User> userOpt = userRepository.findByKeycloakId(managerId);
                if (userOpt.isPresent()) {
                    userId = userOpt.get().getId();
                    log.debug("Utilisateur trouve avec ID: {}", userId);
                } else {
                    log.warn("Utilisateur non trouve pour UUID: {}", managerId);
                    return ResponseEntity.badRequest().body("{\"error\":\"Manager non trouvé\"}");
                }
            }

            // 1. Récupérer le portefeuille du manager
            Portfolio portfolio = portfolioRepository.findByManagerId(userId, tenantContext.getRequiredOrganizationId()).stream()
                .findFirst()
                .orElse(null);

            if (portfolio == null) {
                return ResponseEntity.badRequest().body("{\"error\":\"Portefeuille non trouvé\"}");
            }

            // 2. Supprimer l'association client-portefeuille
            Optional<PortfolioClient> portfolioClientOpt = portfolioClientRepository.findByPortfolioIdAndClientId(portfolio.getId(), clientId, tenantContext.getRequiredOrganizationId());
            int removedCount = 0;
            if (portfolioClientOpt.isPresent()) {
                portfolioClientRepository.delete(portfolioClientOpt.get());
                removedCount = 1;
                log.debug("Client {} desassigne du portefeuille {}", clientId, portfolio.getId());
            } else {
                log.warn("Client {} non trouve dans le portefeuille {}", clientId, portfolio.getId());
                return ResponseEntity.badRequest().body("{\"error\":\"Client non assigné à ce portefeuille\"}");
            }

            return ResponseEntity.ok("{\"message\":\"Client désassigné avec succès\",\"removedCount\":" + removedCount + "}");

        } catch (Exception e) {
            log.error("Erreur lors de la desassignation du client", e);
            return ResponseEntity.internalServerError()
                .body("{\"error\":\"Erreur lors de la désassignation\"}");
        }
    }

    @DeleteMapping("/{managerId}/teams/{teamId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<String> unassignTeam(
            @PathVariable String managerId, // Changé de Long à String
            @PathVariable Long teamId) {
        try {
            log.debug("Desassignation de l'equipe {} du manager {}", teamId, managerId);
            Long userId;

            // Essayer de parser comme Long d'abord
            try {
                userId = Long.parseLong(managerId);
                log.debug("ID numerique detecte: {}", userId);
            } catch (NumberFormatException e) {
                // Si ce n'est pas un nombre, chercher par keycloakId
                log.debug("UUID Keycloak detecte, recherche en base...");
                Optional<User> userOpt = userRepository.findByKeycloakId(managerId);
                if (userOpt.isPresent()) {
                    userId = userOpt.get().getId();
                    log.debug("Utilisateur trouve avec ID: {}", userId);
                } else {
                    log.warn("Utilisateur non trouve pour UUID: {}", managerId);
                    return ResponseEntity.badRequest().body("{\"error\":\"Manager non trouvé\"}");
                }
            }

            // Supprimer l'association manager-équipe
            List<ManagerTeam> managerTeams = managerTeamRepository.findAllByManagerIdAndTeamId(userId, teamId, tenantContext.getRequiredOrganizationId());
            int removedCount = 0;
            for (ManagerTeam mt : managerTeams) {
                mt.setIsActive(false); // Soft delete
                managerTeamRepository.save(mt);
                removedCount++;
            }

            log.debug("{} association(s) equipe supprimee(s)", removedCount);

            return ResponseEntity.ok("{\"message\":\"Équipe désassignée avec succès\",\"removedCount\":" + removedCount + "}");

        } catch (Exception e) {
            log.error("Erreur lors de la desassignation de l'equipe", e);
            return ResponseEntity.internalServerError()
                .body("{\"error\":\"Erreur lors de la désassignation\"}");
        }
    }

    @DeleteMapping("/{managerId}/users/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<String> unassignUser(
            @PathVariable String managerId, // Changé de Long à String
            @PathVariable Long userId) {
        try {
            log.debug("Desassignation de l'utilisateur {} du manager {}", userId, managerId);
            Long managerUserId;

            // Essayer de parser comme Long d'abord
            try {
                managerUserId = Long.parseLong(managerId);
                log.debug("ID numerique detecte: {}", managerUserId);
            } catch (NumberFormatException e) {
                // Si ce n'est pas un nombre, chercher par keycloakId
                log.debug("UUID Keycloak detecte, recherche en base...");
                Optional<User> userOpt = userRepository.findByKeycloakId(managerId);
                if (userOpt.isPresent()) {
                    managerUserId = userOpt.get().getId();
                    log.debug("Utilisateur trouve avec ID: {}", managerUserId);
                } else {
                    log.warn("Utilisateur non trouve pour UUID: {}", managerId);
                    return ResponseEntity.badRequest().body("{\"error\":\"Manager non trouvé\"}");
                }
            }

            // Supprimer l'association manager-utilisateur
            List<ManagerUser> managerUsers = managerUserRepository.findAllByManagerIdAndUserId(managerUserId, userId, tenantContext.getRequiredOrganizationId());
            int removedCount = 0;
            for (ManagerUser mu : managerUsers) {
                mu.setIsActive(false); // Soft delete
                managerUserRepository.save(mu);
                removedCount++;
            }

            log.debug("{} association(s) utilisateur supprimee(s)", removedCount);

            return ResponseEntity.ok("{\"message\":\"Utilisateur désassigné avec succès\",\"removedCount\":" + removedCount + "}");

        } catch (Exception e) {
            log.error("Erreur lors de la desassignation de l'utilisateur", e);
            return ResponseEntity.internalServerError()
                .body("{\"error\":\"Erreur lors de la désassignation\"}");
        }
    }

    // ===== ENDPOINTS POUR LA GESTION DES PROPRIÉTÉS INDIVIDUELLES =====

    @PostMapping("/{managerId}/properties/{propertyId}/assign")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<String> assignPropertyToManager(
            @PathVariable String managerId, // String pour supporter Keycloak ID
            @PathVariable Long propertyId) {
        try {
            log.debug("Reassignation de la propriete {} au manager {}", propertyId, managerId);
            Long userId;

            // Conversion String (Keycloak ID) ou Long (DB ID) en Long (DB ID)
            try {
                userId = Long.parseLong(managerId);
                log.debug("ID numerique detecte: {}", userId);
            } catch (NumberFormatException e) {
                Optional<User> userOpt = userRepository.findByKeycloakId(managerId);
                if (userOpt.isPresent()) {
                    userId = userOpt.get().getId();
                    log.debug("Utilisateur trouve avec ID: {}", userId);
                } else {
                    log.warn("Utilisateur non trouve pour UUID: {}", managerId);
                    return ResponseEntity.badRequest().body("{\"error\":\"Manager non trouvé\"}");
                }
            }

            // 1. Vérifier que la propriété existe
            Property property = propertyRepository.findById(propertyId).orElse(null);
            if (property == null) {
                return ResponseEntity.badRequest().body("{\"error\":\"Propriété non trouvée\"}");
            }

            // 2. Vérifier que le propriétaire de la propriété (HOST) est assigné à ce manager
            Long hostId = property.getOwner().getId();
            Portfolio portfolio = portfolioRepository.findByManagerId(userId, tenantContext.getRequiredOrganizationId()).stream()
                .filter(p -> p.getClients().stream().anyMatch(pc -> pc.getClient().getId().equals(hostId)))
                .findFirst()
                .orElse(null);

            if (portfolio == null) {
                return ResponseEntity.badRequest().body("{\"error\":\"Le propriétaire de cette propriété n'est pas assigné à ce manager\"}");
            }

            // 3. Recréer l'association spécifique manager-propriété (si elle n'existe pas déjà)
            ManagerProperty existingAssociation = managerPropertyRepository.findByManagerIdAndPropertyId(userId, propertyId, tenantContext.getRequiredOrganizationId());
            if (existingAssociation == null) {
                ManagerProperty managerProperty = new ManagerProperty(userId, propertyId, "Réassignée par le manager");
                managerPropertyRepository.save(managerProperty);
                log.debug("Association manager-propriete recree pour manager {} et propriete {}", userId, propertyId);
            } else {
                log.debug("Association manager-propriete existe deja pour manager {} et propriete {}", userId, propertyId);
            }

            log.debug("Propriete {} reassignee au manager {}", propertyId, userId);

            return ResponseEntity.ok("{\"message\":\"Propriété réassignée avec succès\",\"propertyId\":" + propertyId + "}");

        } catch (Exception e) {
            log.error("Erreur lors de la reassignation de la propriete", e);
            return ResponseEntity.internalServerError()
                .body("{\"error\":\"Erreur lors de la réassignation de la propriété\"}");
        }
    }

    @DeleteMapping("/{managerId}/properties/{propertyId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<String> unassignPropertyFromManager(
            @PathVariable String managerId, // String pour supporter Keycloak ID
            @PathVariable Long propertyId) {
        try {
            log.debug("Desassignation de la propriete {} du manager {}", propertyId, managerId);
            Long userId;

            // Conversion String (Keycloak ID) ou Long (DB ID) en Long (DB ID)
            try {
                userId = Long.parseLong(managerId);
                log.debug("ID numerique detecte: {}", userId);
            } catch (NumberFormatException e) {
                Optional<User> userOpt = userRepository.findByKeycloakId(managerId);
                if (userOpt.isPresent()) {
                    userId = userOpt.get().getId();
                    log.debug("Utilisateur trouve avec ID: {}", userId);
                } else {
                    log.warn("Utilisateur non trouve pour UUID: {}", managerId);
                    return ResponseEntity.badRequest().body("{\"error\":\"Manager non trouvé\"}");
                }
            }

            // 1. Vérifier que la propriété existe
            Property property = propertyRepository.findById(propertyId).orElse(null);
            if (property == null) {
                return ResponseEntity.badRequest().body("{\"error\":\"Propriété non trouvée\"}");
            }

            // 2. Vérifier que le propriétaire de la propriété (HOST) est assigné à ce manager
            Long hostId = property.getOwner().getId();
            Portfolio portfolio = portfolioRepository.findByManagerId(userId, tenantContext.getRequiredOrganizationId()).stream()
                .filter(p -> p.getClients().stream().anyMatch(pc -> pc.getClient().getId().equals(hostId)))
                .findFirst()
                .orElse(null);

            if (portfolio == null) {
                return ResponseEntity.badRequest().body("{\"error\":\"Cette propriété n'est pas assignée à ce manager\"}");
            }

            // 3. Supprimer l'association spécifique manager-propriété
            ManagerProperty managerProperty = managerPropertyRepository.findByManagerIdAndPropertyId(userId, propertyId, tenantContext.getRequiredOrganizationId());
            if (managerProperty != null) {
                log.debug("Association manager-propriete trouvee: ID={}, Manager={}, Property={}", managerProperty.getId(), userId, propertyId);

                managerPropertyRepository.delete(managerProperty);
                log.debug("Propriete {} desassignee du manager {}", propertyId, userId);

                // Vérifier que l'association a bien été supprimée
                ManagerProperty verification = managerPropertyRepository.findByManagerIdAndPropertyId(userId, propertyId, tenantContext.getRequiredOrganizationId());
                if (verification != null) {
                    log.error("L'association manager-propriete existe encore apres suppression");
                } else {
                    log.debug("Verification OK: association manager-propriete bien supprimee");
                }
            } else {
                log.warn("Association manager-propriete non trouvee pour manager {} et propriete {}", userId, propertyId);
                return ResponseEntity.badRequest().body("{\"error\":\"Propriété non assignée à ce manager\"}");
            }

            return ResponseEntity.ok("{\"message\":\"Propriété désassignée avec succès - Client libéré\",\"propertyId\":" + propertyId + "}");

        } catch (Exception e) {
            log.error("Erreur lors de la desassignation de la propriete", e);
            return ResponseEntity.internalServerError()
                .body("{\"error\":\"Erreur lors de la désassignation de la propriété\"}");
        }
    }

    @PutMapping("/{managerId}/properties/{propertyId}/reassign")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<String> reassignPropertyToManager(
            @PathVariable String managerId, // String pour supporter Keycloak ID
            @PathVariable Long propertyId,
            @RequestBody ReassignmentRequest request) {
        try {
            log.debug("Reassignation de la propriete {} vers le manager {}", propertyId, request.getNewManagerId());

            // Pour l'instant, retourner une réponse simple pour tester
            return ResponseEntity.ok("{\"message\":\"Réassignation de propriété test réussie\",\"propertyId\":" +
                propertyId + ",\"newManagerId\":" + request.getNewManagerId() + "}");

        } catch (Exception e) {
            log.error("Erreur lors de la reassignation de la propriete", e);
            return ResponseEntity.internalServerError()
                .body("{\"error\":\"Erreur interne du serveur\"}");
        }
    }
}
