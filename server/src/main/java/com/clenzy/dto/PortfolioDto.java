package com.clenzy.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;
import java.util.List;

public class PortfolioDto {
    
    private Long id;
    
    @NotNull(message = "L'ID du manager est requis")
    private Long managerId;
    
    @NotBlank(message = "Le nom du portefeuille est requis")
    private String name;
    
    private String description;
    
    private Boolean isActive = true;
    
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;
    
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime updatedAt;
    
    // Informations complémentaires pour l'affichage
    private String managerName;
    private List<PortfolioClientDto> clients;
    private List<PortfolioTeamDto> teamMembers;
    
    // Statistiques
    private Long clientCount;
    private Long teamMemberCount;
    
    // Constructeurs
    public PortfolioDto() {}
    
    public PortfolioDto(Long managerId, String name, String description) {
        this.managerId = managerId;
        this.name = name;
        this.description = description;
    }
    
    // Getters et Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    
    public Long getManagerId() { return managerId; }
    public void setManagerId(Long managerId) { this.managerId = managerId; }
    
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
    
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    
    public String getManagerName() { return managerName; }
    public void setManagerName(String managerName) { this.managerName = managerName; }
    
    public List<PortfolioClientDto> getClients() { return clients; }
    public void setClients(List<PortfolioClientDto> clients) { this.clients = clients; }
    
    public List<PortfolioTeamDto> getTeamMembers() { return teamMembers; }
    public void setTeamMembers(List<PortfolioTeamDto> teamMembers) { this.teamMembers = teamMembers; }
    
    public Long getClientCount() { return clientCount; }
    public void setClientCount(Long clientCount) { this.clientCount = clientCount; }
    
    public Long getTeamMemberCount() { return teamMemberCount; }
    public void setTeamMemberCount(Long teamMemberCount) { this.teamMemberCount = teamMemberCount; }
}
