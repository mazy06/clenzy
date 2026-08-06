package com.clenzy.integration.channex.model;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Correspondance entre une organisation Baitly et son group Channex.
 *
 * <p>La cle API Channex est unique pour toute la plateforme : sans group par
 * organisation, {@code GET /properties} expose le compte entier a n'importe
 * quel appelant. Le group est la primitive d'isolation offerte par Channex —
 * un logement appartient a au moins un group, et le contenu d'un group se lit
 * via {@code GET /groups/:id}.</p>
 *
 * <p><b>Volontairement PAS annotee {@code @Filter(organizationFilter)}</b> :
 * cette table est du routage, lue par l'integration <em>avant</em> de savoir ce
 * qu'il faut montrer. La filtrer par organisation la rendrait illisible pour
 * les traitements cross-org (backfill, watchdog) et n'apporterait rien — une
 * ligne par organisation, sans donnee metier.</p>
 *
 * <p>Le {@link #title} est deterministe ({@code Baitly Org <id>}) : si cette
 * table est perdue, la re-provision retrouve le group existant sur le hub par
 * son titre au lieu d'en creer un doublon.</p>
 */
@Entity
@Table(name = "channex_organization_groups",
    uniqueConstraints = {
        @UniqueConstraint(name = "uq_channex_org_groups_org", columnNames = "organization_id"),
        @UniqueConstraint(name = "uq_channex_org_groups_group", columnNames = "channex_group_id"),
    })
public class ChannexOrganizationGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(columnDefinition = "UUID")
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "channex_group_id", nullable = false, length = 64)
    private String channexGroupId;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (this.createdAt == null) this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    // ─── Getters / Setters ──────────────────────────────────────────────────

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getChannexGroupId() { return channexGroupId; }
    public void setChannexGroupId(String channexGroupId) { this.channexGroupId = channexGroupId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
