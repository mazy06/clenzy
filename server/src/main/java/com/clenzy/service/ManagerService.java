package com.clenzy.service;

import com.clenzy.dto.ManagerAssociationsDto;
import com.clenzy.dto.ClientAssociationDto;
import com.clenzy.dto.PropertyAssociationDto;
import com.clenzy.dto.TeamAssociationDto;
import com.clenzy.dto.UserAssociationDto;
import com.clenzy.model.Portfolio;
import com.clenzy.model.PortfolioClient;
import com.clenzy.model.PortfolioTeam;
import com.clenzy.model.Property;
import com.clenzy.model.Team;
import com.clenzy.model.User;
import com.clenzy.repository.PortfolioRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.TeamRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.repository.ManagerTeamRepository;
import com.clenzy.repository.ManagerUserRepository;
import com.clenzy.repository.ManagerPropertyRepository;
import com.clenzy.model.ManagerTeam;
import com.clenzy.model.ManagerUser;
import com.clenzy.model.ManagerProperty;
import com.clenzy.model.UserRole;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ManagerService {

    @Autowired
    private PortfolioRepository portfolioRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private TeamRepository teamRepository;

    @Autowired
    private UserRepository userRepository;
    
    @Autowired
    private ManagerTeamRepository managerTeamRepository;
    
    @Autowired
    private ManagerUserRepository managerUserRepository;
    
    @Autowired
    private ManagerPropertyRepository managerPropertyRepository;
    
    /**
     * Récupérer les HOSTs qui ont au moins une propriété non assignée
     */
    @Transactional(readOnly = true)
    public List<User> getAvailableHosts() {
        System.out.println("🔄 ManagerService - Récupération des HOSTs disponibles...");
        List<User> allHosts = userRepository.findByRoleIn(java.util.Arrays.asList(UserRole.HOST));
        List<User> availableHosts = new java.util.ArrayList<>();

        for (User host : allHosts) {
            List<Property> hostProperties = propertyRepository.findByOwnerId(host.getId());
            System.out.println("🔍 ManagerService - Host " + host.getId() + " (" + host.getFirstName() + ") a " + hostProperties.size() + " propriétés");

            // Si un host n'a pas de propriétés, il est considéré comme disponible
            if (hostProperties.isEmpty()) {
                System.out.println("📊 ManagerService - Host " + host.getId() + " a 0 propriétés, donc disponible.");
                availableHosts.add(host);
                continue;
            }

            boolean hasUnassignedProperty = false;
            for (Property property : hostProperties) {
                // Vérifier si cette propriété n'est assignée à AUCUN manager
                if (!managerPropertyRepository.existsByPropertyId(property.getId())) {
                    hasUnassignedProperty = true;
                    System.out.println("📊 ManagerService - Propriété " + property.getId() + " du Host " + host.getId() + " est non assignée. Host disponible.");
                    break; // Trouvé une propriété non assignée, ce host est disponible
                }
            }

            if (hasUnassignedProperty) {
                availableHosts.add(host);
            } else {
                System.out.println("📊 ManagerService - Host " + host.getId() + " (" + host.getFirstName() + ") a toutes ses propriétés assignées. Non disponible.");
            }
        }
        System.out.println("✅ ManagerService - " + availableHosts.size() + " HOSTs disponibles trouvés.");
        return availableHosts;
    }
    
    /**
     * Récupérer les propriétés non assignées d'un HOST
     */
    @Transactional(readOnly = true)
    public List<Property> getAvailablePropertiesForHost(Long hostId) {
        System.out.println("🔄 ManagerService - Récupération des propriétés disponibles pour le HOST " + hostId);
        List<Property> allHostProperties = propertyRepository.findByOwnerId(hostId);
        List<Property> availableProperties = new java.util.ArrayList<>();

        for (Property property : allHostProperties) {
            // Vérifier si cette propriété n'est assignée à AUCUN manager
            if (!managerPropertyRepository.existsByPropertyId(property.getId())) {
                availableProperties.add(property);
                System.out.println("📊 ManagerService - Propriété " + property.getId() + " (" + property.getName() + ") est disponible");
            } else {
                System.out.println("📊 ManagerService - Propriété " + property.getId() + " (" + property.getName() + ") est déjà assignée");
            }
        }
        
        System.out.println("✅ ManagerService - " + availableProperties.size() + " propriétés disponibles trouvées pour le HOST " + hostId);
        return availableProperties;
    }
    
    /**
     * Récupérer les propriétés non assignées d'un HOST avec les informations de l'owner
     */
    @Transactional(readOnly = true)
    public List<java.util.Map<String, Object>> getAvailablePropertiesForHostWithOwner(Long hostId) {
        System.out.println("🔄 ManagerService - Récupération des propriétés disponibles avec owner pour le HOST " + hostId);
        List<Property> allHostProperties = propertyRepository.findByOwnerId(hostId);
        List<java.util.Map<String, Object>> availableProperties = new java.util.ArrayList<>();

        for (Property property : allHostProperties) {
            // Vérifier si cette propriété n'est assignée à AUCUN manager
            if (!managerPropertyRepository.existsByPropertyId(property.getId())) {
                java.util.Map<String, Object> propertyData = new java.util.HashMap<>();
                propertyData.put("id", property.getId());
                propertyData.put("name", property.getName() != null ? property.getName() : "");
                propertyData.put("address", property.getAddress() != null ? property.getAddress() : "");
                propertyData.put("city", property.getCity() != null ? property.getCity() : "");
                propertyData.put("type", property.getType() != null ? property.getType().name() : "");
                propertyData.put("status", property.getStatus() != null ? property.getStatus().name() : "");
                propertyData.put("ownerId", property.getOwner().getId());
                propertyData.put("ownerFirstName", property.getOwner().getFirstName() != null ? property.getOwner().getFirstName() : "");
                propertyData.put("ownerLastName", property.getOwner().getLastName() != null ? property.getOwner().getLastName() : "");
                propertyData.put("isActive", property.getStatus() != null ? property.getStatus().name().equals("ACTIVE") : true);
                
                availableProperties.add(propertyData);
                System.out.println("📊 ManagerService - Propriété " + property.getId() + " (" + property.getName() + ") est disponible");
            } else {
                System.out.println("📊 ManagerService - Propriété " + property.getId() + " (" + property.getName() + ") est déjà assignée");
            }
        }
        
        System.out.println("✅ ManagerService - " + availableProperties.size() + " propriétés disponibles trouvées pour le HOST " + hostId);
        return availableProperties;
    }
    

    /**
     * Récupérer toutes les associations d'un manager en une seule requête optimisée
     */
    @Transactional(readOnly = true)
    public ManagerAssociationsDto getManagerAssociations(Long managerId) {
        System.out.println("🔄 ManagerService.getManagerAssociations() - Récupération des associations pour le manager: " + managerId);

        // 1. Récupérer les portefeuilles du manager
        List<Portfolio> portfolios = portfolioRepository.findByManagerId(managerId);
        System.out.println("📊 ManagerService - " + portfolios.size() + " portefeuilles trouvés");

        // 2. Récupérer les clients associés via les portefeuilles
        List<ClientAssociationDto> clients = portfolios.stream()
            .flatMap(portfolio -> portfolio.getClients().stream())
            .map(this::convertToClientAssociationDto)
            .collect(Collectors.toList());

        // 3. Récupérer les utilisateurs associés via les portefeuilles
        List<UserAssociationDto> usersFromPortfolios = portfolios.stream()
            .flatMap(portfolio -> portfolio.getTeamMembers().stream())
            .map(this::convertToUserAssociationDto)
            .collect(Collectors.toList());

        // 4. Récupérer les utilisateurs associés directement via manager_users
        List<ManagerUser> managerUsers = managerUserRepository.findByManagerIdAndIsActiveTrue(managerId);
        List<UserAssociationDto> usersFromDirect = managerUsers.stream()
            .map(mu -> {
                User user = userRepository.findById(mu.getUserId()).orElse(null);
                if (user != null) {
                    return convertUserToAssociationDto(user);
                }
                return null;
            })
            .filter(dto -> dto != null)
            .collect(Collectors.toList());

        // Combiner les utilisateurs des portefeuilles et les utilisateurs directs
        List<UserAssociationDto> users = new java.util.ArrayList<>();
        users.addAll(usersFromPortfolios);
        users.addAll(usersFromDirect);

        // 5. Récupérer les propriétés spécifiquement assignées au manager
        List<PropertyAssociationDto> properties = new java.util.ArrayList<>();
        List<ManagerProperty> managerProperties = managerPropertyRepository.findByManagerId(managerId);
        System.out.println("🔍 ManagerService - " + managerProperties.size() + " propriétés spécifiquement assignées au manager " + managerId);
        
        for (ManagerProperty managerProperty : managerProperties) {
            Property property = propertyRepository.findById(managerProperty.getPropertyId()).orElse(null);
            if (property != null) {
                PropertyAssociationDto dto = convertToPropertyAssociationDto(property);
                dto.setAssignedAt(managerProperty.getAssignedAt() != null ? 
                    managerProperty.getAssignedAt().format(java.time.format.DateTimeFormatter.ISO_LOCAL_DATE_TIME) : "N/A");
                dto.setNotes(managerProperty.getNotes() != null ? managerProperty.getNotes() : "Assignée spécifiquement");
                properties.add(dto);
                System.out.println("🔍 ManagerService - Propriété " + property.getId() + " ajoutée à la liste (assignée spécifiquement)");
            } else {
                System.out.println("⚠️ ManagerService - Propriété " + managerProperty.getPropertyId() + " non trouvée en base");
            }
        }

        // 6. Récupérer les équipes associées directement via manager_teams
        List<ManagerTeam> managerTeams = managerTeamRepository.findByManagerIdAndIsActiveTrue(managerId);
        List<TeamAssociationDto> teams = managerTeams.stream()
            .map(mt -> {
                Team team = teamRepository.findById(mt.getTeamId()).orElse(null);
                if (team != null) {
                    return convertTeamToAssociationDto(team);
                }
                return null;
            })
            .filter(dto -> dto != null)
            .collect(Collectors.toList());

        System.out.println("📊 ManagerService - Associations récupérées:");
        System.out.println("  - Clients: " + clients.size());
        System.out.println("  - Propriétés: " + properties.size());
        System.out.println("  - Équipes: " + teams.size());
        System.out.println("  - Utilisateurs: " + users.size());

        return new ManagerAssociationsDto(clients, properties, teams, users);
    }

    private ClientAssociationDto convertToClientAssociationDto(PortfolioClient portfolioClient) {
        ClientAssociationDto dto = new ClientAssociationDto();
        dto.setId(portfolioClient.getClient().getId());
        dto.setFirstName(portfolioClient.getClient().getFirstName() != null ? 
            portfolioClient.getClient().getFirstName() : "N/A");
        dto.setLastName(portfolioClient.getClient().getLastName() != null ? 
            portfolioClient.getClient().getLastName() : "N/A");
        dto.setEmail(portfolioClient.getClient().getEmail());
        dto.setPhoneNumber(portfolioClient.getClient().getPhoneNumber());
        dto.setRole("HOST");
        dto.setAssignedAt(portfolioClient.getAssignedAt() != null ? 
            portfolioClient.getAssignedAt().format(java.time.format.DateTimeFormatter.ISO_LOCAL_DATE_TIME) : "N/A");
        dto.setNotes(portfolioClient.getNotes());
        dto.setPortfolioId(portfolioClient.getPortfolio().getId());
        dto.setPortfolioName(portfolioClient.getPortfolio().getName());
        return dto;
    }

    private UserAssociationDto convertToUserAssociationDto(PortfolioTeam portfolioTeam) {
        UserAssociationDto dto = new UserAssociationDto();
        dto.setId(portfolioTeam.getTeamMember().getId());
        dto.setFirstName(portfolioTeam.getTeamMember().getFirstName() != null ? 
            portfolioTeam.getTeamMember().getFirstName() : "N/A");
        dto.setLastName(portfolioTeam.getTeamMember().getLastName() != null ? 
            portfolioTeam.getTeamMember().getLastName() : "N/A");
        dto.setEmail(portfolioTeam.getTeamMember().getEmail());
        dto.setRole(portfolioTeam.getRoleInTeam() != null ? 
            portfolioTeam.getRoleInTeam().name() : "TECHNICIAN");
        dto.setAssignedAt(portfolioTeam.getAssignedAt() != null ? 
            portfolioTeam.getAssignedAt().toString() : "N/A");
        dto.setNotes(portfolioTeam.getNotes());
        dto.setPortfolioId(portfolioTeam.getPortfolio().getId());
        dto.setPortfolioName(portfolioTeam.getPortfolio().getName());
        return dto;
    }

    private PropertyAssociationDto convertToPropertyAssociationDto(Property property) {
        PropertyAssociationDto dto = new PropertyAssociationDto();
        dto.setId(property.getId());
        dto.setName(property.getName());
        dto.setAddress(property.getAddress());
        dto.setDescription(property.getDescription());
        dto.setOwnerId(property.getOwner().getId());
        dto.setOwnerName(property.getOwner().getFirstName() + " " + property.getOwner().getLastName());
        dto.setAssignedAt(property.getCreatedAt() != null ? 
            property.getCreatedAt().toString() : "N/A");
        dto.setNotes(property.getSpecialRequirements()); // Utiliser specialRequirements comme notes
        return dto;
    }

    private TeamAssociationDto convertToTeamAssociationDto(Team team) {
        TeamAssociationDto dto = new TeamAssociationDto();
        dto.setId(team.getId());
        dto.setName(team.getName());
        dto.setDescription(team.getDescription());
        dto.setMemberCount(team.getMemberCount());
        dto.setAssignedAt(team.getCreatedAt() != null ? 
            team.getCreatedAt().toString() : "N/A");
        dto.setNotes(team.getInterventionType()); // Utiliser interventionType comme notes
        return dto;
    }
    
    private TeamAssociationDto convertTeamToAssociationDto(Team team) {
        return convertToTeamAssociationDto(team);
    }
    
    private UserAssociationDto convertUserToAssociationDto(User user) {
        UserAssociationDto dto = new UserAssociationDto();
        dto.setId(user.getId());
        dto.setFirstName(user.getFirstName() != null ? user.getFirstName() : "N/A");
        dto.setLastName(user.getLastName() != null ? user.getLastName() : "N/A");
        dto.setEmail(user.getEmail());
        dto.setRole(user.getRole() != null ? user.getRole().name() : "TECHNICIAN");
        dto.setAssignedAt(user.getCreatedAt() != null ? 
            user.getCreatedAt().toString() : "N/A");
        dto.setNotes("Assigné directement au manager");
        return dto;
    }
}
