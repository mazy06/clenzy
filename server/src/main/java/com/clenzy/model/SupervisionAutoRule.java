package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * Toggle d'auto-application PAR TYPE d'action de la constellation (Vague 1).
 *
 * <p>Une ligne par (org, {@code actionType}) : {@code enabled} (défaut FALSE —
 * opt-in total), {@code level} (NOTIFY = auto + notification, FULL = auto
 * silencieux + feed) et {@code envelope} JSON éditable (bornes d'auto-application
 * par type, NULL = défauts Java documentés dans {@code AutoApplyGate}).</p>
 *
 * <p>Hiérarchie de commande : kill-switch global ({@link SupervisionSettings})
 * → niveau du module = <b>plafond</b> ({@link SupervisionModuleSettings}) →
 * cette règle. Le niveau effectif = min(niveau règle, plafond module).</p>
 */
@Entity
@Table(name = "supervision_auto_rules", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"organization_id", "action_type"})
})
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class SupervisionAutoRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    /** Type d'action (cf. {@code SupervisionActionType}), ex. {@code CLEANING_REQUEST}. */
    @Column(name = "action_type", nullable = false, length = 40)
    private String actionType;

    /** Opt-in : FALSE (défaut) = le type reste 100 % HITL (carte). */
    @Column(nullable = false)
    private boolean enabled = false;

    /**
     * Niveau demandé pour ce type : {@link SupervisionAutonomy#NOTIFY} ou
     * {@link SupervisionAutonomy#FULL} (jamais SUGGEST — une règle SUGGEST
     * n'aurait pas de sens : c'est l'état par défaut sans règle).
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "level", nullable = false, length = 20)
    private SupervisionAutonomy level = SupervisionAutonomy.NOTIFY;

    /** Enveloppe JSON éditable (bornes par type) — NULL = défauts Java. */
    @Column(name = "envelope", columnDefinition = "TEXT")
    private String envelope;

    /**
     * Règles de Confiance des cartes (V3) : suggestion active « automatiser ce
     * type ? » posée par l'évaluateur quotidien (N approbations humaines
     * consécutives). NULL = aucune. Effacée à l'activation ou au rejet — la
     * suggestion est INERTE tant que l'humain ne l'accepte pas.
     */
    @Column(name = "suggested_at")
    private Instant suggestedAt;

    /** Dernière suggestion écartée (« Ignorer ») — cooldown de re-suggestion 30 j. */
    @Column(name = "suggestion_dismissed_at")
    private Instant suggestionDismissedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private Instant createdAt;

    @Column(name = "updated_at")
    @UpdateTimestamp
    private Instant updatedAt;

    public SupervisionAutoRule() {}

    public SupervisionAutoRule(Long organizationId, String actionType) {
        this.organizationId = organizationId;
        this.actionType = actionType;
    }

    public Long getId() { return id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getActionType() { return actionType; }
    public void setActionType(String actionType) { this.actionType = actionType; }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public SupervisionAutonomy getLevel() { return level; }
    public void setLevel(SupervisionAutonomy level) { this.level = level; }

    public String getEnvelope() { return envelope; }
    public void setEnvelope(String envelope) { this.envelope = envelope; }

    public Instant getSuggestedAt() { return suggestedAt; }
    public void setSuggestedAt(Instant suggestedAt) { this.suggestedAt = suggestedAt; }

    public Instant getSuggestionDismissedAt() { return suggestionDismissedAt; }
    public void setSuggestionDismissedAt(Instant suggestionDismissedAt) {
        this.suggestionDismissedAt = suggestionDismissedAt;
    }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
