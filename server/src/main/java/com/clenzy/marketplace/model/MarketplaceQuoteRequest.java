package com.clenzy.marketplace.model;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Une demande de devis entre une organisation et un prestataire.
 *
 * <h2>Pourquoi il n'y a PAS de filtre tenant ici</h2>
 * <p>Une demande relie DEUX organisations : celle qui demande, et celle qui
 * porte le prestataire. Un {@code @Filter} sur {@code organization_id} n'en
 * montrerait qu'une — et le prestataire ne verrait jamais ce qui lui est
 * adresse. Le controle d'acces est donc EXPLICITE, des deux cotes, dans
 * {@code MarketplaceQuoteService}. C'est le meme choix que pour le reste des
 * tables {@code marketplace_*}, et pour la meme raison.</p>
 *
 * <h2>Le montant appartient au prestataire</h2>
 * <p>Les champs de reponse sont separes de ceux de la demande. Rien de ce que
 * le demandeur envoie ne peut fixer un prix — regle n°1 de l'audit : ne jamais
 * faire confiance a un montant venant du client.</p>
 */
@Entity
@Table(
    name = "marketplace_quote_requests",
    indexes = {
        @Index(name = "idx_quote_provider", columnList = "marketplace_provider_id,status"),
        @Index(name = "idx_quote_requester", columnList = "requester_organization_id,status"),
    }
)
public class MarketplaceQuoteRequest {

    @Column(name = "service_request_id")
    private Long serviceRequestId;
    public Long getServiceRequestId() { return serviceRequestId; }
    public void setServiceRequestId(Long value) { serviceRequestId = value; }
    @Column(name = "service_request_cycle")
    private Integer serviceRequestCycle;
    public Integer getServiceRequestCycle() { return serviceRequestCycle; }
    public void setServiceRequestCycle(Integer value) { serviceRequestCycle = value; }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Accord annulé à l'origine de cette nouvelle négociation, sans reprise de prix. */
    @Column(name = "replaces_quote_id")
    private Long replacesQuoteId;

    public Long getReplacesQuoteId() { return replacesQuoteId; }
    public void setReplacesQuoteId(Long value) { replacesQuoteId = value; }

    @Column(name = "requested_start_time")
    private java.time.LocalTime requestedStartTime;
    @Column(name = "requested_duration_minutes")
    private Integer requestedDurationMinutes;
    public java.time.LocalTime getRequestedStartTime() { return requestedStartTime; }
    public void setRequestedStartTime(java.time.LocalTime value) { requestedStartTime = value; }
    public Integer getRequestedDurationMinutes() { return requestedDurationMinutes; }
    public void setRequestedDurationMinutes(Integer value) { requestedDurationMinutes = value; }

    // ─── La demande ──────────────────────────────────────────────────────────

    @Column(name = "marketplace_provider_id", nullable = false)
    private Long providerId;

    @Column(name = "provider_team_id")
    private Long providerTeamId;

    @Enumerated(EnumType.STRING)
    @Column(name = "discussion_published_status", length = 20)
    private QuoteRequestStatus discussionPublishedStatus;

    public Long getProviderTeamId() { return providerTeamId; }
    public void setProviderTeamId(Long value) { providerTeamId = value; }
    public QuoteRequestStatus getDiscussionPublishedStatus() { return discussionPublishedStatus; }
    public void setDiscussionPublishedStatus(QuoteRequestStatus value) { discussionPublishedStatus = value; }

    @Column(name = "requester_organization_id", nullable = false)
    private Long requesterOrganizationId;

    @Column(name = "requested_by_user_id")
    private Long requestedByUserId;

    /** Logement concerne, quand il y en a un. Une demande peut etre generale. */
    @Column(name = "property_id")
    private Long propertyId;

    @Column(name = "category_code", length = 40)
    private String categoryCode;

    @Column(name = "service_item_code", length = 60)
    private String serviceItemCode;

    @Column(name = "title", nullable = false, length = 150)
    private String title;

    @Column(name = "message", columnDefinition = "TEXT")
    private String message;

    @Column(name = "desired_date")
    private LocalDate desiredDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private QuoteRequestStatus status = QuoteRequestStatus.SENT;

    // ─── La reponse, ecrite par le PRESTATAIRE seul ──────────────────────────

    @Column(name = "quoted_amount", precision = 12, scale = 2)
    private BigDecimal quotedAmount;

    @Column(name = "quoted_currency", length = 3)
    private String quotedCurrency;

    @Column(name = "quote_message", columnDefinition = "TEXT")
    private String quoteMessage;

    @Column(name = "quote_valid_until")
    private LocalDate quoteValidUntil;

    @Column(name = "quoted_at")
    private LocalDateTime quotedAt;

    // ─── La decision, ecrite par le DEMANDEUR seul ───────────────────────────

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    @Column(name = "decision_reason", length = 500)
    private String decisionReason;

    /** Intervention creee a l'acceptation. Vide tant que rien n'est accepte. */
    @Column(name = "intervention_id")
    private Long interventionId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public MarketplaceQuoteRequest() {}

    /**
     * Le devis a-t-il depasse sa date de validite ?
     *
     * <p>Calcule et non stocke : un statut {@code EXPIRED} pose par un job
     * serait faux entre deux passages, alors que la date, elle, ne ment jamais.</p>
     */
    public boolean isExpiredOn(LocalDate day) {
        return status == QuoteRequestStatus.QUOTED
            && quoteValidUntil != null
            && quoteValidUntil.isBefore(day);
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getProviderId() { return providerId; }
    public void setProviderId(Long providerId) { this.providerId = providerId; }

    public Long getRequesterOrganizationId() { return requesterOrganizationId; }
    public void setRequesterOrganizationId(Long id) { this.requesterOrganizationId = id; }

    public Long getRequestedByUserId() { return requestedByUserId; }
    public void setRequestedByUserId(Long id) { this.requestedByUserId = id; }

    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public String getCategoryCode() { return categoryCode; }
    public void setCategoryCode(String categoryCode) { this.categoryCode = categoryCode; }

    public String getServiceItemCode() { return serviceItemCode; }
    public void setServiceItemCode(String code) { this.serviceItemCode = code; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public LocalDate getDesiredDate() { return desiredDate; }
    public void setDesiredDate(LocalDate desiredDate) { this.desiredDate = desiredDate; }

    public QuoteRequestStatus getStatus() { return status; }
    public void setStatus(QuoteRequestStatus status) { this.status = status; }

    public BigDecimal getQuotedAmount() { return quotedAmount; }
    public void setQuotedAmount(BigDecimal quotedAmount) { this.quotedAmount = quotedAmount; }

    public String getQuotedCurrency() { return quotedCurrency; }
    public void setQuotedCurrency(String quotedCurrency) { this.quotedCurrency = quotedCurrency; }

    public String getQuoteMessage() { return quoteMessage; }
    public void setQuoteMessage(String quoteMessage) { this.quoteMessage = quoteMessage; }

    public LocalDate getQuoteValidUntil() { return quoteValidUntil; }
    public void setQuoteValidUntil(LocalDate quoteValidUntil) { this.quoteValidUntil = quoteValidUntil; }

    public LocalDateTime getQuotedAt() { return quotedAt; }
    public void setQuotedAt(LocalDateTime quotedAt) { this.quotedAt = quotedAt; }

    public LocalDateTime getDecidedAt() { return decidedAt; }
    public void setDecidedAt(LocalDateTime decidedAt) { this.decidedAt = decidedAt; }

    public String getDecisionReason() { return decisionReason; }
    public void setDecisionReason(String decisionReason) { this.decisionReason = decisionReason; }

    public Long getInterventionId() { return interventionId; }
    public void setInterventionId(Long interventionId) { this.interventionId = interventionId; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
