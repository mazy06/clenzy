package com.clenzy.model;

import com.clenzy.config.EncryptedFieldConverter;
import com.clenzy.util.StringUtils;
import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "users")
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", insertable = false, updatable = false)
    private Organization organization;
    
    @NotBlank(message = "Le prénom est obligatoire")
    @Size(min = 2, max = 50, message = "Le prénom doit contenir entre 2 et 50 caractères")
    // length=500 : la valeur stockée est le ciphertext AES (EncryptedFieldConverter), bien plus long
    // que le texte clair. Sans cette longueur explicite, Hibernate dimensionnerait la colonne sur le
    // @Size(50) (texte clair) → varchar(50) trop court (cf. Guest, varchar(500)). Le @Size valide le clair.
    @Column(name = "first_name", nullable = false, length = 500)
    @Convert(converter = EncryptedFieldConverter.class)
    private String firstName;

    @NotBlank(message = "Le nom est obligatoire")
    @Size(min = 2, max = 50, message = "Le nom doit contenir entre 2 et 50 caractères")
    @Column(name = "last_name", nullable = false, length = 500)
    @Convert(converter = EncryptedFieldConverter.class)
    private String lastName;

    @NotBlank(message = "L'email est obligatoire")
    @Email(message = "Format d'email invalide")
    @Column(unique = true, nullable = false)
    @Convert(converter = EncryptedFieldConverter.class)
    private String email;

    @Column(name = "email_hash", length = 64)
    private String emailHash;

    // Le mot de passe n'est PAS persiste ici : Keycloak est la seule source
    // d'authentification (cf. InscriptionService -> keycloakUser.setPassword).
    // Le champ legacy `users.password` (stocke en clair) a ete supprime
    // (changeset 0235) — voir mission MB1-PASSWORD.

    @Column(name = "phone_number")
    @Convert(converter = EncryptedFieldConverter.class)
    private String phoneNumber;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserRole role = UserRole.HOST;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserStatus status = UserStatus.ACTIVE;
    
    @Column(name = "profile_picture_url")
    private String profilePictureUrl;
    
    @Column(name = "cognito_user_id")
    private String cognitoUserId;
    
    @Column(name = "keycloak_id", unique = true)
    private String keycloakId;

    @Column(name = "stripe_customer_id", unique = true)
    private String stripeCustomerId;

    @Column(name = "stripe_subscription_id", unique = true)
    private String stripeSubscriptionId;

    // Donnees du profil host (remplies lors de l'inscription via le formulaire de devis)
    @Column(name = "company_name")
    private String companyName;

    private String forfait;

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

    /** Services forfait sélectionnés (stockés séparés par virgule, ex: "menage-complet,linge,poubelles") */
    @Column(name = "services", length = 500)
    private String services;

    /** Services sur devis sélectionnés (stockés séparés par virgule, ex: "repassage,vitres") */
    @Column(name = "services_devis", length = 500)
    private String servicesDevis;

    @Column(name = "billing_period", length = 20)
    private String billingPeriod;

    // ─── Consentement RGPD + attribution (recopie depuis pending_inscriptions) ─

    /** Horodatage du consentement aux CGU/Politique de confidentialite (RGPD). */
    @Column(name = "accepted_terms_at")
    private LocalDateTime acceptedTermsAt;

    /** Opt-in newsletter (modifiable dans /settings/notifications). */
    @Column(name = "newsletter_opt_in", nullable = false)
    private boolean newsletterOptIn = false;

    /** Code promo / cooptation utilise a l'inscription. */
    @Column(name = "promo_code", length = 50)
    private String promoCode;

    /** Canal de decouverte declare a l'inscription. */
    @Column(name = "referral_source", length = 50)
    private String referralSource;

    /** Paiement differe : les interventions auto (iCal) passent directement en PENDING sans attente de paiement */
    @Column(name = "deferred_payment", nullable = false)
    private boolean deferredPayment = false;

    @Column(name = "email_verified")
    private Boolean emailVerified = false;
    
    @Column(name = "phone_verified")
    private Boolean phoneVerified = false;
    
    @Column(name = "last_login")
    private LocalDateTime lastLogin;
    
    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    @UpdateTimestamp
    private LocalDateTime updatedAt;
    
    // Relations
    @OneToMany(mappedBy = "owner", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private Set<Property> properties = new HashSet<>();
    
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private Set<ServiceRequest> serviceRequests = new HashSet<>();
    
    // Relations vers les interventions supprimées car nous utilisons ServiceRequest directement
    
    // Constructeurs
    public User() {}
    
    /**
     * @param legacyPassword conserve uniquement pour la compatibilite de signature
     *        (nombreux appels de test historiques). Le mot de passe n'est PLUS
     *        persiste : il transite uniquement vers Keycloak. Parametre ignore.
     */
    public User(String firstName, String lastName, String email, String legacyPassword) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.email = email;
    }
    
    // Getters et Setters
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public String getFirstName() {
        return firstName;
    }
    
    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }
    
    public String getLastName() {
        return lastName;
    }
    
    public void setLastName(String lastName) {
        this.lastName = lastName;
    }
    
    public String getEmail() {
        return email;
    }
    
    public void setEmail(String email) {
        this.email = email;
        this.emailHash = email != null ? StringUtils.computeEmailHash(email) : null;
    }

    public String getEmailHash() {
        return emailHash;
    }

    public void setEmailHash(String emailHash) {
        this.emailHash = emailHash;
    }


    public String getPhoneNumber() {
        return phoneNumber;
    }
    
    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }
    
    public UserRole getRole() {
        return role;
    }
    
    public void setRole(UserRole role) {
        this.role = role;
    }
    
    public UserStatus getStatus() {
        return status;
    }
    
    public void setStatus(UserStatus status) {
        this.status = status;
    }
    
    public String getProfilePictureUrl() {
        return profilePictureUrl;
    }
    
    public void setProfilePictureUrl(String profilePictureUrl) {
        this.profilePictureUrl = profilePictureUrl;
    }
    
    public String getCognitoUserId() {
        return cognitoUserId;
    }
    
    public void setCognitoUserId(String cognitoUserId) {
        this.cognitoUserId = cognitoUserId;
    }
    
    public String getKeycloakId() {
        return keycloakId;
    }
    
    public void setKeycloakId(String keycloakId) {
        this.keycloakId = keycloakId;
    }

    public String getStripeCustomerId() {
        return stripeCustomerId;
    }

    public void setStripeCustomerId(String stripeCustomerId) {
        this.stripeCustomerId = stripeCustomerId;
    }

    public String getStripeSubscriptionId() {
        return stripeSubscriptionId;
    }

    public void setStripeSubscriptionId(String stripeSubscriptionId) {
        this.stripeSubscriptionId = stripeSubscriptionId;
    }

    public String getCompanyName() {
        return companyName;
    }

    public void setCompanyName(String companyName) {
        this.companyName = companyName;
    }

    public String getForfait() {
        return forfait;
    }

    public void setForfait(String forfait) {
        this.forfait = forfait;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getPostalCode() {
        return postalCode;
    }

    public void setPostalCode(String postalCode) {
        this.postalCode = postalCode;
    }

    public String getPropertyType() {
        return propertyType;
    }

    public void setPropertyType(String propertyType) {
        this.propertyType = propertyType;
    }

    public Integer getPropertyCount() {
        return propertyCount;
    }

    public void setPropertyCount(Integer propertyCount) {
        this.propertyCount = propertyCount;
    }

    public Integer getSurface() {
        return surface;
    }

    public void setSurface(Integer surface) {
        this.surface = surface;
    }

    public Integer getGuestCapacity() {
        return guestCapacity;
    }

    public void setGuestCapacity(Integer guestCapacity) {
        this.guestCapacity = guestCapacity;
    }

    public String getBookingFrequency() {
        return bookingFrequency;
    }

    public void setBookingFrequency(String bookingFrequency) {
        this.bookingFrequency = bookingFrequency;
    }

    public String getCleaningSchedule() {
        return cleaningSchedule;
    }

    public void setCleaningSchedule(String cleaningSchedule) {
        this.cleaningSchedule = cleaningSchedule;
    }

    public String getCalendarSync() {
        return calendarSync;
    }

    public void setCalendarSync(String calendarSync) {
        this.calendarSync = calendarSync;
    }

    public String getServices() {
        return services;
    }

    public void setServices(String services) {
        this.services = services;
    }

    public String getServicesDevis() {
        return servicesDevis;
    }

    public void setServicesDevis(String servicesDevis) {
        this.servicesDevis = servicesDevis;
    }

    public String getBillingPeriod() {
        return billingPeriod;
    }

    public void setBillingPeriod(String billingPeriod) {
        this.billingPeriod = billingPeriod;
    }

    public LocalDateTime getAcceptedTermsAt() {
        return acceptedTermsAt;
    }

    public void setAcceptedTermsAt(LocalDateTime acceptedTermsAt) {
        this.acceptedTermsAt = acceptedTermsAt;
    }

    public boolean isNewsletterOptIn() {
        return newsletterOptIn;
    }

    public void setNewsletterOptIn(boolean newsletterOptIn) {
        this.newsletterOptIn = newsletterOptIn;
    }

    public String getPromoCode() {
        return promoCode;
    }

    public void setPromoCode(String promoCode) {
        this.promoCode = promoCode;
    }

    public String getReferralSource() {
        return referralSource;
    }

    public void setReferralSource(String referralSource) {
        this.referralSource = referralSource;
    }

    public boolean isDeferredPayment() {
        return deferredPayment;
    }

    public void setDeferredPayment(boolean deferredPayment) {
        this.deferredPayment = deferredPayment;
    }

    public Boolean isEmailVerified() {
        return emailVerified;
    }
    
    public void setEmailVerified(Boolean emailVerified) {
        this.emailVerified = emailVerified;
    }
    
    public Boolean isPhoneVerified() {
        return phoneVerified;
    }
    
    public void setPhoneVerified(Boolean phoneVerified) {
        this.phoneVerified = phoneVerified;
    }
    
    public LocalDateTime getLastLogin() {
        return lastLogin;
    }
    
    public void setLastLogin(LocalDateTime lastLogin) {
        this.lastLogin = lastLogin;
    }
    
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
    
    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
    
    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
    
    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
    
    public Set<Property> getProperties() {
        return properties;
    }
    
    public void setProperties(Set<Property> properties) {
        this.properties = properties;
    }
    
    public Set<ServiceRequest> getServiceRequests() {
        return serviceRequests;
    }
    
    public void setServiceRequests(Set<ServiceRequest> serviceRequests) {
        this.serviceRequests = serviceRequests;
    }
    

    
    public Long getOrganizationId() {
        return organizationId;
    }

    public void setOrganizationId(Long organizationId) {
        this.organizationId = organizationId;
    }

    public Organization getOrganization() {
        return organization;
    }

    // Méthodes utilitaires
    public String getFullName() {
        return firstName + " " + lastName;
    }
    
    public boolean isAdmin() {
        return role != null && role.isPlatformAdmin();
    }
    
    public boolean isTechnician() {
        return UserRole.TECHNICIAN.equals(role);
    }
    
    public boolean isHost() {
        return UserRole.HOST.equals(role);
    }
    
    @Override
    public String toString() {
        return "User{" +
                "id=" + id +
                ", firstName='" + firstName + '\'' +
                ", lastName='" + lastName + '\'' +
                ", email='" + email + '\'' +
                ", role=" + role +
                ", status=" + status +
                '}';
    }
}
