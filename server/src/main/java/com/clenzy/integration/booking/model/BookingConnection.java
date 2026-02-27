package com.clenzy.integration.booking.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Entite JPA representant une connexion entre une organisation Clenzy
 * et un etablissement Booking.com.
 *
 * Stocke les credentials API (username/password chiffre) et le statut
 * de la connexion pour le polling periodique et les webhooks.
 */
@Entity
@Table(name = "booking_connections", indexes = {
    @Index(name = "idx_booking_conn_org_id", columnList = "organization_id"),
    @Index(name = "idx_booking_conn_hotel_id", columnList = "hotel_id")
})
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class BookingConnection {

    public enum BookingConnectionStatus {
        ACTIVE,
        INACTIVE,
        ERROR,
        SUSPENDED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "hotel_id", nullable = false)
    private String hotelId;

    @Column(name = "username")
    private String username;

    @Column(name = "password_encrypted", columnDefinition = "TEXT")
    private String passwordEncrypted;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private BookingConnectionStatus status = BookingConnectionStatus.ACTIVE;

    @Column(name = "connected_at")
    private LocalDateTime connectedAt;

    @Column(name = "last_sync_at")
    private LocalDateTime lastSyncAt;

    @Column(name = "error_message")
    private String errorMessage;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    // Constructeurs
    public BookingConnection() {
    }

    public BookingConnection(Long organizationId, String hotelId) {
        this.organizationId = organizationId;
        this.hotelId = hotelId;
    }

    // Getters et Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getOrganizationId() {
        return organizationId;
    }

    public void setOrganizationId(Long organizationId) {
        this.organizationId = organizationId;
    }

    public String getHotelId() {
        return hotelId;
    }

    public void setHotelId(String hotelId) {
        this.hotelId = hotelId;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPasswordEncrypted() {
        return passwordEncrypted;
    }

    public void setPasswordEncrypted(String passwordEncrypted) {
        this.passwordEncrypted = passwordEncrypted;
    }

    public BookingConnectionStatus getStatus() {
        return status;
    }

    public void setStatus(BookingConnectionStatus status) {
        this.status = status;
    }

    public LocalDateTime getConnectedAt() {
        return connectedAt;
    }

    public void setConnectedAt(LocalDateTime connectedAt) {
        this.connectedAt = connectedAt;
    }

    public LocalDateTime getLastSyncAt() {
        return lastSyncAt;
    }

    public void setLastSyncAt(LocalDateTime lastSyncAt) {
        this.lastSyncAt = lastSyncAt;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    // Methodes utilitaires
    public boolean isActive() {
        return BookingConnectionStatus.ACTIVE.equals(this.status);
    }

    @Override
    public String toString() {
        return "BookingConnection{" +
                "id=" + id +
                ", organizationId=" + organizationId +
                ", hotelId='" + hotelId + '\'' +
                ", status=" + status +
                ", connectedAt=" + connectedAt +
                '}';
    }
}
