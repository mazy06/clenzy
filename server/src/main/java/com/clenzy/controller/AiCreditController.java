package com.clenzy.controller;

import com.clenzy.service.ai.AiCreditGrantService;
import com.clenzy.service.ai.AiCreditPurchaseService;
import com.clenzy.tenant.TenantContext;
import com.stripe.exception.StripeException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Credits IA : solde detaille, packs et rechargement (campagne T-07).
 *
 * <p>Controller mince (regle n°4) : delegation pure aux services. Les montants
 * des packs sont serveur ({@link AiCreditPurchaseService}) ; le credit effectif
 * n'arrive qu'au webhook Stripe apres paiement confirme.</p>
 */
@RestController
@RequestMapping("/api/ai/credits")
@PreAuthorize("isAuthenticated()")
public class AiCreditController {

    /** Corps du POST /topup — seul le pack est choisi par le client, jamais un montant. */
    public record TopUpRequest(String pack) {}

    private final AiCreditGrantService grantService;
    private final AiCreditPurchaseService purchaseService;
    private final TenantContext tenantContext;

    public AiCreditController(AiCreditGrantService grantService,
                              AiCreditPurchaseService purchaseService,
                              TenantContext tenantContext) {
        this.grantService = grantService;
        this.purchaseService = purchaseService;
        this.tenantContext = tenantContext;
    }

    /** Solde detaille de l'organisation courante (total + poches avec expiration). */
    @GetMapping("/balance")
    public Map<String, Object> balance() {
        return grantService.getBalance(tenantContext.getRequiredOrganizationId());
    }

    /** Packs de recharge disponibles (prix serveur). */
    @GetMapping("/packs")
    public List<AiCreditPurchaseService.CreditPack> packs() {
        return purchaseService.listPacks();
    }

    /** 50 dernieres lignes du ledger de l'organisation (historique credits). */
    @GetMapping("/ledger")
    public List<Map<String, Object>> ledger() {
        return grantService.getRecentLedger(tenantContext.getRequiredOrganizationId());
    }

    /** Cree une session Stripe Checkout pour un pack. Retourne {checkoutUrl}. */
    @PostMapping("/topup")
    public Map<String, String> topUp(@RequestBody TopUpRequest request,
                                     @AuthenticationPrincipal Jwt jwt) throws StripeException {
        return purchaseService.createTopUpCheckout(jwt.getSubject(), request.pack());
    }
}
