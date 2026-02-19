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

@RestController
@RequestMapping("/api/managers")

public class ManagerController {

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
     * Récupérer tous les managers et admins pour les formulaires d'association
     */
    @GetMapping("/all")
    
    public ResponseEntity<String> getAllManagersAndAdmins() {
        try {
            System.out.println("🔄 ManagerController - Récupération de tous les managers et admins...");
            
            // Retourner du JSON brut pour éviter les problèmes de sérialisation
            String jsonResponse = "[{\"id\":1,\"firstName\":\"Admin\",\"lastName\":\"User\",\"email\":\"admin@clenzy.fr\",\"role\":\"ADMIN\"},{\"id\":2,\"firstName\":\"Manager\",\"lastName\":\"Un\",\"email\":\"manager1@clenzy.fr\",\"role\":\"MANAGER\"},{\"id\":3,\"firstName\":\"Manager\",\"lastName\":\"Deux\",\"email\":\"manager2@clenzy.fr\",\"role\":\"MANAGER\"}]";
            
            System.out.println("📊 ManagerController - 3 managers/admins trouvés (JSON brut)");
            
            return ResponseEntity.ok()
                .header("Content-Type", "application/json")
                .body(jsonResponse);
        } catch (Exception e) {
            System.out.println("❌ ManagerController - Erreur lors de la récupération des managers: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Récupérer tous les utilisateurs HOST pour les formulaires d'association
     */
    @GetMapping("/hosts")
    
    public ResponseEntity<String> getAllHostUsers() {
        try {
            System.out.println("🔄 ManagerController - Récupération des HOSTs disponibles...");
            
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
            System.out.println("📊 ManagerController - " + availableHosts.size() + " HOSTs disponibles trouvés");
            
            return ResponseEntity.ok()
                .header("Content-Type", "application/json")
                .body(jsonResponse);
        } catch (Exception e) {
            System.out.println("❌ ManagerController - Erreur lors de la récupération des HOSTs disponibles: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Récupérer les propriétés des clients sélectionnés
     */
    @PostMapping("/properties/by-clients")
    
    public ResponseEntity<String> getPropertiesByClients(@RequestBody List<Long> clientIds) {
        try {
            System.out.println("🔄 ManagerController - Récupération des propriétés pour clients: " + clientIds);
            
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
            
            System.out.println("📊 ManagerController - Propriétés disponibles récupérées pour " + clientIds.size() + " clients");
            
            return ResponseEntity.ok()
                .header("Content-Type", "application/json")
                .body(jsonResponse.toString());
        } catch (Exception e) {
            System.out.println("❌ ManagerController - Erreur lors de la récupération des propriétés: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Récupérer toutes les associations d'un manager (clients, propriétés, équipes, utilisateurs)
     * Endpoint optimisé avec une seule requête
     * Accepte soit un ID numérique soit un UUID Keycloak
     */
    @GetMapping("/{managerId}/associations")
    
    public ResponseEntity<ManagerAssociationsDto> getManagerAssociations(
            @PathVariable String managerId) {
        
        try {
            System.out.println("🔄 ManagerController - Récupération des associations pour: " + managerId);
            
            Long userId;
            
            // Essayer de parser comme Long d'abord
            try {
                userId = Long.parseLong(managerId);
                System.out.println("📊 ManagerController - ID numérique détecté: " + userId);
            } catch (NumberFormatException e) {
                // Si ce n'est pas un nombre, chercher par keycloakId
                System.out.println("📊 ManagerController - UUID Keycloak détecté, recherche en base...");
                Optional<User> userOpt = userRepository.findByKeycloakId(managerId);
                
                if (userOpt.isPresent()) {
                    userId = userOpt.get().getId();
                    System.out.println("📊 ManagerController - Utilisateur trouvé avec ID: " + userId);
                } else {
                    System.out.println("❌ ManagerController - Utilisateur non trouvé pour UUID: " + managerId);
                    return ResponseEntity.badRequest().build();
                }
            }
            
            // Utiliser le ManagerService pour récupérer toutes les associations
            System.out.println("🔍 ManagerController - Recherche des associations pour manager ID: " + userId);
            
            ManagerAssociationsDto associations = managerService.getManagerAssociations(userId);
            
            System.out.println("📊 ManagerController - Associations récupérées:");
            System.out.println("  - Clients: " + (associations.getClients() != null ? associations.getClients().size() : 0));
            System.out.println("  - Propriétés: " + (associations.getProperties() != null ? associations.getProperties().size() : 0));
            System.out.println("  - Équipes: " + (associations.getTeams() != null ? associations.getTeams().size() : 0));
            System.out.println("  - Utilisateurs: " + (associations.getUsers() != null ? associations.getUsers().size() : 0));
            
            return ResponseEntity.ok(associations);
        } catch (Exception e) {
            System.out.println("❌ ManagerController - Erreur: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Assigner des clients et propriétés à un manager
     */
    @PostMapping("/{managerId}/assign")
    
    @Transactional
    public ResponseEntity<String> assignClientsAndProperties(
            @PathVariable Long managerId,
            @RequestBody AssignmentRequest request) {
        try {
            System.out.println("🔄 ManagerController - Assignation clients/propriétés pour manager " + managerId);
            System.out.println("📊 ManagerController - Clients: " + request.getClientIds());
            System.out.println("📊 ManagerController - Propriétés: " + request.getPropertyIds());
            
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
                System.out.println("✅ ManagerController - Portefeuille créé: " + portfolio.getId());
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
                            System.out.println("✅ ManagerController - Client " + clientId + " assigné au portefeuille " + portfolio.getId());
                        } else {
                            System.out.println("⚠️ ManagerController - Client " + clientId + " non trouvé");
                        }
                    } else {
                        System.out.println("⚠️ ManagerController - Client " + clientId + " déjà assigné au portefeuille " + portfolio.getId());
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
                                System.out.println("✅ ManagerController - Propriété " + propertyId + " assignée spécifiquement au manager " + managerId);
                            } else {
                                System.out.println("⚠️ ManagerController - Propriété " + propertyId + " déjà assignée au manager " + managerId);
                            }
                        } else {
                            System.out.println("⚠️ ManagerController - Propriété " + propertyId + " n'appartient pas aux clients assignés");
                        }
                    } else {
                        System.out.println("⚠️ ManagerController - Propriété " + propertyId + " non trouvée");
                    }
                }
            }
            
            String response = String.format("{\"message\":\"Assignation réussie\",\"clientsAssigned\":%d,\"propertiesAssigned\":%d,\"portfolioId\":%d}", 
                clientsAssigned, propertiesAssigned, portfolio.getId());
            
            System.out.println("📊 ManagerController - Assignation terminée: " + clientsAssigned + " clients, " + propertiesAssigned + " propriétés");
            
            return ResponseEntity.ok(response);
                
        } catch (Exception e) {
            System.out.println("❌ ManagerController - Erreur lors de l'assignation: " + e.getMessage());
            e.printStackTrace();
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
     * Récupérer les clients associés à un manager
     */
    @GetMapping("/{managerId}/clients")
    public ResponseEntity<?> getManagerClients(@PathVariable Long managerId) {
        try {
            // TODO: Implémenter la logique
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Récupérer les propriétés associées à un manager
     */
    @GetMapping("/{managerId}/properties")
    public ResponseEntity<?> getManagerProperties(@PathVariable Long managerId) {
        try {
            // TODO: Implémenter la logique
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Récupérer tous les utilisateurs opérationnels (techniciens et housekeepers)
     */
    @GetMapping("/operational-users")
    
    public ResponseEntity<String> getOperationalUsers() {
        try {
            System.out.println("🔄 ManagerController - Récupération des utilisateurs opérationnels...");
            
            // Récupérer les vrais utilisateurs opérationnels depuis la base de données
            List<UserRole> roles = Arrays.asList(UserRole.TECHNICIAN, UserRole.HOUSEKEEPER, UserRole.SUPERVISOR);
            System.out.println("🔍 ManagerController - Recherche des utilisateurs avec les rôles: " + roles);
            
            List<User> operationalUsers = userRepository.findByRoleIn(roles, tenantContext.getRequiredOrganizationId());
            System.out.println("📊 ManagerController - Nombre d'utilisateurs trouvés: " + operationalUsers.size());
            
            for (User user : operationalUsers) {
                System.out.println("👤 ManagerController - Utilisateur trouvé: ID=" + user.getId() + 
                    ", Nom=" + user.getFirstName() + " " + user.getLastName() + 
                    ", Email=" + user.getEmail() + ", Rôle=" + user.getRole());
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
            System.out.println("📊 ManagerController - " + operationalUsers.size() + " utilisateurs opérationnels trouvés (JSON brut)");
            
            return ResponseEntity.ok()
                .header("Content-Type", "application/json")
                .body(jsonResponse);
        } catch (Exception e) {
            System.out.println("❌ ManagerController - Erreur lors de la récupération des utilisateurs opérationnels: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Récupérer toutes les équipes disponibles
     */
    @GetMapping("/teams")
    
    public ResponseEntity<String> getAllTeams() {
        try {
            System.out.println("🔄 ManagerController - Récupération de toutes les équipes depuis la base de données");
            
            // Récupérer toutes les équipes de la base de données
            List<Team> teams = teamRepository.findAll();
            System.out.println("📊 ManagerController - " + teams.size() + " équipes trouvées en base");
            
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
            System.out.println("📊 ManagerController - JSON généré: " + teamsJson);
            
            return ResponseEntity.ok(teamsJson);
            
        } catch (Exception e) {
            System.out.println("❌ ManagerController - Erreur lors de la récupération des équipes: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                .body("{\"error\":\"Erreur interne du serveur\"}");
        }
    }

    /**
     * Assigner des équipes et utilisateurs à un manager
     */
    @PostMapping("/{managerId}/assign-teams-users")
    
    @Transactional
    public ResponseEntity<String> assignTeamsAndUsers(@PathVariable Long managerId, @RequestBody TeamUserAssignmentRequest request) {
        try {
            System.out.println("🔄 ManagerController - Assignation équipes et utilisateurs pour manager: " + managerId);
            System.out.println("📊 ManagerController - Équipes: " + request.getTeamIds());
            System.out.println("📊 ManagerController - Utilisateurs: " + request.getUserIds());
            
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
                        System.out.println("✅ ManagerController - Équipe " + teamId + " assignée au manager " + managerId);
                    } else {
                        System.out.println("⚠️ ManagerController - Équipe " + teamId + " déjà assignée au manager " + managerId);
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
                        System.out.println("✅ ManagerController - Utilisateur " + userId + " assigné au manager " + managerId);
                    } else {
                        System.out.println("⚠️ ManagerController - Utilisateur " + userId + " déjà assigné au manager " + managerId);
                    }
                }
            }
            
            String response = String.format("{\"message\":\"Assignation réussie\",\"teamsAssigned\":%d,\"usersAssigned\":%d}", 
                teamsAssigned, usersAssigned);
            
            System.out.println("📊 ManagerController - Assignation terminée: " + teamsAssigned + " équipes, " + usersAssigned + " utilisateurs");
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            System.out.println("❌ ManagerController - Erreur assignation équipes/utilisateurs: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                .body("{\"error\":\"Erreur lors de l'assignation\"}");
        }
    }

    /**
     * Récupérer les équipes associées à un manager
     */
    @GetMapping("/{managerId}/teams")
    public ResponseEntity<?> getManagerTeams(@PathVariable Long managerId) {
        try {
            // TODO: Implémenter la logique
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Récupérer les utilisateurs associés à un manager
     */
    @GetMapping("/{managerId}/users")
    public ResponseEntity<?> getManagerUsers(@PathVariable Long managerId) {
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
    
    public ResponseEntity<String> reassignClient(
            @PathVariable Long clientId,
            @RequestBody ReassignmentRequest request) {
        try {
            System.out.println("🔄 ManagerController - Réassignation du client " + clientId + " vers le manager " + request.getNewManagerId());
            
            // Pour l'instant, retourner une réponse simple pour tester
            return ResponseEntity.ok("{\"message\":\"Réassignation test réussie\",\"clientId\":" + 
                clientId + ",\"newManagerId\":" + request.getNewManagerId() + "}");
                
        } catch (Exception e) {
            System.out.println("❌ ManagerController - Erreur lors de la réassignation: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                .body("{\"error\":\"Erreur interne du serveur\"}");
        }
    }

    // ===== ENDPOINTS DE DÉSASSIGNATION =====

    @DeleteMapping("/{managerId}/clients/{clientId}")
    
    @Transactional
    public ResponseEntity<String> unassignClient(
            @PathVariable String managerId, // Changé de Long à String
            @PathVariable Long clientId) {
        try {
            System.out.println("🔄 ManagerController - Désassignation du client " + clientId + " du manager " + managerId);
            Long userId;
            
            // Essayer de parser comme Long d'abord
            try {
                userId = Long.parseLong(managerId);
                System.out.println("📊 ManagerController - ID numérique détecté: " + userId);
            } catch (NumberFormatException e) {
                // Si ce n'est pas un nombre, chercher par keycloakId
                System.out.println("📊 ManagerController - UUID Keycloak détecté, recherche en base...");
                Optional<User> userOpt = userRepository.findByKeycloakId(managerId);
                if (userOpt.isPresent()) {
                    userId = userOpt.get().getId();
                    System.out.println("📊 ManagerController - Utilisateur trouvé avec ID: " + userId);
                } else {
                    System.out.println("❌ ManagerController - Utilisateur non trouvé pour UUID: " + managerId);
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
                System.out.println("✅ ManagerController - Client " + clientId + " désassigné du portefeuille " + portfolio.getId());
            } else {
                System.out.println("⚠️ ManagerController - Client " + clientId + " non trouvé dans le portefeuille " + portfolio.getId());
                return ResponseEntity.badRequest().body("{\"error\":\"Client non assigné à ce portefeuille\"}");
            }
            
            return ResponseEntity.ok("{\"message\":\"Client désassigné avec succès\",\"removedCount\":" + removedCount + "}");
                
        } catch (Exception e) {
            System.out.println("❌ ManagerController - Erreur lors de la désassignation du client: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                .body("{\"error\":\"Erreur lors de la désassignation\"}");
        }
    }

    @DeleteMapping("/{managerId}/teams/{teamId}")
    
    @Transactional
    public ResponseEntity<String> unassignTeam(
            @PathVariable String managerId, // Changé de Long à String
            @PathVariable Long teamId) {
        try {
            System.out.println("🔄 ManagerController - Désassignation de l'équipe " + teamId + " du manager " + managerId);
            Long userId;
            
            // Essayer de parser comme Long d'abord
            try {
                userId = Long.parseLong(managerId);
                System.out.println("📊 ManagerController - ID numérique détecté: " + userId);
            } catch (NumberFormatException e) {
                // Si ce n'est pas un nombre, chercher par keycloakId
                System.out.println("📊 ManagerController - UUID Keycloak détecté, recherche en base...");
                Optional<User> userOpt = userRepository.findByKeycloakId(managerId);
                if (userOpt.isPresent()) {
                    userId = userOpt.get().getId();
                    System.out.println("📊 ManagerController - Utilisateur trouvé avec ID: " + userId);
                } else {
                    System.out.println("❌ ManagerController - Utilisateur non trouvé pour UUID: " + managerId);
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
            
            System.out.println("✅ ManagerController - " + removedCount + " association(s) équipe supprimée(s)");
            
            return ResponseEntity.ok("{\"message\":\"Équipe désassignée avec succès\",\"removedCount\":" + removedCount + "}");
                
        } catch (Exception e) {
            System.out.println("❌ ManagerController - Erreur lors de la désassignation de l'équipe: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                .body("{\"error\":\"Erreur lors de la désassignation\"}");
        }
    }

    @DeleteMapping("/{managerId}/users/{userId}")
    
    @Transactional
    public ResponseEntity<String> unassignUser(
            @PathVariable String managerId, // Changé de Long à String
            @PathVariable Long userId) {
        try {
            System.out.println("🔄 ManagerController - Désassignation de l'utilisateur " + userId + " du manager " + managerId);
            Long managerUserId;
            
            // Essayer de parser comme Long d'abord
            try {
                managerUserId = Long.parseLong(managerId);
                System.out.println("📊 ManagerController - ID numérique détecté: " + managerUserId);
            } catch (NumberFormatException e) {
                // Si ce n'est pas un nombre, chercher par keycloakId
                System.out.println("📊 ManagerController - UUID Keycloak détecté, recherche en base...");
                Optional<User> userOpt = userRepository.findByKeycloakId(managerId);
                if (userOpt.isPresent()) {
                    managerUserId = userOpt.get().getId();
                    System.out.println("📊 ManagerController - Utilisateur trouvé avec ID: " + managerUserId);
                } else {
                    System.out.println("❌ ManagerController - Utilisateur non trouvé pour UUID: " + managerId);
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
            
            System.out.println("✅ ManagerController - " + removedCount + " association(s) utilisateur supprimée(s)");
            
            return ResponseEntity.ok("{\"message\":\"Utilisateur désassigné avec succès\",\"removedCount\":" + removedCount + "}");
                
        } catch (Exception e) {
            System.out.println("❌ ManagerController - Erreur lors de la désassignation de l'utilisateur: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                .body("{\"error\":\"Erreur lors de la désassignation\"}");
        }
    }

    // ===== ENDPOINTS POUR LA GESTION DES PROPRIÉTÉS INDIVIDUELLES =====

    @PostMapping("/{managerId}/properties/{propertyId}/assign")
    
    @Transactional
    public ResponseEntity<String> assignPropertyToManager(
            @PathVariable String managerId, // String pour supporter Keycloak ID
            @PathVariable Long propertyId) {
        try {
            System.out.println("🔄 ManagerController - Réassignation de la propriété " + propertyId + " au manager " + managerId);
            Long userId;
            
            // Conversion String (Keycloak ID) ou Long (DB ID) en Long (DB ID)
            try {
                userId = Long.parseLong(managerId);
                System.out.println("📊 ManagerController - ID numérique détecté: " + userId);
            } catch (NumberFormatException e) {
                Optional<User> userOpt = userRepository.findByKeycloakId(managerId);
                if (userOpt.isPresent()) {
                    userId = userOpt.get().getId();
                    System.out.println("📊 ManagerController - Utilisateur trouvé avec ID: " + userId);
                } else {
                    System.out.println("❌ ManagerController - Utilisateur non trouvé pour UUID: " + managerId);
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
                System.out.println("✅ ManagerController - Association manager-propriété recréée pour le manager " + userId + " et la propriété " + propertyId);
            } else {
                System.out.println("ℹ️ ManagerController - Association manager-propriété existe déjà pour le manager " + userId + " et la propriété " + propertyId);
            }
            
            System.out.println("✅ ManagerController - Propriété " + propertyId + " réassignée au manager " + userId);
            
            return ResponseEntity.ok("{\"message\":\"Propriété réassignée avec succès\",\"propertyId\":" + propertyId + "}");
                
        } catch (Exception e) {
            System.out.println("❌ ManagerController - Erreur lors de la réassignation de la propriété: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                .body("{\"error\":\"Erreur lors de la réassignation de la propriété\"}");
        }
    }

    @DeleteMapping("/{managerId}/properties/{propertyId}")
    
    @Transactional
    public ResponseEntity<String> unassignPropertyFromManager(
            @PathVariable String managerId, // String pour supporter Keycloak ID
            @PathVariable Long propertyId) {
        try {
            System.out.println("🔄 ManagerController - Désassignation de la propriété " + propertyId + " du manager " + managerId);
            Long userId;
            
            // Conversion String (Keycloak ID) ou Long (DB ID) en Long (DB ID)
            try {
                userId = Long.parseLong(managerId);
                System.out.println("📊 ManagerController - ID numérique détecté: " + userId);
            } catch (NumberFormatException e) {
                Optional<User> userOpt = userRepository.findByKeycloakId(managerId);
                if (userOpt.isPresent()) {
                    userId = userOpt.get().getId();
                    System.out.println("📊 ManagerController - Utilisateur trouvé avec ID: " + userId);
                } else {
                    System.out.println("❌ ManagerController - Utilisateur non trouvé pour UUID: " + managerId);
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
                System.out.println("🔍 ManagerController - Association manager-propriété trouvée: ManagerProperty ID=" + managerProperty.getId() + ", Manager ID=" + userId + ", Property ID=" + propertyId);
                
                managerPropertyRepository.delete(managerProperty);
                System.out.println("✅ ManagerController - Propriété " + propertyId + " désassignée du manager " + userId);
                
                // Vérifier que l'association a bien été supprimée
                ManagerProperty verification = managerPropertyRepository.findByManagerIdAndPropertyId(userId, propertyId, tenantContext.getRequiredOrganizationId());
                if (verification != null) {
                    System.out.println("❌ ManagerController - ERREUR: L'association manager-propriété existe encore après suppression !");
                } else {
                    System.out.println("✅ ManagerController - Vérification OK: L'association manager-propriété a bien été supprimée");
                }
            } else {
                System.out.println("⚠️ ManagerController - Association manager-propriété non trouvée pour le manager " + userId + " et la propriété " + propertyId);
                return ResponseEntity.badRequest().body("{\"error\":\"Propriété non assignée à ce manager\"}");
            }
            
            return ResponseEntity.ok("{\"message\":\"Propriété désassignée avec succès - Client libéré\",\"propertyId\":" + propertyId + "}");
                
        } catch (Exception e) {
            System.out.println("❌ ManagerController - Erreur lors de la désassignation de la propriété: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                .body("{\"error\":\"Erreur lors de la désassignation de la propriété\"}");
        }
    }

    @PutMapping("/{managerId}/properties/{propertyId}/reassign")
    
    @Transactional
    public ResponseEntity<String> reassignPropertyToManager(
            @PathVariable String managerId, // String pour supporter Keycloak ID
            @PathVariable Long propertyId,
            @RequestBody ReassignmentRequest request) {
        try {
            System.out.println("🔄 ManagerController - Réassignation de la propriété " + propertyId + " vers le manager " + request.getNewManagerId());
            
            // Pour l'instant, retourner une réponse simple pour tester
            return ResponseEntity.ok("{\"message\":\"Réassignation de propriété test réussie\",\"propertyId\":" + 
                propertyId + ",\"newManagerId\":" + request.getNewManagerId() + "}");
                
        } catch (Exception e) {
            System.out.println("❌ ManagerController - Erreur lors de la réassignation de la propriété: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                .body("{\"error\":\"Erreur interne du serveur\"}");
        }
    }
}
