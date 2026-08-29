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

    /**
     * Objet du paiement. {@code DEPOSIT} = l'acompte du devis approuve,
     * {@code FULL} (defaut) = la prestation entiere. Ce n'est PAS le montant
     * qui vient du client : le serveur le recalcule selon cet objet.
     */
    private String purpose;

    /**
     * Ou revenir apres Stripe — l'ecran d'ou part le paiement.
     *
     * <p>Sans elle, un abandon renvoyait vers la page de facturation par
     * defaut : on quittait une discussion pour atterrir ailleurs, sans lien
     * avec ce qu'on venait de faire. L'origine est validee contre l'allow-list
     * du provider ({@code StripePaymentProvider.sanitizeReturnUrl}), un lien
     * exterieur ne peut donc pas s'y glisser.</p>
     */
    private String returnUrl;
    
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

    public String getPurpose() { return purpose; }
    public void setPurpose(String purpose) { this.purpose = purpose; }

    public String getReturnUrl() { return returnUrl; }
    public void setReturnUrl(String returnUrl) { this.returnUrl = returnUrl; }
}
