package com.clenzy.integration.direct.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Configuration du widget de reservation directe par propriete.
 * Permet au proprietaire de personnaliser l'apparence et le comportement
 * du widget embarque sur son site web.
 */
@Entity
@Table(name = "direct_booking_configs",
       uniqueConstraints = @UniqueConstraint(columnNames = {"organization_id", "property_id"}))
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class DirectBookingConfiguration {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(name = "widget_theme_color", length = 7)
    private String widgetThemeColor;

    @Column(name = "widget_logo")
    private String widgetLogo;

    @Column(name = "custom_css", columnDefinition = "TEXT")
    private String customCss;

    @Column(name = "terms_and_conditions_url")
    private String termsAndConditionsUrl;

    @Column(name = "cancellation_policy_text", columnDefinition = "TEXT")
    private String cancellationPolicyText;

    @Column(name = "confirmation_email_template", columnDefinition = "TEXT")
    private String confirmationEmailTemplate;

    @Column(name = "auto_confirm", nullable = false)
    private boolean autoConfirm = false;

    @Column(name = "require_payment", nullable = false)
    private boolean requirePayment = true;

    @Column(name = "allowed_currencies", length = 100)
    private String allowedCurrencies;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    @UpdateTimestamp
    private LocalDateTime updatedAt;

    // Constructeurs

    public DirectBookingConfiguration() {}

    public DirectBookingConfiguration(Long organizationId, Long propertyId) {
        this.organizationId = organizationId;
        this.propertyId = propertyId;
    }

    // Getters et Setters

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public String getWidgetThemeColor() { return widgetThemeColor; }
    public void setWidgetThemeColor(String widgetThemeColor) { this.widgetThemeColor = widgetThemeColor; }

    public String getWidgetLogo() { return widgetLogo; }
    public void setWidgetLogo(String widgetLogo) { this.widgetLogo = widgetLogo; }

    public String getCustomCss() { return customCss; }
    public void setCustomCss(String customCss) { this.customCss = customCss; }

    public String getTermsAndConditionsUrl() { return termsAndConditionsUrl; }
    public void setTermsAndConditionsUrl(String termsAndConditionsUrl) { this.termsAndConditionsUrl = termsAndConditionsUrl; }

    public String getCancellationPolicyText() { return cancellationPolicyText; }
    public void setCancellationPolicyText(String cancellationPolicyText) { this.cancellationPolicyText = cancellationPolicyText; }

    public String getConfirmationEmailTemplate() { return confirmationEmailTemplate; }
    public void setConfirmationEmailTemplate(String confirmationEmailTemplate) { this.confirmationEmailTemplate = confirmationEmailTemplate; }

    public boolean isAutoConfirm() { return autoConfirm; }
    public void setAutoConfirm(boolean autoConfirm) { this.autoConfirm = autoConfirm; }

    public boolean isRequirePayment() { return requirePayment; }
    public void setRequirePayment(boolean requirePayment) { this.requirePayment = requirePayment; }

    public String getAllowedCurrencies() { return allowedCurrencies; }
    public void setAllowedCurrencies(String allowedCurrencies) { this.allowedCurrencies = allowedCurrencies; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    @Override
    public String toString() {
        return "DirectBookingConfiguration{id=" + id
                + ", orgId=" + organizationId
                + ", propertyId=" + propertyId
                + ", enabled=" + enabled + "}";
    }
}
