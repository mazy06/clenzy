package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Association feature IA → modele plateforme actif.
 *
 * Chaque feature (DESIGN, PRICING, etc.) peut etre assignee a un seul modele
 * via cette table de mapping. La contrainte UNIQUE sur feature garantit
 * qu'une seule association existe par feature.
 */
@Entity
@Table(name = "platform_ai_feature_model")
public class PlatformAiFeatureModel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 30)
    private String feature;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "model_id", nullable = false)
    private PlatformAiModel model;

    @Column(name = "updated_at", nullable = false)
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    // ─── Constructors ────────────────────────────────────────────────────

    public PlatformAiFeatureModel() {}

    public PlatformAiFeatureModel(String feature, PlatformAiModel model) {
        this.feature = feature;
        this.model = model;
    }

    // ─── Getters / Setters ───────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getFeature() { return feature; }
    public void setFeature(String feature) { this.feature = feature; }

    public PlatformAiModel getModel() { return model; }
    public void setModel(PlatformAiModel model) { this.model = model; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
