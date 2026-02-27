package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Entite pour stocker les inscriptions en attente de paiement.
 * Une fois le paiement Stripe confirme via webhook, l'inscription est finalisee
 * (creation du user Keycloak + user en base) puis cette entite est supprimee.
 */
@Entity
@Table(name = "pending_inscriptions")
public class PendingInscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "first_name", nullable = false)
    private String firstName;

    @Column(name = "last_name", nullable = false)
    private String lastName;

    @Column(nullable = false)
    private String email;

    private String password;

    @Column(name = "phone_number")
    private String phoneNumber;

    @Column(name = "company_name")
    private String companyName;

    @Column(name = "organization_type", length = 30)
    private String organizationType = "INDIVIDUAL";

    @Column(nullable = false)
    private String forfait;

    // Donnees du formulaire de devis
    private String city;

    @Column(name = "postal_code")
    private String postalCode;

    @Column(name = "property_type")
    private String propertyType;

    @Column(name = "property_count")
    private Integer propertyCount;

    private Integer surface;

    @Column(name = "guest_capacity")
    private Integer guestCapacity;

    @Column(name = "booking_frequency")
    private String bookingFrequency;

    @Column(name = "cleaning_schedule")
    private String cleaningSchedule;

    @Column(name = "calendar_sync")
    private String calendarSync;

    /** Services forfait sélectionnés (stockés séparés par virgule) */
    @Column(name = "services", length = 500)
    private String services;

    /** Services sur devis sélectionnés (stockés séparés par virgule) */
    @Column(name = "services_devis", length = 500)
    private String servicesDevis;

    @Column(name = "billing_period", length = 20)
    private String billingPeriod = "MONTHLY";

    // Token de confirmation email (SHA-256 hash)
    @Column(name = "confirmation_token_hash", length = 64)
    private String confirmationTokenHash;

    // Stripe
    @Column(name = "stripe_session_id", unique = true)
    private String stripeSessionId;

    @Column(name = "stripe_customer_id")
    private String stripeCustomerId;

    @Column(name = "stripe_subscription_id")
    private String stripeSubscriptionId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PendingInscriptionStatus status = PendingInscriptionStatus.PENDING_PAYMENT;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    // Constructeurs
    public PendingInscription() {}

    // Getters et Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }

    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }

    public String getOrganizationType() { return organizationType; }
    public void setOrganizationType(String organizationType) { this.organizationType = organizationType; }

    public String getForfait() { return forfait; }
    public void setForfait(String forfait) { this.forfait = forfait; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getPostalCode() { return postalCode; }
    public void setPostalCode(String postalCode) { this.postalCode = postalCode; }

    public String getPropertyType() { return propertyType; }
    public void setPropertyType(String propertyType) { this.propertyType = propertyType; }

    public Integer getPropertyCount() { return propertyCount; }
    public void setPropertyCount(Integer propertyCount) { this.propertyCount = propertyCount; }

    public Integer getSurface() { return surface; }
    public void setSurface(Integer surface) { this.surface = surface; }

    public Integer getGuestCapacity() { return guestCapacity; }
    public void setGuestCapacity(Integer guestCapacity) { this.guestCapacity = guestCapacity; }

    public String getBookingFrequency() { return bookingFrequency; }
    public void setBookingFrequency(String bookingFrequency) { this.bookingFrequency = bookingFrequency; }

    public String getCleaningSchedule() { return cleaningSchedule; }
    public void setCleaningSchedule(String cleaningSchedule) { this.cleaningSchedule = cleaningSchedule; }

    public String getCalendarSync() { return calendarSync; }
    public void setCalendarSync(String calendarSync) { this.calendarSync = calendarSync; }

    public String getServices() { return services; }
    public void setServices(String services) { this.services = services; }

    public String getServicesDevis() { return servicesDevis; }
    public void setServicesDevis(String servicesDevis) { this.servicesDevis = servicesDevis; }

    public String getBillingPeriod() { return billingPeriod; }
    public void setBillingPeriod(String billingPeriod) { this.billingPeriod = billingPeriod; }

    public String getConfirmationTokenHash() { return confirmationTokenHash; }
    public void setConfirmationTokenHash(String confirmationTokenHash) { this.confirmationTokenHash = confirmationTokenHash; }

    public String getStripeSessionId() { return stripeSessionId; }
    public void setStripeSessionId(String stripeSessionId) { this.stripeSessionId = stripeSessionId; }

    public String getStripeCustomerId() { return stripeCustomerId; }
    public void setStripeCustomerId(String stripeCustomerId) { this.stripeCustomerId = stripeCustomerId; }

    public String getStripeSubscriptionId() { return stripeSubscriptionId; }
    public void setStripeSubscriptionId(String stripeSubscriptionId) { this.stripeSubscriptionId = stripeSubscriptionId; }

    public PendingInscriptionStatus getStatus() { return status; }
    public void setStatus(PendingInscriptionStatus status) { this.status = status; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }

    public String getFullName() {
        return firstName + " " + lastName;
    }

    @Override
    public String toString() {
        return "PendingInscription{" +
                "id=" + id +
                ", email='" + email + '\'' +
                ", forfait='" + forfait + '\'' +
                ", status=" + status +
                ", stripeSessionId='" + stripeSessionId + '\'' +
                '}';
    }
}
