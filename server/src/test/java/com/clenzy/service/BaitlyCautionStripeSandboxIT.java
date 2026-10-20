package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.*;
import com.clenzy.booking.service.BookingEngineDepositService;
import com.clenzy.scheduler.BookingCautionScheduler;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import com.clenzy.tenant.TenantScopedExecutor;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.SharedEntityManagerCreator;
import org.springframework.transaction.interceptor.*;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.support.TransactionTemplate;
import java.math.BigDecimal;
import java.sql.DriverManager;
import java.time.*;
import java.util.*;
import java.util.function.Function;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** PostgreSQL jetable et vraies préautorisations Stripe TEST, jamais de débit ni de virement réel. */
@EnabledIfEnvironmentVariable(named="BAITLY_CAUTION_STRIPE_SANDBOX",matches="true")
class BaitlyCautionStripeSandboxIT {
    static final String BASE="jdbc:postgresql://127.0.0.1:55439/postgres";
    String schema;
    SessionFactory factory;
    EntityManager em;
    JpaTransactionManager manager;
    TransactionTemplate transactions;
    SecurityDepositRepository deposits;
    SecurityDepositHoldService holds;
    SecurityDepositPaymentService payments;
    StripeGateway stripe;
    BookingCautionScheduler scheduler;
    final List<Map<String,Object>> evidence=new ArrayList<>();
    final List<String> authorizations=new ArrayList<>();
    final Clock clock=Clock.systemUTC();

    @BeforeEach void start() throws Exception {
        String key=System.getenv("BAITLY_CAUTION_STRIPE_TEST_KEY");
        assertThat(key).matches("(?:sk|rk)_test_[A-Za-z0-9]+");
        stripe=new StripeGateway(key);
        assertThat(stripe.retrievePlatformBalance().getLivemode()).isFalse();
        schema="baitly_caution_"+UUID.randomUUID().toString().replace("-","");
        try(var c=DriverManager.getConnection(BASE,"postgres","");var s=c.createStatement()) {s.execute("CREATE SCHEMA "+schema);}
        factory=BaitlyDepositOperationPersistenceTest.configuration(BASE+"?currentSchema="+schema)
                .setProperty("hibernate.connection.username","postgres")
                .setProperty("hibernate.globally_quoted_identifiers","true")
                .setProperty("hibernate.globally_quoted_identifiers_skip_column_definitions","true")
                .buildSessionFactory();
        try(var c=DriverManager.getConnection(BASE+"?currentSchema="+schema,"postgres","");var s=c.createStatement()) {
            s.execute("ALTER TABLE security_deposits ALTER COLUMN id RESTART WITH "+System.currentTimeMillis());
        }
        manager=new JpaTransactionManager(factory);
        transactions=new TransactionTemplate(manager);
        em=SharedEntityManagerCreator.createSharedEntityManager(factory);
        deposits=repository(SecurityDepositRepository.class);
        var issues=repository(IssueRepository.class);
        var reservations=mock(ReservationRepository.class);
        when(reservations.findByIdWithGuestAndProperty(anyLong())).thenAnswer(a->Optional.ofNullable(em.find(Reservation.class,a.getArgument(0,Long.class))));
        var interventions=mock(InterventionRepository.class);
        String hql=InterventionRepository.class.getMethod("findByReservationId",Long.class,Long.class)
                .getAnnotation(org.springframework.data.jpa.repository.Query.class).value();
        when(interventions.findByReservationId(anyLong(),anyLong())).thenAnswer(a->em.createQuery(hql,Intervention.class)
                .setParameter("reservationId",a.getArgument(0,Long.class)).setParameter("orgId",a.getArgument(1,Long.class)).getResultList());
        var policy=transactional(new BaitlyDepositReleasePolicy(interventions,issues,clock));
        holds=new SecurityDepositHoldService(deposits,stripe,mock(NotificationService.class),clock,policy);
        var store=transactional(new BaitlyDepositOperationStore(deposits,reservations,policy,em));
        payments=transactional(new SecurityDepositPaymentService(deposits,reservations,mock(SecurityDepositService.class),holds,stripe,store));
        var tenants=mock(TenantScopedExecutor.class);
        doAnswer(call->{call.getArgument(1,Runnable.class).run();return null;})
                .when(tenants).runAsOrganization(anyLong(),any());
        when(reservations.findById(anyLong())).thenAnswer(a->Optional.ofNullable(em.find(Reservation.class,a.getArgument(0,Long.class))));
        scheduler=new BookingCautionScheduler(payments,deposits,reservations,mock(SupervisionActivityService.class),
                tenants,mock(BookingEngineDepositService.class),mock(NotificationService.class));
    }
    <T>T transactional(T target) {
        var proxy=new ProxyFactory(target);proxy.setProxyTargetClass(true);
        proxy.addAdvice(new TransactionInterceptor(manager,new AnnotationTransactionAttributeSource()));
        return (T)proxy.getProxy();
    }
    <T>T repository(Class<T> type) {
        var proxy=new ProxyFactory(new JpaRepositoryFactory(em).getRepository(type));
        proxy.addAdvice(new TransactionInterceptor(manager,new MatchAlwaysTransactionAttributeSource()));
        return type.cast(proxy.getProxy());
    }
    <T>T tx(Function<EntityManager,T> action) {return transactions.execute(status->action.apply(em));}

    @Test void twoPropertyAmountsRemainHeldUntilCleaningAndIssuesPermitRelease() throws Exception {
        var customer=stripe.createCustomer(com.stripe.param.CustomerCreateParams.builder()
                .setName("Baitly caution TEST "+schema).setPaymentMethod("pm_card_visa").build());
        long base=System.currentTimeMillis();
        for(int index=0;index<2;index++) {
            long id=base+index;
            BigDecimal amount=new BigDecimal(index==0?"5.00":"7.00");
            tx(entityManager->{
                var property=new Property();property.setId(id);property.setOrganizationId(7L);property.setTimezone("Europe/Paris");
                property.setDefaultCheckOutTime("00:00");property.setSecurityDepositAmount(amount);property.setDefaultCurrency("EUR");em.persist(property);
                var reservation=new Reservation();reservation.setId(id);reservation.setOrganizationId(7L);reservation.setProperty(property);
                reservation.setCheckIn(LocalDate.now(ZoneId.of("Europe/Paris")).minusDays(2));
                reservation.setCheckOut(LocalDate.now(ZoneId.of("Europe/Paris")));reservation.setStatus("confirmed");
                reservation.setSecurityDepositAmount(amount);reservation.setCurrency("EUR");
                reservation.setStripeCustomerId(customer.getId());reservation.setStripePaymentMethodId(customer.getDefaultSource());
                em.persist(reservation);
                var request=new ServiceRequest();request.setId(id);request.setOrganizationId(7L);request.setReservationId(id);
                request.setServiceType(ServiceType.CLEANING);em.persist(request);
                var cleaning=new Intervention();cleaning.setId(id);cleaning.setOrganizationId(7L);cleaning.setProperty(property);
                cleaning.setServiceRequest(request);cleaning.setScheduledDate(reservation.getCheckOut().atTime(1,0));
                cleaning.setCompletedAt(reservation.getCheckOut().atTime(1,30));cleaning.setStatus(InterventionStatus.AWAITING_VALIDATION);em.persist(cleaning);
                return null;
            });
            // Customer.payment_method est une carte de test, pas une source legacy.
            var saved=stripe.createPaymentIntent(com.stripe.param.PaymentIntentCreateParams.builder()
                    .setAmount(100L).setCurrency("eur").setCustomer(customer.getId()).setPaymentMethod("pm_card_visa")
                    .setConfirm(true).setSetupFutureUsage(com.stripe.param.PaymentIntentCreateParams.SetupFutureUsage.OFF_SESSION)
                    .setAutomaticPaymentMethods(com.stripe.param.PaymentIntentCreateParams.AutomaticPaymentMethods.builder()
                            .setEnabled(true).setAllowRedirects(com.stripe.param.PaymentIntentCreateParams.AutomaticPaymentMethods.AllowRedirects.NEVER).build())
                    .build(),"baitly-caution-card-"+schema+id);
            assertThat(saved.getLivemode()).isFalse();
            tx(entityManager->{em.find(Reservation.class,id).setStripePaymentMethodId(saved.getPaymentMethod());return null;});
            Long depositId=tx(entityManager->{
                var deposit=new SecurityDeposit();deposit.setOrganizationId(7L);deposit.setReservationId(id);deposit.setAmount(amount);
                deposit.setCurrency("EUR");deposit.setStatus(SecurityDepositStatus.PENDING);em.persist(deposit);return deposit.getId();
            });
            // Les clés du hold utilisent l'ID DB : réserver une plage propre à cette recette.
            var reservation=tx(entityManager->em.find(Reservation.class,id));
            var deposit=tx(entityManager->em.find(SecurityDeposit.class,depositId));
            assertThat(holds.placeHoldIfDue(deposit,reservation)).isEqualTo(SecurityDepositHoldService.HoldOutcome.PLACED);
            var held=tx(entityManager->em.find(SecurityDeposit.class,depositId));
            authorizations.add(held.getExternalRef());
            var pi=stripe.retrievePaymentIntent(held.getExternalRef());
            assertThat(pi.getLivemode()).isFalse();assertThat(pi.getStatus()).isEqualTo("requires_capture");
            assertThat(pi.getAmountCapturable()).isEqualTo(amount.movePointRight(2).longValueExact());
            scheduler.releaseExpiredHolds();
            assertThat(stripe.retrievePaymentIntent(held.getExternalRef()).getStatus()).isEqualTo("requires_capture");
            assertThat(this.<SecurityDepositStatus>tx(entityManager->em.find(SecurityDeposit.class,depositId).getStatus()))
                    .isEqualTo(SecurityDepositStatus.HELD);
            tx(entityManager->{
                em.find(Intervention.class,id).setStatus(InterventionStatus.COMPLETED);
                if(amount.intValue()==7) {
                    var issue=new Issue();issue.setOrganizationId(7L);issue.setPropertyId(id);issue.setReportedBy(7L);
                    issue.setTitle("Anomalie de recette TEST");em.persist(issue);
                }
                return null;
            });
            if(index==1) {
                scheduler.releaseExpiredHolds();
                assertThat(stripe.retrievePaymentIntent(held.getExternalRef()).getStatus()).isEqualTo("requires_capture");
                tx(entityManager->{em.createQuery("update Issue i set i.status=:status where i.propertyId=:id")
                        .setParameter("status",Issue.IssueStatus.DISMISSED).setParameter("id",id).executeUpdate();return null;});
            }
            scheduler.releaseExpiredHolds();
            scheduler.releaseExpiredHolds();
            assertThat(payments.releaseAfterCleaning(7L,depositId)).isFalse();
            var released=stripe.retrievePaymentIntent(held.getExternalRef());
            assertThat(released.getStatus()).isEqualTo("canceled");assertThat(released.getAmountReceived()).isZero();
            assertThat(this.<SecurityDepositStatus>tx(entityManager->em.find(SecurityDeposit.class,depositId).getStatus()))
                    .isEqualTo(SecurityDepositStatus.RELEASED);
            evidence.add(Map.of("propertyId",id,"reservationId",id,"depositId",depositId,
                    "amount",amount.toPlainString(),"currency","EUR","paymentIntent",released.getId(),
                    "livemode",released.getLivemode(),"stripeStatus",released.getStatus(),
                    "amountReceived",released.getAmountReceived(),"baitlyStatus","RELEASED"));
        }
        String report=System.getenv("BAITLY_CAUTION_EVIDENCE_PATH");
        if(report!=null) new com.fasterxml.jackson.databind.ObjectMapper().writerWithDefaultPrettyPrinter()
                .writeValue(java.nio.file.Path.of(report).toFile(),Map.of("testedAt",Instant.now().toString(),
                        "scope","PostgreSQL isolated schema, real Stripe TEST, production release scheduler",
                        "waitingForValidationBlocksRelease",true,"openIssueBlocksRelease",true,
                        "repeatedSchedulerIsIdempotent",true,"deposits",evidence));
    }

    @AfterEach void cleanup() throws Exception {
        try {
            for(String id:authorizations) {
                var pi=stripe.retrievePaymentIntent(id);
                if("requires_capture".equals(pi.getStatus())) stripe.cancelPaymentIntent(pi,"baitly-caution-cleanup-"+id);
            }
        } finally {
            if(factory!=null)factory.close();
            if(schema!=null)try(var c=DriverManager.getConnection(BASE,"postgres","");var s=c.createStatement()) {s.execute("DROP SCHEMA "+schema+" CASCADE");}
        }
    }
}
