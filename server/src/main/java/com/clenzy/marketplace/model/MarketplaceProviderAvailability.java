package com.clenzy.marketplace.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Horaires de candidature avant rattachement à un compte.
 * À l'activation, ils sont transférés une seule fois dans le calendrier individuel.
 * La base interdit toute nouvelle écriture ici pour une fiche liée à un compte.
 */
@Entity
@Table(name = "marketplace_provider_availability")
public class MarketplaceProviderAvailability {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "provider_id", nullable = false)
    private MarketplaceProvider provider;

    @Column(name = "day_of_week", nullable = false)
    private Short dayOfWeek;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public MarketplaceProvider getProvider() { return provider; }
    public void setProvider(MarketplaceProvider provider) { this.provider = provider; }

    public Short getDayOfWeek() { return dayOfWeek; }
    public void setDayOfWeek(Short dayOfWeek) { this.dayOfWeek = dayOfWeek; }

    public LocalTime getStartTime() { return startTime; }
    public void setStartTime(LocalTime startTime) { this.startTime = startTime; }

    public LocalTime getEndTime() { return endTime; }
    public void setEndTime(LocalTime endTime) { this.endTime = endTime; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
