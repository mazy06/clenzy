package com.clenzy.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * Inscription à la liste d'attente (waitlist) du lancement Baitly.
 * Non scopé par organisation (capture publique depuis la landing).
 */
@Entity
@Table(name = "waitlist_signups")
public class WaitlistSignup {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String email;

    @Column(name = "full_name")
    private String fullName;

    private String phone;

    @Column(name = "property_count")
    private String propertyCount;

    private String city;

    /** Provenance (ex: "landing", "campaign-x"). */
    private String source;

    @Column(name = "ip_address")
    private String ipAddress;

    @Column(name = "brevo_synced", nullable = false)
    private boolean brevoSynced = false;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getPropertyCount() { return propertyCount; }
    public void setPropertyCount(String propertyCount) { this.propertyCount = propertyCount; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }

    public boolean isBrevoSynced() { return brevoSynced; }
    public void setBrevoSynced(boolean brevoSynced) { this.brevoSynced = brevoSynced; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
