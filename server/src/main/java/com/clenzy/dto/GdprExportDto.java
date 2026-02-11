package com.clenzy.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO pour l'export des donnees personnelles (RGPD Article 15 + 20).
 * Contient toutes les donnees personnelles stockees par Clenzy pour un utilisateur.
 * Format structuré pour portabilité (droit à la portabilité - Article 20).
 */
public class GdprExportDto {

    private String exportDate;
    private String platform;
    private UserDataSection personalData;
    private List<PropertyDataSection> properties;
    private List<ConsentDataSection> consents;
    private List<AuditDataSection> activityLog;

    public GdprExportDto() {
        this.platform = "Clenzy PMS";
    }

    // --- Inner classes ---

    /**
     * Donnees personnelles de l'utilisateur.
     */
    public static class UserDataSection {
        private Long id;
        private String firstName;
        private String lastName;
        private String email;
        private String phoneNumber;
        private String role;
        private String status;
        private String profilePictureUrl;
        private Boolean emailVerified;
        private Boolean phoneVerified;
        private LocalDateTime lastLogin;
        private LocalDateTime createdAt;

        // Getters & Setters
        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public String getFirstName() { return firstName; }
        public void setFirstName(String firstName) { this.firstName = firstName; }
        public String getLastName() { return lastName; }
        public void setLastName(String lastName) { this.lastName = lastName; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getPhoneNumber() { return phoneNumber; }
        public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }
        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public String getProfilePictureUrl() { return profilePictureUrl; }
        public void setProfilePictureUrl(String profilePictureUrl) { this.profilePictureUrl = profilePictureUrl; }
        public Boolean getEmailVerified() { return emailVerified; }
        public void setEmailVerified(Boolean emailVerified) { this.emailVerified = emailVerified; }
        public Boolean getPhoneVerified() { return phoneVerified; }
        public void setPhoneVerified(Boolean phoneVerified) { this.phoneVerified = phoneVerified; }
        public LocalDateTime getLastLogin() { return lastLogin; }
        public void setLastLogin(LocalDateTime lastLogin) { this.lastLogin = lastLogin; }
        public LocalDateTime getCreatedAt() { return createdAt; }
        public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    }

    /**
     * Donnees des proprietes possedees par l'utilisateur.
     */
    public static class PropertyDataSection {
        private Long id;
        private String name;
        private String address;
        private String city;
        private String postalCode;
        private String country;
        private LocalDateTime createdAt;

        // Getters & Setters
        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getAddress() { return address; }
        public void setAddress(String address) { this.address = address; }
        public String getCity() { return city; }
        public void setCity(String city) { this.city = city; }
        public String getPostalCode() { return postalCode; }
        public void setPostalCode(String postalCode) { this.postalCode = postalCode; }
        public String getCountry() { return country; }
        public void setCountry(String country) { this.country = country; }
        public LocalDateTime getCreatedAt() { return createdAt; }
        public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    }

    /**
     * Donnees de consentement de l'utilisateur.
     */
    public static class ConsentDataSection {
        private String consentType;
        private boolean granted;
        private int version;
        private LocalDateTime grantedAt;
        private LocalDateTime revokedAt;

        // Getters & Setters
        public String getConsentType() { return consentType; }
        public void setConsentType(String consentType) { this.consentType = consentType; }
        public boolean isGranted() { return granted; }
        public void setGranted(boolean granted) { this.granted = granted; }
        public int getVersion() { return version; }
        public void setVersion(int version) { this.version = version; }
        public LocalDateTime getGrantedAt() { return grantedAt; }
        public void setGrantedAt(LocalDateTime grantedAt) { this.grantedAt = grantedAt; }
        public LocalDateTime getRevokedAt() { return revokedAt; }
        public void setRevokedAt(LocalDateTime revokedAt) { this.revokedAt = revokedAt; }
    }

    /**
     * Donnees d'activite de l'utilisateur (extrait du log d'audit).
     */
    public static class AuditDataSection {
        private String action;
        private String entityType;
        private String entityId;
        private String details;
        private String timestamp;

        // Getters & Setters
        public String getAction() { return action; }
        public void setAction(String action) { this.action = action; }
        public String getEntityType() { return entityType; }
        public void setEntityType(String entityType) { this.entityType = entityType; }
        public String getEntityId() { return entityId; }
        public void setEntityId(String entityId) { this.entityId = entityId; }
        public String getDetails() { return details; }
        public void setDetails(String details) { this.details = details; }
        public String getTimestamp() { return timestamp; }
        public void setTimestamp(String timestamp) { this.timestamp = timestamp; }
    }

    // --- Root Getters & Setters ---

    public String getExportDate() { return exportDate; }
    public void setExportDate(String exportDate) { this.exportDate = exportDate; }

    public String getPlatform() { return platform; }
    public void setPlatform(String platform) { this.platform = platform; }

    public UserDataSection getPersonalData() { return personalData; }
    public void setPersonalData(UserDataSection personalData) { this.personalData = personalData; }

    public List<PropertyDataSection> getProperties() { return properties; }
    public void setProperties(List<PropertyDataSection> properties) { this.properties = properties; }

    public List<ConsentDataSection> getConsents() { return consents; }
    public void setConsents(List<ConsentDataSection> consents) { this.consents = consents; }

    public List<AuditDataSection> getActivityLog() { return activityLog; }
    public void setActivityLog(List<AuditDataSection> activityLog) { this.activityLog = activityLog; }
}
