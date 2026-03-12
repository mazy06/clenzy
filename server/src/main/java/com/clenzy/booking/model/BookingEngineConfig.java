package com.clenzy.booking.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Configuration du Booking Engine par organisation.
 * Chaque organisation peut activer un moteur de reservation public
 * accessible via une API Key dediee.
 */
@Entity
@Table(name = "booking_engine_configs",
    indexes = {
        @Index(name = "idx_bec_api_key", columnList = "api_key", unique = true),
        @Index(name = "idx_bec_org_id", columnList = "organization_id")
    },
    uniqueConstraints = {
        @UniqueConstraint(name = "uq_bec_org_name", columnNames = {"organization_id", "name"})
    }
)
public class BookingEngineConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "name", nullable = false, length = 100)
    private String name = "Default";

    @Column(nullable = false)
    private boolean enabled = false;

    @Column(name = "api_key", nullable = false, unique = true, length = 64)
    private String apiKey;

    // ─── Theming ────────────────────────────────────────────────────────

    @Column(name = "primary_color", length = 7)
    private String primaryColor = "#2563eb";

    @Column(name = "accent_color", length = 7)
    private String accentColor;

    @Column(name = "logo_url", length = 500)
    private String logoUrl;

    @Column(name = "font_family", length = 100)
    private String fontFamily;

    // ─── Comportement ───────────────────────────────────────────────────

    @Column(name = "default_language", length = 5)
    private String defaultLanguage = "fr";

    @Column(name = "default_currency", length = 3)
    private String defaultCurrency = "EUR";

    @Column(name = "min_advance_days")
    private Integer minAdvanceDays = 1;

    @Column(name = "max_advance_days")
    private Integer maxAdvanceDays = 365;

    // ─── Politiques ─────────────────────────────────────────────────────

    @Column(name = "cancellation_policy", columnDefinition = "TEXT")
    private String cancellationPolicy;

    @Column(name = "terms_url", length = 500)
    private String termsUrl;

    @Column(name = "privacy_url", length = 500)
    private String privacyUrl;

    // ─── Securite ───────────────────────────────────────────────────────

    @Column(name = "allowed_origins", columnDefinition = "TEXT")
    private String allowedOrigins;

    // ─── Options ────────────────────────────────────────────────────────

    @Column(name = "collect_payment_on_booking")
    private boolean collectPaymentOnBooking = true;

    @Column(name = "auto_confirm")
    private boolean autoConfirm = true;

    @Column(name = "show_cleaning_fee")
    private boolean showCleaningFee = true;

    @Column(name = "show_tourist_tax")
    private boolean showTouristTax = true;

    // ─── Custom CSS/JS ──────────────────────────────────────────────────

    @Column(name = "custom_css", columnDefinition = "TEXT")
    private String customCss;

    @Column(name = "custom_js", columnDefinition = "TEXT")
    private String customJs;

    @Column(name = "component_config", columnDefinition = "TEXT")
    private String componentConfig;

    // ─── AI Design Analysis ───────────────────────────────────────────

    @Column(name = "design_tokens", columnDefinition = "TEXT")
    private String designTokens;

    @Column(name = "source_website_url", length = 500)
    private String sourceWebsiteUrl;

    @Column(name = "ai_analysis_hash", length = 64)
    private String aiAnalysisHash;

    @Column(name = "ai_analysis_at")
    private LocalDateTime aiAnalysisAt;

    // ─── Timestamps ─────────────────────────────────────────────────────

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // ─── Getters / Setters ──────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }

    public String getPrimaryColor() { return primaryColor; }
    public void setPrimaryColor(String primaryColor) { this.primaryColor = primaryColor; }

    public String getAccentColor() { return accentColor; }
    public void setAccentColor(String accentColor) { this.accentColor = accentColor; }

    public String getLogoUrl() { return logoUrl; }
    public void setLogoUrl(String logoUrl) { this.logoUrl = logoUrl; }

    public String getFontFamily() { return fontFamily; }
    public void setFontFamily(String fontFamily) { this.fontFamily = fontFamily; }

    public String getDefaultLanguage() { return defaultLanguage; }
    public void setDefaultLanguage(String defaultLanguage) { this.defaultLanguage = defaultLanguage; }

    public String getDefaultCurrency() { return defaultCurrency; }
    public void setDefaultCurrency(String defaultCurrency) { this.defaultCurrency = defaultCurrency; }

    public Integer getMinAdvanceDays() { return minAdvanceDays; }
    public void setMinAdvanceDays(Integer minAdvanceDays) { this.minAdvanceDays = minAdvanceDays; }

    public Integer getMaxAdvanceDays() { return maxAdvanceDays; }
    public void setMaxAdvanceDays(Integer maxAdvanceDays) { this.maxAdvanceDays = maxAdvanceDays; }

    public String getCancellationPolicy() { return cancellationPolicy; }
    public void setCancellationPolicy(String cancellationPolicy) { this.cancellationPolicy = cancellationPolicy; }

    public String getTermsUrl() { return termsUrl; }
    public void setTermsUrl(String termsUrl) { this.termsUrl = termsUrl; }

    public String getPrivacyUrl() { return privacyUrl; }
    public void setPrivacyUrl(String privacyUrl) { this.privacyUrl = privacyUrl; }

    public String getAllowedOrigins() { return allowedOrigins; }
    public void setAllowedOrigins(String allowedOrigins) { this.allowedOrigins = allowedOrigins; }

    public boolean isCollectPaymentOnBooking() { return collectPaymentOnBooking; }
    public void setCollectPaymentOnBooking(boolean collectPaymentOnBooking) { this.collectPaymentOnBooking = collectPaymentOnBooking; }

    public boolean isAutoConfirm() { return autoConfirm; }
    public void setAutoConfirm(boolean autoConfirm) { this.autoConfirm = autoConfirm; }

    public boolean isShowCleaningFee() { return showCleaningFee; }
    public void setShowCleaningFee(boolean showCleaningFee) { this.showCleaningFee = showCleaningFee; }

    public boolean isShowTouristTax() { return showTouristTax; }
    public void setShowTouristTax(boolean showTouristTax) { this.showTouristTax = showTouristTax; }

    public String getCustomCss() { return customCss; }
    public void setCustomCss(String customCss) { this.customCss = customCss; }

    public String getCustomJs() { return customJs; }
    public void setCustomJs(String customJs) { this.customJs = customJs; }

    public String getComponentConfig() { return componentConfig; }
    public void setComponentConfig(String componentConfig) { this.componentConfig = componentConfig; }

    public String getDesignTokens() { return designTokens; }
    public void setDesignTokens(String designTokens) { this.designTokens = designTokens; }

    public String getSourceWebsiteUrl() { return sourceWebsiteUrl; }
    public void setSourceWebsiteUrl(String sourceWebsiteUrl) { this.sourceWebsiteUrl = sourceWebsiteUrl; }

    public String getAiAnalysisHash() { return aiAnalysisHash; }
    public void setAiAnalysisHash(String aiAnalysisHash) { this.aiAnalysisHash = aiAnalysisHash; }

    public LocalDateTime getAiAnalysisAt() { return aiAnalysisAt; }
    public void setAiAnalysisAt(LocalDateTime aiAnalysisAt) { this.aiAnalysisAt = aiAnalysisAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
