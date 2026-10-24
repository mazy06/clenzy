package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "automation_executions")
@org.hibernate.annotations.Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class AutomationExecution {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "automation_rule_id", nullable = false)
    private AutomationRule automationRule;

    /**
     * Sujet generique de l'execution : cle d'idempotence (regle x subject_type x subject_id).
     * Type libre (constantes TYPE_* de {@code AutomationSubject}) : un nouveau module ajoute
     * son type sans toucher au modele. Migration 0305 : lignes historiques = RESERVATION.
     */
    @Column(name = "subject_type", nullable = false, length = 30)
    private String subjectType = "RESERVATION";

    @Column(name = "subject_id", nullable = false)
    private Long subjectId;

    /**
     * Lien reservation conserve pour l'affichage UI des executions du cycle de vie
     * reservation ; null pour les sujets non-reservation (facture, payout, device...).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reservation_id")
    private Reservation reservation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AutomationExecutionStatus status = AutomationExecutionStatus.PENDING;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "scheduled_at", nullable = false)
    private LocalDateTime scheduledAt;

    @Column(name = "executed_at")
    private LocalDateTime executedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "attempt_token")
    private java.util.UUID attemptToken;
    @Column(name = "attempted_at")
    private LocalDateTime attemptedAt;

    // Baitly recovery metadata is internal and absent from the execution DTO.
    @Column(name = "durable_state", length = 20)
    private String durableState;
    @Column(name = "durable_context", columnDefinition = "TEXT")
    private String durableContext;
    @Column(name = "durable_key", length = 160, unique = true)
    private String durableKey;
    @Column(name = "rule_revision")
    private LocalDateTime ruleRevision;
    @Column(name = "durable_expires_at")
    private LocalDateTime durableExpiresAt;

    @com.fasterxml.jackson.annotation.JsonIgnore
    public String getDurableState() { return durableState; }
    public void setDurableState(String value) { durableState=value; }
    @com.fasterxml.jackson.annotation.JsonIgnore
    public String getDurableContext() { return durableContext; }
    public void setDurableContext(String value) { durableContext=value; }
    @com.fasterxml.jackson.annotation.JsonIgnore
    public String getDurableKey() { return durableKey; }
    public void setDurableKey(String value) { durableKey=value; }
    @com.fasterxml.jackson.annotation.JsonIgnore
    public LocalDateTime getRuleRevision() { return ruleRevision; }
    public void setRuleRevision(LocalDateTime value) { ruleRevision=value; }
    @com.fasterxml.jackson.annotation.JsonIgnore
    public LocalDateTime getDurableExpiresAt() { return durableExpiresAt; }
    public void setDurableExpiresAt(LocalDateTime value) { durableExpiresAt=value; }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public AutomationRule getAutomationRule() { return automationRule; }
    public void setAutomationRule(AutomationRule automationRule) { this.automationRule = automationRule; }
    public String getSubjectType() { return subjectType; }
    public void setSubjectType(String subjectType) { this.subjectType = subjectType; }
    public Long getSubjectId() { return subjectId; }
    public void setSubjectId(Long subjectId) { this.subjectId = subjectId; }
    public Reservation getReservation() { return reservation; }
    public void setReservation(Reservation reservation) { this.reservation = reservation; }
    public AutomationExecutionStatus getStatus() { return status; }
    public void setStatus(AutomationExecutionStatus status) { this.status = status; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public LocalDateTime getScheduledAt() { return scheduledAt; }
    public void setScheduledAt(LocalDateTime scheduledAt) { this.scheduledAt = scheduledAt; }
    public LocalDateTime getExecutedAt() { return executedAt; }
    public void setExecutedAt(LocalDateTime executedAt) { this.executedAt = executedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
