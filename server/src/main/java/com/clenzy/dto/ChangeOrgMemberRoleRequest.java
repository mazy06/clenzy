package com.clenzy.dto;

import jakarta.validation.constraints.NotBlank;

public class ChangeOrgMemberRoleRequest {

    @NotBlank(message = "Le role est obligatoire")
    private String role;

    public ChangeOrgMemberRoleRequest() {}

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
}
