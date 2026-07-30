package com.clenzy.model;

import com.clenzy.config.EncryptedFieldConverter;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "online_checkins")
@org.hibernate.annotations.Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class OnlineCheckIn {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reservation_id", nullable = false)
    private Reservation reservation;

    @Column(nullable = false, unique = true)
    private UUID token = UUID.randomUUID();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OnlineCheckInStatus status = OnlineCheckInStatus.PENDING;

    @Convert(converter = EncryptedFieldConverter.class)
    @Column(name = "first_name", length = 500)
    private String firstName;

    @Convert(converter = EncryptedFieldConverter.class)
    @Column(name = "last_name", length = 500)
    private String lastName;

    @Convert(converter = EncryptedFieldConverter.class)
    @Column(length = 500)
    private String email;

    @Convert(converter = EncryptedFieldConverter.class)
    @Column(length = 500)
    private String phone;

    @Convert(converter = EncryptedFieldConverter.class)
    @Column(name = "id_document_number", length = 500)
    private String idDocumentNumber;

    @Column(name = "id_document_type", length = 50)
    private String idDocumentType;

    @Column(name = "id_document_file_path", length = 1000)
    private String idDocumentFilePath;

    // ── Identité, pour la fiche voyageur ────────────────────────────────────
    //
    // Collectés jusqu'ici dans un second formulaire, depuis le livret d'accueil :
    // un voyageur pouvait compléter intégralement son check-in sans que la fiche
    // existe.
    //
    // CHIFFRÉS comme les autres données personnelles de cette entité — date et
    // lieu de naissance, adresse de résidence sont parmi les plus sensibles
    // qu'on manipule. D'où la longueur 500 : c'est celle du chiffré, pas du
    // clair.

    @Convert(converter = EncryptedFieldConverter.class)
    @Column(name = "maiden_name", length = 500)
    private String maidenName;

    /** Date de naissance ISO {@code yyyy-MM-dd}. */
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

    @Column(name = "estimated_arrival_time", length = 10)
    private String estimatedArrivalTime;

    @Column(name = "special_requests", columnDefinition = "TEXT")
    private String specialRequests;

    @Column(name = "number_of_guests")
    private Integer numberOfGuests;

    @Column(name = "additional_guests", columnDefinition = "JSONB")
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    private String additionalGuests;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    // Getters and setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public Reservation getReservation() { return reservation; }
    public void setReservation(Reservation reservation) { this.reservation = reservation; }
    public UUID getToken() { return token; }
    public void setToken(UUID token) { this.token = token; }
    public OnlineCheckInStatus getStatus() { return status; }
    public void setStatus(OnlineCheckInStatus status) { this.status = status; }
    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }
    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getIdDocumentNumber() { return idDocumentNumber; }
    public void setIdDocumentNumber(String idDocumentNumber) { this.idDocumentNumber = idDocumentNumber; }
    public String getIdDocumentType() { return idDocumentType; }
    public void setIdDocumentType(String idDocumentType) { this.idDocumentType = idDocumentType; }
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

    public String getIdDocumentFilePath() { return idDocumentFilePath; }
    public void setIdDocumentFilePath(String idDocumentFilePath) { this.idDocumentFilePath = idDocumentFilePath; }
    public String getEstimatedArrivalTime() { return estimatedArrivalTime; }
    public void setEstimatedArrivalTime(String estimatedArrivalTime) { this.estimatedArrivalTime = estimatedArrivalTime; }
    public String getSpecialRequests() { return specialRequests; }
    public void setSpecialRequests(String specialRequests) { this.specialRequests = specialRequests; }
    public Integer getNumberOfGuests() { return numberOfGuests; }
    public void setNumberOfGuests(Integer numberOfGuests) { this.numberOfGuests = numberOfGuests; }
    public String getAdditionalGuests() { return additionalGuests; }
    public void setAdditionalGuests(String additionalGuests) { this.additionalGuests = additionalGuests; }
    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
