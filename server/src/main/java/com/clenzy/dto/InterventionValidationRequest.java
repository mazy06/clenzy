package com.clenzy.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

public class InterventionValidationRequest {
    
    @NotNull(message = "Le montant estimé est requis")
    @Positive(message = "Le montant doit être positif")
    private BigDecimal estimatedCost;
    
    public BigDecimal getEstimatedCost() {
        return estimatedCost;
    }
    
    public void setEstimatedCost(BigDecimal estimatedCost) {
        this.estimatedCost = estimatedCost;
    }
}
