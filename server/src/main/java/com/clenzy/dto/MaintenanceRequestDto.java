package com.clenzy.dto;

import java.util.List;

/**
 * DTO pour les demandes de devis maintenance depuis la landing page.
 * Travaux sélectionnés parmi une liste exhaustive + besoin custom.
 */
public class MaintenanceRequestDto {

    private List<String> selectedWorks;
    private String customNeed;
    private String urgency;
    private String description;
    private String fullName;
    private String email;
    private String phone;
    private String city;
    private String postalCode;

    public MaintenanceRequestDto() {}

    // --- Getters & Setters ---

    public List<String> getSelectedWorks() { return selectedWorks; }
    public void setSelectedWorks(List<String> selectedWorks) { this.selectedWorks = selectedWorks; }

    public String getCustomNeed() { return customNeed; }
    public void setCustomNeed(String customNeed) { this.customNeed = customNeed; }

    public String getUrgency() { return urgency; }
    public void setUrgency(String urgency) { this.urgency = urgency; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getPostalCode() { return postalCode; }
    public void setPostalCode(String postalCode) { this.postalCode = postalCode; }

    @Override
    public String toString() {
        return "MaintenanceRequestDto{" +
                "fullName='" + fullName + '\'' +
                ", email='" + email + '\'' +
                ", city='" + city + '\'' +
                ", urgency='" + urgency + '\'' +
                ", works=" + (selectedWorks != null ? selectedWorks.size() : 0) +
                '}';
    }
}
