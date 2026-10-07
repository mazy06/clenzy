package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.payment.StripeGateway;
import com.clenzy.tenant.TenantContext;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.LocalDateTime;
import java.util.*;
import static com.clenzy.service.BaitlyMonthlyPricing.*;

/** Contrat mensuel explicite, figé avant Checkout. Aucun appel PSP sous verrou de base. */
@Service
public class BaitlyMonthlySubscriptionService {
    public static final String TYPE="baitly_monthly_subscription";
    private final BaitlySubscriptionOrderRepository orders;
    private final OrganizationRepository organizations;
    private final OrganizationMemberRepository members;
    private final OrganizationService access;
    private final UserRepository users;
    private final PropertyRepository properties;
    private final TenantContext tenant;
    private final BaitlyMonthlyPricing pricing;
    private final StripeGateway stripe;
    private final BaitlySubscriptionSchedule schedules;
    private final PlatformPromoCodeRepository promos;
    private final BaitlySubscriptionInvoiceRepository invoices;
    private final TransactionTemplate write;
    @Value("${FRONTEND_URL:http://localhost:3000}") private String frontendUrl;
    @Value("${stripe.tax.saas-product-tax-code:txcd_10103001}") private String taxCode;

    public BaitlyMonthlySubscriptionService(BaitlySubscriptionOrderRepository orders,OrganizationRepository organizations,
            OrganizationMemberRepository members,OrganizationService access,UserRepository users,PropertyRepository properties,
            TenantContext tenant,BaitlyMonthlyPricing pricing,StripeGateway stripe,
            BaitlySubscriptionSchedule schedules,PlatformPromoCodeRepository promos,BaitlySubscriptionInvoiceRepository invoices,PlatformTransactionManager transactionManager) {
        this.orders=orders;this.organizations=organizations;this.members=members;this.access=access;this.users=users;
        this.properties=properties;this.tenant=tenant;this.pricing=pricing;this.stripe=stripe;
        this.schedules=schedules;this.promos=promos;this.invoices=invoices;this.write=new TransactionTemplate(transactionManager);
    }

    public record Proposal(List<Quote> phases,long propertyCount,String previousPlan,long firstInvoiceExcludingTaxCents,String promoCode,int subscriptionMonth,String billingCountry,String sellerCountry) {}
    @Transactional(readOnly=true)
    public Proposal proposal(String subject,Plan plan,String promoCode) {
        Long org=tenant.getRequiredOrganizationId(); access.validateOrgManagement(subject,org);
        var organization=organizations.findById(org).orElseThrow();
        long count=properties.countByOrganizationId(org);
        int billable=Math.toIntExact(Math.max(1,count));
        String country=BaitlyBillingCountry.normalize(organization.getBillingCountry());
        Market market=marketForCountry(country);
        var phases=List.of(pricing.quote(plan,market,billable,1),pricing.quote(plan,market,billable,4),
                pricing.quote(plan,market,billable,7),pricing.quote(plan,market,billable,13));
        var promo=promoCode==null || promoCode.isBlank()?null:promos.findByCodeIgnoreCase(promoCode.trim())
                .orElseThrow(()->new IllegalArgumentException("Code promotionnel inconnu"));
        var tenure=tenure(organization);
        long first=pricing.quote(plan,market,billable,tenure.month()).totalCents();
        if(promo!=null) {validatePromo(promo,phases.getFirst().currency());first=promo.applyTo(Math.toIntExact(first));}
        return new Proposal(phases,count,organization.getForfait(),first,promo==null?null:promo.getCode(),tenure.month(),country,BaitlyBillingCountry.sellerCountry(country));
    }

    public record BillingCountry(String billingCountry,String sellerCountry) {}
    @Transactional(readOnly=true)
    public BillingCountry billingCountry(String subject) {
        Long org=tenant.getRequiredOrganizationId();access.validateOrgManagement(subject,org);
        String country=organizations.findById(org).orElseThrow().getBillingCountry();
        return new BillingCountry(country,country==null?null:BaitlyBillingCountry.sellerCountry(country));
    }
    @Transactional
    public BillingCountry updateBillingCountry(String subject,String country) {
        Long org=tenant.getRequiredOrganizationId();access.validateOrgManagement(subject,org);
        var organization=organizations.lockById(org).orElseThrow();
        country=BaitlyBillingCountry.normalize(country);
        if(!Objects.equals(country,organization.getBillingCountry())) {
            restorePrimarySubscription(organization);
            require(organization.getStripeSubscriptionId()==null && orders.findByOrganizationIdOrderByCreatedAtDesc(org).stream()
                    .noneMatch(o->!Set.of("EXPIRED","CANCELLED").contains(o.getStatus())),
                    "Un contrat existe : le changement de pays nécessite une migration de facturation, pas une modification du profil fiscal");
            organization.setBillingCountry(country);organizations.save(organization);
        }
        return new BillingCountry(country,BaitlyBillingCountry.sellerCountry(country));
    }

    private record Prepared(Long id,Long org,String email,String customer,String currency,String plan,int count,long amount,long firstInvoice,String url,String session) {}
    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    public Map<String,String> checkout(String subject,Plan plan,UUID requestId,String promoCode) throws StripeException {
        if(requestId==null)throw new IllegalArgumentException("Identifiant de commande requis");
        var billing=billingCountry(subject);
        String country=BaitlyBillingCountry.normalize(billing.billingCountry());
        String seller=BaitlyBillingCountry.sellerCountry(country);
        String account=stripe.requireSubscriptionSellerCountry(seller);
        stripe.requireSubscriptionTaxReady();
        var prepared=write.execute(status->{
            Long org=tenant.getRequiredOrganizationId();access.validateOrgManagement(subject,org);
            var organization=organizations.lockById(org).orElseThrow();
            require(country.equals(organization.getBillingCountry()),"Le pays de facturation a changé : actualisez la proposition");
            restorePrimarySubscription(organization);
            var caller=users.findByKeycloakId(subject).orElseThrow();
            var existing=orders.findByOrganizationIdAndRequestId(org,requestId);
            BaitlySubscriptionOrder order;
            if(existing.isPresent()) {
                order=existing.get();
                require(order.getBillingCountry()==null || country.equals(order.getBillingCountry()),"Cette tentative correspond à un autre pays de facturation");
                require(order.getSellerStripeAccountId()==null || account.equals(order.getSellerStripeAccountId()),"Autre compte de paiement : commande à rapprocher");
                require(order.getPlan().equals(plan.name()),"Cette tentative correspond à une autre formule");
                require(Objects.equals(order.getPromoCode(),normalizePromo(promoCode)),"Cette tentative correspond à une autre promotion");
                require(Set.of("PREPARED","CHECKOUT_OPEN").contains(order.getStatus()),"Cette commande est déjà terminée");
                require(order.getCheckoutSessionId()!=null || order.getCreatedAt().plusHours(23).isAfter(LocalDateTime.now(java.time.Clock.systemUTC())),
                        "Cette tentative ancienne doit être rapprochée avant une nouvelle émission");
            } else {
                require(organization.getStripeSubscriptionId()==null,"Un abonnement existe : programmez le changement à son renouvellement");
                var proposal=proposal(subject,plan,promoCode);
                require(orders.findByOrganizationIdOrderByCreatedAtDesc(org).stream()
                        .noneMatch(o->Set.of("PREPARED","CHECKOUT_OPEN","ACTIVATING").contains(o.getStatus())),
                        "Un changement d'abonnement est déjà en cours");
                Quote first=proposal.phases().getFirst(); order=new BaitlySubscriptionOrder();
                if(organization.getStripeSubscriptionId()!=null)orders.findByStripeSubscriptionId(organization.getStripeSubscriptionId()).ifPresent(current->{
                    require(!Set.of("ACTIVE","PAST_DUE").contains(current.getStatus()) || !current.getPlan().equals(plan.name())
                            || current.getProperties()!=first.properties() || !current.getPriceVersion().equals(first.version()),
                            "Cette formule est déjà en place. Consultez ses échéances avant un nouveau paiement");
                });
                order.setOrganizationId(org);order.setPayerUserId(caller.getId());order.setRequestId(requestId);
                order.setBillingCountry(country);order.setSellerCountry(seller);order.setSellerStripeAccountId(account);
                order.setPlan(plan.name());order.setMarket(first.market().name());order.setCurrency(first.currency());
                order.setProperties(first.properties());order.setPriceVersion(first.version());
                order.setMonthOneCents(first.totalCents());order.setMonthFourCents(proposal.phases().get(1).totalCents());
                order.setMonthSevenCents(proposal.phases().get(2).totalCents());order.setMonthThirteenCents(proposal.phases().get(3).totalCents());
                var tenure=tenure(organization);order.setSubscriptionMonth(tenure.month());order.setLoyaltyStartedAt(tenure.start());
                order.setFirstInvoiceCents(order.firstRegularCents());
                if(proposal.promoCode()!=null) {
                    var promo=promos.lockByCode(proposal.promoCode()).orElseThrow();
                    validatePromo(promo,first.currency());
                    long reserved=orders.countByPromoCodeIdAndStatusIn(promo.getId(),List.of("PREPARED","CHECKOUT_OPEN","ACTIVATING"));
                    require(promo.getMaxUses()==null || promo.getUsedCount()+reserved<promo.getMaxUses(),"Quota promotionnel épuisé");
                    order.setPromoCodeId(promo.getId());order.setPromoCode(promo.getCode());
                    order.setFirstInvoiceCents(promo.applyTo(Math.toIntExact(order.firstRegularCents())));
                }
                order.setPreviousSubscriptionId(organization.getStripeSubscriptionId());order.setStripeCustomerId(organization.getStripeCustomerId());
                orders.saveAndFlush(order);
            }
            return new Prepared(order.getId(),org,caller.getEmail(),order.getStripeCustomerId(),order.getCurrency(),order.getPlan(),
                    order.getProperties(),order.firstRegularCents(),order.getFirstInvoiceCents(),order.getCheckoutUrl(),order.getCheckoutSessionId());
        });
        if(prepared.url()!=null)return Map.of("checkoutUrl",prepared.url(),"sessionId",prepared.session());
        var metadata=Map.of("type",TYPE,"baitly_order_id",String.valueOf(prepared.id()),"orgId",String.valueOf(prepared.org()),"priceVersion",VERSION);
        var parameters=SessionCreateParams.builder().setIntegrationIdentifier(StripeGateway.CHECKOUT_INTEGRATION_ID)
                .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
                .setSuccessUrl(frontendUrl+"/settings?tab=subscription&subscription=return")
                .setCancelUrl(frontendUrl+"/settings?tab=subscription&subscription=cancelled")
                .setAutomaticTax(SessionCreateParams.AutomaticTax.builder().setEnabled(true).build())
                .setBillingAddressCollection(SessionCreateParams.BillingAddressCollection.REQUIRED)
                .setTaxIdCollection(SessionCreateParams.TaxIdCollection.builder().setEnabled(true).build())
                .putAllMetadata(metadata).setSubscriptionData(SessionCreateParams.SubscriptionData.builder().putAllMetadata(metadata).build())
                .addLineItem(SessionCreateParams.LineItem.builder().setQuantity(1L)
                        .setPriceData(SessionCreateParams.LineItem.PriceData.builder().setCurrency(prepared.currency().toLowerCase(Locale.ROOT))
                                .setUnitAmount(prepared.amount()).setTaxBehavior(SessionCreateParams.LineItem.PriceData.TaxBehavior.EXCLUSIVE)
                                .setRecurring(SessionCreateParams.LineItem.PriceData.Recurring.builder()
                                        .setInterval(SessionCreateParams.LineItem.PriceData.Recurring.Interval.MONTH).build())
                                .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                        .setName("Baitly "+prepared.plan()+" · "+prepared.count()+" logement(s)")
                                        .setTaxCode(taxCode)
                                        .setDescription("Mensuel : fidélité de 10 % dès le mois 4, 20 % dès le mois 7, 30 % dès le mois 13. Remise volume incluse.").build()).build()).build());
        if(prepared.customer()!=null)parameters.setCustomer(prepared.customer()).setCustomerUpdate(SessionCreateParams.CustomerUpdate.builder()
                .setAddress(SessionCreateParams.CustomerUpdate.Address.AUTO).setName(SessionCreateParams.CustomerUpdate.Name.AUTO).build());
        else parameters.setCustomerEmail(prepared.email());
        if(prepared.firstInvoice()<prepared.amount()) {
            var coupon=stripe.createCoupon(com.stripe.param.CouponCreateParams.builder()
                    .setName("Baitly · remise de première échéance")
                    .setDuration(com.stripe.param.CouponCreateParams.Duration.ONCE)
                    .setAmountOff(prepared.amount()-prepared.firstInvoice()).setCurrency(prepared.currency().toLowerCase(Locale.ROOT)).build(),
                    "BAITLY-MONTHLY-COUPON-"+prepared.id());
            parameters.addDiscount(SessionCreateParams.Discount.builder().setCoupon(coupon.getId()).build());
        }
        Session session=stripe.createSession(parameters.build(),"BAITLY-MONTHLY-"+prepared.id());
        write.executeWithoutResult(status->{
            var order=orders.lockByIdAndOrganizationId(prepared.id(),prepared.org()).orElseThrow();
            require(order.getCheckoutSessionId()==null || order.getCheckoutSessionId().equals(session.getId()),"Session concurrente incompatible");
            if(!Set.of("PREPARED","CHECKOUT_OPEN").contains(order.getStatus()))return;
            order.setCheckoutSessionId(session.getId());order.setCheckoutUrl(session.getUrl());order.setStatus("CHECKOUT_OPEN");orders.save(order);
        });
        return Map.of("checkoutUrl",session.getUrl(),"sessionId",session.getId());
    }

    /** Le webhook relit une preuve canonique avant d'installer les remises et remplacer l'ancien abonnement. */
    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    public void complete(String sessionId) throws StripeException {
        Session session=stripe.retrieveSession(sessionId);
        BaitlySubscriptionOrder order=orders.findByCheckoutSessionId(sessionId)
                .orElseThrow(()->new IllegalStateException("Contrat mensuel à rapprocher"));
        verify(order,session);
        stripe.verifySubscriptionSeller(order.getSellerCountry(),order.getSellerStripeAccountId());
        if("ACTIVE".equals(order.getStatus()))return;
        require(Set.of("CHECKOUT_OPEN","ACTIVATING").contains(order.getStatus()),"Contrat mensuel non activable");
        var subscription=stripe.retrieveSubscription(session.getSubscription());
        require(session.getCustomer().equals(subscription.getCustomer()) && "active".equals(subscription.getStatus()),"Abonnement Stripe non actif");
        String schedule=schedules.install(order,subscription);
        write.executeWithoutResult(status->{
            var locked=orders.lockByIdAndOrganizationId(order.getId(),order.getOrganizationId()).orElseThrow();
            if("ACTIVE".equals(locked.getStatus()))return;
            var org=organizations.lockById(order.getOrganizationId()).orElseThrow();
            require(Objects.equals(org.getStripeSubscriptionId(),order.getPreviousSubscriptionId()),"Un autre contrat a remplacé cet abonnement");
            locked.setStatus("ACTIVATING");locked.setStripeSubscriptionId(session.getSubscription());locked.setStripeScheduleId(schedule);orders.save(locked);
        });
        if(order.getPreviousSubscriptionId()!=null && !order.getPreviousSubscriptionId().equals(session.getSubscription())) {
            var previous=stripe.retrieveSubscription(order.getPreviousSubscriptionId());
            require(session.getCustomer().equals(previous.getCustomer()),"Ancien abonnement appartenant à un autre client");
            if(!"canceled".equals(previous.getStatus()))stripe.cancelSubscription(previous,
                    com.stripe.param.SubscriptionCancelParams.builder().setProrate(true).build());
        }
        write.executeWithoutResult(status->{
            var locked=orders.lockByIdAndOrganizationId(order.getId(),order.getOrganizationId()).orElseThrow();
            if("ACTIVE".equals(locked.getStatus()))return;
            var org=organizations.lockById(order.getOrganizationId()).orElseThrow();
            require(Objects.equals(org.getStripeSubscriptionId(),order.getPreviousSubscriptionId()),"Contrat concurrent à rapprocher");
            String entitlement="pro".equals(order.getPlan())?"premium":"essentiel";
            org.setForfait(entitlement);org.setBillingPeriod("MONTHLY");org.setStripeCustomerId(session.getCustomer());org.setStripeSubscriptionId(session.getSubscription());organizations.save(org);
            // Compatibilité legacy limitée au rattachement principal : ne pas modifier les droits d'une autre organisation.
            for(var member:members.findByOrganizationIdWithUser(org.getId())) {
                var user=member.getUser();
                if(!Objects.equals(user.getOrganizationId(),org.getId()))continue;
                user.setForfait(entitlement);user.setBillingPeriod("MONTHLY");
                if(member.isOwner()){user.setStripeCustomerId(session.getCustomer());user.setStripeSubscriptionId(session.getSubscription());}
                users.save(user);
            }
            locked.setStatus("ACTIVE");locked.setStripeCustomerId(session.getCustomer());locked.setActivatedAt(LocalDateTime.now());orders.save(locked);
            if(locked.getPromoCodeId()!=null) {
                var promo=promos.lockByCode(locked.getPromoCode()).orElseThrow();
                // La validité a été acquise à la réservation ; une expiration entre-temps ne retire pas la remise payée.
                promo.setUsedCount(Math.addExact(promo.getUsedCount(),1));promos.save(promo);
            }
        });
    }

    static void verify(BaitlySubscriptionOrder order,Session session) {
        if(order.getBillingCountry()!=null)require(session.getCustomerDetails()!=null && session.getCustomerDetails().getAddress()!=null
                && order.getBillingCountry().equalsIgnoreCase(session.getCustomerDetails().getAddress().getCountry()),
                "Le pays de facturation a changé : paiement à rapprocher avant activation");
        if(order.getMarket()!=null)require(session.getCustomerDetails()!=null && session.getCustomerDetails().getAddress()!=null
                && order.getMarket().equals(marketForCountry(session.getCustomerDetails().getAddress().getCountry()).name()),
                "Le pays de facturation ne correspond pas au tarif souscrit : paiement à rapprocher");
        var meta=session.getMetadata();
        long discount=order.firstRegularCents()-order.getFirstInvoiceCents();
        long tax=session.getTotalDetails()==null || session.getTotalDetails().getAmountTax()==null?0:session.getTotalDetails().getAmountTax();
        long observedDiscount=session.getTotalDetails()==null || session.getTotalDetails().getAmountDiscount()==null?0:session.getTotalDetails().getAmountDiscount();
        require("complete".equals(session.getStatus()) && ("paid".equals(session.getPaymentStatus())
                || (order.getFirstInvoiceCents()==0 && "no_payment_required".equals(session.getPaymentStatus())))
                && "subscription".equals(session.getMode()) && session.getSubscription()!=null && session.getCustomer()!=null
                && (Objects.equals(order.getCheckoutSessionId(),session.getId())
                    || order.getCheckoutSessionId()==null && order.getSignupId()!=null && "PREPARED".equals(order.getStatus()))
                && Objects.equals(order.firstRegularCents(),session.getAmountSubtotal())
                && observedDiscount==discount && tax>=0
                && Objects.equals(Math.addExact(order.getFirstInvoiceCents(),tax),session.getAmountTotal())
                && session.getAutomaticTax()!=null && Boolean.TRUE.equals(session.getAutomaticTax().getEnabled())
                && "complete".equals(session.getAutomaticTax().getStatus())
                && order.getCurrency().equalsIgnoreCase(session.getCurrency()) && meta!=null
                && (order.getSignupId()==null ? TYPE.equals(meta.get("type")) && String.valueOf(order.getOrganizationId()).equals(meta.get("orgId"))
                    : "inscription".equals(meta.get("type")) && String.valueOf(order.getSignupId()).equals(meta.get("signupId")))
                && String.valueOf(order.getId()).equals(meta.get("baitly_order_id"))
                && order.getPriceVersion().equals(meta.get("priceVersion"))
                && (order.getStripeCustomerId()==null || order.getStripeCustomerId().equals(session.getCustomer())),
                "La preuve de paiement ne correspond pas au contrat mensuel");
    }
    private static String normalizePromo(String code){return code==null || code.isBlank()?null:code.trim().toUpperCase(Locale.ROOT);}
    private record Tenure(LocalDateTime start,int month) {}
    private Tenure tenure(Organization organization) {
        LocalDateTime now=LocalDateTime.now(java.time.Clock.systemUTC());
        if(organization.getStripeSubscriptionId()!=null) {
            var current=orders.findByStripeSubscriptionId(organization.getStripeSubscriptionId());
            if(current.isPresent() && Set.of("ACTIVE","PAST_DUE").contains(current.get().getStatus())
                    && current.get().getPaidUntil()!=null && current.get().getPaidUntil().isAfter(java.time.Instant.now())) {
                LocalDateTime start=current.get().getLoyaltyStartedAt();
                return new Tenure(start,Math.toIntExact(Math.max(0,java.time.temporal.ChronoUnit.MONTHS.between(start,now))+1));
            }
        }
        return new Tenure(now,1);
    }
    /** Les anciennes inscriptions rattachaient parfois Stripe seulement au propriétaire principal. */
    private void restorePrimarySubscription(Organization organization) {
        if(organization.getStripeSubscriptionId()!=null)return;
        var owners=members.findByOrganizationIdWithUser(organization.getId()).stream()
                .filter(OrganizationMember::isOwner).map(OrganizationMember::getUser)
                .filter(user->Objects.equals(user.getOrganizationId(),organization.getId()) && user.getStripeSubscriptionId()!=null).toList();
        require(owners.size()<=1,"Plusieurs abonnements historiques doivent être rapprochés pour cette organisation");
        if(owners.isEmpty())return;
        var owner=owners.getFirst();require(owner.getStripeCustomerId()!=null,"Client Stripe historique à rapprocher");
        organization.setStripeSubscriptionId(owner.getStripeSubscriptionId());organization.setStripeCustomerId(owner.getStripeCustomerId());organizations.save(organization);
    }
    public record Contract(Long id,UUID requestId,String plan,String status,String currency,int properties,
            long firstInvoiceExcludingTaxCents,long monthOneCents,long monthFourCents,long monthSevenCents,long monthThirteenCents,
            String promoCode,java.time.Instant paidUntil,boolean cancelAtPeriodEnd) {}
    @Transactional(readOnly=true)
    public List<Contract> contracts(String subject) {
        Long org=tenant.getRequiredOrganizationId();access.validateOrgManagement(subject,org);
        return orders.findByOrganizationIdOrderByCreatedAtDesc(org).stream().map(o->new Contract(o.getId(),o.getRequestId(),o.getPlan(),o.getStatus(),o.getCurrency(),o.getProperties(),
                o.getFirstInvoiceCents(),o.getMonthOneCents(),o.getMonthFourCents(),o.getMonthSevenCents(),o.getMonthThirteenCents(),o.getPromoCode(),o.getPaidUntil(),o.isCancelAtPeriodEnd())).toList();
    }

    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    public String refresh(String subject,Long id) throws StripeException {
        var order=owned(subject,id);
        require(order.getCheckoutSessionId()!=null,"Le paiement n'est pas encore préparé");
        Session session=stripe.retrieveSession(order.getCheckoutSessionId());
        if("expired".equals(session.getStatus()))expire(session.getId());
        else if("complete".equals(session.getStatus()) && Set.of("CHECKOUT_OPEN","ACTIVATING").contains(order.getStatus()))complete(session.getId());
        return orders.findByIdAndOrganizationId(id,order.getOrganizationId()).orElseThrow().getStripeSubscriptionId();
    }

    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    public void cancelCheckout(String subject,Long id) throws StripeException {
        var order=owned(subject,id);
        require(Set.of("PREPARED","CHECKOUT_OPEN","EXPIRED").contains(order.getStatus()),"Ce contrat ne peut plus être abandonné");
        if("EXPIRED".equals(order.getStatus()))return;
        // Récupère aussi une création dont la réponse réseau aurait été perdue, via la même clé PSP.
        var result=checkout(subject,Plan.valueOf(order.getPlan()),order.getRequestId(),order.getPromoCode());
        Session session=stripe.retrieveSession(result.get("sessionId"));
        if("open".equals(session.getStatus()))stripe.expireSession(session,"BAITLY-MONTHLY-EXPIRE-"+id);
        expire(session.getId());
    }

    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    public void expire(String sessionId) throws StripeException {
        var session=stripe.retrieveSession(sessionId);
        var order=orders.findByCheckoutSessionId(sessionId).orElseThrow();
        stripe.verifySubscriptionSeller(order.getSellerCountry(),order.getSellerStripeAccountId());
        require("expired".equals(session.getStatus()) && session.getMetadata()!=null
                && TYPE.equals(session.getMetadata().get("type"))
                && String.valueOf(order.getId()).equals(session.getMetadata().get("baitly_order_id")),"Expiration non confirmée");
        write.executeWithoutResult(status->{var locked=orders.lockByIdAndOrganizationId(order.getId(),order.getOrganizationId()).orElseThrow();
            if(Set.of("PREPARED","CHECKOUT_OPEN").contains(locked.getStatus())){locked.setStatus("EXPIRED");orders.save(locked);}});
    }

    BaitlySubscriptionOrder owned(String subject,Long id) {
        Long org=tenant.getRequiredOrganizationId();access.validateOrgManagement(subject,org);
        return orders.findByIdAndOrganizationId(id,org).orElseThrow(()->new org.springframework.security.access.AccessDeniedException("Contrat inaccessible"));
    }
    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    public Map<String,String> paymentPortal(String subject,Long id)throws StripeException {
        var order=owned(subject,id);stripe.verifySubscriptionSeller(order.getSellerCountry(),order.getSellerStripeAccountId());
        require(order.getStripeCustomerId()!=null && order.getStripeSubscriptionId()!=null,"Compte de facturation absent");
        var sub=stripe.retrieveSubscription(order.getStripeSubscriptionId());
        require(Objects.equals(sub.getCustomer(),order.getStripeCustomerId()),"Client de facturation incompatible");
        return Map.of("url",BaitlySubscriptionBilling.stripeUrl(stripe.subscriptionPaymentPortal(order.getStripeCustomerId(),frontendUrl+"/settings?tab=subscription")));
    }
    public record Bill(String id,String status,String currency,long excludingTaxCents,long totalCents,long paidCents,
            long remainingCents,String hostedUrl,String pdfUrl,java.time.Instant issuedAt) {}
    @Transactional(readOnly=true)
    public List<Bill> invoices(String subject) {
        Long org=tenant.getRequiredOrganizationId();access.validateOrgManagement(subject,org);
        return invoices.findByOrganizationIdOrderByIssuedAtDesc(org).stream().map(i->new Bill(i.getInvoiceId(),i.getStatus(),i.getCurrency(),
                i.getExcludingTaxCents(),i.getTotalCents(),i.getPaidCents(),i.getRemainingCents(),i.getHostedUrl(),i.getPdfUrl(),i.getIssuedAt())).toList();
    }
    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    public void cancelAtPeriodEnd(String subject,Long id)throws StripeException {
        var order=owned(subject,id);
        stripe.verifySubscriptionSeller(order.getSellerCountry(),order.getSellerStripeAccountId());
        require(Set.of("ACTIVE","PAST_DUE").contains(order.getStatus()),"Contrat non résiliable dans cet état");
        var subscription=stripe.retrieveSubscription(order.getStripeSubscriptionId());
        require(Objects.equals(order.getStripeCustomerId(),subscription.getCustomer()),"Abonnement Stripe incompatible");
        schedules.cancelAtPeriodEnd(order,subscription);
        write.executeWithoutResult(status->{var locked=orders.lockByIdAndOrganizationId(id,order.getOrganizationId()).orElseThrow();
            locked.setCancelAtPeriodEnd(true);orders.save(locked);});
    }
    static void validatePromo(PlatformPromoCode promo,String currency) {
        require(promo.isUsableAt(LocalDateTime.now(java.time.Clock.systemUTC())),"Code promotionnel expiré ou épuisé");
        if(promo.getDiscountType()==PlatformPromoCode.DiscountType.FIXED)
            require(currency.equalsIgnoreCase(promo.getCurrency()),"Devise du code promotionnel incompatible");
    }
    private static void require(boolean valid,String message){if(!valid)throw new IllegalStateException(message);}
}
