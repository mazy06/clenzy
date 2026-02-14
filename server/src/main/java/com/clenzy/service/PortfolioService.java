package com.clenzy.service;

import com.clenzy.dto.PortfolioDto;
import com.clenzy.dto.PortfolioClientDto;
import com.clenzy.dto.PortfolioTeamDto;
import com.clenzy.model.*;
import com.clenzy.model.NotificationKey;
import com.clenzy.repository.PortfolioRepository;
import com.clenzy.repository.PortfolioClientRepository;
import com.clenzy.repository.PortfolioTeamRepository;
import com.clenzy.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@Transactional
public class PortfolioService {
    
    @Autowired
    private PortfolioRepository portfolioRepository;
    
    @Autowired
    private PortfolioClientRepository portfolioClientRepository;
    
    @Autowired
    private PortfolioTeamRepository portfolioTeamRepository;
    
    @Autowired
    private UserRepository userRepository;

    @Autowired
    private NotificationService notificationService;
    
    /**
     * Créer un nouveau portefeuille
     */
    public PortfolioDto createPortfolio(PortfolioDto portfolioDto) {
        User manager = userRepository.findById(portfolioDto.getManagerId())
            .orElseThrow(() -> new RuntimeException("Manager non trouvé"));
        
        Portfolio portfolio = new Portfolio(manager, portfolioDto.getName(), portfolioDto.getDescription());
        Portfolio savedPortfolio = portfolioRepository.save(portfolio);

        try {
            notificationService.notifyAdminsAndManagers(
                NotificationKey.PORTFOLIO_CREATED,
                "Nouveau portefeuille",
                "Portefeuille \"" + savedPortfolio.getName() + "\" cree pour " + manager.getFirstName() + " " + manager.getLastName(),
                "/portfolios/" + savedPortfolio.getId()
            );
        } catch (Exception e) {
            System.err.println("Erreur notification PORTFOLIO_CREATED: " + e.getMessage());
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
        List<Portfolio> portfolios = portfolioRepository.findByManagerId(managerId);
        return portfolios.stream()
            .map(this::convertToDto)
            .collect(Collectors.toList());
    }
    
    /**
     * Récupérer tous les portefeuilles actifs
     */
    public List<PortfolioDto> getAllActivePortfolios() {
        List<Portfolio> portfolios = portfolioRepository.findByIsActiveTrue();
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
        if (portfolioClientRepository.existsByPortfolioIdAndClientId(portfolioId, clientId)) {
            throw new RuntimeException("Ce client est déjà dans ce portefeuille");
        }
        
        PortfolioClient portfolioClient = new PortfolioClient(portfolio, client);
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
            System.err.println("Erreur notification PORTFOLIO_CLIENT_ADDED: " + e.getMessage());
        }

        return convertClientToDto(savedClient);
    }
    
    /**
     * Retirer un client du portefeuille
     */
    public void removeClientFromPortfolio(Long portfolioId, Long clientId) {
        PortfolioClient portfolioClient = portfolioClientRepository
            .findByPortfolioIdAndClientId(portfolioId, clientId)
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
            System.err.println("Erreur notification PORTFOLIO_CLIENT_REMOVED: " + e.getMessage());
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
        if (portfolioTeamRepository.existsByPortfolioIdAndTeamMemberId(portfolioId, teamMemberId)) {
            throw new RuntimeException("Ce membre d'équipe est déjà dans ce portefeuille");
        }
        
        PortfolioTeam portfolioTeam = new PortfolioTeam(portfolio, teamMember, roleInTeam);
        portfolioTeam.setNotes(notes);
        
        PortfolioTeam savedTeamMember = portfolioTeamRepository.save(portfolioTeam);
        return convertTeamToDto(savedTeamMember);
    }
    
    /**
     * Retirer un membre d'équipe du portefeuille
     */
    public void removeTeamMemberFromPortfolio(Long portfolioId, Long teamMemberId) {
        PortfolioTeam portfolioTeam = portfolioTeamRepository
            .findByPortfolioIdAndTeamMemberId(portfolioId, teamMemberId)
            .orElseThrow(() -> new RuntimeException("Membre d'équipe non trouvé dans ce portefeuille"));
        
        portfolioTeamRepository.delete(portfolioTeam);
    }
    
    /**
     * Trouver le manager responsable d'un HOST
     */
    public User findManagerForHost(User host) {
        List<PortfolioClient> portfolioClients = portfolioClientRepository
            .findByClientIdAndIsActiveTrue(host.getId());
        
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
            .findByTeamMemberIdAndIsActiveTrue(teamMember.getId());
        
        if (portfolioTeam.isPresent()) {
            return portfolioTeam.get().getPortfolio().getManager();
        }
        
        throw new RuntimeException("Aucun manager trouvé pour ce membre d'équipe");
    }
    
    /**
     * Récupérer les clients d'un portefeuille
     */
    public List<PortfolioClientDto> getPortfolioClients(Long portfolioId) {
        List<PortfolioClient> clients = portfolioClientRepository.findByPortfolioIdAndIsActiveTrue(portfolioId);
        return clients.stream()
            .map(this::convertClientToDto)
            .collect(Collectors.toList());
    }
    
    /**
     * Récupérer les membres d'équipe d'un portefeuille
     */
    public List<PortfolioTeamDto> getPortfolioTeamMembers(Long portfolioId) {
        List<PortfolioTeam> teamMembers = portfolioTeamRepository.findByPortfolioIdAndIsActiveTrue(portfolioId);
        return teamMembers.stream()
            .map(this::convertTeamToDto)
            .collect(Collectors.toList());
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
