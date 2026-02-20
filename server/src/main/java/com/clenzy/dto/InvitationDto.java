package com.clenzy.dto;

import java.time.LocalDateTime;

public class InvitationDto {
    private Long id;
    private Long organizationId;
    private String organizationName;
    private String invitedEmail;
    private String roleInvited;
    private String status;
    private String invitedByName;
    private LocalDateTime expiresAt;
    private LocalDateTime createdAt;
    private LocalDateTime acceptedAt;
    private String invitationLink;

    public InvitationDto() {}

    // --- Getters / Setters ---

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getOrganizationName() { return organizationName; }
    public void setOrganizationName(String organizationName) { this.organizationName = organizationName; }

    public String getInvitedEmail() { return invitedEmail; }
    public void setInvitedEmail(String invitedEmail) { this.invitedEmail = invitedEmail; }

    public String getRoleInvited() { return roleInvited; }
    public void setRoleInvited(String roleInvited) { this.roleInvited = roleInvited; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getInvitedByName() { return invitedByName; }
    public void setInvitedByName(String invitedByName) { this.invitedByName = invitedByName; }

    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getAcceptedAt() { return acceptedAt; }
    public void setAcceptedAt(LocalDateTime acceptedAt) { this.acceptedAt = acceptedAt; }

    public String getInvitationLink() { return invitationLink; }
    public void setInvitationLink(String invitationLink) { this.invitationLink = invitationLink; }
}
