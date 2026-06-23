package com.clenzy.booking.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
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

    /** Caution / dépôt de garantie pré-autorisé sur la carte du voyageur (NULL/0 = pas de caution). */
    @Column(name = "security_deposit_amount", precision = 12, scale = 2)
    private BigDecimal securityDepositAmount;

    /** Acompte : % prélevé à la réservation (1–99 ; NULL/0/100 = paiement intégral). */
    @Column(name = "deposit_percent")
    private Integer depositPercent;

    /** Acompte : nombre de jours avant l'arrivée où le solde devient dû. */
    @Column(name = "balance_due_days")
    private Integer balanceDueDays;

    /** Book Direct & Save (2.8) : remise % appliquée aux réservations directes (1–100 ; NULL/0 = aucune). */
    @Column(name = "direct_booking_discount_percent")
    private Integer directBookingDiscountPercent;

    /** Tarif membre (2.8) : remise % pour un voyageur CONNECTÉ (le membre obtient max(directe, membre)). */
    @Column(name = "member_discount_percent")
    private Integer memberDiscountPercent;

    /**
     * Durée du hold avant annulation auto d'une réservation PENDING non payée (minutes). Au-delà,
     * le scheduler de nettoyage expire la session Stripe, annule la résa et libère le calendrier.
     * NULL = défaut système (30 min).
     */
    @Column(name = "pending_hold_minutes")
    private Integer pendingHoldMinutes;

    // ─── Custom CSS/JS ──────────────────────────────────────────────────

    @Column(name = "custom_css", columnDefinition = "TEXT")
    private String customCss;

    @Column(name = "custom_js", columnDefinition = "TEXT")
    private String customJs;

    @Column(name = "component_config", columnDefinition = "TEXT")
    private String componentConfig;

    // ─── Site builder (page composée par blocs, JSON) ───────────────────

    @Column(name = "page_layout", columnDefinition = "TEXT")
    private String pageLayout;

    /** Parcours de réservation custom (bibliothèque de funnels, JSON) éditée dans le Studio. */
    @Column(name = "funnel_presets", columnDefinition = "TEXT")
    private String funnelPresets;

    /** Widgets composites custom (bibliothèque, JSON) éditée dans le Studio. */
    @Column(name = "composite_widgets", columnDefinition = "TEXT")
    private String compositeWidgets;

    /** Propriétés affichées (curation) : IDs en CSV ; NULL/vide = toutes les propriétés visibles. */
    @Column(name = "featured_property_ids", columnDefinition = "TEXT")
    private String featuredPropertyIds;

    // ─── AI Design Analysis ───────────────────────────────────────────

    @Column(name = "design_tokens", columnDefinition = "TEXT")
    private String designTokens;

    @Column(name = "source_website_url", length = 500)
    private String sourceWebsiteUrl;

    @Column(name = "ai_analysis_hash", length = 64)
    private String aiAnalysisHash;

    @Column(name = "ai_analysis_at")
    private LocalDateTime aiAnalysisAt;

    // ─── Widget Integration Position ──────────────────────────────────

    @Column(name = "widget_position", length = 10)
    private String widgetPosition = "bottom";

    @Column(name = "inline_target_id", length = 50)
    private String inlineTargetId;

    @Column(name = "inline_placement", length = 10)
    private String inlinePlacement = "after";

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

    public BigDecimal getSecurityDepositAmount() { return securityDepositAmount; }
    public void setSecurityDepositAmount(BigDecimal securityDepositAmount) { this.securityDepositAmount = securityDepositAmount; }

    public Integer getDepositPercent() { return depositPercent; }
    public void setDepositPercent(Integer depositPercent) { this.depositPercent = depositPercent; }

    public Integer getBalanceDueDays() { return balanceDueDays; }
    public void setBalanceDueDays(Integer balanceDueDays) { this.balanceDueDays = balanceDueDays; }

    public Integer getDirectBookingDiscountPercent() { return directBookingDiscountPercent; }
    public void setDirectBookingDiscountPercent(Integer directBookingDiscountPercent) { this.directBookingDiscountPercent = directBookingDiscountPercent; }

    public Integer getMemberDiscountPercent() { return memberDiscountPercent; }
    public void setMemberDiscountPercent(Integer memberDiscountPercent) { this.memberDiscountPercent = memberDiscountPercent; }

    public Integer getPendingHoldMinutes() { return pendingHoldMinutes; }
    public void setPendingHoldMinutes(Integer pendingHoldMinutes) { this.pendingHoldMinutes = pendingHoldMinutes; }

    public String getCustomCss() { return customCss; }
    public void setCustomCss(String customCss) { this.customCss = customCss; }

    public String getCustomJs() { return customJs; }
    public void setCustomJs(String customJs) { this.customJs = customJs; }

    public String getComponentConfig() { return componentConfig; }
    public void setComponentConfig(String componentConfig) { this.componentConfig = componentConfig; }

    public String getPageLayout() { return pageLayout; }
    public void setPageLayout(String pageLayout) { this.pageLayout = pageLayout; }

    public String getFunnelPresets() { return funnelPresets; }
    public void setFunnelPresets(String funnelPresets) { this.funnelPresets = funnelPresets; }

    public String getCompositeWidgets() { return compositeWidgets; }
    public void setCompositeWidgets(String compositeWidgets) { this.compositeWidgets = compositeWidgets; }

    public String getFeaturedPropertyIds() { return featuredPropertyIds; }
    public void setFeaturedPropertyIds(String featuredPropertyIds) { this.featuredPropertyIds = featuredPropertyIds; }

    public String getDesignTokens() { return designTokens; }
    public void setDesignTokens(String designTokens) { this.designTokens = designTokens; }

    public String getSourceWebsiteUrl() { return sourceWebsiteUrl; }
    public void setSourceWebsiteUrl(String sourceWebsiteUrl) { this.sourceWebsiteUrl = sourceWebsiteUrl; }

    public String getAiAnalysisHash() { return aiAnalysisHash; }
    public void setAiAnalysisHash(String aiAnalysisHash) { this.aiAnalysisHash = aiAnalysisHash; }

    public LocalDateTime getAiAnalysisAt() { return aiAnalysisAt; }
    public void setAiAnalysisAt(LocalDateTime aiAnalysisAt) { this.aiAnalysisAt = aiAnalysisAt; }

    public String getWidgetPosition() { return widgetPosition; }
    public void setWidgetPosition(String widgetPosition) { this.widgetPosition = widgetPosition; }

    public String getInlineTargetId() { return inlineTargetId; }
    public void setInlineTargetId(String inlineTargetId) { this.inlineTargetId = inlineTargetId; }

    public String getInlinePlacement() { return inlinePlacement; }
    public void setInlinePlacement(String inlinePlacement) { this.inlinePlacement = inlinePlacement; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
