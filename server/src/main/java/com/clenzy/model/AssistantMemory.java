package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;

import java.time.LocalDateTime;

/**
 * Entree de memoire long-terme de l'assistant IA.
 *
 * <p>Chaque entree est un couple {@code (key, value)} categorise par {@link Scope}
 * (preference / fact / goal / project). Les entrees sont re-injectees dans le
 * system prompt a chaque conversation pour permettre la personnalisation.</p>
 *
 * <p>Multi-tenant via le filtre Hibernate {@code organizationFilter}. Un user
 * ne voit que ses propres memoires (filtre {@code keycloak_id} au niveau service)
 * avec defense en profondeur cote BDD.</p>
 *
 * <p>Contrainte d'unicite {@code (keycloak_id, memory_key)} : le tool
 * {@code remember_fact} fait un upsert (insert + on-conflict-update).</p>
 */
@Entity
@Table(name = "assistant_memory")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class AssistantMemory {

    public enum Scope {
        PREFERENCE,
        FACT,
        GOAL,
        PROJECT;

        public static Scope fromString(String raw) {
            if (raw == null || raw.isBlank()) {
                return null;
            }
            try {
                return Scope.valueOf(raw.trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                return null;
            }
        }

        public String dbValue() {
            return name().toLowerCase();
        }
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "keycloak_id", nullable = false, length = 255)
    private String keycloakId;

    @Column(name = "memory_key", nullable = false, length = 120)
    private String memoryKey;

    @Column(name = "memory_value", nullable = false, columnDefinition = "TEXT")
    private String memoryValue;

    @Column(nullable = false, length = 20)
    private String scope;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public AssistantMemory() {}

    public AssistantMemory(Long organizationId, String keycloakId,
                            String memoryKey, String memoryValue, Scope scope) {
        this.organizationId = organizationId;
        this.keycloakId = keycloakId;
        this.memoryKey = memoryKey;
        this.memoryValue = memoryValue;
        this.scope = scope.dbValue();
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public Scope getScopeEnum() {
        return Scope.fromString(scope);
    }

    public void setScopeEnum(Scope s) {
        this.scope = s.dbValue();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public String getKeycloakId() { return keycloakId; }
    public void setKeycloakId(String keycloakId) { this.keycloakId = keycloakId; }
    public String getMemoryKey() { return memoryKey; }
    public void setMemoryKey(String memoryKey) { this.memoryKey = memoryKey; }
    public String getMemoryValue() { return memoryValue; }
    public void setMemoryValue(String memoryValue) { this.memoryValue = memoryValue; }
    public String getScope() { return scope; }
    public void setScope(String scope) { this.scope = scope; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
