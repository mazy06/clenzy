package com.clenzy.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;

/**
 * Regle de Confiance (campagne X2, signature feature Phase 6 n°2) : l'autonomie
 * qui s'apprend. Suggeree par l'evaluateur quand un couple (org, outil) montre
 * N confirmations HITL consecutives sans refus ; INERTE tant qu'un humain ne
 * l'a pas acceptee ; visible et revocable a tout moment.
 *
 * <p>Une regle ACTIVE fait passer l'outil de « confirmer » a « notifier » :
 * l'execution ne se met plus en pause, elle reste tracee (audit, agent_step,
 * ledger) et visible dans le flux.</p>
 */
@Entity
@Table(name = "agent_trust_rule",
        uniqueConstraints = @UniqueConstraint(name = "uq_agent_trust_rule_org_tool",
                columnNames = {"organization_id", "tool_name"}))
public class AgentTrustRule {

    public static final String STATUS_SUGGESTED = "SUGGESTED";
    public static final String STATUS_ACTIVE = "ACTIVE";
    public static final String STATUS_DISMISSED = "DISMISSED";
    public static final String STATUS_REVOKED = "REVOKED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "tool_name", nullable = false, length = 96)
    private String toolName;

    @Column(nullable = false, length = 16)
    private String status;

    @Column(name = "confirmations_seen", nullable = false)
    private int confirmationsSeen;

    @Column(name = "suggested_at", nullable = false)
    private Instant suggestedAt;

    @Column(name = "decided_at")
    private Instant decidedAt;

    @Column(name = "decided_by", length = 64)
    private String decidedBy;

    protected AgentTrustRule() {}

    public AgentTrustRule(Long organizationId, String toolName, int confirmationsSeen) {
        this.organizationId = organizationId;
        this.toolName = toolName;
        this.status = STATUS_SUGGESTED;
        this.confirmationsSeen = confirmationsSeen;
        this.suggestedAt = Instant.now();
    }

    public void decide(String status, String decidedBy) {
        this.status = status;
        this.decidedBy = decidedBy;
        this.decidedAt = Instant.now();
    }

    public Long getId() { return id; }
    public Long getOrganizationId() { return organizationId; }
    public String getToolName() { return toolName; }
    public String getStatus() { return status; }
    public int getConfirmationsSeen() { return confirmationsSeen; }
    public Instant getSuggestedAt() { return suggestedAt; }
    public Instant getDecidedAt() { return decidedAt; }
    public String getDecidedBy() { return decidedBy; }
}
