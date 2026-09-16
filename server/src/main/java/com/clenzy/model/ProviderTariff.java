package com.clenzy.model;

import com.clenzy.marketplace.model.PricingModel;
import jakarta.persistence.*;
import java.math.BigDecimal;

/** Tarif public unique d'une personne pour une prestation, indépendant de ses clients. */
@Entity
@Table(name = "provider_tariffs", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "service_key"}))
public class ProviderTariff {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "user_id", nullable = false) private Long userId;
    @Column(name = "service_key", nullable = false, length = 200) private String serviceKey;
    @Enumerated(EnumType.STRING) @Column(name = "pricing_model", nullable = false, length = 20)
    private PricingModel pricingModel = PricingModel.ON_QUOTE;
    @Column(precision = 10, scale = 2) private BigDecimal amount;
    @Column(nullable = false, length = 3) private String currency = "EUR";
    @Column(name = "unit_label", length = 40) private String unitLabel;
    public String getUnitLabel() { return unitLabel; }
    public void setUnitLabel(String value) { unitLabel = value; }
    @Column(name = "needs_review", nullable = false) private boolean needsReview;
    @Column(nullable = false) private boolean enabled = true;
    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long value) { userId = value; }
    public String getServiceKey() { return serviceKey; }
    public void setServiceKey(String value) { serviceKey = value; }
    public PricingModel getPricingModel() { return pricingModel; }
    public void setPricingModel(PricingModel value) { pricingModel = value; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal value) { amount = value; }
    public String getCurrency() { return currency; }
    public void setCurrency(String value) { currency = value; }
    public boolean isNeedsReview() { return needsReview; }
    public void setNeedsReview(boolean value) { needsReview = value; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean value) { enabled = value; }
}
