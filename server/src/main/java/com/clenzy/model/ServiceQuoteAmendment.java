package com.clenzy.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Objects;

/** Proposition distincte de l'accord Baitly en vigueur ; aucune application implicite. */
@Entity
@Table(name = "service_quote_amendments")
@org.hibernate.annotations.Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class ServiceQuoteAmendment {
    public enum Status { PROPOSED, ACCEPTED, REJECTED, WITHDRAWN, OBSOLETE }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Version private long version;
    @Column(name = "organization_id", nullable = false) private Long organizationId;
    @Column(name = "quote_id", nullable = false) private Long quoteId;
    @Column(name = "intervention_id", nullable = false) private Long interventionId;
    @Column(name = "base_intervention_version", nullable = false) private Long baseInterventionVersion;
    @Column(name = "proposed_by", nullable = false) private Long proposedBy;
    @Column(name = "original_amount", nullable = false, precision = 12, scale = 2) private BigDecimal originalAmount;
    @Column(name = "proposed_amount", nullable = false, precision = 12, scale = 2) private BigDecimal proposedAmount;
    @Column(nullable = false, length = 8) private String currency;
    @Column(nullable = false, length = 1000) private String reason;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private Status status;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "decided_at") private Instant decidedAt;
    @Column(name = "decided_by") private Long decidedBy;

    protected ServiceQuoteAmendment() {}

    /** Validation métier uniquement ; le service appelant doit vérifier les droits et verrouiller les ressources. */
    public static ServiceQuoteAmendment propose(ServiceQuote quote, Intervention mission, Long authorId,
                                                BigDecimal amount, String reason, Instant now) {
        return propose(quote, mission, authorId, amount, reason, now, quote.getAmount());
    }

    public static ServiceQuoteAmendment propose(ServiceQuote quote, Intervention mission, Long authorId,
                                                BigDecimal amount, String reason, Instant now, BigDecimal agreedAmount) {
        requireEligible(quote, mission, agreedAmount);
        if (authorId == null || now == null || reason == null || reason.isBlank() || reason.strip().length() > 1000) {
            throw new IllegalArgumentException("Auteur, date et motif de 1 à 1000 caractères requis");
        }
        if (amount == null || amount.signum() < 0 || agreedAmount == null || agreedAmount.signum() < 0) {
            throw new IllegalArgumentException("Montant d'avenant invalide");
        }
        BigDecimal normalized;
        try { normalized = amount.setScale(2, RoundingMode.UNNECESSARY); }
        catch (ArithmeticException e) { throw new IllegalArgumentException("Le montant doit avoir au plus deux décimales", e); }
        if (normalized.precision() > 12 || normalized.compareTo(agreedAmount) == 0) {
            throw new IllegalArgumentException("Le nouveau montant doit être différent et compatible avec la précision monétaire");
        }
        var proposal = new ServiceQuoteAmendment();
        proposal.organizationId = quote.getOrganizationId();
        proposal.quoteId = quote.getId();
        proposal.interventionId = mission.getId();
        proposal.baseInterventionVersion = mission.getVersion();
        proposal.proposedBy = authorId;
        proposal.originalAmount = agreedAmount;
        proposal.proposedAmount = normalized;
        proposal.currency = quote.getCurrency();
        proposal.reason = reason.strip();
        proposal.status = Status.PROPOSED;
        proposal.createdAt = now;
        return proposal;
    }

    /** Motif bloquant commun aux commandes et à leur prévisualisation, sans effet de bord.
     * Les transactions de paiement sont vérifiées séparément par le service sous verrou.
     */
    public static String eligibilityFailure(ServiceQuote quote, Intervention mission, BigDecimal agreedAmount) {
        if (quote == null || mission == null || quote.getStatus() != ServiceQuote.Status.APPROVED || quote.getId() == null
                || quote.getOrganizationId() == null || mission.getId() == null
                || !mission.getId().equals(quote.getInterventionId())
                || !quote.getOrganizationId().equals(mission.getOrganizationId())) {
            return "L'avenant doit porter sur un devis accepté de cette mission";
        }
        if (mission.getStatus() != InterventionStatus.PENDING
                && mission.getStatus() != InterventionStatus.AWAITING_VALIDATION
                && mission.getStatus() != InterventionStatus.AWAITING_PAYMENT) {
            return "La mission a commencé ou est close";
        }
        if (quote.getDepositPaidAt() != null || mission.getPaidAt() != null || mission.getStripeSessionId() != null
                || (mission.getPaymentStatus() != null && mission.getPaymentStatus() != PaymentStatus.PENDING)) {
            return "Un paiement est engagé : cet avenant de prix nécessite un traitement financier";
        }
        if (quote.getDepositAmount() != null && quote.getDepositAmount().signum() > 0) {
            return "Les accords avec acompte nécessitent un avenant financier";
        }
        if (mission.getServiceRequest() != null) {
            return "Cette mission liée à une demande de service nécessite une réconciliation financière";
        }
        if (agreedAmount == null || agreedAmount.signum() < 0 || mission.getEstimatedCost() == null
                || mission.getEstimatedCost().compareTo(agreedAmount) != 0
                || (mission.getCurrency() != null && !Objects.equals(mission.getCurrency(), quote.getCurrency()))) {
            return "Le prix de la mission ne correspond plus à l'accord";
        }
        return null;
    }

    private static void requireEligible(ServiceQuote quote, Intervention mission, BigDecimal agreedAmount) {
        String failure = eligibilityFailure(quote, mission, agreedAmount);
        if (failure != null) throw new IllegalStateException(failure);
    }

    public Long getId() { return id; }
    /** Vérifie le support contractuel ; ne prend aucune décision et ne modifie aucun montant. */
    public boolean isBasedOn(ServiceQuote quote, Intervention mission) {
        return isBasedOn(quote, mission, quote == null ? null : quote.getAmount());
    }

    public boolean isBasedOn(ServiceQuote quote, Intervention mission, BigDecimal agreedAmount) {
        return quote != null && mission != null && status == Status.PROPOSED
                && Objects.equals(quoteId, quote.getId())
                && Objects.equals(interventionId, mission.getId())
                && Objects.equals(interventionId, quote.getInterventionId())
                && Objects.equals(organizationId, quote.getOrganizationId())
                && Objects.equals(organizationId, mission.getOrganizationId())
                && Objects.equals(baseInterventionVersion, mission.getVersion())
                && quote.getStatus() == ServiceQuote.Status.APPROVED
                && originalAmount != null && agreedAmount != null
                && originalAmount.compareTo(agreedAmount) == 0
                && Objects.equals(currency, quote.getCurrency());
    }

    public void markObsolete(Long actorId, Instant now) {
        if (status != Status.PROPOSED) throw new IllegalStateException("Cet avenant a déjà été traité");
        decidedBy = Objects.requireNonNull(actorId);
        decidedAt = Objects.requireNonNull(now);
        status = Status.OBSOLETE;
    }
    public void accept(ServiceQuote quote, Intervention mission, BigDecimal agreedAmount,
                       Long actorId, long expectedVersion, Instant now) {
        if (version != expectedVersion || !isBasedOn(quote, mission, agreedAmount)) {
            throw new IllegalStateException("Cette proposition a changé ; rechargez l'avenant");
        }
        if (Objects.equals(proposedBy, actorId)) throw new IllegalStateException("L'auteur ne peut pas accepter son propre avenant");
        requireEligible(quote, mission, agreedAmount);
        decidedBy = Objects.requireNonNull(actorId);
        decidedAt = Objects.requireNonNull(now);
        status = Status.ACCEPTED;
    }
    public void close(Status decision, Long actorId, long expectedVersion, Instant now) {
        if (version != expectedVersion || status != Status.PROPOSED) {
            throw new IllegalStateException("Cette proposition a déjà changé ; rechargez l'avenant");
        }
        if (decision != Status.REJECTED && decision != Status.WITHDRAWN) {
            throw new IllegalArgumentException("Décision non disponible");
        }
        decidedBy = Objects.requireNonNull(actorId);
        decidedAt = Objects.requireNonNull(now);
        status = decision;
    }
    public long getVersion() { return version; }
    public Long getOrganizationId() { return organizationId; }
    public Long getQuoteId() { return quoteId; }
    public Long getInterventionId() { return interventionId; }
    public Long getBaseInterventionVersion() { return baseInterventionVersion; }
    public Long getProposedBy() { return proposedBy; }
    public BigDecimal getOriginalAmount() { return originalAmount; }
    public BigDecimal getProposedAmount() { return proposedAmount; }
    public String getCurrency() { return currency; }
    public String getReason() { return reason; }
    public Status getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getDecidedAt() { return decidedAt; }
    public Long getDecidedBy() { return decidedBy; }
}
