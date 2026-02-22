package com.clenzy.dto;

import java.time.LocalDateTime;

public class OrganizationDto {

    private Long id;
    private String name;
    private String slug;
    private String type;
    private int memberCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public OrganizationDto() {}

    public OrganizationDto(Long id, String name, String slug, String type, int memberCount) {
        this.id = id;
        this.name = name;
        this.slug = slug;
        this.type = type;
        this.memberCount = memberCount;
    }

    public OrganizationDto(Long id, String name, String slug, String type, int memberCount,
                           LocalDateTime createdAt, LocalDateTime updatedAt) {
        this.id = id;
        this.name = name;
        this.slug = slug;
        this.type = type;
        this.memberCount = memberCount;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public int getMemberCount() { return memberCount; }
    public void setMemberCount(int memberCount) { this.memberCount = memberCount; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
