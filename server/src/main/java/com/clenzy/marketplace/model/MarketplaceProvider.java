package com.clenzy.marketplace.model;

import com.clenzy.config.EncryptedFieldConverter;
import com.clenzy.util.StringUtils;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Fiche professionnelle de la place de marche Baitly.
 *
 * <h2>Pourquoi cette entite n'est pas org-scopee</h2>
 * <p>Tout l'existant prestataire — equipe personnelle, zones de couverture,
 * tarifs menage, prestations technicien — porte {@code organization_id} et
 * passe par le filtre Hibernate {@code organizationFilter}. C'est ce qu'il faut
 * pour la gestion INTERNE d'une conciergerie, et c'est ce qui rend un catalogue
 * de place de marche impossible : le professionnel n'y serait visible que de
 * l'organisation qui l'a saisi.</p>
 *
 * <p>Cette entite est donc PLATEFORME : aucun filtre tenant. Le cloisonnement
 * passe par l'autorisation ({@code SUPER_ADMIN} / {@code SUPER_MANAGER} sur
 * l'API d'administration), jamais par le tenant. Toute requete qui l'expose
 * ailleurs doit rendre ce choix explicite.</p>
 *
 * <h2>L'organisation porteuse</h2>
 * <p>Un professionnel est toujours porte par une organisation : la sienne s'il
 * est independant, celle qui l'emploie s'il est rattache. {@link #homeOrganizationId}
 * reste vide tant que la candidature n'est pas validee — quelqu'un qui s'inscrit
 * depuis le site public n'a pas encore d'organisation d'accueil.</p>
 */
@Entity
@Table(name = "marketplace_providers")
public class MarketplaceProvider {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Reference opaque servie aux surfaces publiques. Jamais l'identifiant
     * sequentiel, qui donnerait le volume du catalogue et permettrait de
     * l'enumerer.
     */
    @Column(name = "public_ref", nullable = false, updatable = false)
    private UUID publicRef = UUID.randomUUID();

    /**
     * Nom commercial publie. <b>Volontairement en clair</b> : c'est l'enseigne
     * sous laquelle le professionnel se presente, et la seule colonne que
     * l'ecran cherche et trie. La chiffrer aurait casse la recherche et le tri,
     * c'est-a-dire ce pour quoi l'ecran existe.
     */
    @Column(name = "display_name", nullable = false, length = 150)
    private String displayName;

    @Column(name = "legal_name", length = 200)
    private String legalName;

    // ─── Coordonnees personnelles : chiffrees au repos ───────────────────────
    //
    // `users` chiffre deja prenom, nom, courriel et telephone. Les reprendre en
    // clair ici aurait laisse la meme personne protegee d'un cote et lisible de
    // l'autre. Les colonnes font 500 caracteres : le ciphertext est bien plus
    // long que le texte clair.

    @Column(name = "contact_first_name", length = 500)
    @Convert(converter = EncryptedFieldConverter.class)
    private String contactFirstName;

    @Column(name = "contact_last_name", length = 500)
    @Convert(converter = EncryptedFieldConverter.class)
    private String contactLastName;

    @Column(name = "email", nullable = false, length = 500)
    @Convert(converter = EncryptedFieldConverter.class)
    private String email;

    /**
     * SHA-256 du courriel normalise.
     *
     * <p>Porte l'unicite et toutes les recherches exactes : le chiffrement AES a
     * vecteur aleatoire donne un ciphertext different a chaque ecriture, donc ni
     * indexable ni comparable. Meme mecanisme que {@code users.email_hash}.
     * Renseigne automatiquement par {@link #setEmail(String)} — ne jamais le
     * poser a la main, les deux valeurs divergeraient.</p>
     */
    @Column(name = "email_hash", length = 64)
    private String emailHash;

    @Column(name = "phone", length = 500)
    @Convert(converter = EncryptedFieldConverter.class)
    private String phone;

    @Column(name = "website", length = 300)
    private String website;

    @Column(name = "headline", length = 200)
    private String headline;

    @Column(name = "bio", columnDefinition = "TEXT")
    private String bio;

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    // ─── Ancrage geographique ────────────────────────────────────────────────

    @Column(name = "base_address", length = 200)
    private String baseAddress;

    @Column(name = "base_city", length = 80)
    private String baseCity;

    @Column(name = "base_postal_code", length = 10)
    private String basePostalCode;

    @Column(name = "base_country_code", nullable = false, length = 2)
    private String baseCountryCode = "FR";

    @Column(name = "latitude", precision = 10, scale = 6)
    private BigDecimal latitude;

    @Column(name = "longitude", precision = 10, scale = 6)
    private BigDecimal longitude;

    /**
     * Distance maximale de deplacement depuis la base. Complete les zones
     * declarees : une zone dit « je couvre ce departement », le rayon dit
     * « je me deplace jusque-la ».
     */
    @Column(name = "travel_radius_km")
    private Integer travelRadiusKm;

    /** Codes ISO 639-1 separes par des virgules (ex. {@code fr,en,ar}). */
    @Column(name = "languages", length = 120)
    private String languages;

    // ─── Etat ────────────────────────────────────────────────────────────────

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ProviderStatus status = ProviderStatus.PENDING_REVIEW;

    @Enumerated(EnumType.STRING)
    @Column(name = "engagement_mode", nullable = false, length = 20)
    private EngagementMode engagementMode = EngagementMode.INDEPENDENT;

    @Column(name = "home_organization_id")
    private Long homeOrganizationId;

    @Column(name = "user_id")
    private Long userId;

    // ─── Conformite ──────────────────────────────────────────────────────────
    //
    // Les pieces elles-memes vivent dans `provider_documents`, deja rattache a
    // l'utilisateur. Ces colonnes ne les dupliquent pas : elles portent les
    // echeances, qui doivent etre filtrables sans ouvrir chaque document.

    @Column(name = "registration_number", length = 40)
    private String registrationNumber;

    @Column(name = "vat_number", length = 40)
    private String vatNumber;

    @Column(name = "insurance_company", length = 120)
    private String insuranceCompany;

    @Column(name = "insurance_policy_number", length = 60)
    private String insurancePolicyNumber;

    @Column(name = "insurance_expires_at")
    private LocalDate insuranceExpiresAt;

    /**
     * Echeance de l'attestation de vigilance URSSAF. Son absence expose le
     * donneur d'ordre a la solidarite financiere en cas de travail dissimule :
     * c'est un critere de selection, pas un detail administratif.
     */
    @Column(name = "vigilance_expires_at")
    private LocalDate vigilanceExpiresAt;

    // ─── Conditions commerciales generales ───────────────────────────────────

    @Column(name = "currency", nullable = false, length = 3)
    private String currency = "EUR";

    @Column(name = "minimum_charge", precision = 10, scale = 2)
    private BigDecimal minimumCharge;

    @Column(name = "travel_fee", precision = 10, scale = 2)
    private BigDecimal travelFee;

    @Column(name = "accepts_urgent", nullable = false)
    private boolean acceptsUrgent = false;

    @Column(name = "lead_time_hours")
    private Integer leadTimeHours;

    @Column(name = "cancellation_notice_hours")
    private Integer cancellationNoticeHours;

    // ─── Reputation (agregats denormalises) ──────────────────────────────────
    //
    // La liste affiche des cartes triables par note : recalculer une moyenne
    // par carte imposerait une agregation par professionnel a chaque page.
    // Recalcules par le service, jamais saisis a la main.

    @Column(name = "rating_avg", precision = 3, scale = 2)
    private BigDecimal ratingAvg;

    @Column(name = "rating_count", nullable = false)
    private int ratingCount = 0;

    @Column(name = "completed_missions", nullable = false)
    private int completedMissions = 0;

    @Column(name = "acceptance_rate_pct", precision = 5, scale = 2)
    private BigDecimal acceptanceRatePct;

    @Column(name = "avg_response_minutes")
    private Integer avgResponseMinutes;

    // ─── Moderation ──────────────────────────────────────────────────────────

    @Column(name = "verified_at")
    private LocalDateTime verifiedAt;

    @Column(name = "verified_by_keycloak_id", length = 64)
    private String verifiedByKeycloakId;

    /** Motif d'un refus ou note interne. Lue par l'equipe plateforme. */
    @Column(name = "review_note", length = 500)
    private String reviewNote;

    /**
     * Reponse ECRITE POUR LE CANDIDAT, envoyee par courriel.
     *
     * <p>Distincte de {@link #reviewNote}, qui reste interne. Un seul champ pour
     * deux lecteurs donnait soit une note franche qu'on n'ose pas envoyer, soit
     * un message diplomatique inutile a l'equipe.</p>
     */
    @Column(name = "decision_message", length = 2000)
    private String decisionMessage;

    /** Vide tant qu'aucune decision n'a ete annoncee au candidat. */
    @Column(name = "decision_sent_at")
    private LocalDateTime decisionSentAt;

    @Column(name = "retention_hold_reason", length = 1000)
    private String retentionHoldReason;

    @Column(name = "retention_hold_review_at")
    private LocalDateTime retentionHoldReviewAt;

    @Column(name = "retention_hold_actor", length = 120)
    private String retentionHoldActor;

    public String getRetentionHoldReason() { return retentionHoldReason; }
    public void setRetentionHoldReason(String value) { retentionHoldReason = value; }
    public LocalDateTime getRetentionHoldReviewAt() { return retentionHoldReviewAt; }
    public void setRetentionHoldReviewAt(LocalDateTime value) { retentionHoldReviewAt = value; }
    public String getRetentionHoldActor() { return retentionHoldActor; }
    public void setRetentionHoldActor(String value) { retentionHoldActor = value; }

    // ─── Preuve d'acceptation des conditions ─────────────────────────────────
    //
    // Meme forme que `users` : version du DOCUMENT accepte, horodatage, et
    // adresse resolue. Les trois ensemble font une preuve ; separement aucune ne
    // vaut. Vides sur une fiche reprise d'un compte interne — personne n'a rien
    // accepte, et poser une fausse preuve serait pire que son absence.

    @Column(name = "terms_version", length = 20)
    private String termsVersion;

    @Column(name = "terms_accepted_at")
    private LocalDateTime termsAcceptedAt;

    /** Preuve conservee, JAMAIS exposee par un DTO. */
    @Column(name = "terms_accepted_ip", length = 45)
    private String termsAcceptedIp;

    // ─── Jeton de depot des pieces ───────────────────────────────────────────
    //
    // Un candidat n'a pas de compte : ce jeton est la seule chose qui lui
    // permette de revenir deposer son Kbis et sa vigilance. Il est stocke en
    // EMPREINTE — un jeton en clair dans une colonne serait un acces direct aux
    // pieces d'identite pour quiconque lit la base.

    @Column(name = "upload_token_hash", length = 64)
    private String uploadTokenHash;

    @Column(name = "upload_token_expires_at")
    private LocalDateTime uploadTokenExpiresAt;

    // ─── Confirmation de l'adresse ───────────────────────────────────────────
    //
    // Le formulaire est public : sans preuve, n'importe qui peut candidater au
    // nom d'un tiers, et l'acceptation creerait un compte Keycloak sur son
    // adresse. Une fiche non confirmee reste instruisable, mais pas acceptable.

    @Column(name = "email_confirmed_at")
    private LocalDateTime emailConfirmedAt;

    @Column(name = "email_confirm_token_hash", length = 64)
    private String emailConfirmTokenHash;

    // ─── Activation du compte ────────────────────────────────────────────────
    //
    // Le plus sensible des trois jetons : il ouvre un COMPTE, la ou les autres
    // ouvrent un depot de pieces ou confirment une adresse. D'ou une fenetre
    // courte et un usage unique.

    @Column(name = "activation_token_hash", length = 64)
    private String activationTokenHash;

    @Column(name = "activation_token_expires_at")
    private LocalDateTime activationTokenExpiresAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false, length = 20)
    private ProviderSource source = ProviderSource.LANDING;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @Column(name = "activated_at")
    private LocalDateTime activatedAt;

    @Column(name = "suspended_at")
    private LocalDateTime suspendedAt;

    @Column(name = "last_active_at")
    private LocalDateTime lastActiveAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "provider", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<MarketplaceProviderOffer> offers = new ArrayList<>();

    @OneToMany(mappedBy = "provider", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<MarketplaceProviderZone> zones = new ArrayList<>();

    @OneToMany(mappedBy = "provider", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<MarketplaceProviderAvailability> availability = new ArrayList<>();

    // ─── Invariants metier ───────────────────────────────────────────────────

    /**
     * true si la fiche part au catalogue des organisations : publiee ET dans un
     * mode qui autorise l'exposition. Les deux conditions sont necessaires — une
     * fiche active mais exclusive reste invisible des autres organisations.
     */
    public boolean isExposable() {
        return status.isPubliclyVisible() && engagementMode.allowsCatalogExposure();
    }

    /**
     * true si une piece de conformite est expiree ou expire dans les trente
     * jours. Une piece absente n'est PAS un signalement : beaucoup de
     * professionnels n'ont pas encore depose leur dossier, et les traiter comme
     * non conformes noierait les vraies alertes.
     */
    public boolean hasComplianceAlert(LocalDate today) {
        LocalDate threshold = today.plusDays(30);
        return (insuranceExpiresAt != null && insuranceExpiresAt.isBefore(threshold))
            || (vigilanceExpiresAt != null && vigilanceExpiresAt.isBefore(threshold));
    }

    // ─── Accesseurs ──────────────────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public UUID getPublicRef() { return publicRef; }
    public void setPublicRef(UUID publicRef) { this.publicRef = publicRef; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public String getLegalName() { return legalName; }
    public void setLegalName(String legalName) { this.legalName = legalName; }

    public String getContactFirstName() { return contactFirstName; }
    public void setContactFirstName(String contactFirstName) { this.contactFirstName = contactFirstName; }

    public String getContactLastName() { return contactLastName; }
    public void setContactLastName(String contactLastName) { this.contactLastName = contactLastName; }

    public String getEmail() { return email; }

    /** Pose le courriel ET son empreinte : les separer les ferait diverger. */
    public void setEmail(String email) {
        this.email = email;
        this.emailHash = email == null ? null : StringUtils.computeEmailHash(email);
    }

    public String getEmailHash() { return emailHash; }

    /** Reserve a JPA. Passer par {@link #setEmail(String)} dans le code metier. */
    public void setEmailHash(String emailHash) { this.emailHash = emailHash; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getWebsite() { return website; }
    public void setWebsite(String website) { this.website = website; }

    public String getHeadline() { return headline; }
    public void setHeadline(String headline) { this.headline = headline; }

    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }

    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }

    public String getBaseAddress() { return baseAddress; }
    public void setBaseAddress(String baseAddress) { this.baseAddress = baseAddress; }

    public String getBaseCity() { return baseCity; }
    public void setBaseCity(String baseCity) { this.baseCity = baseCity; }

    public String getBasePostalCode() { return basePostalCode; }
    public void setBasePostalCode(String basePostalCode) { this.basePostalCode = basePostalCode; }

    public String getBaseCountryCode() { return baseCountryCode; }
    public void setBaseCountryCode(String baseCountryCode) { this.baseCountryCode = baseCountryCode; }

    public BigDecimal getLatitude() { return latitude; }
    public void setLatitude(BigDecimal latitude) { this.latitude = latitude; }

    public BigDecimal getLongitude() { return longitude; }
    public void setLongitude(BigDecimal longitude) { this.longitude = longitude; }

    public Integer getTravelRadiusKm() { return travelRadiusKm; }
    public void setTravelRadiusKm(Integer travelRadiusKm) { this.travelRadiusKm = travelRadiusKm; }

    public String getLanguages() { return languages; }
    public void setLanguages(String languages) { this.languages = languages; }

    public ProviderStatus getStatus() { return status; }
    public void setStatus(ProviderStatus status) { this.status = status; }

    public EngagementMode getEngagementMode() { return engagementMode; }
    public void setEngagementMode(EngagementMode engagementMode) { this.engagementMode = engagementMode; }

    public Long getHomeOrganizationId() { return homeOrganizationId; }
    public void setHomeOrganizationId(Long homeOrganizationId) { this.homeOrganizationId = homeOrganizationId; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getRegistrationNumber() { return registrationNumber; }
    public void setRegistrationNumber(String registrationNumber) { this.registrationNumber = registrationNumber; }

    public String getVatNumber() { return vatNumber; }
    public void setVatNumber(String vatNumber) { this.vatNumber = vatNumber; }

    public String getInsuranceCompany() { return insuranceCompany; }
    public void setInsuranceCompany(String insuranceCompany) { this.insuranceCompany = insuranceCompany; }

    public String getInsurancePolicyNumber() { return insurancePolicyNumber; }
    public void setInsurancePolicyNumber(String insurancePolicyNumber) { this.insurancePolicyNumber = insurancePolicyNumber; }

    public LocalDate getInsuranceExpiresAt() { return insuranceExpiresAt; }
    public void setInsuranceExpiresAt(LocalDate insuranceExpiresAt) { this.insuranceExpiresAt = insuranceExpiresAt; }

    public LocalDate getVigilanceExpiresAt() { return vigilanceExpiresAt; }
    public void setVigilanceExpiresAt(LocalDate vigilanceExpiresAt) { this.vigilanceExpiresAt = vigilanceExpiresAt; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public BigDecimal getMinimumCharge() { return minimumCharge; }
    public void setMinimumCharge(BigDecimal minimumCharge) { this.minimumCharge = minimumCharge; }

    public BigDecimal getTravelFee() { return travelFee; }
    public void setTravelFee(BigDecimal travelFee) { this.travelFee = travelFee; }

    public boolean isAcceptsUrgent() { return acceptsUrgent; }
    public void setAcceptsUrgent(boolean acceptsUrgent) { this.acceptsUrgent = acceptsUrgent; }

    public Integer getLeadTimeHours() { return leadTimeHours; }
    public void setLeadTimeHours(Integer leadTimeHours) { this.leadTimeHours = leadTimeHours; }

    public Integer getCancellationNoticeHours() { return cancellationNoticeHours; }
    public void setCancellationNoticeHours(Integer cancellationNoticeHours) { this.cancellationNoticeHours = cancellationNoticeHours; }

    public BigDecimal getRatingAvg() { return ratingAvg; }
    public void setRatingAvg(BigDecimal ratingAvg) { this.ratingAvg = ratingAvg; }

    public int getRatingCount() { return ratingCount; }
    public void setRatingCount(int ratingCount) { this.ratingCount = ratingCount; }

    public int getCompletedMissions() { return completedMissions; }
    public void setCompletedMissions(int completedMissions) { this.completedMissions = completedMissions; }

    public BigDecimal getAcceptanceRatePct() { return acceptanceRatePct; }
    public void setAcceptanceRatePct(BigDecimal acceptanceRatePct) { this.acceptanceRatePct = acceptanceRatePct; }

    public Integer getAvgResponseMinutes() { return avgResponseMinutes; }
    public void setAvgResponseMinutes(Integer avgResponseMinutes) { this.avgResponseMinutes = avgResponseMinutes; }

    public LocalDateTime getVerifiedAt() { return verifiedAt; }
    public void setVerifiedAt(LocalDateTime verifiedAt) { this.verifiedAt = verifiedAt; }

    public String getVerifiedByKeycloakId() { return verifiedByKeycloakId; }
    public void setVerifiedByKeycloakId(String verifiedByKeycloakId) { this.verifiedByKeycloakId = verifiedByKeycloakId; }

    public String getReviewNote() { return reviewNote; }
    public void setReviewNote(String reviewNote) { this.reviewNote = reviewNote; }

    public String getTermsVersion() { return termsVersion; }
    public void setTermsVersion(String termsVersion) { this.termsVersion = termsVersion; }

    public LocalDateTime getTermsAcceptedAt() { return termsAcceptedAt; }
    public void setTermsAcceptedAt(LocalDateTime termsAcceptedAt) { this.termsAcceptedAt = termsAcceptedAt; }

    public String getTermsAcceptedIp() { return termsAcceptedIp; }
    public void setTermsAcceptedIp(String termsAcceptedIp) { this.termsAcceptedIp = termsAcceptedIp; }

    public String getActivationTokenHash() { return activationTokenHash; }
    public void setActivationTokenHash(String hash) { this.activationTokenHash = hash; }

    public LocalDateTime getActivationTokenExpiresAt() { return activationTokenExpiresAt; }
    public void setActivationTokenExpiresAt(LocalDateTime at) { this.activationTokenExpiresAt = at; }

    public LocalDateTime getEmailConfirmedAt() { return emailConfirmedAt; }
    public void setEmailConfirmedAt(LocalDateTime at) { this.emailConfirmedAt = at; }

    public String getEmailConfirmTokenHash() { return emailConfirmTokenHash; }
    public void setEmailConfirmTokenHash(String hash) { this.emailConfirmTokenHash = hash; }

    /** L'adresse a-t-elle ete prouvee ? Condition de l'acceptation. */
    public boolean isEmailConfirmed() { return emailConfirmedAt != null; }

    public String getDecisionMessage() { return decisionMessage; }
    public void setDecisionMessage(String decisionMessage) { this.decisionMessage = decisionMessage; }

    public LocalDateTime getDecisionSentAt() { return decisionSentAt; }
    public void setDecisionSentAt(LocalDateTime decisionSentAt) { this.decisionSentAt = decisionSentAt; }

    public String getUploadTokenHash() { return uploadTokenHash; }
    public void setUploadTokenHash(String uploadTokenHash) { this.uploadTokenHash = uploadTokenHash; }

    public LocalDateTime getUploadTokenExpiresAt() { return uploadTokenExpiresAt; }
    public void setUploadTokenExpiresAt(LocalDateTime at) { this.uploadTokenExpiresAt = at; }

    public ProviderSource getSource() { return source; }
    public void setSource(ProviderSource source) { this.source = source; }

    public LocalDateTime getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(LocalDateTime submittedAt) { this.submittedAt = submittedAt; }

    public LocalDateTime getActivatedAt() { return activatedAt; }
    public void setActivatedAt(LocalDateTime activatedAt) { this.activatedAt = activatedAt; }

    public LocalDateTime getSuspendedAt() { return suspendedAt; }
    public void setSuspendedAt(LocalDateTime suspendedAt) { this.suspendedAt = suspendedAt; }

    public LocalDateTime getLastActiveAt() { return lastActiveAt; }
    public void setLastActiveAt(LocalDateTime lastActiveAt) { this.lastActiveAt = lastActiveAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public List<MarketplaceProviderOffer> getOffers() { return offers; }
    public void setOffers(List<MarketplaceProviderOffer> offers) { this.offers = offers; }

    public List<MarketplaceProviderZone> getZones() { return zones; }
    public void setZones(List<MarketplaceProviderZone> zones) { this.zones = zones; }

    public List<MarketplaceProviderAvailability> getAvailability() { return availability; }
    public void setAvailability(List<MarketplaceProviderAvailability> availability) { this.availability = availability; }
}
