package com.clenzy.service;

import com.clenzy.dto.PaymentOrchestrationRequest;
import com.clenzy.dto.PaymentOrchestrationResult;
import com.clenzy.dto.ShopCheckoutRequest;
import com.clenzy.model.HardwareCatalog;
import com.clenzy.model.HardwareOrder;
import com.clenzy.model.OrderStatus;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.HardwareOrderRepository;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.model.TransactionType;
import com.clenzy.model.PaymentProviderType;
import com.clenzy.model.TransactionStatus;
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
    private final PaymentTransactionRepository payments;
    private final BaitlyHardwareInventory inventory;
    private final BaitlyPurchaseRequests requests;
    private final com.clenzy.repository.OrganizationRepository organizations;
    private final BaitlyPlatformCommerce commerce;
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
                       PlatformTransactionManager transactionManager, PaymentTransactionRepository payments,BaitlyHardwareInventory inventory,BaitlyPurchaseRequests requests,com.clenzy.repository.OrganizationRepository organizations,BaitlyPlatformCommerce commerce) {
        this.commerce=commerce;
        this.organizations=organizations;
        this.requests=requests;
        this.inventory=inventory;
        this.hardwareOrderRepository = hardwareOrderRepository;
        this.tenantContext = tenantContext;
        this.objectMapper = objectMapper;
        this.stripeGateway = stripeGateway;
        this.orchestrationService = orchestrationService;
        this.writeTx = new TransactionTemplate(transactionManager);
        this.payments = payments;
    }

    /**
     * Crée une session de paiement (orchestrée) pour un achat de matériel IoT.
     * Les prix sont résolus côté serveur depuis HardwareCatalog (jamais depuis le frontend).
     *
     * <p>La collecte d'adresse de livraison est exprimée en <strong>capacité</strong>
     * ({@code SHIPPING_ADDRESS}) : le resolver route vers un provider capable (Stripe
     * aujourd'hui, tout PSP qui déclarera la capacité demain — aucun épinglage en dur).
     * Le montant est facturé en une ligne unique (le détail par SKU reste dans
     * {@code order.itemsJson}). Complétion inchangée via le webhook {@code type=hardware_purchase}
     * (relecture du shipping via {@code retrieveSession}, Stripe-spécifique tant qu'un
     * seul provider déclare la capacité).</p>
     *
     * <p>NOT_SUPPORTED (règle #2) : appel provider hors transaction ; création commande +
     * rattachement session en transactions courtes.</p>
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public Map<String, String> createCheckoutSession(ShopCheckoutRequest request,
                                                     String customerEmail,
                                                     String keycloakId) {
        if (request == null || request.items() == null || request.items().isEmpty()) {
            throw new IllegalArgumentException("Le panier est vide");
        }
        if (request.items().size() > 50) throw new IllegalArgumentException("Panier trop volumineux");

        final Long orgId = tenantContext.getRequiredOrganizationId();
        final String seller=BaitlyBillingCountry.sellerCountry(organizations.findById(orgId).orElseThrow().getBillingCountry());
        InterventionPaymentBatch.require("FR".equals(seller),"La boutique attend la configuration du PSP et du catalogue de votre société de facturation.");
        final String sellerAccount;
        try {sellerAccount=stripeGateway.requireSubscriptionSellerCountry(seller);}catch(com.stripe.exception.StripeException e){throw new IllegalStateException("Société facturante indisponible",e);}
        var fiscalMetadata=commerce.invoiceMetadata(SOURCE_TYPE,seller,sellerAccount);

        // Validation SKU + total depuis le catalogue serveur (Z3-SEC-01, jamais le montant client).
        final List<Map<String, Object>> itemDetails = new ArrayList<>();
        int totalAmountCents = 0;
        var skus = new java.util.HashSet<String>();
        for (ShopCheckoutRequest.CartItem cartItem : request.items()) {
            if (cartItem == null || cartItem.quantity() < 1 || cartItem.quantity() > 100) {
                throw new IllegalArgumentException("Quantite invalide : de 1 à 100 par produit");
            }
            if (!skus.add(cartItem.sku())) throw new IllegalArgumentException("Un produit ne peut figurer que sur une ligne du panier");
            final HardwareCatalog.Product product = HardwareCatalog.findBySku(cartItem.sku())
                .orElseThrow(() -> new IllegalArgumentException("SKU inconnu: " + cartItem.sku()));
            totalAmountCents = Math.addExact(totalAmountCents, Math.multiplyExact(product.priceInCents(), cartItem.quantity()));

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
        String basket=request.items().stream().sorted(java.util.Comparator.comparing(ShopCheckoutRequest.CartItem::sku)).map(i->i.sku()+":"+i.quantity()).collect(java.util.stream.Collectors.joining(","));
        final HardwareOrder order = writeTx.execute(status -> {
          Long id=requests.prepare(orgId,request.requestId(),SOURCE_TYPE,keycloakId,basket,()->{
            HardwareOrder o = new HardwareOrder();
            o.setOrganizationId(orgId);
            o.setUserId(keycloakId);
            o.setStatus(OrderStatus.PENDING);
            o.setTotalAmount(totalAmount);
            o.setCurrency("eur");
            o.setItemsJson(serializeItems(itemDetails));
            o=hardwareOrderRepository.save(o);
            inventory.reserve(o,seller);
            return o.getId();
          });
          return hardwareOrderRepository.findById(id).filter(o->orgId.equals(o.getOrganizationId()) && keycloakId.equals(o.getUserId())).orElseThrow();
        });
        if(order.getStatus()!=OrderStatus.PENDING)throw new IllegalStateException("Cette commande a déjà été traitée. Consultez son suivi avant un nouvel achat.");

        Map<String, String> metadata = new HashMap<>();
        metadata.put("type", "hardware_purchase");
        metadata.put("order_id", order.getId().toString());
        metadata.put("user_id", keycloakId);
        metadata.put("org_id", orgId.toString());
        metadata.put("seller_country",seller);metadata.put("seller_account",sellerAccount);
        metadata.putAll(fiscalMetadata);

        PaymentOrchestrationRequest orchRequest = new PaymentOrchestrationRequest(
            BigDecimal.valueOf(order.getTotalAmount(),2),
            order.getCurrency(),
            SOURCE_TYPE,
            order.getId(),
            "Materiel IoT — " + itemCount + " article(s)",
            customerEmail,
            null,                                  // résolu par capacité SHIPPING_ADDRESS (pas d'épinglage)
            successUrl,
            cancelUrl,
            metadata,
            "HARDWARE-ORDER-" + order.getId(),
            false,                                 // embedded
            order.getCreatedAt().toInstant(java.time.ZoneOffset.UTC).plusSeconds(3600).getEpochSecond(),
            false,                                 // saveCard
            SHIPPING_COUNTRIES);                   // collecte d'adresse de livraison

        PaymentOrchestrationResult result = orchestrationService.initiatePayment(orgId,seller,orchRequest);
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
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public void completeOrder(String stripeSessionId) {
        final Session session;
        try { session = stripeGateway.retrieveSession(stripeSessionId); }
        catch (com.stripe.exception.StripeException e) {
            throw new IllegalStateException("Preuve du paiement matériel indisponible", e);
        }
        writeTx.executeWithoutResult(status -> {
            var tx = payments.findByProviderTxId(stripeSessionId)
                    .orElseThrow(() -> new IllegalStateException("Encaissement matériel introuvable"));
            InterventionPaymentBatch.require(SOURCE_TYPE.equals(tx.getSourceType()) && tx.getSourceId()!=null
                    && tx.getOrganizationId()!=null,"Encaissement matériel incompatible");
            // Le journal est déjà durable si le processus s'est arrêté avant le rattachement à la commande.
            var order = hardwareOrderRepository.lockByStripeSessionId(stripeSessionId)
                    .or(() -> hardwareOrderRepository.lockForOrganization(tx.getOrganizationId(),tx.getSourceId()))
                    .orElseThrow(() -> new IllegalStateException("Commande matériel introuvable"));
            InterventionPaymentBatch.require(order.getStripeSessionId()==null || stripeSessionId.equals(order.getStripeSessionId()),
                    "La commande possède déjà une autre session");
            var metadata = session == null ? null : session.getMetadata();
            InterventionPaymentBatch.require(session != null && java.util.Objects.equals(stripeSessionId,session.getId())
                    && "payment".equals(session.getMode()) && "complete".equals(session.getStatus())
                    && "paid".equals(session.getPaymentStatus()) && session.getPaymentIntent()!=null
                    && session.getPaymentIntent().startsWith("pi_")
                    && java.util.Objects.equals((long)order.getTotalAmount(),session.getAmountTotal())
                    && order.getCurrency().equalsIgnoreCase(session.getCurrency())
                    && metadata!=null && SOURCE_TYPE.equals(metadata.get("sourceType"))
                    && java.util.Objects.equals(String.valueOf(order.getId()),metadata.get("sourceId"))
                    && java.util.Objects.equals(String.valueOf(order.getOrganizationId()),metadata.get("orgId"))
                    && java.util.Objects.equals(tx.getTransactionRef(),metadata.get("transactionRef"))
                    && tx.getPaymentType()==TransactionType.CHECKOUT && tx.getProviderType()==PaymentProviderType.STRIPE
                    && SOURCE_TYPE.equals(tx.getSourceType()) && java.util.Objects.equals(order.getId(),tx.getSourceId())
                    && java.util.Objects.equals(order.getOrganizationId(),tx.getOrganizationId())
                    && tx.getAmount()!=null && tx.getAmount().compareTo(BigDecimal.valueOf(order.getTotalAmount(),2))==0
                    && order.getCurrency().equalsIgnoreCase(tx.getCurrency()), "Preuve du paiement matériel incompatible");
            InterventionPaymentBatch.require(tx.getStatus()==TransactionStatus.PROCESSING || tx.getStatus()==TransactionStatus.COMPLETED,
                    "Encaissement matériel à rapprocher");
            // Un webhook rejoué ne remet jamais une commande livrée en préparation.
            if (order.getStatus()==OrderStatus.SHIPPED || order.getStatus()==OrderStatus.DELIVERED || order.getStatus()==OrderStatus.PAID) {
                orchestrationService.completeTransaction(tx.getTransactionRef());
                return;
            }
            InterventionPaymentBatch.require(order.getStatus()==OrderStatus.PENDING, "Commande annulée : remboursement à examiner");
            var shipping = session.getCollectedInformation()==null ? null : session.getCollectedInformation().getShippingDetails();
            InterventionPaymentBatch.require(shipping!=null && shipping.getAddress()!=null
                    && SHIPPING_COUNTRIES.contains(shipping.getAddress().getCountry()), "Adresse de livraison à vérifier");
            var address=shipping.getAddress();
            order.setStripeSessionId(stripeSessionId);
            order.setStripePaymentIntentId(session.getPaymentIntent());
            order.setShippingName(shipping.getName());
            order.setShippingAddress(java.util.stream.Stream.of(address.getLine1(),address.getLine2())
                    .filter(v->v!=null && !v.isBlank()).collect(java.util.stream.Collectors.joining(", ")));
            order.setShippingCity(address.getCity());order.setShippingPostalCode(address.getPostalCode());order.setShippingCountry(address.getCountry());
            inventory.paid(order);
            order.setStatus(OrderStatus.PAID);
            hardwareOrderRepository.save(order);
            orchestrationService.completeTransaction(tx.getTransactionRef());
        });
    }

    /** Répare uniquement un lien manquant depuis une unique transaction persistée, sans déclarer la vente payée. */
    public String recoverCheckoutReference(Long org,Long id) {
        var order=hardwareOrderRepository.lockForOrganization(org,id).orElseThrow();
        if(order.getStripeSessionId()!=null)return order.getStripeSessionId();
        InterventionPaymentBatch.require(order.getStatus()==OrderStatus.PENDING,"Commande déjà traitée");
        var candidates=payments.findByOrganizationIdAndSourceTypeAndSourceId(org,SOURCE_TYPE,id).stream()
                .filter(tx->tx.getPaymentType()==TransactionType.CHECKOUT && tx.getProviderType()==PaymentProviderType.STRIPE
                        && tx.getProviderTxId()!=null && tx.getProviderTxId().startsWith("cs_")
                        && (tx.getStatus()==TransactionStatus.PROCESSING || tx.getStatus()==TransactionStatus.COMPLETED))
                .toList();
        InterventionPaymentBatch.require(candidates.size()==1,"Session matérielle ambiguë ou absente : rapprochement requis");
        var tx=candidates.getFirst();
        InterventionPaymentBatch.require(org.equals(tx.getOrganizationId()) && id.equals(tx.getSourceId())
                && SOURCE_TYPE.equals(tx.getSourceType()) && tx.getAmount()!=null
                && tx.getAmount().compareTo(BigDecimal.valueOf(order.getTotalAmount(),2))==0
                && order.getCurrency().equalsIgnoreCase(tx.getCurrency()),"Encaissement matériel incompatible");
        order.setStripeSessionId(tx.getProviderTxId());
        hardwareOrderRepository.save(order);
        return tx.getProviderTxId();
    }

    /**
     * Liste les commandes pour l'organisation courante.
     */
    @Transactional(readOnly = true)
    public List<HardwareOrder> getOrders() {
        final Long orgId = tenantContext.getRequiredOrganizationId();
        return hardwareOrderRepository.findByOrganizationIdOrderByCreatedAtDesc(orgId);
    }

    @Transactional(readOnly = true)
    public List<HardwareOrder> getOrders(String buyer,boolean manager) {
        return getOrders().stream().filter(o->manager || java.util.Objects.equals(buyer,o.getUserId())).toList();
    }

    @Transactional(readOnly = true)
    public void requireOrderAccess(Long id,String buyer,boolean manager) {
        var order=hardwareOrderRepository.findById(id).orElseThrow();
        if(!tenantContext.getRequiredOrganizationId().equals(order.getOrganizationId()) || (!manager && !java.util.Objects.equals(buyer,order.getUserId())))
            throw new org.springframework.security.access.AccessDeniedException("Commande inaccessible");
    }

    private String serializeItems(List<Map<String, Object>> items) {
        try {
            return objectMapper.writeValueAsString(items);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Erreur de serialisation des items", e);
        }
    }
}
