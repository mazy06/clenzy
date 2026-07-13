package com.clenzy.controller;

import com.clenzy.service.ai.AiCreditGrantService;
import com.clenzy.service.ai.AiCreditPurchaseService;
import com.clenzy.tenant.TenantContext;
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
    private final com.clenzy.service.ai.CreditReconciliationService reconciliationService;
    private final TenantContext tenantContext;

    public AiCreditController(AiCreditGrantService grantService,
                              AiCreditPurchaseService purchaseService,
                              com.clenzy.service.ai.CreditReconciliationService reconciliationService,
                              TenantContext tenantContext) {
        this.grantService = grantService;
        this.purchaseService = purchaseService;
        this.reconciliationService = reconciliationService;
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

    /**
     * Rapport de reconciliation mensuel (X10) — plateforme uniquement : marge
     * par provider (a rapprocher des factures Anthropic/OpenAI), revenu par
     * source de poche, cross-check interne ledger ↔ ai_token_usage.
     */
    @GetMapping("/reconciliation")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public Map<String, Object> reconciliation(
            @org.springframework.web.bind.annotation.RequestParam(name = "month", required = false) String month) {
        java.time.YearMonth target = month != null
                ? java.time.YearMonth.parse(month)
                : java.time.YearMonth.now(java.time.ZoneOffset.UTC).minusMonths(1);
        return reconciliationService.monthlyReport(target);
    }

    /**
     * Dotation initiale d'amorçage de TOUTES les orgs existantes (plateforme
     * uniquement) — à lancer AVANT d'activer l'enforcement des crédits pour
     * qu'aucune org ne soit coupée au flip. Idempotent : une org déjà dotée
     * (poche active) est ignorée. {@code millicredits} configurable
     * (défaut 500 000 mc = allotment Essentiel), TTL 32 j (relais Stripe).
     *
     * @return {@code {granted, skipped, millicredits}}
     */
    @PostMapping("/admin/grant-initial")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Map<String, Object> grantInitialAll(
            @org.springframework.web.bind.annotation.RequestParam(name = "millicredits", defaultValue = "500000")
            long millicredits) {
        return grantService.grantInitialToAllOrgs(millicredits);
    }

    /** Cree une session de paiement (orchestrée) pour un pack. Retourne {checkoutUrl}. */
    @PostMapping("/topup")
    public Map<String, String> topUp(@RequestBody TopUpRequest request,
                                     @AuthenticationPrincipal Jwt jwt) {
        return purchaseService.createTopUpCheckout(jwt.getSubject(), request.pack());
    }
}
