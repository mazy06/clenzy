package com.clenzy.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "organizations", indexes = {
    @Index(name = "idx_org_slug", columnList = "slug", unique = true),
    @Index(name = "idx_org_type", columnList = "type"),
    @Index(name = "idx_org_stripe_customer", columnList = "stripe_customer_id")
})
public class Organization {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Le nom de l'organisation est obligatoire")
    @Size(min = 1, max = 200)
    @Column(nullable = false, length = 200)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private OrganizationType type = OrganizationType.INDIVIDUAL;

    @Column(unique = true, nullable = false, length = 100)
    private String slug;

    // --- Champs billing (migres depuis User) ---

    @Column(name = "stripe_customer_id", unique = true)
    private String stripeCustomerId;

    @Column(name = "stripe_subscription_id", unique = true)
    private String stripeSubscriptionId;

    private String forfait;

    @Column(name = "billing_period", length = 20)
    private String billingPeriod;

    @Column(name = "deferred_payment", nullable = false)
    private boolean deferredPayment = false;

    // --- Timestamps ---

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    // --- Relations ---

    @OneToMany(mappedBy = "organization", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private Set<OrganizationMember> members = new HashSet<>();

    // --- Constructeurs ---

    public Organization() {}

    public Organization(String name, OrganizationType type, String slug) {
        this.name = name;
        this.type = type;
        this.slug = slug;
    }

    // --- Getters / Setters ---

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public OrganizationType getType() { return type; }
    public void setType(OrganizationType type) { this.type = type; }

    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }

    public String getStripeCustomerId() { return stripeCustomerId; }
    public void setStripeCustomerId(String stripeCustomerId) { this.stripeCustomerId = stripeCustomerId; }

    public String getStripeSubscriptionId() { return stripeSubscriptionId; }
    public void setStripeSubscriptionId(String stripeSubscriptionId) { this.stripeSubscriptionId = stripeSubscriptionId; }

    public String getForfait() { return forfait; }
    public void setForfait(String forfait) { this.forfait = forfait; }

    public String getBillingPeriod() { return billingPeriod; }
    public void setBillingPeriod(String billingPeriod) { this.billingPeriod = billingPeriod; }

    public boolean isDeferredPayment() { return deferredPayment; }
    public void setDeferredPayment(boolean deferredPayment) { this.deferredPayment = deferredPayment; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public Set<OrganizationMember> getMembers() { return members; }
    public void setMembers(Set<OrganizationMember> members) { this.members = members; }

    // --- Methodes utilitaires ---

    public boolean isIndividual() {
        return OrganizationType.INDIVIDUAL.equals(type);
    }

    @Override
    public String toString() {
        return "Organization{" +
                "id=" + id +
                ", name='" + name + '\'' +
                ", type=" + type +
                ", slug='" + slug + '\'' +
                '}';
    }
}
