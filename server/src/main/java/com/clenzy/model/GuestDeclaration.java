package com.clenzy.model;

import com.clenzy.config.EncryptedFieldConverter;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Fiche de police / declaration voyageur — entite DEDIEE (distincte du flux check-in
 * {@link OnlineCheckIn}). <b>Une declaration par voyageur</b>, voyageur principal
 * ({@code isPrimary=true}) comme accompagnants.
 *
 * <p>Donnee PII sensible et soumise a une <b>obligation de purge</b> (fiche de police
 * voyageurs etrangers : 6 mois / 180 jours, CESEDA R814-3 ; cf. {@code RETENTION-POLICY.md}).
 * Tous les champs d'identite sont chiffres AES-256 via {@link EncryptedFieldConverter}
 * (memes garanties que {@link Guest} / {@link OnlineCheckIn}).</p>
 *
 * <p>Org-scopee via le filtre Hibernate {@code organizationFilter} (multi-tenant).
 * L'{@code organizationId} et la {@code reservation} sont resolus <b>serveur</b> (jamais
 * depuis le client) — cf. {@code GuestDeclarationService}.</p>
 */
@Entity
@Table(name = "guest_declarations")
@org.hibernate.annotations.Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class GuestDeclaration {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reservation_id", nullable = false)
    private Reservation reservation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "guest_id")
    private Guest guest;

    /** true = voyageur principal du sejour ; false = accompagnant. */
    @Column(name = "is_primary", nullable = false)
    private boolean primary = true;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DeclarationStatus status = DeclarationStatus.PENDING;

    // --- Identite (PII chiffrees AES-256) ---

    @Convert(converter = EncryptedFieldConverter.class)
    @Column(name = "first_name", length = 500)
    private String firstName;

    @Convert(converter = EncryptedFieldConverter.class)
    @Column(name = "last_name", length = 500)
    private String lastName;

    @Convert(converter = EncryptedFieldConverter.class)
    @Column(name = "maiden_name", length = 500)
    private String maidenName;

    /**
     * Date de naissance, stockee chiffree en String (ISO {@code yyyy-MM-dd}) pour rester coherent
     * avec le chiffrement AES sur String des autres champs identite (pas de colonne DATE en clair).
     */
    @Convert(converter = EncryptedFieldConverter.class)
    @Column(name = "birth_date", length = 500)
    private String birthDate;

    @Convert(converter = EncryptedFieldConverter.class)
    @Column(name = "birth_place", length = 500)
    private String birthPlace;

    @Convert(converter = EncryptedFieldConverter.class)
    @Column(length = 500)
    private String nationality;

    @Convert(converter = EncryptedFieldConverter.class)
    @Column(name = "residence_address", length = 500)
    private String residenceAddress;

    @Convert(converter = EncryptedFieldConverter.class)
    @Column(name = "residence_country", length = 500)
    private String residenceCountry;

    @Convert(converter = EncryptedFieldConverter.class)
    @Column(name = "id_document_type", length = 500)
    private String idDocumentType;

    @Convert(converter = EncryptedFieldConverter.class)
    @Column(name = "id_document_number", length = 500)
    private String idDocumentNumber;

    /** Juridiction de la fiche (FR / MA / SA…). Non chiffre : sert au routage / aux regles, pas une PII. */
    @Column(name = "country_code", length = 2)
    private String countryCode;

    // --- Soumission au teleservice (NON implementee dans cette phase) ---

    /** true une fois transmise au provider de declaration (Chekin / DGSN / Absher). */
    @Column(name = "submitted_to_provider", nullable = false)
    private boolean submittedToProvider = false;

    /** Provider de declaration cible (ex : CHEKIN, DGSN, ABSHER). Null tant que non transmise. */
    @Column(name = "provider_type", length = 30)
    private String providerType;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    // Getters / setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public Reservation getReservation() { return reservation; }
    public void setReservation(Reservation reservation) { this.reservation = reservation; }
    public Guest getGuest() { return guest; }
    public void setGuest(Guest guest) { this.guest = guest; }
    public boolean isPrimary() { return primary; }
    public void setPrimary(boolean primary) { this.primary = primary; }
    public DeclarationStatus getStatus() { return status; }
    public void setStatus(DeclarationStatus status) { this.status = status; }
    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }
    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }
    public String getMaidenName() { return maidenName; }
    public void setMaidenName(String maidenName) { this.maidenName = maidenName; }
    public String getBirthDate() { return birthDate; }
    public void setBirthDate(String birthDate) { this.birthDate = birthDate; }
    public String getBirthPlace() { return birthPlace; }
    public void setBirthPlace(String birthPlace) { this.birthPlace = birthPlace; }
    public String getNationality() { return nationality; }
    public void setNationality(String nationality) { this.nationality = nationality; }
    public String getResidenceAddress() { return residenceAddress; }
    public void setResidenceAddress(String residenceAddress) { this.residenceAddress = residenceAddress; }
    public String getResidenceCountry() { return residenceCountry; }
    public void setResidenceCountry(String residenceCountry) { this.residenceCountry = residenceCountry; }
    public String getIdDocumentType() { return idDocumentType; }
    public void setIdDocumentType(String idDocumentType) { this.idDocumentType = idDocumentType; }
    public String getIdDocumentNumber() { return idDocumentNumber; }
    public void setIdDocumentNumber(String idDocumentNumber) { this.idDocumentNumber = idDocumentNumber; }
    public String getCountryCode() { return countryCode; }
    public void setCountryCode(String countryCode) { this.countryCode = countryCode; }
    public boolean isSubmittedToProvider() { return submittedToProvider; }
    public void setSubmittedToProvider(boolean submittedToProvider) { this.submittedToProvider = submittedToProvider; }
    public String getProviderType() { return providerType; }
    public void setProviderType(String providerType) { this.providerType = providerType; }
    public LocalDateTime getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(LocalDateTime submittedAt) { this.submittedAt = submittedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
