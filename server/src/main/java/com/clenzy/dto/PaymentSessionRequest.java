package com.clenzy.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

public class PaymentSessionRequest {
    
    @NotNull(message = "L'ID de l'intervention est requis")
    private Long interventionId;
    
    @NotNull(message = "Le montant est requis")
    @Positive(message = "Le montant doit être positif")
    private BigDecimal amount;
    
    public Long getInterventionId() {
        return interventionId;
    }
    
    public void setInterventionId(Long interventionId) {
        this.interventionId = interventionId;
    }
    
    public BigDecimal getAmount() {
        return amount;
    }
    
    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }
}
