package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.payment.StripeGateway;
import com.clenzy.tenant.TenantContext;
import com.stripe.model.checkout.Session;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.SharedEntityManagerCreator;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.test.util.ReflectionTestUtils;
import liquibase.*;
import liquibase.changelog.DatabaseChangeLog;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import java.sql.DriverManager;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Vraies transactions PostgreSQL : quota partagé, reprise réseau et migration du contrat HT. */
@EnabledIfSystemProperty(named="baitly.test.jdbc",matches="jdbc:postgresql://(localhost|127\\.0\\.0\\.1):.*")
class BaitlyMonthlySubscriptionPostgresTest {
    static String jdbc,user,schema;static SessionFactory factory;static EntityManager em;static JpaTransactionManager manager;
    BaitlySubscriptionOrderRepository orders;PlatformPromoCodeRepository promos;TransactionTemplate tx;
    BaitlyMonthlySubscriptionService service;StripeGateway stripe;ThreadLocal<Long> tenantId=new ThreadLocal<>();
    Map<String,Session> sessions=new ConcurrentHashMap<>();
    @BeforeAll static void database()throws Exception {
        String base=System.getProperty("baitly.test.jdbc");user=System.getProperty("baitly.test.user","postgres");schema="baitly_monthly_"+UUID.randomUUID().toString().replace("-","");
        try(var c=DriverManager.getConnection(base,user,"");var s=c.createStatement()){s.execute("CREATE SCHEMA "+schema);}
        jdbc=base+(base.contains("?")?"&":"?")+"currentSchema="+schema;
        factory=new Configuration().addAnnotatedClass(BaitlySubscriptionOrder.class).addAnnotatedClass(BaitlySubscriptionInvoice.class).addAnnotatedClass(BaitlySubscriptionAmendment.class).addAnnotatedClass(PlatformPromoCode.class).addAnnotatedClass(PendingInscription.class)
                .setProperty("hibernate.connection.url",jdbc).setProperty("hibernate.connection.username",user)
                .setProperty("hibernate.hbm2ddl.auto","create-drop").setProperty("jakarta.persistence.validation.mode","none").buildSessionFactory();
        try(var c=DriverManager.getConnection(jdbc,user,"");var s=c.createStatement()) {
            s.execute("DROP TABLE baitly_subscription_amendments, baitly_subscription_invoices, baitly_subscription_orders");s.execute("ALTER TABLE platform_promo_codes DROP COLUMN currency");
            s.execute("CREATE TABLE organizations(id BIGINT PRIMARY KEY)");s.execute("CREATE TABLE users(id BIGINT PRIMARY KEY)");
            s.execute("CREATE TABLE fiscal_profiles (organization_id BIGINT NOT NULL UNIQUE, country_code VARCHAR(3))");s.execute("INSERT INTO fiscal_profiles VALUES(2,'FR'),(3,'FR')");s.execute("INSERT INTO organizations VALUES(2),(3)");s.execute("INSERT INTO users VALUES(2)");
        }
        for(int pass=0;pass<2;pass++)try(var c=DriverManager.getConnection(jdbc,user,"")) {
            var db=DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));var resources=new ClassLoaderResourceAccessor();
            try(var master=new Liquibase("db/changelog/db.changelog-master.yaml",resources,db)) {
                var selected=new DatabaseChangeLog("db/changelog/db.changelog-master.yaml");
                selected.addChangeSet(master.getDatabaseChangeLog().getChangeSets().stream().filter(cs->cs.getId().equals("0518-monthly-subscription-orders")).findFirst().orElseThrow());
                selected.addChangeSet(master.getDatabaseChangeLog().getChangeSets().stream().filter(cs->cs.getId().equals("0522-signup-monthly-contract")).findFirst().orElseThrow());
                selected.addChangeSet(master.getDatabaseChangeLog().getChangeSets().stream().filter(cs->cs.getId().equals("0523-billing-country-and-fiscal-jurisdictions")).findFirst().orElseThrow());
                selected.addChangeSet(master.getDatabaseChangeLog().getChangeSets().stream().filter(cs->cs.getId().equals("0526-subscription-amendments")).findFirst().orElseThrow());
                new Liquibase(selected,resources,db).update("");
            }
        }
        manager=new JpaTransactionManager(factory);em=SharedEntityManagerCreator.createSharedEntityManager(factory);
    }
    @AfterAll static void close()throws Exception {
        if(factory!=null)factory.close();
        if(jdbc!=null)try(var c=DriverManager.getConnection(jdbc,user,"");var s=c.createStatement()){s.execute("DROP SCHEMA "+schema+" CASCADE");}
    }
    @BeforeEach void setup()throws Exception {
        var repos=new JpaRepositoryFactory(em);orders=repos.getRepository(BaitlySubscriptionOrderRepository.class);promos=repos.getRepository(PlatformPromoCodeRepository.class);tx=new TransactionTemplate(manager);
        tx.executeWithoutResult(status->{em.createQuery("delete from BaitlySubscriptionAmendment").executeUpdate();em.createQuery("delete from BaitlySubscriptionInvoice").executeUpdate();em.createQuery("delete from BaitlySubscriptionOrder").executeUpdate();em.createQuery("delete from PlatformPromoCode").executeUpdate();em.createQuery("delete from PendingInscription").executeUpdate();
            var promo=new PlatformPromoCode();promo.setCode("LAST");promo.setDiscountValue(10);promo.setMaxUses(1);promos.save(promo);});
        var organizations=mock(OrganizationRepository.class);
        when(organizations.findById(anyLong())).thenAnswer(call->Optional.of(organization(call.getArgument(0))));
        when(organizations.lockById(anyLong())).thenAnswer(call->{Long id=call.getArgument(0);em.createNativeQuery("SELECT id FROM organizations WHERE id=:id FOR UPDATE").setParameter("id",id).getSingleResult();return Optional.of(organization(id));});
        var users=mock(UserRepository.class);var payer=new User();payer.setId(2L);payer.setEmail("sandbox@example.invalid");when(users.findByKeycloakId(anyString())).thenReturn(Optional.of(payer));
        var properties=mock(PropertyRepository.class);when(properties.countByOrganizationId(anyLong())).thenReturn(1L);
        var fiscal=mock(FiscalProfileRepository.class);var profile=new FiscalProfile();profile.setCountryCode("FR");when(fiscal.findByOrganizationId(anyLong())).thenReturn(Optional.of(profile));
        var tenant=mock(TenantContext.class);when(tenant.getRequiredOrganizationId()).thenAnswer(call->tenantId.get());
        stripe=mock(StripeGateway.class);when(stripe.requireSubscriptionSellerCountry(anyString())).thenReturn("acct_baitly_fr");
        when(stripe.createCoupon(any(),anyString())).thenAnswer(call->{assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();var coupon=new com.stripe.model.Coupon();coupon.setId("coupon_test");return coupon;});
        when(stripe.createSession(any(),anyString())).thenAnswer(call->{
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            String key=call.getArgument(1);com.stripe.param.checkout.SessionCreateParams parameters=call.getArgument(0);
            return sessions.computeIfAbsent(key,ignored->{var session=new Session();session.setId("cs_test_"+key);session.setClientSecret("secret_"+key);session.setUrl("https://checkout.stripe.com/"+key);session.setMetadata(parameters.getMetadata());session.setStatus("open");return session;});
        });
        when(stripe.retrieveSession(anyString())).thenAnswer(call->sessions.values().stream().filter(s->s.getId().equals(call.getArgument(0))).findFirst().orElseThrow());
        service=new BaitlyMonthlySubscriptionService(orders,organizations,mock(OrganizationMemberRepository.class),mock(OrganizationService.class),users,properties,tenant,new BaitlyMonthlyPricing(),stripe,
                new BaitlySubscriptionSchedule(stripe),promos,repos.getRepository(BaitlySubscriptionInvoiceRepository.class),manager);
        ReflectionTestUtils.setField(service,"frontendUrl","http://localhost:3000");ReflectionTestUtils.setField(service,"taxCode","txcd_10103001");tenantId.set(2L);
    }
    Organization organization(Long id){var org=new Organization();org.setId(id);org.setBillingCountry("FR");return org;}
    @Test void simultaneousOrganizationsCannotReserveTheLastPromoTwice()throws Exception {
        try(var pool=Executors.newFixedThreadPool(2)) {
            var start=new CyclicBarrier(2);List<Future<Boolean>> attempts=new ArrayList<>();
            for(long org:List.of(2L,3L))attempts.add(pool.submit(()->{tenantId.set(org);start.await();try{service.checkout("caller",BaitlyMonthlyPricing.Plan.essential,UUID.randomUUID(),"LAST");return true;}catch(IllegalStateException denied){return false;}finally{tenantId.remove();}}));
            int successes=0;for(var attempt:attempts)if(attempt.get(20,TimeUnit.SECONDS))successes++;
            assertThat(successes).isEqualTo(1);
        }
        tx.executeWithoutResult(status->{assertThat(orders.findAll()).hasSize(1);assertThat(promos.findAll().getFirst().getUsedCount()).isZero();});
    }
    @Test void retriesReuseOnePersistedOrderAndOneStripeSession()throws Exception {
        UUID attempt=UUID.randomUUID();var first=service.checkout("caller",BaitlyMonthlyPricing.Plan.pro,attempt,null);
        assertThat(service.checkout("caller",BaitlyMonthlyPricing.Plan.pro,attempt,null)).isEqualTo(first);
        verify(stripe,times(1)).createSession(any(),anyString());tx.executeWithoutResult(status->assertThat(orders.findAll()).hasSize(1));
    }
    @Test void expirationReleasesReservedPromoAndLegacyConsumptionCannotStealIt()throws Exception {
        var result=service.checkout("caller",BaitlyMonthlyPricing.Plan.essential,UUID.randomUUID(),"LAST");
        Long promoId=tx.execute(status->promos.findAll().getFirst().getId());
        Integer reservedResult=tx.execute(status->promos.tryIncrementUsedCount(promoId));
        assertThat(reservedResult).isZero();
        stripe.retrieveSession(result.get("sessionId")).setStatus("expired");service.expire(result.get("sessionId"));
        Integer releasedResult=tx.execute(status->promos.tryIncrementUsedCount(promoId));
        assertThat(releasedResult).isEqualTo(1);
        tx.executeWithoutResult(status->assertThat(orders.findAll().getFirst().getStatus()).isEqualTo("EXPIRED"));
    }

    BaitlySignupCheckout signup() {
        var repos=new JpaRepositoryFactory(em);
        var service=new BaitlySignupCheckout(repos.getRepository(PendingInscriptionRepository.class),orders,promos,mock(UserRepository.class),
                new BaitlyMonthlyPricing(),stripe,mock(BaitlySubscriptionSchedule.class),new com.fasterxml.jackson.databind.ObjectMapper(),manager);
        ReflectionTestUtils.setField(service,"returnUrl","http://localhost:3000/inscription/success");ReflectionTestUtils.setField(service,"taxCode","txcd_10103001");return service;
    }
    com.clenzy.dto.InscriptionDto signupRequest(String email) {
        var dto=new com.clenzy.dto.InscriptionDto();dto.setRequestId(UUID.randomUUID());dto.setEmail(email);dto.setFullName("Jean Test");
        dto.setAcceptedTerms(true);dto.setBillingCountry("FR");dto.setForfait("essential");dto.setPropertyCount(5);return dto;
    }
    @Test void publicSignupUsesVolumeNetPriceAndTaxesInsteadOfLegacyAnnualPricing()throws Exception {
        var dto=signupRequest("new@example.invalid");var result=signup().start(dto);
        assertThat(result.get("monthlyPriceCents")).isEqualTo(14210L);
        var capture=org.mockito.ArgumentCaptor.forClass(com.stripe.param.checkout.SessionCreateParams.class);
        verify(stripe).createSession(capture.capture(),startsWith("BAITLY-SIGNUP-"));
        assertThat(capture.getValue().getAutomaticTax().getEnabled()).isTrue();
        assertThat(capture.getValue().getLineItems().getFirst().getPriceData().getTaxBehavior().getValue()).isEqualTo("exclusive");
        assertThat(capture.getValue().getLineItems().getFirst().getPriceData().getRecurring().getInterval().getValue()).isEqualTo("month");
        dto.setBillingPeriod("ANNUAL");assertThatThrownBy(()->signup().start(dto)).hasMessageContaining("mensuelle");
    }
    @Test void networkFailureKeepsIntentAndRetryUsesSameStripeIdempotencyKey()throws Exception {
        var dto=signupRequest("retry@example.invalid");var signup=signup();
        var original=stripe.createSession(com.stripe.param.checkout.SessionCreateParams.builder().putMetadata("probe","1").build(),"probe");
        clearInvocations(stripe);sessions.clear();
        doThrow(new IllegalStateException("network")).when(stripe).createSession(any(),startsWith("BAITLY-SIGNUP-"));
        assertThatThrownBy(()->signup.start(dto)).hasMessage("network");
        var order=tx.execute(status->orders.findAll().getFirst());assertThat(order.getStatus()).isEqualTo("PREPARED");
        original.setId("cs_retried");doReturn(original).when(stripe).createSession(any(),eq("BAITLY-SIGNUP-"+order.getId()));
        signup.start(dto);
        verify(stripe,times(2)).createSession(any(),eq("BAITLY-SIGNUP-"+order.getId()));
        tx.executeWithoutResult(status->assertThat(orders.findAll()).hasSize(1));
    }
    @Test void changedSignupPayloadCannotReuseAnExistingCheckoutAndAnotherRequestCannotDeleteIt()throws Exception {
        var signup=signup();var dto=signupRequest("same@example.invalid");signup.start(dto);
        dto.setPropertyCount(8);assertThatThrownBy(()->signup.start(dto)).hasMessageContaining("autre demande");
        dto.setRequestId(UUID.randomUUID());assertThatThrownBy(()->signup.start(dto)).hasMessageContaining("Reprenez");
        tx.executeWithoutResult(status->assertThat(orders.findAll()).hasSize(1));verify(stripe,times(1)).createSession(any(),anyString());
    }
    @Test void publicSignupAndAuthenticatedCheckoutShareOnePromotionQuota()throws Exception {
        var dto=signupRequest("promo@example.invalid");dto.setPromoCode("LAST");signup().start(dto);
        assertThatThrownBy(()->service.checkout("caller",BaitlyMonthlyPricing.Plan.essential,UUID.randomUUID(),"LAST")).hasMessageContaining("Quota");
        tx.executeWithoutResult(status->{assertThat(orders.findAll()).hasSize(1);assertThat(promos.findAll().getFirst().getUsedCount()).isZero();});
    }
    @Test void signupQuotaReleasesOnlyAfterCanonicalExpirationAndKeepsAudit()throws Exception {
        var signup=signup();var dto=signupRequest("expire@example.invalid");dto.setPromoCode("LAST");var result=signup.start(dto);
        String id=(String)result.get("sessionId");Session session=stripe.retrieveSession(id);session.setStatus("complete");
        assertThatThrownBy(()->signup.expire(id)).hasMessageContaining("rapproché");
        session.setStatus("expired");signup.expire(id);signup.expire(id);
        tx.executeWithoutResult(status->{assertThat(orders.findAll().getFirst().getStatus()).isEqualTo("EXPIRED");
            assertThat(new JpaRepositoryFactory(em).getRepository(PendingInscriptionRepository.class).findAll()).hasSize(1);});
        assertThatCode(()->service.checkout("caller",BaitlyMonthlyPricing.Plan.essential,UUID.randomUUID(),"LAST")).doesNotThrowAnyException();
    }
    @Test void incompleteTaxConfigurationCannotCreateSignupOrConsumePromotion()throws Exception {
        doThrow(new IllegalStateException("Stripe Tax")).when(stripe).requireSubscriptionTaxReady();
        assertThatThrownBy(()->signup().start(signupRequest("tax@example.invalid"))).hasMessageContaining("Stripe Tax");
        tx.executeWithoutResult(status->assertThat(orders.findAll()).isEmpty());verify(stripe,never()).createSession(any(),anyString());
    }
    @Test void fiscalCountryDoesNotMoveTheOrganizationsBillingCountry() {
        tx.executeWithoutResult(status->{
            em.createNativeQuery("INSERT INTO fiscal_profiles(organization_id,country_code,primary_profile) VALUES(2,'MA',false)").executeUpdate();
            assertThat(em.createNativeQuery("SELECT billing_country FROM organizations WHERE id=2").getSingleResult()).isEqualTo("FR");
            assertThat(em.createNativeQuery("SELECT count(*) FROM fiscal_profiles WHERE organization_id=2").getSingleResult()).isEqualTo(2L);
        });
        var proposal=service.proposal("caller",BaitlyMonthlyPricing.Plan.essential,null);
        assertThat(proposal.billingCountry()).isEqualTo("FR");assertThat(proposal.sellerCountry()).isEqualTo("FR");
        assertThat(proposal.phases().getFirst().currency()).isEqualTo("EUR");
        tx.executeWithoutResult(status->em.createNativeQuery("DELETE FROM fiscal_profiles WHERE organization_id=2 AND country_code='MA'").executeUpdate());
    }
    @Test void differentOperatingCompanyCannotUseTheDefaultPsp()throws Exception {
        doThrow(new IllegalStateException("Société à raccorder")).when(stripe).requireSubscriptionSellerCountry("FR");
        assertThatThrownBy(()->service.checkout("caller",BaitlyMonthlyPricing.Plan.essential,UUID.randomUUID(),null)).hasMessageContaining("raccorder");
        tx.executeWithoutResult(status->assertThat(orders.findAll()).isEmpty());verify(stripe,never()).createSession(any(),anyString());
    }
    @Test void historicalOwnerSubscriptionAlsoPreventsChangingBillingCountry() {
        var owner=new User();owner.setOrganizationId(2L);owner.setStripeSubscriptionId("sub_legacy");owner.setStripeCustomerId("cus_legacy");
        var member=mock(OrganizationMember.class);when(member.isOwner()).thenReturn(true);when(member.getUser()).thenReturn(owner);
        var members=(OrganizationMemberRepository)ReflectionTestUtils.getField(service,"members");
        when(members.findByOrganizationIdWithUser(2L)).thenReturn(List.of(member));
        assertThatThrownBy(()->tx.execute(status->service.updateBillingCountry("caller","MA"))).hasMessageContaining("migration de facturation");
        verifyNoInteractions(stripe);
    }

    record AmendmentFixture(BaitlySubscriptionOrder order,BaitlySubscriptionAmendments changes,com.stripe.model.Subscription sub,com.stripe.model.SubscriptionSchedule schedule) {}
    AmendmentFixture amendmentFixture()throws Exception {
        var id=service.checkout("caller",BaitlyMonthlyPricing.Plan.essential,UUID.randomUUID(),null);
        var now=java.time.Instant.now();long end=now.plusSeconds(20*86400).getEpochSecond();
        var order=tx.execute(status->{var o=orders.findAll().getFirst();o.setStatus("ACTIVE");o.setPaidUntil(java.time.Instant.ofEpochSecond(end));o.setLoyaltyStartedAt(java.time.LocalDateTime.ofInstant(now.minusSeconds(10*86400),java.time.ZoneOffset.UTC));o.setStripeCustomerId("cus_change");o.setStripeSubscriptionId("sub_change");return o;});
        var sub=com.stripe.net.ApiResource.GSON.fromJson("""
            {"id":"sub_change","status":"active","customer":"cus_change","schedule":"sched_change","items":{"data":[{"quantity":1,"price":{"id":"price_old","product":"prod_pms","currency":"eur","unit_amount":2900}}]}}
            """,com.stripe.model.Subscription.class);
        sub.getItems().getData().getFirst().setCurrentPeriodEnd(end);
        var schedule=com.stripe.net.ApiResource.GSON.fromJson("""
            {"id":"sched_change","subscription":"sub_change","current_phase":{"start_date":1,"end_date":2},"metadata":{}}
            """,com.stripe.model.SubscriptionSchedule.class);
        schedule.getCurrentPhase().setStartDate(now.minusSeconds(10*86400).getEpochSecond());schedule.getCurrentPhase().setEndDate(end);
        when(stripe.retrieveSubscription("sub_change")).thenReturn(sub);when(stripe.retrieveSubscriptionSchedule("sched_change")).thenReturn(schedule);
        var propertyRepository=(PropertyRepository)ReflectionTestUtils.getField(service,"properties");
        return new AmendmentFixture(order,new BaitlySubscriptionAmendments(em,service,orders,new BaitlyMonthlyPricing(),propertyRepository,stripe,manager),sub,schedule);
    }
    @Test void schedulesOnExistingContractWithNoImmediateChargeAndPreservesCurrentPrice()throws Exception {
        var f=amendmentFixture();var proposal=f.changes().proposal("caller",f.order().getId(),BaitlyMonthlyPricing.Plan.pro);
        assertThat(proposal.chargeNowCents()).isZero();var request=UUID.randomUUID();
        var change=f.changes().schedule("caller",f.order().getId(),BaitlyMonthlyPricing.Plan.pro,request,proposal.terms());
        assertThat(change.status()).isEqualTo("SCHEDULED");
        var capture=org.mockito.ArgumentCaptor.forClass(Map.class);verify(stripe).updateSubscriptionSchedule(eq(f.schedule()),capture.capture(),eq("BAITLY-AMEND-"+change.id()));
        var phases=(List<Map<String,Object>>)capture.getValue().get("phases");
        assertThat(phases.getFirst().get("items")).isEqualTo(List.of(Map.of("price","price_old","quantity",1)));
        assertThat(phases).allSatisfy(p->assertThat(p.get("proration_behavior")).isEqualTo("none"));
        assertThat(f.changes().schedule("caller",f.order().getId(),BaitlyMonthlyPricing.Plan.pro,request,proposal.terms())).isEqualTo(change);
        tx.executeWithoutResult(s->assertThat(orders.findById(f.order().getId()).orElseThrow().getPlan()).isEqualTo("essential"));
        verify(stripe,times(1)).createSession(any(),any());
    }
    @Test void uncertainScheduleWriteRecoversByProviderMarkerWithoutRewritingIt()throws Exception {
        var f=amendmentFixture();var proposal=f.changes().proposal("caller",f.order().getId(),BaitlyMonthlyPricing.Plan.pro);var request=UUID.randomUUID();
        doAnswer(call->{Map<String,Object> values=call.getArgument(1);f.schedule().setMetadata((Map<String,String>)values.get("metadata"));throw new IllegalStateException("lost response");}).when(stripe).updateSubscriptionSchedule(any(),any(),any());
        assertThatThrownBy(()->f.changes().schedule("caller",f.order().getId(),BaitlyMonthlyPricing.Plan.pro,request,proposal.terms())).hasMessage("lost response");
        assertThat(f.changes().list("caller",f.order().getId()).getFirst().status()).isEqualTo("PREPARED");
        f.changes().recover(f.order().getId(),2L);
        assertThat(f.changes().list("caller",f.order().getId()).getFirst().status()).isEqualTo("SCHEDULED");verify(stripe,times(1)).updateSubscriptionSchedule(any(),any(),any());
    }
    @Test void staleQuantityCannotScheduleAndForeignTenantCannotReadProposal()throws Exception {
        var f=amendmentFixture();var proposal=f.changes().proposal("caller",f.order().getId(),BaitlyMonthlyPricing.Plan.pro);
        var properties=(PropertyRepository)ReflectionTestUtils.getField(service,"properties");when(properties.countByOrganizationId(2L)).thenReturn(2L);
        assertThatThrownBy(()->f.changes().schedule("caller",f.order().getId(),BaitlyMonthlyPricing.Plan.pro,UUID.randomUUID(),proposal.terms())).hasMessageContaining("changé");
        tenantId.set(3L);assertThatThrownBy(()->f.changes().proposal("caller",f.order().getId(),BaitlyMonthlyPricing.Plan.pro)).isInstanceOf(RuntimeException.class);
        verify(stripe,never()).updateSubscriptionSchedule(any(),any(),any());
    }
    @Test void onlyMatchingPaidInvoiceAppliesChangedPlanOnce()throws Exception {
        var f=amendmentFixture();var p=f.changes().proposal("caller",f.order().getId(),BaitlyMonthlyPricing.Plan.pro);
        var change=f.changes().schedule("caller",f.order().getId(),BaitlyMonthlyPricing.Plan.pro,UUID.randomUUID(),p.terms());
        var invoice=BaitlyMonthlySubscriptionTest.invoice();invoice.setSubtotal(p.terms().monthly());
        invoice.getLines().getData().getFirst().getPeriod().setStart(p.terms().effectiveAt());
        invoice.getParent().getSubscriptionDetails().setMetadata(Map.of("baitly_change_id","wrong"));
        assertThatThrownBy(()->tx.execute(s->{f.changes().confirm(orders.lockByIdAndOrganizationId(f.order().getId(),2L).orElseThrow(),invoice,f.sub());return null;})).hasMessageContaining("preuve");
        invoice.getParent().getSubscriptionDetails().setMetadata(Map.of("baitly_change_id",change.id().toString()));
        for(int retry=0;retry<2;retry++)tx.executeWithoutResult(s->f.changes().confirm(orders.lockByIdAndOrganizationId(f.order().getId(),2L).orElseThrow(),invoice,f.sub()));
        tx.executeWithoutResult(s->{assertThat(orders.findById(f.order().getId()).orElseThrow().getPlan()).isEqualTo("pro");assertThat(em.find(BaitlySubscriptionAmendment.class,change.id()).getAppliedInvoiceId()).isEqualTo(invoice.getId());});
    }

}
