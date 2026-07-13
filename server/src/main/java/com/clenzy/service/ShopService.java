package com.clenzy.service;

import com.clenzy.dto.PaymentOrchestrationRequest;
import com.clenzy.dto.PaymentOrchestrationResult;
import com.clenzy.dto.ShopCheckoutRequest;
import com.clenzy.model.HardwareCatalog;
import com.clenzy.model.HardwareOrder;
import com.clenzy.model.OrderStatus;
import com.clenzy.model.PaymentProviderType;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.HardwareOrderRepository;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stripe.model.checkout.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional
public class ShopService {

    private static final Logger log = LoggerFactory.getLogger(ShopService.class);

    /** {@code sourceType} de la {@code PaymentTransaction} d'une commande de matériel IoT. */
    public static final String SOURCE_TYPE = "HARDWARE_ORDER";
    /** Pays de livraison autorisés (biens physiques). */
    private static final List<String> SHIPPING_COUNTRIES = List.of("FR", "BE", "CH", "MA", "ES");

    private final HardwareOrderRepository hardwareOrderRepository;
    private final TenantContext tenantContext;
    private final ObjectMapper objectMapper;
    private final StripeGateway stripeGateway;
    private final PaymentOrchestrationService orchestrationService;
    /** Création commande + rattachement session en transactions courtes (appel provider hors tx). */
    private final TransactionTemplate writeTx;

    @Value("${stripe.success-url}")
    private String successUrl;

    @Value("${stripe.cancel-url}")
    private String cancelUrl;

    public ShopService(HardwareOrderRepository hardwareOrderRepository,
                       TenantContext tenantContext,
                       ObjectMapper objectMapper,
                       StripeGateway stripeGateway,
                       PaymentOrchestrationService orchestrationService,
                       PlatformTransactionManager transactionManager) {
        this.hardwareOrderRepository = hardwareOrderRepository;
        this.tenantContext = tenantContext;
        this.objectMapper = objectMapper;
        this.stripeGateway = stripeGateway;
        this.orchestrationService = orchestrationService;
        this.writeTx = new TransactionTemplate(transactionManager);
    }

    /**
     * Crée une session de paiement (orchestrée) pour un achat de matériel IoT.
     * Les prix sont résolus côté serveur depuis HardwareCatalog (jamais depuis le frontend).
     *
     * <p>Provider épinglé Stripe : la collecte d'adresse de livraison + sa relecture à
     * la complétion ({@code completeOrder} via {@code retrieveSession}) sont Stripe-spécifiques.
     * Le montant est facturé en une ligne unique (le détail par SKU reste dans
     * {@code order.itemsJson}). Complétion inchangée via le webhook {@code type=hardware_purchase}.</p>
     *
     * <p>NOT_SUPPORTED (règle #2) : appel provider hors transaction ; création commande +
     * rattachement session en transactions courtes.</p>
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public Map<String, String> createCheckoutSession(ShopCheckoutRequest request,
                                                     String customerEmail,
                                                     String keycloakId) {
        if (request.items() == null || request.items().isEmpty()) {
            throw new IllegalArgumentException("Le panier est vide");
        }

        final Long orgId = tenantContext.getRequiredOrganizationId();

        // Validation SKU + total depuis le catalogue serveur (Z3-SEC-01, jamais le montant client).
        final List<Map<String, Object>> itemDetails = new ArrayList<>();
        int totalAmountCents = 0;
        for (ShopCheckoutRequest.CartItem cartItem : request.items()) {
            if (cartItem.quantity() < 1) {
                throw new IllegalArgumentException("Quantite invalide pour SKU: " + cartItem.sku());
            }
            final HardwareCatalog.Product product = HardwareCatalog.findBySku(cartItem.sku())
                .orElseThrow(() -> new IllegalArgumentException("SKU inconnu: " + cartItem.sku()));
            totalAmountCents += product.priceInCents() * cartItem.quantity();

            final Map<String, Object> detail = new HashMap<>();
            detail.put("sku", product.sku());
            detail.put("name", product.name());
            detail.put("quantity", cartItem.quantity());
            detail.put("unitPrice", product.priceInCents());
            itemDetails.add(detail);
        }

        final int totalAmount = totalAmountCents;
        final int itemCount = request.items().size();
        // Création de la commande PENDING en transaction courte.
        final HardwareOrder order = writeTx.execute(status -> {
            HardwareOrder o = new HardwareOrder();
            o.setOrganizationId(orgId);
            o.setUserId(keycloakId);
            o.setStatus(OrderStatus.PENDING);
            o.setTotalAmount(totalAmount);
            o.setCurrency("eur");
            o.setItemsJson(serializeItems(itemDetails));
            return hardwareOrderRepository.save(o);
        });

        Map<String, String> metadata = new HashMap<>();
        metadata.put("type", "hardware_purchase");
        metadata.put("order_id", order.getId().toString());
        metadata.put("user_id", keycloakId);
        metadata.put("org_id", orgId.toString());

        PaymentOrchestrationRequest orchRequest = new PaymentOrchestrationRequest(
            BigDecimal.valueOf(totalAmount).movePointLeft(2), // cents → unités
            "eur",
            SOURCE_TYPE,
            order.getId(),
            "Materiel IoT — " + itemCount + " article(s)",
            customerEmail,
            PaymentProviderType.STRIPE,           // épinglé : shipping Stripe-spécifique
            successUrl,
            cancelUrl,
            metadata,
            "HARDWARE-ORDER-" + order.getId(),
            false,                                 // embedded
            null,                                  // expiresAt
            false,                                 // saveCard
            SHIPPING_COUNTRIES);                   // collecte d'adresse de livraison

        PaymentOrchestrationResult result = orchestrationService.initiatePayment(orchRequest);
        if (!result.isSuccess()) {
            String err = result.paymentResult() != null ? result.paymentResult().errorMessage() : "erreur inconnue";
            throw new IllegalStateException("Echec de creation du paiement de la commande materiel: " + err);
        }

        final String providerTxId = result.paymentResult().providerTxId();
        writeTx.executeWithoutResult(status -> {
            HardwareOrder fresh = hardwareOrderRepository.findById(order.getId()).orElse(null);
            if (fresh != null) {
                fresh.setStripeSessionId(providerTxId);
                hardwareOrderRepository.save(fresh);
            }
        });

        log.info("Session de paiement matériel créée via orchestrateur: orderId={}, sessionId={}, total={}c",
            order.getId(), providerTxId, totalAmount);

        return Map.of(
            "sessionId", providerTxId,
            "url", result.paymentResult().redirectUrl()
        );
    }

    /**
     * Complete une commande apres confirmation de paiement via le webhook Stripe.
     */
    public void completeOrder(String stripeSessionId) {
        final HardwareOrder order = hardwareOrderRepository.findByStripeSessionId(stripeSessionId)
            .orElse(null);

        if (order == null) {
            log.warn("Commande hardware introuvable pour stripeSessionId={}", stripeSessionId);
            return;
        }

        if (order.getStatus() == OrderStatus.PAID) {
            log.info("Commande hardware deja marquee PAID: orderId={}", order.getId());
            return;
        }

        order.setStatus(OrderStatus.PAID);

        // Recuperer le payment intent ID depuis Stripe si possible
        try {
            final Session session = stripeGateway.retrieveSession(stripeSessionId);
            if (session.getPaymentIntent() != null) {
                order.setStripePaymentIntentId(session.getPaymentIntent());
            }
            // Store shipping info if collected
            if (session.getShippingDetails() != null) {
                final var shipping = session.getShippingDetails();
                order.setShippingName(shipping.getName());
                if (shipping.getAddress() != null) {
                    final var addr = shipping.getAddress();
                    order.setShippingAddress(
                        String.join(", ",
                            addr.getLine1() != null ? addr.getLine1() : "",
                            addr.getLine2() != null ? addr.getLine2() : ""
                        ).replaceAll("^,\\s*|,\\s*$", "").trim()
                    );
                    order.setShippingCity(addr.getCity());
                    order.setShippingPostalCode(addr.getPostalCode());
                    order.setShippingCountry(addr.getCountry());
                }
            }
        } catch (Exception e) {
            log.warn("Impossible de recuperer les details de session Stripe pour orderId={}: {}",
                order.getId(), e.getMessage());
        }

        hardwareOrderRepository.save(order);
        log.info("Commande hardware completee: orderId={}, total={}c", order.getId(), order.getTotalAmount());
    }

    /**
     * Liste les commandes pour l'organisation courante.
     */
    @Transactional(readOnly = true)
    public List<HardwareOrder> getOrders() {
        final Long orgId = tenantContext.getRequiredOrganizationId();
        return hardwareOrderRepository.findByOrganizationIdOrderByCreatedAtDesc(orgId);
    }

    private String serializeItems(List<Map<String, Object>> items) {
        try {
            return objectMapper.writeValueAsString(items);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Erreur de serialisation des items", e);
        }
    }
}
