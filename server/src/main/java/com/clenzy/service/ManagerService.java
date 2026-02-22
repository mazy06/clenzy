package com.clenzy.service;

import com.clenzy.dto.AssignmentRequest;
import com.clenzy.dto.ManagerAssociationsDto;
import com.clenzy.dto.ClientAssociationDto;
import com.clenzy.dto.PropertyAssociationDto;
import com.clenzy.dto.TeamAssociationDto;
import com.clenzy.dto.TeamUserAssignmentRequest;
import com.clenzy.dto.UserAssociationDto;
import com.clenzy.dto.manager.AssignmentResultDto;
import com.clenzy.dto.manager.ManagerTeamSummaryDto;
import com.clenzy.dto.manager.ManagerUserSummaryDto;
import com.clenzy.dto.manager.PropertyAssignmentResultDto;
import com.clenzy.dto.manager.PropertyByClientDto;
import com.clenzy.dto.manager.TeamUserAssignmentResultDto;
import com.clenzy.dto.manager.UnassignmentResultDto;
import com.clenzy.model.ManagerProperty;
import com.clenzy.model.ManagerTeam;
import com.clenzy.model.ManagerUser;
import com.clenzy.model.Portfolio;
import com.clenzy.model.PortfolioClient;
import com.clenzy.model.PortfolioTeam;
import com.clenzy.model.Property;
import com.clenzy.model.Team;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.repository.ManagerPropertyRepository;
import com.clenzy.repository.ManagerTeamRepository;
import com.clenzy.repository.ManagerUserRepository;
import com.clenzy.repository.PortfolioClientRepository;
import com.clenzy.repository.PortfolioRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.TeamRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class ManagerService {

    private static final Logger log = LoggerFactory.getLogger(ManagerService.class);

    private final PortfolioRepository portfolioRepository;
    private final PortfolioClientRepository portfolioClientRepository;
    private final PropertyRepository propertyRepository;
    private final TeamRepository teamRepository;
    private final UserRepository userRepository;
    private final ManagerTeamRepository managerTeamRepository;
    private final ManagerUserRepository managerUserRepository;
    private final ManagerPropertyRepository managerPropertyRepository;
    private final TenantContext tenantContext;

    public ManagerService(PortfolioRepository portfolioRepository,
                          PortfolioClientRepository portfolioClientRepository,
                          PropertyRepository propertyRepository,
                          TeamRepository teamRepository,
                          UserRepository userRepository,
                          ManagerTeamRepository managerTeamRepository,
                          ManagerUserRepository managerUserRepository,
                          ManagerPropertyRepository managerPropertyRepository,
                          TenantContext tenantContext) {
        this.portfolioRepository = portfolioRepository;
        this.portfolioClientRepository = portfolioClientRepository;
        this.propertyRepository = propertyRepository;
        this.teamRepository = teamRepository;
        this.userRepository = userRepository;
        this.managerTeamRepository = managerTeamRepository;
        this.managerUserRepository = managerUserRepository;
        this.managerPropertyRepository = managerPropertyRepository;
        this.tenantContext = tenantContext;
    }

    // ===== MANAGER ID RESOLUTION =====

    /**
     * Resolve a managerId string (numeric DB ID or Keycloak UUID) to a database Long ID.
     * Returns empty if the UUID is not found in the database.
     */
    public Optional<Long> resolveManagerId(String managerId) {
        try {
            return Optional.of(Long.parseLong(managerId));
        } catch (NumberFormatException e) {
            log.debug("UUID Keycloak detecte, recherche en base...");
            return userRepository.findByKeycloakId(managerId)
                    .map(user -> {
                        log.debug("Utilisateur trouve avec ID: {}", user.getId());
                        return user.getId();
                    });
        }
    }

    // ===== OWNERSHIP VALIDATION =====

    /**
     * Validate that the authenticated user is the target manager or a SUPER_ADMIN.
     */
    public void validateManagerOwnership(Jwt jwt, Long targetManagerId) {
        final String keycloakId = jwt.getSubject();

        @SuppressWarnings("unchecked")
        Map<String, Object> realmAccess = jwt.getClaim("realm_access");
        if (realmAccess != null) {
            @SuppressWarnings("unchecked")
            List<String> roles = (List<String>) realmAccess.get("roles");
            if (roles != null && roles.contains("SUPER_ADMIN")) {
                return;
            }
        }

        Optional<User> userOpt = userRepository.findByKeycloakId(keycloakId);
        if (userOpt.isEmpty() || !userOpt.get().getId().equals(targetManagerId)) {
            throw new AccessDeniedException("Vous n'avez pas acces aux donnees de ce manager");
        }
    }

    // ===== LISTING ENDPOINTS =====

    /**
     * Get all managers and admins as summary DTOs.
     */
    @Transactional(readOnly = true)
    public List<ManagerUserSummaryDto> getAllManagersAndAdmins() {
        log.debug("Recuperation de tous les managers et admins");
        final List<UserRole> roles = Arrays.asList(UserRole.SUPER_ADMIN, UserRole.SUPER_MANAGER);
        final List<User> users = userRepository.findByRoleIn(roles, tenantContext.getRequiredOrganizationId());
        return users.stream()
                .map(this::toUserSummaryDto)
                .collect(Collectors.toList());
    }

    /**
     * Get available HOST users as summary DTOs.
     */
    @Transactional(readOnly = true)
    public List<ManagerUserSummaryDto> getAvailableHostSummaries() {
        final List<User> hosts = getAvailableHosts();
        return hosts.stream()
                .map(this::toUserSummaryDto)
                .collect(Collectors.toList());
    }

    /**
     * Get available properties for a list of client IDs as PropertyByClientDto.
     */
    @Transactional(readOnly = true)
    public List<PropertyByClientDto> getPropertiesByClients(List<Long> clientIds) {
        log.debug("Recuperation des proprietes pour clients: {}", clientIds);
        final List<PropertyByClientDto> result = new ArrayList<>();

        for (Long clientId : clientIds) {
            final List<Property> hostProperties = propertyRepository.findByOwnerId(clientId);
            for (Property property : hostProperties) {
                if (!managerPropertyRepository.existsByPropertyId(property.getId(), tenantContext.getRequiredOrganizationId())) {
                    result.add(toPropertyByClientDto(property));
                }
            }
        }

        log.debug("Proprietes disponibles recuperees pour {} clients", clientIds.size());
        return result;
    }

    /**
     * Get all operational users (technicians, housekeepers, etc.) as summary DTOs.
     */
    @Transactional(readOnly = true)
    public List<ManagerUserSummaryDto> getOperationalUsers() {
        log.debug("Recuperation des utilisateurs operationnels");
        final List<UserRole> roles = Arrays.asList(
                UserRole.TECHNICIAN, UserRole.HOUSEKEEPER,
                UserRole.SUPERVISOR, UserRole.LAUNDRY, UserRole.EXTERIOR_TECH);
        final List<User> users = userRepository.findByRoleIn(roles, tenantContext.getRequiredOrganizationId());
        log.debug("{} utilisateurs operationnels trouves", users.size());
        return users.stream()
                .map(this::toUserSummaryDto)
                .collect(Collectors.toList());
    }

    /**
     * Get all teams as summary DTOs.
     */
    @Transactional(readOnly = true)
    public List<ManagerTeamSummaryDto> getAllTeamSummaries() {
        log.debug("Recuperation de toutes les equipes depuis la base de donnees");
        final List<Team> teams = teamRepository.findAll();
        log.debug("{} equipes trouvees en base", teams.size());
        return teams.stream()
                .map(this::toTeamSummaryDto)
                .collect(Collectors.toList());
    }

    // ===== ASSIGNMENT OPERATIONS =====

    /**
     * Assign clients and properties to a manager, creating a portfolio if needed.
     */
    @Transactional
    public AssignmentResultDto assignClientsAndProperties(Long managerId, AssignmentRequest request) {
        log.debug("Assignation clients/proprietes pour manager {}", managerId);

        final User manager = userRepository.findById(managerId)
                .orElseThrow(() -> new IllegalArgumentException("Manager non trouve"));

        Portfolio portfolio = getOrCreateManagerPortfolio(managerId, manager);

        int clientsAssigned = 0;
        int propertiesAssigned = 0;

        // Assign clients to portfolio
        if (request.getClientIds() != null && !request.getClientIds().isEmpty()) {
            clientsAssigned = assignClientsToPortfolio(portfolio, request.getClientIds());
        }

        // Assign properties to manager
        if (request.getPropertyIds() != null && !request.getPropertyIds().isEmpty()) {
            propertiesAssigned = assignPropertiesToManager(managerId, portfolio, request);
        }

        log.debug("Assignation terminee: {} clients, {} proprietes", clientsAssigned, propertiesAssigned);
        return new AssignmentResultDto("Assignation reussie", clientsAssigned, propertiesAssigned, portfolio.getId());
    }

    /**
     * Assign teams and users to a manager.
     */
    @Transactional
    public TeamUserAssignmentResultDto assignTeamsAndUsers(Long managerId, TeamUserAssignmentRequest request) {
        log.debug("Assignation equipes et utilisateurs pour manager: {}", managerId);

        int teamsAssigned = 0;
        int usersAssigned = 0;

        if (request.getTeamIds() != null && !request.getTeamIds().isEmpty()) {
            for (Long teamId : request.getTeamIds()) {
                if (!managerTeamRepository.existsByManagerIdAndTeamIdAndIsActiveTrue(managerId, teamId, tenantContext.getRequiredOrganizationId())) {
                    final ManagerTeam managerTeam = new ManagerTeam(managerId, teamId);
                    managerTeamRepository.save(managerTeam);
                    teamsAssigned++;
                    log.debug("Equipe {} assignee au manager {}", teamId, managerId);
                } else {
                    log.debug("Equipe {} deja assignee au manager {}", teamId, managerId);
                }
            }
        }

        if (request.getUserIds() != null && !request.getUserIds().isEmpty()) {
            for (Long userId : request.getUserIds()) {
                if (!managerUserRepository.existsByManagerIdAndUserIdAndIsActiveTrue(managerId, userId, tenantContext.getRequiredOrganizationId())) {
                    final ManagerUser managerUser = new ManagerUser(managerId, userId);
                    managerUserRepository.save(managerUser);
                    usersAssigned++;
                    log.debug("Utilisateur {} assigne au manager {}", userId, managerId);
                } else {
                    log.debug("Utilisateur {} deja assigne au manager {}", userId, managerId);
                }
            }
        }

        log.debug("Assignation terminee: {} equipes, {} utilisateurs", teamsAssigned, usersAssigned);
        return new TeamUserAssignmentResultDto("Assignation reussie", teamsAssigned, usersAssigned);
    }

    // ===== UNASSIGNMENT OPERATIONS =====

    /**
     * Unassign a client from a manager's portfolio.
     */
    @Transactional
    public UnassignmentResultDto unassignClient(Long managerId, Long clientId) {
        log.debug("Desassignation du client {} du manager {}", clientId, managerId);

        final Portfolio portfolio = findManagerPortfolio(managerId);
        if (portfolio == null) {
            throw new IllegalArgumentException("Portefeuille non trouve");
        }

        final Optional<PortfolioClient> portfolioClientOpt =
                portfolioClientRepository.findByPortfolioIdAndClientId(portfolio.getId(), clientId, tenantContext.getRequiredOrganizationId());

        if (portfolioClientOpt.isEmpty()) {
            throw new IllegalArgumentException("Client non assigne a ce portefeuille");
        }

        portfolioClientRepository.delete(portfolioClientOpt.get());
        log.debug("Client {} desassigne du portefeuille {}", clientId, portfolio.getId());
        return new UnassignmentResultDto("Client desassigne avec succes", 1);
    }

    /**
     * Unassign a team from a manager (soft delete).
     */
    @Transactional
    public UnassignmentResultDto unassignTeam(Long managerId, Long teamId) {
        log.debug("Desassignation de l'equipe {} du manager {}", teamId, managerId);

        final List<ManagerTeam> managerTeams = managerTeamRepository.findAllByManagerIdAndTeamId(managerId, teamId, tenantContext.getRequiredOrganizationId());
        int removedCount = 0;
        for (ManagerTeam mt : managerTeams) {
            mt.setIsActive(false);
            managerTeamRepository.save(mt);
            removedCount++;
        }

        log.debug("{} association(s) equipe supprimee(s)", removedCount);
        return new UnassignmentResultDto("Equipe desassignee avec succes", removedCount);
    }

    /**
     * Unassign a user from a manager (soft delete).
     */
    @Transactional
    public UnassignmentResultDto unassignUser(Long managerId, Long userId) {
        log.debug("Desassignation de l'utilisateur {} du manager {}", userId, managerId);

        final List<ManagerUser> managerUsers = managerUserRepository.findAllByManagerIdAndUserId(managerId, userId, tenantContext.getRequiredOrganizationId());
        int removedCount = 0;
        for (ManagerUser mu : managerUsers) {
            mu.setIsActive(false);
            managerUserRepository.save(mu);
            removedCount++;
        }

        log.debug("{} association(s) utilisateur supprimee(s)", removedCount);
        return new UnassignmentResultDto("Utilisateur desassigne avec succes", removedCount);
    }

    // ===== PROPERTY ASSIGNMENT/UNASSIGNMENT =====

    /**
     * Assign a specific property to a manager.
     */
    @Transactional
    public PropertyAssignmentResultDto assignPropertyToManager(Long managerId, Long propertyId) {
        log.debug("Reassignation de la propriete {} au manager {}", propertyId, managerId);

        final Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new IllegalArgumentException("Propriete non trouvee"));

        final Long hostId = property.getOwner().getId();
        final Portfolio portfolio = findPortfolioForHost(managerId, hostId);
        if (portfolio == null) {
            throw new IllegalArgumentException("Le proprietaire de cette propriete n'est pas assigne a ce manager");
        }

        final ManagerProperty existingAssociation = managerPropertyRepository.findByManagerIdAndPropertyId(
                managerId, propertyId, tenantContext.getRequiredOrganizationId());
        if (existingAssociation == null) {
            final ManagerProperty managerProperty = new ManagerProperty(managerId, propertyId, "Reassignee par le manager");
            managerPropertyRepository.save(managerProperty);
            log.debug("Association manager-propriete creee pour manager {} et propriete {}", managerId, propertyId);
        } else {
            log.debug("Association manager-propriete existe deja pour manager {} et propriete {}", managerId, propertyId);
        }

        return new PropertyAssignmentResultDto("Propriete reassignee avec succes", propertyId);
    }

    /**
     * Unassign a specific property from a manager.
     */
    @Transactional
    public PropertyAssignmentResultDto unassignPropertyFromManager(Long managerId, Long propertyId) {
        log.debug("Desassignation de la propriete {} du manager {}", propertyId, managerId);

        propertyRepository.findById(propertyId)
                .orElseThrow(() -> new IllegalArgumentException("Propriete non trouvee"));

        final ManagerProperty managerProperty = managerPropertyRepository.findByManagerIdAndPropertyId(
                managerId, propertyId, tenantContext.getRequiredOrganizationId());

        if (managerProperty == null) {
            throw new IllegalArgumentException("Propriete non assignee a ce manager");
        }

        managerPropertyRepository.delete(managerProperty);
        log.debug("Propriete {} desassignee du manager {}", propertyId, managerId);

        return new PropertyAssignmentResultDto("Propriete desassignee avec succes - Client libere", propertyId);
    }

    // ===== EXISTING METHODS (preserved) =====

    /**
     * Get HOSTs that have at least one unassigned property.
     */
    @Transactional(readOnly = true)
    public List<User> getAvailableHosts() {
        log.debug("Recuperation des HOSTs disponibles...");
        final List<User> allHosts = userRepository.findByRoleIn(
                Arrays.asList(UserRole.HOST), tenantContext.getRequiredOrganizationId());
        final List<User> availableHosts = new ArrayList<>();

        for (User host : allHosts) {
            final List<Property> hostProperties = propertyRepository.findByOwnerId(host.getId());

            if (hostProperties.isEmpty()) {
                availableHosts.add(host);
                continue;
            }

            boolean hasUnassignedProperty = false;
            for (Property property : hostProperties) {
                if (!managerPropertyRepository.existsByPropertyId(property.getId(), tenantContext.getRequiredOrganizationId())) {
                    hasUnassignedProperty = true;
                    break;
                }
            }

            if (hasUnassignedProperty) {
                availableHosts.add(host);
            }
        }
        log.debug("{} HOSTs disponibles trouves.", availableHosts.size());
        return availableHosts;
    }

    /**
     * Get unassigned properties for a HOST.
     */
    @Transactional(readOnly = true)
    public List<Property> getAvailablePropertiesForHost(Long hostId) {
        log.debug("Recuperation des proprietes disponibles pour le HOST {}", hostId);
        final List<Property> allHostProperties = propertyRepository.findByOwnerId(hostId);
        final List<Property> availableProperties = new ArrayList<>();

        for (Property property : allHostProperties) {
            if (!managerPropertyRepository.existsByPropertyId(property.getId(), tenantContext.getRequiredOrganizationId())) {
                availableProperties.add(property);
            }
        }

        log.debug("{} proprietes disponibles trouvees pour le HOST {}", availableProperties.size(), hostId);
        return availableProperties;
    }

    /**
     * Get unassigned properties for a HOST with owner info as Maps.
     * @deprecated Use {@link #getPropertiesByClients(List)} instead for typed results.
     */
    @Deprecated
    @Transactional(readOnly = true)
    public List<java.util.Map<String, Object>> getAvailablePropertiesForHostWithOwner(Long hostId) {
        log.debug("Recuperation des proprietes disponibles avec owner pour le HOST {}", hostId);
        final List<Property> allHostProperties = propertyRepository.findByOwnerId(hostId);
        final List<java.util.Map<String, Object>> availableProperties = new ArrayList<>();

        for (Property property : allHostProperties) {
            if (!managerPropertyRepository.existsByPropertyId(property.getId(), tenantContext.getRequiredOrganizationId())) {
                final java.util.Map<String, Object> propertyData = new java.util.HashMap<>();
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
            }
        }

        log.debug("{} proprietes disponibles trouvees pour le HOST {}", availableProperties.size(), hostId);
        return availableProperties;
    }

    /**
     * Get all associations for a manager in a single optimized call.
     */
    @Transactional(readOnly = true)
    public ManagerAssociationsDto getManagerAssociations(Long managerId) {
        log.debug("getManagerAssociations() - Recuperation des associations pour le manager: {}", managerId);

        final List<Portfolio> portfolios = portfolioRepository.findByManagerId(managerId, tenantContext.getRequiredOrganizationId());
        log.debug("{} portefeuilles trouves", portfolios.size());

        // Clients via portfolios
        final List<ClientAssociationDto> clients = portfolios.stream()
                .flatMap(portfolio -> portfolio.getClients().stream())
                .map(this::convertToClientAssociationDto)
                .collect(Collectors.toList());

        // Users via portfolios
        final List<UserAssociationDto> usersFromPortfolios = portfolios.stream()
                .flatMap(portfolio -> portfolio.getTeamMembers().stream())
                .map(this::convertToUserAssociationDto)
                .collect(Collectors.toList());

        // Users via direct manager_users association
        final List<ManagerUser> managerUsers = managerUserRepository.findByManagerIdAndIsActiveTrue(managerId, tenantContext.getRequiredOrganizationId());
        final List<UserAssociationDto> usersFromDirect = managerUsers.stream()
                .map(mu -> userRepository.findById(mu.getUserId()).orElse(null))
                .filter(user -> user != null)
                .map(this::convertUserToAssociationDto)
                .collect(Collectors.toList());

        final List<UserAssociationDto> users = new ArrayList<>();
        users.addAll(usersFromPortfolios);
        users.addAll(usersFromDirect);

        // Properties via manager_properties
        final List<PropertyAssociationDto> properties = new ArrayList<>();
        final List<ManagerProperty> managerProperties = managerPropertyRepository.findByManagerId(managerId, tenantContext.getRequiredOrganizationId());

        for (ManagerProperty mp : managerProperties) {
            final Property property = propertyRepository.findById(mp.getPropertyId()).orElse(null);
            if (property != null) {
                final PropertyAssociationDto dto = convertToPropertyAssociationDto(property);
                dto.setAssignedAt(mp.getAssignedAt() != null
                        ? mp.getAssignedAt().format(java.time.format.DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                        : "N/A");
                dto.setNotes(mp.getNotes() != null ? mp.getNotes() : "Assignee specifiquement");
                properties.add(dto);
            }
        }

        // Teams via manager_teams
        final List<ManagerTeam> managerTeams = managerTeamRepository.findByManagerIdAndIsActiveTrue(managerId, tenantContext.getRequiredOrganizationId());
        final List<TeamAssociationDto> teams = managerTeams.stream()
                .map(mt -> teamRepository.findById(mt.getTeamId()).orElse(null))
                .filter(team -> team != null)
                .map(this::convertToTeamAssociationDto)
                .collect(Collectors.toList());

        log.debug("Associations recuperees: Clients={}, Proprietes={}, Equipes={}, Utilisateurs={}",
                clients.size(), properties.size(), teams.size(), users.size());

        return new ManagerAssociationsDto(clients, properties, teams, users);
    }

    // ===== PRIVATE HELPERS =====

    private Portfolio getOrCreateManagerPortfolio(Long managerId, User manager) {
        final Portfolio existing = findManagerPortfolio(managerId);
        if (existing != null) {
            return existing;
        }

        final Portfolio portfolio = new Portfolio();
        portfolio.setName("Portefeuille Manager " + managerId);
        portfolio.setDescription("Portefeuille automatiquement cree");
        portfolio.setManager(manager);
        portfolio.setIsActive(true);
        final Portfolio saved = portfolioRepository.save(portfolio);
        log.debug("Portefeuille cree: {}", saved.getId());
        return saved;
    }

    private Portfolio findManagerPortfolio(Long managerId) {
        return portfolioRepository.findByManagerId(managerId, tenantContext.getRequiredOrganizationId()).stream()
                .findFirst()
                .orElse(null);
    }

    private Portfolio findPortfolioForHost(Long managerId, Long hostId) {
        return portfolioRepository.findByManagerId(managerId, tenantContext.getRequiredOrganizationId()).stream()
                .filter(p -> p.getClients().stream().anyMatch(pc -> pc.getClient().getId().equals(hostId)))
                .findFirst()
                .orElse(null);
    }

    private int assignClientsToPortfolio(Portfolio portfolio, List<Long> clientIds) {
        int assigned = 0;
        for (Long clientId : clientIds) {
            if (!portfolioClientRepository.existsByPortfolioIdAndClientId(portfolio.getId(), clientId, tenantContext.getRequiredOrganizationId())) {
                final User client = userRepository.findById(clientId).orElse(null);
                if (client != null) {
                    final PortfolioClient portfolioClient = new PortfolioClient(portfolio, client);
                    portfolioClientRepository.save(portfolioClient);
                    assigned++;
                    log.debug("Client {} assigne au portefeuille {}", clientId, portfolio.getId());
                } else {
                    log.warn("Client {} non trouve", clientId);
                }
            } else {
                log.debug("Client {} deja assigne au portefeuille {}", clientId, portfolio.getId());
            }
        }
        return assigned;
    }

    private int assignPropertiesToManager(Long managerId, Portfolio portfolio, AssignmentRequest request) {
        int assigned = 0;
        for (Long propertyId : request.getPropertyIds()) {
            final Property property = propertyRepository.findById(propertyId).orElse(null);
            if (property == null) {
                log.warn("Propriete {} non trouvee", propertyId);
                continue;
            }

            final boolean isClientAssigned = request.getClientIds().contains(property.getOwner().getId());
            if (!isClientAssigned) {
                log.warn("Propriete {} n'appartient pas aux clients assignes", propertyId);
                continue;
            }

            if (!managerPropertyRepository.existsByManagerIdAndPropertyId(managerId, propertyId, tenantContext.getRequiredOrganizationId())) {
                final ManagerProperty managerProperty = new ManagerProperty(managerId, propertyId, "Assignee via formulaire");
                managerPropertyRepository.save(managerProperty);
                assigned++;
                log.debug("Propriete {} assignee au manager {}", propertyId, managerId);
            } else {
                log.debug("Propriete {} deja assignee au manager {}", propertyId, managerId);
            }
        }
        return assigned;
    }

    // ===== DTO CONVERSION HELPERS =====

    private ManagerUserSummaryDto toUserSummaryDto(User user) {
        return new ManagerUserSummaryDto(
                user.getId(),
                user.getFirstName() != null ? user.getFirstName() : "",
                user.getLastName() != null ? user.getLastName() : "",
                user.getEmail() != null ? user.getEmail() : "",
                user.getRole() != null ? user.getRole().name() : "",
                user.getStatus() != null ? user.getStatus().name().equals("ACTIVE") : true
        );
    }

    private ManagerTeamSummaryDto toTeamSummaryDto(Team team) {
        String description = team.getDescription();
        if (description != null && description.length() > 50) {
            description = description.substring(0, 47) + "...";
        }
        return new ManagerTeamSummaryDto(
                team.getId(),
                team.getName(),
                description != null ? description : "",
                team.getInterventionType(),
                0, // Avoid LazyInitializationException
                true
        );
    }

    private PropertyByClientDto toPropertyByClientDto(Property property) {
        final String firstName = property.getOwner().getFirstName() != null ? property.getOwner().getFirstName() : "";
        final String lastName = property.getOwner().getLastName() != null ? property.getOwner().getLastName() : "";
        String ownerName = (firstName + " " + lastName).trim();
        if (ownerName.isEmpty()) {
            ownerName = "Proprietaire inconnu";
        }

        return new PropertyByClientDto(
                property.getId(),
                property.getName() != null ? property.getName() : "",
                property.getAddress() != null ? property.getAddress() : "",
                property.getCity() != null ? property.getCity() : "",
                property.getType() != null ? property.getType().name() : "",
                property.getStatus() != null ? property.getStatus().name() : "",
                property.getOwner().getId(),
                ownerName,
                property.getStatus() != null ? property.getStatus().name().equals("ACTIVE") : true
        );
    }

    private ClientAssociationDto convertToClientAssociationDto(PortfolioClient portfolioClient) {
        final ClientAssociationDto dto = new ClientAssociationDto();
        dto.setId(portfolioClient.getClient().getId());
        dto.setFirstName(portfolioClient.getClient().getFirstName() != null
                ? portfolioClient.getClient().getFirstName() : "N/A");
        dto.setLastName(portfolioClient.getClient().getLastName() != null
                ? portfolioClient.getClient().getLastName() : "N/A");
        dto.setEmail(portfolioClient.getClient().getEmail());
        dto.setPhoneNumber(portfolioClient.getClient().getPhoneNumber());
        dto.setRole("HOST");
        dto.setAssignedAt(portfolioClient.getAssignedAt() != null
                ? portfolioClient.getAssignedAt().format(java.time.format.DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                : "N/A");
        dto.setNotes(portfolioClient.getNotes());
        dto.setPortfolioId(portfolioClient.getPortfolio().getId());
        dto.setPortfolioName(portfolioClient.getPortfolio().getName());
        return dto;
    }

    private UserAssociationDto convertToUserAssociationDto(PortfolioTeam portfolioTeam) {
        final UserAssociationDto dto = new UserAssociationDto();
        dto.setId(portfolioTeam.getTeamMember().getId());
        dto.setFirstName(portfolioTeam.getTeamMember().getFirstName() != null
                ? portfolioTeam.getTeamMember().getFirstName() : "N/A");
        dto.setLastName(portfolioTeam.getTeamMember().getLastName() != null
                ? portfolioTeam.getTeamMember().getLastName() : "N/A");
        dto.setEmail(portfolioTeam.getTeamMember().getEmail());
        dto.setRole(portfolioTeam.getRoleInTeam() != null
                ? portfolioTeam.getRoleInTeam().name() : "TECHNICIAN");
        dto.setAssignedAt(portfolioTeam.getAssignedAt() != null
                ? portfolioTeam.getAssignedAt().toString() : "N/A");
        dto.setNotes(portfolioTeam.getNotes());
        dto.setPortfolioId(portfolioTeam.getPortfolio().getId());
        dto.setPortfolioName(portfolioTeam.getPortfolio().getName());
        return dto;
    }

    private PropertyAssociationDto convertToPropertyAssociationDto(Property property) {
        final PropertyAssociationDto dto = new PropertyAssociationDto();
        dto.setId(property.getId());
        dto.setName(property.getName());
        dto.setAddress(property.getAddress());
        dto.setDescription(property.getDescription());
        dto.setOwnerId(property.getOwner().getId());
        dto.setOwnerName(property.getOwner().getFirstName() + " " + property.getOwner().getLastName());
        dto.setAssignedAt(property.getCreatedAt() != null
                ? property.getCreatedAt().toString() : "N/A");
        dto.setNotes(property.getSpecialRequirements());
        return dto;
    }

    private TeamAssociationDto convertToTeamAssociationDto(Team team) {
        final TeamAssociationDto dto = new TeamAssociationDto();
        dto.setId(team.getId());
        dto.setName(team.getName());
        dto.setDescription(team.getDescription());
        dto.setMemberCount(team.getMemberCount());
        dto.setAssignedAt(team.getCreatedAt() != null
                ? team.getCreatedAt().toString() : "N/A");
        dto.setNotes(team.getInterventionType());
        return dto;
    }

    private UserAssociationDto convertUserToAssociationDto(User user) {
        final UserAssociationDto dto = new UserAssociationDto();
        dto.setId(user.getId());
        dto.setFirstName(user.getFirstName() != null ? user.getFirstName() : "N/A");
        dto.setLastName(user.getLastName() != null ? user.getLastName() : "N/A");
        dto.setEmail(user.getEmail());
        dto.setRole(user.getRole() != null ? user.getRole().name() : "TECHNICIAN");
        dto.setAssignedAt(user.getCreatedAt() != null
                ? user.getCreatedAt().toString() : "N/A");
        dto.setNotes("Assigne directement au manager");
        return dto;
    }
}
