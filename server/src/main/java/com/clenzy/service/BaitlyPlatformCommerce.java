package com.clenzy.service;

import com.clenzy.payment.StripeGateway;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.util.Map;

/** Configuration explicite des ventes propres de Baitly ; aucun taux ni vendeur inventé. */
@Service
public class BaitlyPlatformCommerce {
    private final StripeGateway stripe;
    private final String creditTaxCode;
    private final String hardwareTaxCode;
    public BaitlyPlatformCommerce(StripeGateway stripe,@Value("${baitly.commerce.ai-credit-tax-code:}") String creditTaxCode,
            @Value("${baitly.commerce.hardware-tax-code:}") String hardwareTaxCode){this.stripe=stripe;this.creditTaxCode=creditTaxCode;this.hardwareTaxCode=hardwareTaxCode;}
    private String taxCode(String source) {
        return switch(source){case "AI_CREDIT_TOPUP"->creditTaxCode;case "HARDWARE_ORDER"->hardwareTaxCode;default->throw new IllegalArgumentException("Cette vente n'est pas une vente propre de Baitly");};
    }
    public boolean taxCodeConfigured(String source) {
        String code = taxCode(source);
        return code != null && code.matches("txcd_[0-9]{8}");
    }
    public Map<String,String> invoiceMetadata(String source,String seller,String account) {
        String taxCode = taxCode(source);
        if(!taxCodeConfigured(source))throw new IllegalStateException("Renseignez la catégorie fiscale du produit avant sa mise en vente");
        try {stripe.verifySubscriptionSeller(seller,account);stripe.requireSubscriptionTaxReady();}
        catch(com.stripe.exception.StripeException e){throw new IllegalStateException("La configuration fiscale de la société vendeuse est indisponible",e);}
        // Les prix fixes du catalogue ponctuel restent TTC. Le PMS est HT et utilise son propre Checkout.
        return Map.of("baitly_commerce_invoice","true","baitly_tax_code",taxCode,"seller_country",seller,"seller_account",account);
    }
}
