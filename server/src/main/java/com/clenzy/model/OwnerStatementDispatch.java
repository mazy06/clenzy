package com.clenzy.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Trace d'envoi d'un releve proprietaire mensuel automatique (flux F9a,
 * action SEND_OWNER_STATEMENT du moteur AutomationRule).
 *
 * <p>Filet d'idempotence METIER de l'executeur (cf. contrat
 * {@code AutomationActionExecutor}) : la contrainte unique
 * (organization_id, owner_id, period_start) interdit deux envois pour le meme
 * proprietaire sur le meme mois. La ligne est posee AVANT l'envoi de l'email
 * (claim, sous verrou advisory — cf. {@code SendOwnerStatementExecutor}) avec
 * {@code success=false}, puis passee a {@code success=true} apres envoi reussi.
 * L'executeur tournant DANS la transaction du moteur, un echec d'envoi annule
 * aussi le claim : le releve est re-tente au prochain declenchement.</p>
 *
 * <p>La contrainte est declaree ici EN MIROIR du changeset Liquibase 0306 : la
 * suite de tests construit le schema via Hibernate (ddl-auto), pas Liquibase —
 * sans ce miroir, le filet n'existe pas en test (double envoi constate par
 * AutomationConcurrencyIT, vague T3).</p>
 */
@Entity
@Table(name = "owner_statement_dispatch",
       uniqueConstraints = @UniqueConstraint(
           name = "uq_owner_statement_dispatch",
           columnNames = {"organization_id", "owner_id", "period_start"}))
public class OwnerStatementDispatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Column(name = "period_start", nullable = false)
    private LocalDate periodStart;

    @Column(name = "period_end", nullable = false)
    private LocalDate periodEnd;

    @Column(name = "sent_at", nullable = false)
    private Instant sentAt = Instant.now();

    @Column(name = "success", nullable = false)
    private boolean success = false;

    public OwnerStatementDispatch() {}

    public OwnerStatementDispatch(Long organizationId, Long ownerId,
                                   LocalDate periodStart, LocalDate periodEnd) {
        this.organizationId = organizationId;
        this.ownerId = ownerId;
        this.periodStart = periodStart;
        this.periodEnd = periodEnd;
    }

    public Long getId() { return id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long ownerId) { this.ownerId = ownerId; }

    public LocalDate getPeriodStart() { return periodStart; }
    public void setPeriodStart(LocalDate periodStart) { this.periodStart = periodStart; }

    public LocalDate getPeriodEnd() { return periodEnd; }
    public void setPeriodEnd(LocalDate periodEnd) { this.periodEnd = periodEnd; }

    public Instant getSentAt() { return sentAt; }
    public void setSentAt(Instant sentAt) { this.sentAt = sentAt; }

    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }
}
