package com.clenzy.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Filter;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Une action en attente, telle qu'elle est stockée.
 *
 * <p>La file « à traiter » n'est plus recalculée à chaque affichage : elle est
 * cette table. La lecture est une requête indexée, quel que soit le nombre de
 * natures, et une action a enfin une existence — donc une durée de vie, un
 * responsable possible, une date de traitement.</p>
 *
 * <p><b>Deux régimes</b>, portés par {@link #source} :</p>
 * <ul>
 *   <li>{@link #SOURCE_DERIVED} — l'anomalie se déduit des données. Le balayage
 *       de réconciliation la retrouve et rafraîchit {@link #lastSeenAt}. Une
 *       ligne qu'il ne retrouve plus est <b>close d'office</b> : la condition a
 *       disparu.</li>
 *   <li>{@link #SOURCE_EVENT} — l'anomalie a été apprise une fois, par un
 *       webhook. Aucune requête ne peut la redécouvrir : le balayage ne doit
 *       jamais la refermer, sous peine de faire disparaître un litige.</li>
 * </ul>
 */
@Entity
@Table(name = "action_items")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class ActionItem {

    /** Le balayage fait foi : retrouvée, elle vit ; absente, elle se ferme. */
    public static final String SOURCE_DERIVED = "DERIVED";
    /** Apprise par événement : seul un geste explicite la clôt. */
    public static final String SOURCE_EVENT = "EVENT";

    public static final String STATUS_OPEN = "OPEN";
    public static final String STATUS_RESOLVED = "RESOLVED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(nullable = false, length = 50)
    private String kind;

    /**
     * Ce que l'action vise dans le monde réel — {@code reservation:88},
     * {@code dp_1AbCdEf}. Avec l'organisation et la nature, c'est la clé
     * d'idempotence : un balayage répété ne crée pas de doublon.
     */
    @Column(name = "subject_ref", nullable = false, length = 160)
    private String subjectRef;

    @Column(nullable = false, length = 10)
    private String source = SOURCE_DERIVED;

    @Column(nullable = false, length = 20)
    private String status = STATUS_OPEN;

    @Column(nullable = false, length = 20)
    private String severity = "warning";

    /**
     * Rang d'urgence, {@code 0} pour le plus critique.
     *
     * <p>Trier sur le libellé placerait « info » avant « warning » : l'ordre
     * alphabétique n'est pas l'ordre d'urgence. Ce rang permet à la base de
     * trier dans l'index plutôt qu'en mémoire.</p>
     */
    @Column(name = "severity_rank", nullable = false)
    private short severityRank = 1;

    // Ce que l'écran affiche, dénormalisé : la lecture ne joint aucune table
    // métier, sinon on retrouverait le coût qu'on vient de supprimer.

    @Column(length = 255)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String detail;

    @Column(length = 255)
    private String subject;

    @Column(name = "target_id")
    private Long targetId;

    @Column(name = "property_id")
    private Long propertyId;

    @Column(name = "property_name", length = 255)
    private String propertyName;

    @Column(precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(length = 3)
    private String currency;

    @Column(length = 40)
    private String badge;

    @Column(name = "action_type", length = 60)
    private String actionType;

    @Column(name = "assigned_to_user_id")
    private Long assignedToUserId;

    /** Reportée : masquée de la file jusqu'à cette date. */
    @Column(name = "snoozed_until")
    private Instant snoozedUntil;

    /** Échéance imposée de l'extérieur (réponse à un litige). */
    @Column(name = "deadline_at")
    private Instant deadlineAt;

    @Column(name = "first_seen_at", nullable = false)
    private Instant firstSeenAt = Instant.now();

    /** Dernier balayage ayant confirmé l'anomalie. */
    @Column(name = "last_seen_at", nullable = false)
    private Instant lastSeenAt = Instant.now();

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @Column(name = "resolved_by", length = 120)
    private String resolvedBy;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getKind() { return kind; }
    public void setKind(String kind) { this.kind = kind; }

    public String getSubjectRef() { return subjectRef; }
    public void setSubjectRef(String subjectRef) { this.subjectRef = subjectRef; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getSeverity() { return severity; }

    /** Pose le libellé ET son rang : les deux ne doivent jamais diverger. */
    public void setSeverity(String severity) {
        this.severity = severity;
        this.severityRank = rankOf(severity);
    }

    public short getSeverityRank() { return severityRank; }

    private static short rankOf(String severity) {
        if ("critical".equalsIgnoreCase(severity)) return 0;
        if ("warning".equalsIgnoreCase(severity)) return 1;
        return 2;
    }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }

    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }

    public Long getTargetId() { return targetId; }
    public void setTargetId(Long targetId) { this.targetId = targetId; }

    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public String getPropertyName() { return propertyName; }
    public void setPropertyName(String propertyName) { this.propertyName = propertyName; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public String getBadge() { return badge; }
    public void setBadge(String badge) { this.badge = badge; }

    public String getActionType() { return actionType; }
    public void setActionType(String actionType) { this.actionType = actionType; }

    public Long getAssignedToUserId() { return assignedToUserId; }
    public void setAssignedToUserId(Long assignedToUserId) { this.assignedToUserId = assignedToUserId; }

    public Instant getSnoozedUntil() { return snoozedUntil; }
    public void setSnoozedUntil(Instant snoozedUntil) { this.snoozedUntil = snoozedUntil; }

    public Instant getDeadlineAt() { return deadlineAt; }
    public void setDeadlineAt(Instant deadlineAt) { this.deadlineAt = deadlineAt; }

    public Instant getFirstSeenAt() { return firstSeenAt; }
    public void setFirstSeenAt(Instant firstSeenAt) { this.firstSeenAt = firstSeenAt; }

    public Instant getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(Instant lastSeenAt) { this.lastSeenAt = lastSeenAt; }

    public Instant getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(Instant resolvedAt) { this.resolvedAt = resolvedAt; }

    public String getResolvedBy() { return resolvedBy; }
    public void setResolvedBy(String resolvedBy) { this.resolvedBy = resolvedBy; }
}
