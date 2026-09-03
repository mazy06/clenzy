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

    /**
     * Repartitions et serie temporelle, pour les graphiques de l'ecran.
     *
     * <p>Toutes sont calculees a partir des entites DEJA chargees par le
     * parcours des portefeuilles : aucune requete supplementaire.</p>
     */
    private List<Bucket> staffByTrade = new ArrayList<>();
    private List<Bucket> staffByCity = new ArrayList<>();
    private List<Bucket> propertiesByCity = new ArrayList<>();
    private List<Bucket> propertiesByType = new ArrayList<>();
    private List<MonthPoint> assignmentsByMonth = new ArrayList<>();

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

    public List<Bucket> getStaffByTrade() { return staffByTrade; }
    public void setStaffByTrade(List<Bucket> staffByTrade) { this.staffByTrade = staffByTrade; }

    public List<Bucket> getStaffByCity() { return staffByCity; }
    public void setStaffByCity(List<Bucket> staffByCity) { this.staffByCity = staffByCity; }

    public List<Bucket> getPropertiesByCity() { return propertiesByCity; }
    public void setPropertiesByCity(List<Bucket> propertiesByCity) { this.propertiesByCity = propertiesByCity; }

    public List<Bucket> getPropertiesByType() { return propertiesByType; }
    public void setPropertiesByType(List<Bucket> propertiesByType) { this.propertiesByType = propertiesByType; }

    public List<MonthPoint> getAssignmentsByMonth() { return assignmentsByMonth; }
    public void setAssignmentsByMonth(List<MonthPoint> assignmentsByMonth) { this.assignmentsByMonth = assignmentsByMonth; }

    // ── Inner classes ────────────────────────────────────────────────────────

    /** Une part d'une repartition : un libelle, un effectif. */
    public static class Bucket {
        private String label;
        private int count;

        public Bucket() {}

        public Bucket(String label, int count) {
            this.label = label;
            this.count = count;
        }

        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }

        public int getCount() { return count; }
        public void setCount(int count) { this.count = count; }
    }

    /** Rattachements d'un mois, separes par nature. */
    public static class MonthPoint {
        /** Mois au format ISO {@code YYYY-MM}, ordonnable comme une chaine. */
        private String month;
        private int clients;
        private int staff;

        public MonthPoint() {}

        public MonthPoint(String month, int clients, int staff) {
            this.month = month;
            this.clients = clients;
            this.staff = staff;
        }

        public String getMonth() { return month; }
        public void setMonth(String month) { this.month = month; }

        public int getClients() { return clients; }
        public void setClients(int clients) { this.clients = clients; }

        public int getStaff() { return staff; }
        public void setStaff(int staff) { this.staff = staff; }
    }

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
