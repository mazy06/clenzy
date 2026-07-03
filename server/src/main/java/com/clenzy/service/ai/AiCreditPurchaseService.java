package com.clenzy.service.ai;

import com.clenzy.model.User;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.UserRepository;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

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

    /** Pack de credits (prix serveur, degression au volume — grille Phase 2 §9). */
    public record CreditPack(String key, long millicredits, long priceCents, String label) {}

    private static final Map<String, CreditPack> PACKS = new LinkedHashMap<>();

    static {
        PACKS.put("pack_500", new CreditPack("pack_500", 500_000L, 1200L, "500 crédits IA"));
        PACKS.put("pack_2000", new CreditPack("pack_2000", 2_000_000L, 4000L, "2 000 crédits IA"));
        PACKS.put("pack_10000", new CreditPack("pack_10000", 10_000_000L, 16000L, "10 000 crédits IA"));
    }

    private final UserRepository userRepository;
    private final StripeGateway stripeGateway;

    @Value("${stripe.currency:eur}")
    private String currency;

    @Value("${FRONTEND_URL:http://localhost:3000}")
    private String frontendUrl;

    public AiCreditPurchaseService(UserRepository userRepository, StripeGateway stripeGateway) {
        this.userRepository = userRepository;
        this.stripeGateway = stripeGateway;
    }

    /** Packs disponibles (affichage UX T-08). */
    public List<CreditPack> listPacks() {
        return List.copyOf(PACKS.values());
    }

    /**
     * Cree la session Checkout d'un pack pour l'organisation du demandeur.
     * Le montant et le nombre de credits viennent de la table serveur.
     */
    public Map<String, String> createTopUpCheckout(String keycloakId, String packKey)
            throws StripeException {
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

        SessionCreateParams params = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.PAYMENT)
                .setSuccessUrl(frontendUrl + "/settings?tab=ai&topup=success")
                .setCancelUrl(frontendUrl + "/settings?tab=ai&topup=cancelled")
                .putMetadata("type", "ai_credit_topup")
                .putMetadata("org_id", String.valueOf(user.getOrganizationId()))
                .putMetadata("pack_key", pack.key())
                .putMetadata("millicredits", String.valueOf(pack.millicredits()))
                .addLineItem(SessionCreateParams.LineItem.builder()
                        .setQuantity(1L)
                        .setPriceData(SessionCreateParams.LineItem.PriceData.builder()
                                .setCurrency(currency.toLowerCase())
                                .setUnitAmount(pack.priceCents())
                                .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                        .setName("Baitly — " + pack.label())
                                        .setDescription("Recharge de crédits IA (valables 12 mois)")
                                        .build())
                                .build())
                        .build())
                .build();

        Session session = stripeGateway.createSession(params);
        return Map.of("checkoutUrl", session.getUrl());
    }
}
