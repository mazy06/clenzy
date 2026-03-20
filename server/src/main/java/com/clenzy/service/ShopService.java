package com.clenzy.service;

import com.clenzy.dto.ShopCheckoutRequest;
import com.clenzy.model.HardwareCatalog;
import com.clenzy.model.HardwareOrder;
import com.clenzy.model.OrderStatus;
import com.clenzy.repository.HardwareOrderRepository;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional
public class ShopService {

    private static final Logger log = LoggerFactory.getLogger(ShopService.class);

    private final HardwareOrderRepository hardwareOrderRepository;
    private final TenantContext tenantContext;
    private final ObjectMapper objectMapper;

    @Value("${stripe.secret-key}")
    private String stripeSecretKey;

    @Value("${stripe.success-url}")
    private String successUrl;

    @Value("${stripe.cancel-url}")
    private String cancelUrl;

    public ShopService(HardwareOrderRepository hardwareOrderRepository,
                       TenantContext tenantContext,
                       ObjectMapper objectMapper) {
        this.hardwareOrderRepository = hardwareOrderRepository;
        this.tenantContext = tenantContext;
        this.objectMapper = objectMapper;
    }

    /**
     * Cree une session Stripe Checkout pour un achat de materiel IoT.
     * Les prix sont resolus cote serveur depuis HardwareCatalog (jamais depuis le frontend).
     */
    public Map<String, String> createCheckoutSession(ShopCheckoutRequest request,
                                                      String customerEmail,
                                                      String keycloakId) throws StripeException {
        if (request.items() == null || request.items().isEmpty()) {
            throw new IllegalArgumentException("Le panier est vide");
        }

        final Long orgId = tenantContext.getRequiredOrganizationId();

        // Validate SKUs and build line items from server-side catalog prices
        final List<SessionCreateParams.LineItem> lineItems = new ArrayList<>();
        final List<Map<String, Object>> itemDetails = new ArrayList<>();
        int totalAmount = 0;

        for (ShopCheckoutRequest.CartItem cartItem : request.items()) {
            if (cartItem.quantity() < 1) {
                throw new IllegalArgumentException("Quantite invalide pour SKU: " + cartItem.sku());
            }

            final HardwareCatalog.Product product = HardwareCatalog.findBySku(cartItem.sku())
                .orElseThrow(() -> new IllegalArgumentException("SKU inconnu: " + cartItem.sku()));

            totalAmount += product.priceInCents() * cartItem.quantity();

            lineItems.add(
                SessionCreateParams.LineItem.builder()
                    .setQuantity((long) cartItem.quantity())
                    .setPriceData(
                        SessionCreateParams.LineItem.PriceData.builder()
                            .setCurrency("eur")
                            .setUnitAmount((long) product.priceInCents())
                            .setProductData(
                                SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                    .setName(product.name())
                                    .setDescription("SKU: " + product.sku())
                                    .build()
                            )
                            .build()
                    )
                    .build()
            );

            final Map<String, Object> detail = new HashMap<>();
            detail.put("sku", product.sku());
            detail.put("name", product.name());
            detail.put("quantity", cartItem.quantity());
            detail.put("unitPrice", product.priceInCents());
            itemDetails.add(detail);
        }

        // Persist order with PENDING status
        final HardwareOrder order = new HardwareOrder();
        order.setOrganizationId(orgId);
        order.setUserId(keycloakId);
        order.setStatus(OrderStatus.PENDING);
        order.setTotalAmount(totalAmount);
        order.setCurrency("eur");
        order.setItemsJson(serializeItems(itemDetails));
        hardwareOrderRepository.save(order);

        // Create Stripe Checkout Session
        Stripe.apiKey = stripeSecretKey;

        final SessionCreateParams.Builder paramsBuilder = SessionCreateParams.builder()
            .setMode(SessionCreateParams.Mode.PAYMENT)
            .setSuccessUrl(successUrl)
            .setCancelUrl(cancelUrl)
            .setCustomerEmail(customerEmail)
            .putMetadata("type", "hardware_purchase")
            .putMetadata("order_id", order.getId().toString())
            .putMetadata("user_id", keycloakId)
            .putMetadata("org_id", orgId.toString())
            .setShippingAddressCollection(
                SessionCreateParams.ShippingAddressCollection.builder()
                    .addAllowedCountry(SessionCreateParams.ShippingAddressCollection.AllowedCountry.FR)
                    .addAllowedCountry(SessionCreateParams.ShippingAddressCollection.AllowedCountry.BE)
                    .addAllowedCountry(SessionCreateParams.ShippingAddressCollection.AllowedCountry.CH)
                    .addAllowedCountry(SessionCreateParams.ShippingAddressCollection.AllowedCountry.MA)
                    .addAllowedCountry(SessionCreateParams.ShippingAddressCollection.AllowedCountry.ES)
                    .build()
            );

        for (SessionCreateParams.LineItem lineItem : lineItems) {
            paramsBuilder.addLineItem(lineItem);
        }

        final Session session = Session.create(paramsBuilder.build());

        // Update order with Stripe session ID
        order.setStripeSessionId(session.getId());
        hardwareOrderRepository.save(order);

        log.info("Checkout session creee pour commande hardware: orderId={}, sessionId={}, total={}c",
            order.getId(), session.getId(), totalAmount);

        return Map.of(
            "sessionId", session.getId(),
            "url", session.getUrl()
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
            Stripe.apiKey = stripeSecretKey;
            final Session session = Session.retrieve(stripeSessionId);
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
