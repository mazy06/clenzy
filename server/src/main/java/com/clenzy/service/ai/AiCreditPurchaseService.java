package com.clenzy.service.ai;

import com.clenzy.dto.PaymentOrchestrationRequest;
import com.clenzy.dto.PaymentOrchestrationResult;
import com.clenzy.model.User;
import com.clenzy.service.PaymentOrchestrationService;
import com.clenzy.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Achat de packs de credits IA via Stripe Checkout (campagne T-07, ADR-005 —
 * Stripe = tiroir-caisse pur, D-004 : pas de Meters, le solde vit chez nous).
 *
 * <p><b>Regle absolue n°1</b> : les montants sont definis SERVEUR (table des
 * packs) — jamais un montant venant du client. Le credit effectif n'arrive
 * qu'au webhook {@code checkout.session.completed} (paiement confirme), via
 * {@link AiCreditGrantService#grantTopUp} idempotent.</p>
 */
@Service
public class AiCreditPurchaseService {

    /** {@code sourceType} de la {@code PaymentTransaction} d'un achat de crédits IA. */
    public static final String SOURCE_TYPE = "AI_CREDIT_TOPUP";

    /** Pack de credits (prix serveur, degression au volume — grille Phase 2 §9). */
    public record CreditPack(String key, long millicredits, long priceCents, String label) {}

    private static final Map<String, CreditPack> PACKS = new LinkedHashMap<>();

    static {
        PACKS.put("pack_500", new CreditPack("pack_500", 500_000L, 1200L, "500 crédits IA"));
        PACKS.put("pack_2000", new CreditPack("pack_2000", 2_000_000L, 4000L, "2 000 crédits IA"));
        PACKS.put("pack_10000", new CreditPack("pack_10000", 10_000_000L, 16000L, "10 000 crédits IA"));
    }

    private final UserRepository userRepository;
    private final PaymentOrchestrationService orchestrationService;
    private final com.clenzy.tenant.TenantContext tenant;
    private final com.clenzy.repository.OrganizationRepository organizations;
    private final com.clenzy.payment.StripeGateway stripe;
    private final com.clenzy.service.BaitlyPlatformCommerce commerce;
    /** Les prix de cette grille sont libellés en EUR, pas dans la devise d'affichage du PMS. */
    public static final String CURRENCY = "EUR";

    @Value("${FRONTEND_URL:http://localhost:3000}")
    private String frontendUrl;

    public AiCreditPurchaseService(UserRepository userRepository,
                                   PaymentOrchestrationService orchestrationService, com.clenzy.tenant.TenantContext tenant,
                                   com.clenzy.repository.OrganizationRepository organizations,com.clenzy.payment.StripeGateway stripe,com.clenzy.service.BaitlyPlatformCommerce commerce) {
        this.userRepository = userRepository;
        this.orchestrationService = orchestrationService;
        this.tenant = tenant;
        this.organizations=organizations;this.stripe=stripe;this.commerce=commerce;
    }

    /** Packs disponibles (affichage UX T-08). */
    public List<CreditPack> listPacks() {
        return List.copyOf(PACKS.values());
    }

    /**
     * Cree la session Checkout d'un pack pour l'organisation du demandeur.
     * Le montant et le nombre de credits viennent de la table serveur.
     */
    public Map<String, String> createTopUpCheckout(String keycloakId, String packKey, java.util.UUID requestId) {
        if (requestId == null) throw new IllegalArgumentException("Identifiant de tentative requis");
        CreditPack pack = PACKS.get(packKey);
        if (pack == null) {
            throw new IllegalArgumentException("Pack inconnu : " + packKey
                    + " (disponibles : " + PACKS.keySet() + ")");
        }
        User user = userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));
        Long orgId = tenant.getRequiredOrganizationId();
        String country=com.clenzy.service.BaitlyBillingCountry.normalize(organizations.findById(orgId).orElseThrow().getBillingCountry());
        String seller=com.clenzy.service.BaitlyBillingCountry.sellerCountry(country);
        if(!"FR".equals(seller))throw new IllegalStateException("La vente de crédits attend le PSP de votre société de facturation.");
        final String account;
        try {account=stripe.requireSubscriptionSellerCountry(seller);}catch(com.stripe.exception.StripeException e){throw new IllegalStateException("Société facturante indisponible",e);}

        // Montant et crédits TOUJOURS serveur (règle #1) : issus de la table des packs.
        Map<String, String> metadata = new HashMap<>();
        metadata.put("type", "ai_credit_topup");
        metadata.put("org_id", String.valueOf(orgId));
        metadata.put("pack_key", pack.key());
        metadata.put("millicredits", String.valueOf(pack.millicredits()));
        metadata.put("offerVersion", "2026-10-EUR-1");
        metadata.put("seller_country",seller);metadata.put("billing_country",country);metadata.put("seller_account",account);
        metadata.putAll(commerce.invoiceMetadata(SOURCE_TYPE,seller,account));

        PaymentOrchestrationRequest request = new PaymentOrchestrationRequest(
                BigDecimal.valueOf(pack.priceCents()).movePointLeft(2), // cents → unités
                CURRENCY,
                SOURCE_TYPE,
                orgId,
                "Baitly — " + pack.label(),
                user.getEmail(),
                null,
                frontendUrl + "/settings?tab=ai&topup=success",
                frontendUrl + "/settings?tab=ai&topup=cancelled",
                metadata,
                "BAITLY-AI-" + orgId + "-" + requestId);

        // Flux authentifié (org résolue du JWT) : org explicite, pas de dépendance au TenantContext.
        PaymentOrchestrationResult result = orchestrationService.initiatePayment(orgId, seller, request);
        if (!result.isSuccess()) {
            String err = result.paymentResult() != null ? result.paymentResult().errorMessage() : "erreur inconnue";
            throw new IllegalStateException("Echec de creation du paiement de crédits IA: " + err);
        }
        return Map.of("checkoutUrl", result.paymentResult().redirectUrl());
    }

    /** Attribution conforme à l'offre vendue : les métadonnées seules ne valent pas encaissement. */
    public static long purchasedMillicredits(com.clenzy.model.PaymentTransaction tx) {
        var metadata=tx.getMetadata();
        var pack=metadata==null ? null : PACKS.get(String.valueOf(metadata.get("pack_key")));
        if (!(tx.getPaymentType()==com.clenzy.model.TransactionType.CHECKOUT
                && tx.getStatus()==com.clenzy.model.TransactionStatus.COMPLETED && SOURCE_TYPE.equals(tx.getSourceType())
                && tx.getOrganizationId()!=null && tx.getOrganizationId().equals(tx.getSourceId())
                && tx.getProviderTxId()!=null && !tx.getProviderTxId().isBlank()
                && pack!=null && CURRENCY.equalsIgnoreCase(tx.getCurrency()) && tx.getAmount()!=null
                && tx.getAmount().compareTo(BigDecimal.valueOf(pack.priceCents(),2))==0
                && String.valueOf(pack.millicredits()).equals(String.valueOf(metadata.get("millicredits")))))
            throw new IllegalStateException("L'encaissement ne correspond pas au pack de crédits IA");
        return pack.millicredits();
    }
}
