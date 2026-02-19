package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "organization_members", uniqueConstraints = {
    @UniqueConstraint(name = "uk_org_member", columnNames = {"organization_id", "user_id"})
}, indexes = {
    @Index(name = "idx_org_member_org_id", columnList = "organization_id"),
    @Index(name = "idx_org_member_user_id", columnList = "user_id")
})
public class OrganizationMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @Column(name = "organization_id", insertable = false, updatable = false)
    private Long organizationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "user_id", insertable = false, updatable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "role_in_org", nullable = false, length = 20)
    private OrgMemberRole roleInOrg = OrgMemberRole.MEMBER;

    @Column(name = "joined_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime joinedAt;

    // --- Constructeurs ---

    public OrganizationMember() {}

    public OrganizationMember(Organization organization, User user, OrgMemberRole roleInOrg) {
        this.organization = organization;
        this.user = user;
        this.roleInOrg = roleInOrg;
    }

    // --- Getters / Setters ---

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Organization getOrganization() { return organization; }
    public void setOrganization(Organization organization) { this.organization = organization; }

    public Long getOrganizationId() { return organizationId; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public Long getUserId() { return userId; }

    public OrgMemberRole getRoleInOrg() { return roleInOrg; }
    public void setRoleInOrg(OrgMemberRole roleInOrg) { this.roleInOrg = roleInOrg; }

    public LocalDateTime getJoinedAt() { return joinedAt; }
    public void setJoinedAt(LocalDateTime joinedAt) { this.joinedAt = joinedAt; }

    // --- Methodes utilitaires ---

    public boolean isOwner() {
        return OrgMemberRole.OWNER.equals(roleInOrg);
    }

    @Override
    public String toString() {
        return "OrganizationMember{" +
                "id=" + id +
                ", organizationId=" + organizationId +
                ", userId=" + userId +
                ", roleInOrg=" + roleInOrg +
                '}';
    }
}
