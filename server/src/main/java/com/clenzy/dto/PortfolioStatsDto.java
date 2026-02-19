package com.clenzy.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class PortfolioStatsDto {

    private int totalPortfolios;
    private int totalClients;
    private int totalProperties;
    private int totalTeamMembers;
    private int activePortfolios;
    private int inactivePortfolios;
    private List<RecentAssignment> recentAssignments = new ArrayList<>();
    private List<PortfolioBreakdown> portfolioBreakdown = new ArrayList<>();

    // ── Getters / Setters ────────────────────────────────────────────────────

    public int getTotalPortfolios() { return totalPortfolios; }
    public void setTotalPortfolios(int totalPortfolios) { this.totalPortfolios = totalPortfolios; }

    public int getTotalClients() { return totalClients; }
    public void setTotalClients(int totalClients) { this.totalClients = totalClients; }

    public int getTotalProperties() { return totalProperties; }
    public void setTotalProperties(int totalProperties) { this.totalProperties = totalProperties; }

    public int getTotalTeamMembers() { return totalTeamMembers; }
    public void setTotalTeamMembers(int totalTeamMembers) { this.totalTeamMembers = totalTeamMembers; }

    public int getActivePortfolios() { return activePortfolios; }
    public void setActivePortfolios(int activePortfolios) { this.activePortfolios = activePortfolios; }

    public int getInactivePortfolios() { return inactivePortfolios; }
    public void setInactivePortfolios(int inactivePortfolios) { this.inactivePortfolios = inactivePortfolios; }

    public List<RecentAssignment> getRecentAssignments() { return recentAssignments; }
    public void setRecentAssignments(List<RecentAssignment> recentAssignments) { this.recentAssignments = recentAssignments; }

    public List<PortfolioBreakdown> getPortfolioBreakdown() { return portfolioBreakdown; }
    public void setPortfolioBreakdown(List<PortfolioBreakdown> portfolioBreakdown) { this.portfolioBreakdown = portfolioBreakdown; }

    // ── Inner classes ────────────────────────────────────────────────────────

    public static class RecentAssignment {
        private Long id;
        private String type; // "CLIENT" or "TEAM"
        private String name;
        private String portfolioName;

        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
        private LocalDateTime assignedAt;

        public RecentAssignment() {}

        public RecentAssignment(Long id, String type, String name, String portfolioName, LocalDateTime assignedAt) {
            this.id = id;
            this.type = type;
            this.name = name;
            this.portfolioName = portfolioName;
            this.assignedAt = assignedAt;
        }

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public String getPortfolioName() { return portfolioName; }
        public void setPortfolioName(String portfolioName) { this.portfolioName = portfolioName; }

        public LocalDateTime getAssignedAt() { return assignedAt; }
        public void setAssignedAt(LocalDateTime assignedAt) { this.assignedAt = assignedAt; }
    }

    public static class PortfolioBreakdown {
        private Long portfolioId;
        private String portfolioName;
        private int clientCount;
        private int teamMemberCount;
        private boolean isActive;

        public PortfolioBreakdown() {}

        public PortfolioBreakdown(Long portfolioId, String portfolioName, int clientCount, int teamMemberCount, boolean isActive) {
            this.portfolioId = portfolioId;
            this.portfolioName = portfolioName;
            this.clientCount = clientCount;
            this.teamMemberCount = teamMemberCount;
            this.isActive = isActive;
        }

        public Long getPortfolioId() { return portfolioId; }
        public void setPortfolioId(Long portfolioId) { this.portfolioId = portfolioId; }

        public String getPortfolioName() { return portfolioName; }
        public void setPortfolioName(String portfolioName) { this.portfolioName = portfolioName; }

        public int getClientCount() { return clientCount; }
        public void setClientCount(int clientCount) { this.clientCount = clientCount; }

        public int getTeamMemberCount() { return teamMemberCount; }
        public void setTeamMemberCount(int teamMemberCount) { this.teamMemberCount = teamMemberCount; }

        public boolean getIsActive() { return isActive; }
        public void setIsActive(boolean isActive) { this.isActive = isActive; }
    }
}
