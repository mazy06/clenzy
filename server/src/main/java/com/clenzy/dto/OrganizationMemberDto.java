package com.clenzy.dto;

import java.time.LocalDateTime;

public class OrganizationMemberDto {
    private Long id;
    private Long userId;
    private String firstName;
    private String lastName;
    private String email;
    private String roleInOrg;
    private LocalDateTime joinedAt;

    public OrganizationMemberDto() {}

    // --- Getters / Setters ---

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getRoleInOrg() { return roleInOrg; }
    public void setRoleInOrg(String roleInOrg) { this.roleInOrg = roleInOrg; }

    public LocalDateTime getJoinedAt() { return joinedAt; }
    public void setJoinedAt(LocalDateTime joinedAt) { this.joinedAt = joinedAt; }
}
