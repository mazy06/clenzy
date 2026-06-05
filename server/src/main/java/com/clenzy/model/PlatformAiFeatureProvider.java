package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Association feature IA → provider connecte (BYOK OpenAI/Anthropic).
 *
 * Alternative a {@link PlatformAiFeatureModel} : au lieu d'un modele plateforme
 * configure par le SUPER_ADMIN, la feature utilise directement un provider connecte
 * via une cle organisation (BYOK) ou la cle partagee plateforme. La resolution
 * (cf. AiKeyResolver) prefere alors ce provider.
 *
 * Mutuellement exclusif avec {@link PlatformAiFeatureModel} pour une meme feature :
 * l'exclusivite est garantie applicativement par PlatformAiConfigService (assigner
 * l'un supprime l'autre). La contrainte UNIQUE sur feature garantit une seule
 * association provider par feature.
 */
@Entity
@Table(name = "platform_ai_feature_provider")
public class PlatformAiFeatureProvider {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 30)
    private String feature;

    /** Provider connecte : "openai" ou "anthropic". */
    @Column(nullable = false, length = 30)
    private String provider;

    @Column(name = "updated_at", nullable = false)
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    // ─── Constructors ────────────────────────────────────────────────────

    public PlatformAiFeatureProvider() {}

    public PlatformAiFeatureProvider(String feature, String provider) {
        this.feature = feature;
        this.provider = provider;
    }

    // ─── Getters / Setters ───────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getFeature() { return feature; }
    public void setFeature(String feature) { this.feature = feature; }

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
