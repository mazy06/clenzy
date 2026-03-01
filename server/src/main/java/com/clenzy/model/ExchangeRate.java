package com.clenzy.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Taux de change journalier entre deux devises.
 * Utilise pour la conversion multi-devises lors du reporting consolide.
 * Sources : ECB (EUR), BAM (MAD), SAMA (SAR).
 */
@Entity
@Table(name = "exchange_rates", indexes = {
    @Index(name = "idx_fx_lookup", columnList = "base_currency, target_currency, rate_date")
})
public class ExchangeRate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Size(max = 3)
    @Column(name = "base_currency", nullable = false, length = 3)
    private String baseCurrency;

    @NotBlank
    @Size(max = 3)
    @Column(name = "target_currency", nullable = false, length = 3)
    private String targetCurrency;

    @NotNull
    @Column(name = "rate", nullable = false, precision = 12, scale = 6)
    private BigDecimal rate;

    @NotNull
    @Column(name = "rate_date", nullable = false)
    private LocalDate rateDate;

    @Size(max = 30)
    @Column(name = "source", length = 30)
    private String source = "ECB";

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    // --- Constructeurs ---

    public ExchangeRate() {}

    public ExchangeRate(String baseCurrency, String targetCurrency, BigDecimal rate, LocalDate rateDate) {
        this.baseCurrency = baseCurrency;
        this.targetCurrency = targetCurrency;
        this.rate = rate;
        this.rateDate = rateDate;
    }

    // --- Getters / Setters ---

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getBaseCurrency() { return baseCurrency; }
    public void setBaseCurrency(String baseCurrency) { this.baseCurrency = baseCurrency; }

    public String getTargetCurrency() { return targetCurrency; }
    public void setTargetCurrency(String targetCurrency) { this.targetCurrency = targetCurrency; }

    public BigDecimal getRate() { return rate; }
    public void setRate(BigDecimal rate) { this.rate = rate; }

    public LocalDate getRateDate() { return rateDate; }
    public void setRateDate(LocalDate rateDate) { this.rateDate = rateDate; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    @Override
    public String toString() {
        return "ExchangeRate{" +
                baseCurrency + "/" + targetCurrency +
                "=" + rate +
                " (" + rateDate + ")" +
                '}';
    }
}
