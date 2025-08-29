package com.clenzy.dto;

import com.clenzy.model.TeamRole;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;

public class PortfolioTeamDto {
    
    private Long id;
    private Long portfolioId;
    private Long teamMemberId;
    private String teamMemberName;
    private String teamMemberEmail;
    private TeamRole roleInTeam;
    
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime assignedAt;
    
    private Boolean isActive;
    private String notes;
    
    // Constructeurs
    public PortfolioTeamDto() {}
    
    public PortfolioTeamDto(Long portfolioId, Long teamMemberId, TeamRole roleInTeam) {
        this.portfolioId = portfolioId;
        this.teamMemberId = teamMemberId;
        this.roleInTeam = roleInTeam;
    }
    
    // Getters et Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    
    public Long getPortfolioId() { return portfolioId; }
    public void setPortfolioId(Long portfolioId) { this.portfolioId = portfolioId; }
    
    public Long getTeamMemberId() { return teamMemberId; }
    public void setTeamMemberId(Long teamMemberId) { this.teamMemberId = teamMemberId; }
    
    public String getTeamMemberName() { return teamMemberName; }
    public void setTeamMemberName(String teamMemberName) { this.teamMemberName = teamMemberName; }
    
    public String getTeamMemberEmail() { return teamMemberEmail; }
    public void setTeamMemberEmail(String teamMemberEmail) { this.teamMemberEmail = teamMemberEmail; }
    
    public TeamRole getRoleInTeam() { return roleInTeam; }
    public void setRoleInTeam(TeamRole roleInTeam) { this.roleInTeam = roleInTeam; }
    
    public LocalDateTime getAssignedAt() { return assignedAt; }
    public void setAssignedAt(LocalDateTime assignedAt) { this.assignedAt = assignedAt; }
    
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
    
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
