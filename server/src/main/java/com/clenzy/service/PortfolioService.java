package com.clenzy.service;

import com.clenzy.dto.PortfolioDto;
import com.clenzy.dto.PortfolioClientDto;
import com.clenzy.dto.PortfolioStatsDto;
import com.clenzy.dto.PortfolioTeamDto;
import com.clenzy.model.*;
import com.clenzy.model.NotificationKey;
import com.clenzy.repository.PortfolioRepository;
import com.clenzy.repository.PortfolioClientRepository;
import com.clenzy.repository.PortfolioTeamRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Transactional
public class PortfolioService {

    private static final Logger log = LoggerFactory.getLogger(PortfolioService.class);

    private final PortfolioRepository portfolioRepository;
    private final PortfolioClientRepository portfolioClientRepository;
    private final PortfolioTeamRepository portfolioTeamRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final com.clenzy.tenant.TenantContext tenantContext;

    public PortfolioService(PortfolioRepository portfolioRepository,
                            PortfolioClientRepository portfolioClientRepository,
                            PortfolioTeamRepository portfolioTeamRepository,
                            PropertyRepository propertyRepository,
                            UserRepository userRepository,
                            NotificationService notificationService,
                            com.clenzy.tenant.TenantContext tenantContext) {
        this.portfolioRepository = portfolioRepository;
        this.portfolioClientRepository = portfolioClientRepository;
        this.portfolioTeamRepository = portfolioTeamRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.tenantContext = tenantContext;
    }
    
    /**
     * Créer un nouveau portefeuille
     */
    public PortfolioDto createPortfolio(PortfolioDto portfolioDto) {
        User manager = userRepository.findById(portfolioDto.getManagerId())
            .orElseThrow(() -> new RuntimeException("Manager non trouvé"));
        
        Portfolio portfolio = new Portfolio(manager, portfolioDto.getName(), portfolioDto.getDescription());
        portfolio.setOrganizationId(tenantContext.getRequiredOrganizationId());
        Portfolio savedPortfolio = portfolioRepository.save(portfolio);

        try {
            notificationService.notifyAdminsAndManagers(
                NotificationKey.PORTFOLIO_CREATED,
                "Nouveau portefeuille",
                "Portefeuille \"" + savedPortfolio.getName() + "\" cree pour " + manager.getFirstName() + " " + manager.getLastName(),
                "/portfolios/" + savedPortfolio.getId()
            );
        } catch (Exception e) {
            log.warn("Erreur notification PORTFOLIO_CREATED: {}", e.getMessage());
        }

        return convertToDto(savedPortfolio);
    }

    /**
     * Mettre à jour un portefeuille
     */
    public PortfolioDto updatePortfolio(Long portfolioId, PortfolioDto portfolioDto) {
        Portfolio portfolio = portfolioRepository.findById(portfolioId)
            .orElseThrow(() -> new RuntimeException("Portefeuille non trouvé"));
        
        portfolio.setName(portfolioDto.getName());
        portfolio.setDescription(portfolioDto.getDescription());
        portfolio.setIsActive(portfolioDto.getIsActive());
        
        Portfolio savedPortfolio = portfolioRepository.save(portfolio);
        return convertToDto(savedPortfolio);
    }
    
    /**
     * Récupérer un portefeuille par son ID
     */
    public PortfolioDto getPortfolioById(Long portfolioId) {
        Portfolio portfolio = portfolioRepository.findById(portfolioId)
            .orElseThrow(() -> new RuntimeException("Portefeuille non trouvé"));
        
        return convertToDto(portfolio);
    }
    
    /**
     * Récupérer tous les portefeuilles d'un manager
     */
    public List<PortfolioDto> getPortfoliosByManager(Long managerId) {
        List<Portfolio> portfolios = portfolioRepository.findByManagerId(managerId, tenantContext.getRequiredOrganizationId());
        return portfolios.stream()
            .map(this::convertToDto)
            .collect(Collectors.toList());
    }

    /**
     * Récupérer tous les portefeuilles actifs
     */
    public List<PortfolioDto> getAllActivePortfolios() {
        List<Portfolio> portfolios = portfolioRepository.findByIsActiveTrue(tenantContext.getRequiredOrganizationId());
        return portfolios.stream()
            .map(this::convertToDto)
            .collect(Collectors.toList());
    }
    
    /**
     * Ajouter un client au portefeuille
     */
    public PortfolioClientDto addClientToPortfolio(Long portfolioId, Long clientId, String notes) {
        Portfolio portfolio = portfolioRepository.findById(portfolioId)
            .orElseThrow(() -> new RuntimeException("Portefeuille non trouvé"));
        
        User client = userRepository.findById(clientId)
            .orElseThrow(() -> new RuntimeException("Client non trouvé"));
        
        // Vérifier que le client n'est pas déjà dans ce portefeuille
        if (portfolioClientRepository.existsByPortfolioIdAndClientId(portfolioId, clientId, tenantContext.getRequiredOrganizationId())) {
            throw new RuntimeException("Ce client est déjà dans ce portefeuille");
        }
        
        PortfolioClient portfolioClient = new PortfolioClient(portfolio, client);
        portfolioClient.setOrganizationId(tenantContext.getRequiredOrganizationId());
        portfolioClient.setNotes(notes);
        
        PortfolioClient savedClient = portfolioClientRepository.save(portfolioClient);

        try {
            notificationService.notifyAdminsAndManagers(
                NotificationKey.PORTFOLIO_CLIENT_ADDED,
                "Client ajoute au portefeuille",
                "Client " + client.getFirstName() + " " + client.getLastName() + " ajoute au portefeuille \"" + portfolio.getName() + "\"",
                "/portfolios/" + portfolioId
            );
        } catch (Exception e) {
            log.warn("Erreur notification PORTFOLIO_CLIENT_ADDED: {}", e.getMessage());
        }

        return convertClientToDto(savedClient);
    }
    
    /**
     * Retirer un client du portefeuille
     */
    public void removeClientFromPortfolio(Long portfolioId, Long clientId) {
        PortfolioClient portfolioClient = portfolioClientRepository
            .findByPortfolioIdAndClientId(portfolioId, clientId, tenantContext.getRequiredOrganizationId())
            .orElseThrow(() -> new RuntimeException("Client non trouvé dans ce portefeuille"));

        portfolioClientRepository.delete(portfolioClient);

        try {
            notificationService.notifyAdminsAndManagers(
                NotificationKey.PORTFOLIO_CLIENT_REMOVED,
                "Client retire du portefeuille",
                "Client #" + clientId + " retire du portefeuille #" + portfolioId,
                "/portfolios/" + portfolioId
            );
        } catch (Exception e) {
            log.warn("Erreur notification PORTFOLIO_CLIENT_REMOVED: {}", e.getMessage());
        }
    }
    
    /**
     * Ajouter un membre d'équipe au portefeuille
     */
    public PortfolioTeamDto addTeamMemberToPortfolio(Long portfolioId, Long teamMemberId, TeamRole roleInTeam, String notes) {
        Portfolio portfolio = portfolioRepository.findById(portfolioId)
            .orElseThrow(() -> new RuntimeException("Portefeuille non trouvé"));
        
        User teamMember = userRepository.findById(teamMemberId)
            .orElseThrow(() -> new RuntimeException("Membre d'équipe non trouvé"));
        
        // Vérifier que le membre n'est pas déjà dans ce portefeuille
        if (portfolioTeamRepository.existsByPortfolioIdAndTeamMemberId(portfolioId, teamMemberId, tenantContext.getRequiredOrganizationId())) {
            throw new RuntimeException("Ce membre d'équipe est déjà dans ce portefeuille");
        }
        
        PortfolioTeam portfolioTeam = new PortfolioTeam(portfolio, teamMember, roleInTeam);
        portfolioTeam.setOrganizationId(tenantContext.getRequiredOrganizationId());
        portfolioTeam.setNotes(notes);
        
        PortfolioTeam savedTeamMember = portfolioTeamRepository.save(portfolioTeam);
        return convertTeamToDto(savedTeamMember);
    }
    
    /**
     * Retirer un membre d'équipe du portefeuille
     */
    public void removeTeamMemberFromPortfolio(Long portfolioId, Long teamMemberId) {
        PortfolioTeam portfolioTeam = portfolioTeamRepository
            .findByPortfolioIdAndTeamMemberId(portfolioId, teamMemberId, tenantContext.getRequiredOrganizationId())
            .orElseThrow(() -> new RuntimeException("Membre d'équipe non trouvé dans ce portefeuille"));
        
        portfolioTeamRepository.delete(portfolioTeam);
    }
    
    /**
     * Trouver le manager responsable d'un HOST
     */
    public User findManagerForHost(User host) {
        List<PortfolioClient> portfolioClients = portfolioClientRepository
            .findByClientIdAndIsActiveTrue(host.getId(), tenantContext.getRequiredOrganizationId());
        
        if (!portfolioClients.isEmpty()) {
            return portfolioClients.get(0).getPortfolio().getManager();
        }
        
        throw new RuntimeException("Aucun manager trouvé pour ce HOST");
    }
    
    /**
     * Trouver le manager responsable d'un membre d'équipe
     */
    public User findManagerForTeamMember(User teamMember) {
        Optional<PortfolioTeam> portfolioTeam = portfolioTeamRepository
            .findByTeamMemberIdAndIsActiveTrue(teamMember.getId(), tenantContext.getRequiredOrganizationId());
        
        if (portfolioTeam.isPresent()) {
            return portfolioTeam.get().getPortfolio().getManager();
        }
        
        throw new RuntimeException("Aucun manager trouvé pour ce membre d'équipe");
    }
    
    /**
     * Récupérer les clients d'un portefeuille
     */
    public List<PortfolioClientDto> getPortfolioClients(Long portfolioId) {
        List<PortfolioClient> clients = portfolioClientRepository.findByPortfolioIdAndIsActiveTrue(portfolioId, tenantContext.getRequiredOrganizationId());
        return clients.stream()
            .map(this::convertClientToDto)
            .collect(Collectors.toList());
    }
    
    /**
     * Récupérer les membres d'équipe d'un portefeuille
     */
    public List<PortfolioTeamDto> getPortfolioTeamMembers(Long portfolioId) {
        List<PortfolioTeam> teamMembers = portfolioTeamRepository.findByPortfolioIdAndIsActiveTrue(portfolioId, tenantContext.getRequiredOrganizationId());
        return teamMembers.stream()
            .map(this::convertTeamToDto)
            .collect(Collectors.toList());
    }
    
    /**
     * Statistiques des portefeuilles d'un manager
     */
    @Transactional(readOnly = true)
    public PortfolioStatsDto getStatsByManager(Long managerId) {
        List<Portfolio> portfolios = portfolioRepository.findByManagerId(managerId, tenantContext.getRequiredOrganizationId());

        PortfolioStatsDto stats = new PortfolioStatsDto();
        stats.setTotalPortfolios(portfolios.size());

        int activeCount = 0;
        int inactiveCount = 0;
        Set<Long> uniqueClientIds = new HashSet<>();
        Set<Long> uniquePropertyIds = new HashSet<>();
        int totalTeamMembers = 0;

        List<PortfolioStatsDto.PortfolioBreakdown> breakdowns = new ArrayList<>();
        List<PortfolioStatsDto.RecentAssignment> allRecentAssignments = new ArrayList<>();

        for (Portfolio portfolio : portfolios) {
            // Count active / inactive
            if (Boolean.TRUE.equals(portfolio.getIsActive())) {
                activeCount++;
            } else {
                inactiveCount++;
            }

            // Clients for this portfolio
            List<PortfolioClient> clients = portfolioClientRepository
                    .findByPortfolioIdAndIsActiveTrue(portfolio.getId(), tenantContext.getRequiredOrganizationId());
            int clientCount = clients.size();

            // Collect unique client IDs and their properties
            for (PortfolioClient pc : clients) {
                Long clientId = pc.getClient().getId();
                uniqueClientIds.add(clientId);

                // Count properties owned by this client
                List<Property> clientProperties = propertyRepository.findByOwnerId(clientId);
                for (Property prop : clientProperties) {
                    uniquePropertyIds.add(prop.getId());
                }

                // Build recent assignment entry for this client
                allRecentAssignments.add(new PortfolioStatsDto.RecentAssignment(
                        pc.getId(),
                        "CLIENT",
                        pc.getClient().getFirstName() + " " + pc.getClient().getLastName(),
                        portfolio.getName(),
                        pc.getAssignedAt()
                ));
            }

            // Team members for this portfolio
            List<com.clenzy.model.PortfolioTeam> teamMembers = portfolioTeamRepository
                    .findByPortfolioIdAndIsActiveTrue(portfolio.getId(), tenantContext.getRequiredOrganizationId());
            int teamMemberCount = teamMembers.size();
            totalTeamMembers += teamMemberCount;

            for (com.clenzy.model.PortfolioTeam pt : teamMembers) {
                allRecentAssignments.add(new PortfolioStatsDto.RecentAssignment(
                        pt.getId(),
                        "TEAM",
                        pt.getTeamMember().getFirstName() + " " + pt.getTeamMember().getLastName(),
                        portfolio.getName(),
                        pt.getAssignedAt()
                ));
            }

            // Portfolio breakdown
            breakdowns.add(new PortfolioStatsDto.PortfolioBreakdown(
                    portfolio.getId(),
                    portfolio.getName(),
                    clientCount,
                    teamMemberCount,
                    Boolean.TRUE.equals(portfolio.getIsActive())
            ));
        }

        stats.setActivePortfolios(activeCount);
        stats.setInactivePortfolios(inactiveCount);
        stats.setTotalClients(uniqueClientIds.size());
        stats.setTotalProperties(uniquePropertyIds.size());
        stats.setTotalTeamMembers(totalTeamMembers);
        stats.setPortfolioBreakdown(breakdowns);

        // Sort recent assignments by date desc and keep top 10
        allRecentAssignments.sort(Comparator.comparing(
                PortfolioStatsDto.RecentAssignment::getAssignedAt,
                Comparator.nullsLast(Comparator.reverseOrder())
        ));
        stats.setRecentAssignments(
                allRecentAssignments.stream().limit(10).collect(Collectors.toList())
        );

        return stats;
    }

    /**
     * Conversion vers DTO
     */
    private PortfolioDto convertToDto(Portfolio portfolio) {
        PortfolioDto dto = new PortfolioDto(
            portfolio.getManager().getId(),
            portfolio.getName(),
            portfolio.getDescription()
        );
        
        dto.setId(portfolio.getId());
        dto.setIsActive(portfolio.getIsActive());
        dto.setCreatedAt(portfolio.getCreatedAt());
        dto.setUpdatedAt(portfolio.getUpdatedAt());
        dto.setManagerName(portfolio.getManager().getFirstName() + " " + portfolio.getManager().getLastName());
        
        // Compter les clients et membres d'équipe
        if (portfolio.getClients() != null) {
            dto.setClientCount((long) portfolio.getClients().size());
        }
        if (portfolio.getTeamMembers() != null) {
            dto.setTeamMemberCount((long) portfolio.getTeamMembers().size());
        }
        
        return dto;
    }
    
    /**
     * Conversion des clients vers DTO
     */
    private PortfolioClientDto convertClientToDto(PortfolioClient portfolioClient) {
        PortfolioClientDto dto = new PortfolioClientDto(
            portfolioClient.getPortfolio().getId(),
            portfolioClient.getClient().getId()
        );
        
        dto.setId(portfolioClient.getId());
        dto.setClientName(portfolioClient.getClient().getFirstName() + " " + portfolioClient.getClient().getLastName());
        dto.setClientEmail(portfolioClient.getClient().getEmail());
        dto.setClientRole(portfolioClient.getClient().getRole().toString());
        dto.setAssignedAt(portfolioClient.getAssignedAt());
        dto.setIsActive(portfolioClient.getIsActive());
        dto.setNotes(portfolioClient.getNotes());
        
        return dto;
    }
    
    /**
     * Conversion des membres d'équipe vers DTO
     */
    private PortfolioTeamDto convertTeamToDto(PortfolioTeam portfolioTeam) {
        PortfolioTeamDto dto = new PortfolioTeamDto(
            portfolioTeam.getPortfolio().getId(),
            portfolioTeam.getTeamMember().getId(),
            portfolioTeam.getRoleInTeam()
        );
        
        dto.setId(portfolioTeam.getId());
        dto.setTeamMemberName(portfolioTeam.getTeamMember().getFirstName() + " " + portfolioTeam.getTeamMember().getLastName());
        dto.setTeamMemberEmail(portfolioTeam.getTeamMember().getEmail());
        dto.setAssignedAt(portfolioTeam.getAssignedAt());
        dto.setIsActive(portfolioTeam.getIsActive());
        dto.setNotes(portfolioTeam.getNotes());
        
        return dto;
    }
}
