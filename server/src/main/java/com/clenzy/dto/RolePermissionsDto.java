package com.clenzy.dto;

import java.util.List;

public class RolePermissionsDto {
    private String role;
    private List<String> permissions;
    private boolean isDefault;

    public RolePermissionsDto() {}

    public RolePermissionsDto(String role, List<String> permissions, boolean isDefault) {
        this.role = role;
        this.permissions = permissions;
        this.isDefault = isDefault;
    }

    // Getters et Setters
    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public List<String> getPermissions() {
        return permissions;
    }

    public void setPermissions(List<String> permissions) {
        this.permissions = permissions;
    }

    public boolean isDefault() {
        return isDefault;
    }

    public void setDefault(boolean isDefault) {
        this.isDefault = isDefault;
    }
}
