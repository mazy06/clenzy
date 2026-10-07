package com.clenzy.service;

import com.clenzy.dto.InscriptionDto;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.payment.StripeGateway;
import com.clenzy.util.StringUtils;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import static com.clenzy.service.BaitlyMonthlyPricing.*;

/** Inscription publique : commande durable avant Stripe, même grille et échéancier que le PMS. */
@Service
public class BaitlySignupCheckout {
    private final PendingInscriptionRepository signups;
    private final BaitlySubscriptionOrderRepository orders;
    private final PlatformPromoCodeRepository promos;
    private final UserRepository users;
    private final BaitlyMonthlyPricing pricing;
    private final StripeGateway stripe;
    private final BaitlySubscriptionSchedule schedules;
    private final ObjectMapper json;
    private final TransactionTemplate write;
    @Value("${stripe.inscription.return-url:${FRONTEND_URL:http://localhost:3000}/inscription/success}") private String returnUrl;
    @Value("${stripe.tax.saas-product-tax-code:txcd_10103001}") private String taxCode;
    public BaitlySignupCheckout(PendingInscriptionRepository signups,BaitlySubscriptionOrderRepository orders,
            PlatformPromoCodeRepository promos,UserRepository users,BaitlyMonthlyPricing pricing,StripeGateway stripe,
            BaitlySubscriptionSchedule schedules,ObjectMapper json,PlatformTransactionManager tx) {
        this.signups=signups;this.orders=orders;this.promos=promos;this.users=users;this.pricing=pricing;
        this.stripe=stripe;this.schedules=schedules;this.json=json;this.write=new TransactionTemplate(tx);
    }
    public record Proposal(List<Quote> phases,long firstInvoiceExcludingTaxCents,String promoCode) {}
    @Transactional(readOnly=true)
    public Proposal quote(Plan plan,String country,int properties,String code) {
        Market market=marketForCountry(country);
        var phases=List.of(pricing.quote(plan,market,properties,1),pricing.quote(plan,market,properties,4),
                pricing.quote(plan,market,properties,7),pricing.quote(plan,market,properties,13));
        var promo=code==null || code.isBlank()?null:promos.findByCodeIgnoreCase(code.trim())
                .orElseThrow(()->new IllegalArgumentException("Code promotionnel inconnu"));
        long first=phases.getFirst().totalCents();
        if(promo!=null){BaitlyMonthlySubscriptionService.validatePromo(promo,phases.getFirst().currency());first=promo.applyTo(Math.toIntExact(first));}
        return new Proposal(phases,first,promo==null?null:promo.getCode());
    }
    private record Prepared(PendingInscription signup,BaitlySubscriptionOrder order) {}
    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    public Map<String,Object> start(InscriptionDto dto) throws StripeException {
        require(dto.getRequestId()!=null && dto.isAcceptedTerms(),"Identifiant de tentative et accord aux conditions requis");
        require("MONTHLY".equals(dto.getBillingPeriod()),"Les nouvelles souscriptions suivent la grille mensuelle Baitly");
        require(dto.getPropertyCount()!=null,"Renseignez le nombre de logements");
        Plan plan=Plan.valueOf(dto.getForfait());
        pricing.quote(plan,marketForCountry(dto.getBillingCountry()),dto.getPropertyCount(),1);
        String fingerprint=fingerprint(dto);
        String country=BaitlyBillingCountry.normalize(dto.getBillingCountry());
        String seller=BaitlyBillingCountry.sellerCountry(country);
        String account=stripe.requireSubscriptionSellerCountry(seller);
        stripe.requireSubscriptionTaxReady();
        var prepared=write.execute(status->{
            var existing=signups.findByRequestId(dto.getRequestId());
            if(existing.isPresent()) {
                var pending=signups.lockById(existing.get().getId()).orElseThrow();
                require(fingerprint.equals(pending.getRequestFingerprint()),"Cette tentative correspond à une autre demande");
                var order=orders.findBySignupId(pending.getId()).orElseThrow();
                require(order.getSellerStripeAccountId()==null || account.equals(order.getSellerStripeAccountId()),"Autre compte de paiement : inscription à rapprocher");
                require(Set.of("PREPARED","CHECKOUT_OPEN").contains(order.getStatus()),"Cette inscription a déjà été traitée");
                require(order.getCheckoutSessionId()!=null || order.getCreatedAt().plusHours(23).isAfter(LocalDateTime.now(Clock.systemUTC())),
                        "Cette tentative doit être rapprochée avant un nouveau paiement");
                return new Prepared(pending,order);
            }
            String email=dto.getEmail().trim().toLowerCase(Locale.ROOT);
            require(!users.existsByEmailHash(StringUtils.computeEmailHash(email))
                    && !signups.existsByEmailIgnoreCaseAndStatusIn(email,List.of(PendingInscriptionStatus.PENDING_PAYMENT,PendingInscriptionStatus.PAYMENT_CONFIRMED)),
                    "Impossible de traiter cette inscription. Reprenez votre demande ou contactez le support.");
            var pending=copy(dto,email);signups.saveAndFlush(pending);
            var proposal=quote(plan,dto.getBillingCountry(),dto.getPropertyCount(),dto.getPromoCode());
            var order=new BaitlySubscriptionOrder();var first=proposal.phases().getFirst();
            order.setSignupId(pending.getId());order.setRequestId(dto.getRequestId());order.setPlan(plan.name());
            order.setBillingCountry(country);order.setSellerCountry(seller);order.setSellerStripeAccountId(account);
            order.setMarket(first.market().name());order.setCurrency(first.currency());order.setProperties(first.properties());
            order.setPriceVersion(first.version());order.setMonthOneCents(first.totalCents());
            order.setMonthFourCents(proposal.phases().get(1).totalCents());order.setMonthSevenCents(proposal.phases().get(2).totalCents());
            order.setMonthThirteenCents(proposal.phases().get(3).totalCents());order.setFirstInvoiceCents(first.totalCents());
            if(proposal.promoCode()!=null) {
                var promo=promos.lockByCode(proposal.promoCode()).orElseThrow();
                BaitlyMonthlySubscriptionService.validatePromo(promo,first.currency());
                long held=orders.countByPromoCodeIdAndStatusIn(promo.getId(),List.of("PREPARED","CHECKOUT_OPEN","ACTIVATING"));
                require(promo.getMaxUses()==null || promo.getUsedCount()+held<promo.getMaxUses(),"Quota promotionnel épuisé");
                order.setPromoCodeId(promo.getId());order.setPromoCode(promo.getCode());order.setFirstInvoiceCents(promo.applyTo(Math.toIntExact(first.totalCents())));
            }
            orders.saveAndFlush(order);return new Prepared(pending,order);
        });
        var order=prepared.order();
        Session session;
        if(order.getCheckoutSessionId()!=null)session=stripe.retrieveSession(order.getCheckoutSessionId());
        else {
            var metadata=Map.of("type","inscription","baitly_order_id",order.getId().toString(),"signupId",order.getSignupId().toString(),"priceVersion",order.getPriceVersion());
            var parameters=SessionCreateParams.builder().setIntegrationIdentifier(StripeGateway.CHECKOUT_INTEGRATION_ID)
                    .setMode(SessionCreateParams.Mode.SUBSCRIPTION).setUiMode(SessionCreateParams.UiMode.EMBEDDED_PAGE)
                    .setReturnUrl(returnUrl+"?session_id={CHECKOUT_SESSION_ID}").setCustomerEmail(prepared.signup().getEmail())
                    .setAutomaticTax(SessionCreateParams.AutomaticTax.builder().setEnabled(true).build())
                    .setBillingAddressCollection(SessionCreateParams.BillingAddressCollection.REQUIRED)
                    .setTaxIdCollection(SessionCreateParams.TaxIdCollection.builder().setEnabled(true).build())
                    .putAllMetadata(metadata).setSubscriptionData(SessionCreateParams.SubscriptionData.builder().putAllMetadata(metadata).build())
                    .addLineItem(SessionCreateParams.LineItem.builder().setQuantity(1L).setPriceData(SessionCreateParams.LineItem.PriceData.builder()
                            .setCurrency(order.getCurrency().toLowerCase(Locale.ROOT)).setUnitAmount(order.firstRegularCents())
                            .setTaxBehavior(SessionCreateParams.LineItem.PriceData.TaxBehavior.EXCLUSIVE)
                            .setRecurring(SessionCreateParams.LineItem.PriceData.Recurring.builder().setInterval(SessionCreateParams.LineItem.PriceData.Recurring.Interval.MONTH).build())
                            .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder().setName("Baitly "+order.getPlan()+" · "+order.getProperties()+" logement(s)")
                                    .setTaxCode(taxCode).setDescription("Mensuel HT. Fidélité : −10 % dès le mois 4, −20 % dès le mois 7, −30 % dès le mois 13. Remise volume incluse.").build()).build()).build());
            if(order.getFirstInvoiceCents()<order.firstRegularCents()) {
                var coupon=stripe.createCoupon(com.stripe.param.CouponCreateParams.builder().setDuration(com.stripe.param.CouponCreateParams.Duration.ONCE)
                        .setName("Baitly · remise de première échéance").setAmountOff(order.firstRegularCents()-order.getFirstInvoiceCents())
                        .setCurrency(order.getCurrency().toLowerCase(Locale.ROOT)).build(),"BAITLY-SIGNUP-COUPON-"+order.getId());
                parameters.addDiscount(SessionCreateParams.Discount.builder().setCoupon(coupon.getId()).build());
            }
            session=stripe.createSession(parameters.build(),"BAITLY-SIGNUP-"+order.getId());
            final Session created=session;
            write.executeWithoutResult(status->{
                var locked=orders.lockById(order.getId()).orElseThrow();
                require(locked.getCheckoutSessionId()==null || locked.getCheckoutSessionId().equals(created.getId()),"Session concurrente incompatible");
                locked.setCheckoutSessionId(created.getId());locked.setStatus("CHECKOUT_OPEN");orders.save(locked);
                var pending=signups.lockById(order.getSignupId()).orElseThrow();pending.setStripeSessionId(created.getId());signups.save(pending);
            });
        }
        require("open".equals(session.getStatus()) && session.getClientSecret()!=null,"Cette session n'est plus ouverte");
        return Map.of("clientSecret",session.getClientSecret(),"sessionId",session.getId(),"monthlyPriceCents",order.firstRegularCents(),
                "stripePriceAmount",order.getFirstInvoiceCents(),"currency",order.getCurrency(),"billingPeriod","MONTHLY");
    }

    /** Renvoie false uniquement pour un ancien parcours, qui conserve sa procédure historique. */
    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    public boolean confirm(String sessionId) throws StripeException {
        var known=orders.findByCheckoutSessionId(sessionId);
        Session session=stripe.retrieveSession(sessionId);
        if(known.isEmpty())known=unattached(session);
        if(known.isEmpty() || known.get().getSignupId()==null)return false;
        var order=known.get();
        BaitlyMonthlySubscriptionService.verify(order,session);
        stripe.verifySubscriptionSeller(order.getSellerCountry(),order.getSellerStripeAccountId());
        if(order.getOrganizationId()!=null)return true;
        var subscription=stripe.retrieveSubscription(session.getSubscription());
        require(session.getCustomer().equals(subscription.getCustomer()) && "active".equals(subscription.getStatus()),"Abonnement non actif");
        String schedule=schedules.install(order,subscription);
        require(subscription.getLatestInvoice()!=null,"Facture initiale absente");
        var invoice=stripe.retrieveInvoice(subscription.getLatestInvoice());
        order.setStripeCustomerId(session.getCustomer());
        BaitlySubscriptionBilling.verifyInvoice(order,invoice,subscription);
        Instant paidUntil=BaitlySubscriptionBilling.paidPeriodEnd(invoice);
        require(paidUntil!=null && paidUntil.isAfter(Instant.now()),"La période payée est terminée");
        write.executeWithoutResult(status->{
            var locked=orders.lockById(order.getId()).orElseThrow();
            if(locked.getOrganizationId()!=null)return;
            require(Set.of("PREPARED","CHECKOUT_OPEN","PAID_AWAITING_ACCOUNT").contains(locked.getStatus())
                    && (locked.getCheckoutSessionId()==null || sessionId.equals(locked.getCheckoutSessionId())),"Inscription à rapprocher");
            if(!"PAID_AWAITING_ACCOUNT".equals(locked.getStatus()) && locked.getPromoCodeId()!=null) {
                var promo=promos.lockByCode(locked.getPromoCode()).orElseThrow();promo.setUsedCount(Math.addExact(promo.getUsedCount(),1));promos.save(promo);
            }
            locked.setCheckoutSessionId(sessionId);locked.setStripeCustomerId(session.getCustomer());locked.setStripeSubscriptionId(subscription.getId());locked.setStripeScheduleId(schedule);
            locked.setPaidUntil(paidUntil);locked.setLastInvoiceId(invoice.getId());locked.setStatus("PAID_AWAITING_ACCOUNT");orders.save(locked);
            var pending=signups.lockById(order.getSignupId()).orElseThrow();pending.setStripeSessionId(sessionId);pending.setStripeCustomerId(session.getCustomer());pending.setStripeSubscriptionId(subscription.getId());signups.save(pending);
        });
        return true;
    }
    @Transactional(propagation=Propagation.MANDATORY)
    public void requireReadyToProvision(PendingInscription pending) {
        if(pending.getRequestId()==null)return;
        var order=orders.findBySignupId(pending.getId()).orElseThrow(()->new IllegalStateException("Contrat d'inscription absent"));
        require("PAID_AWAITING_ACCOUNT".equals(order.getStatus()) && order.getOrganizationId()==null
                && order.getPaidUntil()!=null && order.getPaidUntil().isAfter(Instant.now())
                && Objects.equals(order.getStripeSubscriptionId(),pending.getStripeSubscriptionId()),"Paiement d'inscription à rapprocher");
    }
    @Transactional(propagation=Propagation.MANDATORY)
    public void bind(PendingInscription pending,User user,Organization organization) {
        var known=orders.findBySignupId(pending.getId());if(known.isEmpty())return;
        var order=orders.lockById(known.get().getId()).orElseThrow();
        require(order.getOrganizationId()==null && "PAID_AWAITING_ACCOUNT".equals(order.getStatus())
                && order.getPaidUntil()!=null && order.getPaidUntil().isAfter(Instant.now())
                && Objects.equals(order.getStripeSubscriptionId(),pending.getStripeSubscriptionId()),"Paiement d'inscription à rapprocher");
        order.setOrganizationId(organization.getId());order.setPayerUserId(user.getId());order.setStatus("ACTIVE");
        organization.setBillingCountry(order.getBillingCountry()!=null?order.getBillingCountry():BaitlyBillingCountry.normalize(pending.getBillingCountry()));
        order.setActivatedAt(LocalDateTime.now(Clock.systemUTC()));orders.save(order);
    }
    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    public void expire(String sessionId) throws StripeException {
        var known=orders.findByCheckoutSessionId(sessionId);
        Session session=stripe.retrieveSession(sessionId);
        if(known.isEmpty())known=unattached(session);
        if(known.isEmpty() || known.get().getSignupId()==null)return;
        stripe.verifySubscriptionSeller(known.get().getSellerCountry(),known.get().getSellerStripeAccountId());
        if("open".equals(session.getStatus()))session=stripe.expireSession(session,"BAITLY-SIGNUP-EXPIRE-"+known.get().getId());
        require("expired".equals(session.getStatus()),"Le paiement doit être rapproché avant libération de la promotion");
        final Long orderId=known.get().getId();
        write.executeWithoutResult(status->{
            var order=orders.lockById(orderId).orElseThrow();
            if(!Set.of("PREPARED","CHECKOUT_OPEN").contains(order.getStatus()))return;
            require(order.getCheckoutSessionId()==null || sessionId.equals(order.getCheckoutSessionId()),"Autre paiement en cours");
            order.setCheckoutSessionId(sessionId);order.setStatus("EXPIRED");orders.save(order);
            var pending=signups.lockById(order.getSignupId()).orElseThrow();pending.setStripeSessionId(sessionId);pending.setStatus(PendingInscriptionStatus.EXPIRED);signups.save(pending);
        });
    }
    /** Récupère une réponse Stripe perdue après création, uniquement à partir de l'objet relu par l'API. */
    private Optional<BaitlySubscriptionOrder> unattached(Session session) {
        if(session==null || session.getMetadata()==null || !"inscription".equals(session.getMetadata().get("type"))
                || !session.getMetadata().containsKey("baitly_order_id"))return Optional.empty();
        var order=orders.findById(Long.valueOf(session.getMetadata().get("baitly_order_id"))).orElseThrow();
        require(order.getSignupId()!=null && order.getCheckoutSessionId()==null && "PREPARED".equals(order.getStatus())
                && String.valueOf(order.getSignupId()).equals(session.getMetadata().get("signupId"))
                && order.getPriceVersion().equals(session.getMetadata().get("priceVersion"))
                && order.getCurrency().equalsIgnoreCase(session.getCurrency())
                && Objects.equals(order.firstRegularCents(),session.getAmountSubtotal()),"Session d'inscription étrangère à la commande");
        return Optional.of(order);
    }
    private PendingInscription copy(InscriptionDto dto,String email) {
        var type=dto.getOrganizationTypeEnum();require(type!=OrganizationType.SYSTEM,"Type d'organisation non autorisé");
        require(type==OrganizationType.INDIVIDUAL || dto.getCompanyName()!=null && !dto.getCompanyName().isBlank(),"Nom de société requis");
        var pending=new PendingInscription();pending.setRequestId(dto.getRequestId());pending.setRequestFingerprint(fingerprint(dto));
        pending.setBillingCountry(dto.getBillingCountry());pending.setEmail(email);pending.setFirstName(dto.getFirstName());pending.setLastName(dto.getLastName());
        pending.setPhoneNumber(dto.getPhone());pending.setCompanyName(dto.getCompanyName());pending.setOrganizationType(type.name());
        pending.setForfait("pro".equals(dto.getForfait())?"premium":"essentiel");pending.setCity(dto.getCity());pending.setPostalCode(dto.getPostalCode());
        pending.setPropertyType(dto.getPropertyType());pending.setPropertyCount(dto.getPropertyCount());pending.setSurface(dto.getSurface());pending.setGuestCapacity(dto.getGuestCapacity());
        pending.setBookingFrequency(dto.getBookingFrequency());pending.setCleaningSchedule(dto.getCleaningSchedule());pending.setCalendarSync(dto.getCalendarSync());
        if(dto.getServices()!=null)pending.setServices(String.join(",",dto.getServices()));
        if(dto.getServicesDevis()!=null)pending.setServicesDevis(String.join(",",dto.getServicesDevis()));
        pending.setAcceptedTermsAt(LocalDateTime.now(Clock.systemUTC()));pending.setNewsletterOptIn(dto.isNewsletterOptIn());
        pending.setPromoCode(dto.getPromoCode());pending.setReferralSource(dto.getReferralSource());pending.setBillingPeriod("MONTHLY");
        pending.setExpiresAt(LocalDateTime.now(Clock.systemUTC()).plusHours(24));return pending;
    }
    private String fingerprint(InscriptionDto dto) {
        try {
            var fields=json.convertValue(dto,new com.fasterxml.jackson.core.type.TypeReference<TreeMap<String,Object>>(){});
            fields.remove("password");
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json.writeValueAsBytes(fields)));
        } catch(Exception failure){throw new IllegalArgumentException("Demande d'inscription invalide",failure);}
    }
    private static void require(boolean valid,String message){if(!valid)throw new IllegalStateException(message);}
}
