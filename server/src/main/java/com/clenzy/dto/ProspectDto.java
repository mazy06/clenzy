package com.clenzy.dto;

import com.clenzy.model.Prospect;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Contact CRM Baitly de l’organisation")
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
    @Schema(description = "Nombre d'employes") String employees,
    String contactType, String contactNature, String sourceType, String sourceDetail,
    String sourceUrl, java.time.Instant sourceRecordedAt, boolean archived
) {
    /** Compatibility with historic partial-update clients. */
    public ProspectDto(Long id,String name,String email,String phone,String city,String specialty,
                       String category,String status,String notes,String website,String linkedIn,String revenue,String employees) {
        this(id,name,email,phone,city,specialty,category,status,notes,website,linkedIn,revenue,employees,
             null,null,null,null,null,null,false);
    }
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
            p.getEmployees(),
            p.getContactType(),p.getContactNature(),p.getSourceType(),p.getSourceDetail(),
            p.getSourceUrl(),p.getSourceRecordedAt(),p.isArchived()
        );
    }
}
