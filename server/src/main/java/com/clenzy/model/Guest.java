package com.clenzy.model;

import com.clenzy.config.EncryptedFieldConverter;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Entite representant un voyageur (guest).
 *
 * Les champs PII (email, phone, firstName, lastName) sont chiffres
 * en AES-256 via EncryptedFieldConverter (conformite RGPD Art. 32).
 *
 * La deduplication se fait au niveau applicatif :
 * - Par (channel, channelGuestId, organizationId) en SQL
 * - Par email en memoire (car chiffre en base)
 *
 * Chaque guest est scope a une organization (multi-tenant).
 */
@Entity
@Table(name = "guests")
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class Guest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Convert(converter = EncryptedFieldConverter.class)
    @Column(length = 500)
    private String email;

    @Convert(converter = EncryptedFieldConverter.class)
    @Column(length = 500)
    private String phone;

    @Convert(converter = EncryptedFieldConverter.class)
    @Column(name = "first_name", length = 500, nullable = false)
    private String firstName;

    @Convert(converter = EncryptedFieldConverter.class)
    @Column(name = "last_name", length = 500, nullable = false)
    private String lastName;

    @Column(length = 5)
    private String language = "fr";

    @Column(name = "country_code", length = 2)
    private String countryCode;

    @Column(name = "channel_guest_id", length = 100)
    private String channelGuestId;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private GuestChannel channel;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "total_stays")
    private Integer totalStays = 0;

    @Column(name = "total_spent", precision = 10, scale = 2)
    private BigDecimal totalSpent = BigDecimal.ZERO;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    // Constructeurs

    public Guest() {}

    public Guest(String firstName, String lastName, Long organizationId) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.organizationId = organizationId;
    }

    // Getters et Setters

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public String getCountryCode() { return countryCode; }
    public void setCountryCode(String countryCode) { this.countryCode = countryCode; }

    public String getChannelGuestId() { return channelGuestId; }
    public void setChannelGuestId(String channelGuestId) { this.channelGuestId = channelGuestId; }

    public GuestChannel getChannel() { return channel; }
    public void setChannel(GuestChannel channel) { this.channel = channel; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public Integer getTotalStays() { return totalStays; }
    public void setTotalStays(Integer totalStays) { this.totalStays = totalStays; }

    public BigDecimal getTotalSpent() { return totalSpent; }
    public void setTotalSpent(BigDecimal totalSpent) { this.totalSpent = totalSpent; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    /**
     * Retourne le nom complet du voyageur.
     */
    public String getFullName() {
        return firstName + " " + lastName;
    }

    @Override
    public String toString() {
        return "Guest{id=" + id + ", firstName='" + firstName + "', lastName='" + lastName
                + "', channel=" + channel + "}";
    }
}
