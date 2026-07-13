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

    @Value("${stripe.currency:eur}")
    private String currency;

    @Value("${FRONTEND_URL:http://localhost:3000}")
    private String frontendUrl;

    public AiCreditPurchaseService(UserRepository userRepository,
                                   PaymentOrchestrationService orchestrationService) {
        this.userRepository = userRepository;
        this.orchestrationService = orchestrationService;
    }

    /** Packs disponibles (affichage UX T-08). */
    public List<CreditPack> listPacks() {
        return List.copyOf(PACKS.values());
    }

    /**
     * Cree la session Checkout d'un pack pour l'organisation du demandeur.
     * Le montant et le nombre de credits viennent de la table serveur.
     */
    public Map<String, String> createTopUpCheckout(String keycloakId, String packKey) {
        CreditPack pack = PACKS.get(packKey);
        if (pack == null) {
            throw new IllegalArgumentException("Pack inconnu : " + packKey
                    + " (disponibles : " + PACKS.keySet() + ")");
        }
        User user = userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));
        if (user.getOrganizationId() == null) {
            throw new IllegalStateException("Utilisateur sans organisation : top-up impossible");
        }
        Long orgId = user.getOrganizationId();

        // Montant et crédits TOUJOURS serveur (règle #1) : issus de la table des packs.
        Map<String, String> metadata = new HashMap<>();
        metadata.put("type", "ai_credit_topup");
        metadata.put("org_id", String.valueOf(orgId));
        metadata.put("pack_key", pack.key());
        metadata.put("millicredits", String.valueOf(pack.millicredits()));

        PaymentOrchestrationRequest request = new PaymentOrchestrationRequest(
                BigDecimal.valueOf(pack.priceCents()).movePointLeft(2), // cents → unités
                currency,
                SOURCE_TYPE,
                orgId,
                "Baitly — " + pack.label(),
                user.getEmail(),
                null,
                frontendUrl + "/settings?tab=ai&topup=success",
                frontendUrl + "/settings?tab=ai&topup=cancelled",
                metadata,
                null); // pas de clé d'idempotence : plusieurs achats du même pack possibles

        // Flux authentifié (org résolue du JWT) : org explicite, pas de dépendance au TenantContext.
        PaymentOrchestrationResult result = orchestrationService.initiatePayment(orgId, null, request);
        if (!result.isSuccess()) {
            String err = result.paymentResult() != null ? result.paymentResult().errorMessage() : "erreur inconnue";
            throw new IllegalStateException("Echec de creation du paiement de crédits IA: " + err);
        }
        return Map.of("checkoutUrl", result.paymentResult().redirectUrl());
    }
}
