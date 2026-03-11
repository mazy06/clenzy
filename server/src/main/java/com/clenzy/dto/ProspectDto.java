package com.clenzy.dto;

import com.clenzy.model.Prospect;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Prospect B2B pour la prospection")
public record ProspectDto(
    @Schema(description = "ID du prospect") Long id,
    @Schema(description = "Nom de l'entreprise") String name,
    @Schema(description = "Email de contact") String email,
    @Schema(description = "Telephone") String phone,
    @Schema(description = "Ville") String city,
    @Schema(description = "Specialite") String specialty,
    @Schema(description = "Categorie") String category,
    @Schema(description = "Statut") String status,
    @Schema(description = "Notes") String notes,
    @Schema(description = "Site web") String website,
    @Schema(description = "Profil LinkedIn") String linkedIn,
    @Schema(description = "Chiffre d'affaires") String revenue,
    @Schema(description = "Nombre d'employes") String employees
) {
    public static ProspectDto fromEntity(Prospect p) {
        return new ProspectDto(
            p.getId(),
            p.getName(),
            p.getEmail(),
            p.getPhone(),
            p.getCity(),
            p.getSpecialty(),
            p.getCategory() != null ? p.getCategory().name() : null,
            p.getStatus() != null ? p.getStatus().name() : null,
            p.getNotes(),
            p.getWebsite(),
            p.getLinkedIn(),
            p.getRevenue(),
            p.getEmployees()
        );
    }
}
