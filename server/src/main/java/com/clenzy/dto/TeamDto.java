package com.clenzy.dto;

import com.clenzy.dto.validation.Create;
import com.clenzy.dto.validation.Update;

import java.time.LocalDateTime;
import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class TeamDto {
    public Long id;

    @NotBlank(groups = Create.class)
    @Size(min = 2, max = 100, groups = {Create.class, Update.class})
    public String name;

    @Size(max = 500, groups = {Create.class, Update.class})
    public String description;

    @NotBlank(groups = Create.class)
    @Size(max = 50, groups = {Create.class, Update.class})
    public String interventionType;

    @NotNull(groups = Create.class)
    public List<TeamMemberDto> members;

    public List<CoverageZoneDto> coverageZones;

    public Integer memberCount;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;

    public static class CoverageZoneDto {
        public Long id;
        public String department;
        public String arrondissement;
    }

    public static class TeamMemberDto {
        @NotNull(groups = Create.class)
        public Long userId;

        @NotBlank(groups = Create.class)
        @Size(max = 50, groups = {Create.class, Update.class})
        public String role;

        // Champs de lecture (non modifiables)
        public String firstName;
        public String lastName;
        public String email;
    }
}
