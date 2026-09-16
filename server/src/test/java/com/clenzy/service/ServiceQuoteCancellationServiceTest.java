package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import java.math.BigDecimal;
import java.time.*;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ServiceQuoteCancellationServiceTest {
    @Mock EntityManager em;
    @Mock ServiceRequestCancellationCoordination requests;
    @Mock ServiceQuoteCancellationRepository cancellations;
    @Mock ServiceQuoteAmendmentService parties;
    @Mock ServiceQuoteAgreementService agreements;
    @Mock InterventionPaymentCoordination payments;
    @Mock ServiceQuoteAmendmentDiscussion discussion;
    @Mock MissionFinancialService finances;
    ServiceQuoteCancellationService service;
    ServiceQuote quote;
    Intervention mission;
    Jwt jwt = Jwt.withTokenValue("test").header("alg", "none").subject("manager").build();
    ServiceQuoteAmendmentService.Access manager = new ServiceQuoteAmendmentService.Access(5L, false, true, false, false);

    @BeforeEach void setup() {
        service = new ServiceQuoteCancellationService(em, cancellations, parties, agreements, payments, discussion,
                Clock.fixed(Instant.EPOCH, ZoneOffset.UTC), requests, finances);
        quote = new ServiceQuote(); quote.setId(1L); quote.setOrganizationId(7L); quote.setInterventionId(2L);
        quote.setStatus(ServiceQuote.Status.APPROVED); quote.setAmount(new BigDecimal("120"));
        mission = new Intervention(); mission.setId(2L); mission.setOrganizationId(7L);
        mission.setVersion(4L); mission.setStatus(InterventionStatus.PENDING);
        lenient().when(em.find(ServiceQuote.class, 1L)).thenReturn(quote);
        lenient().when(em.find(Intervention.class, 2L)).thenReturn(mission);
        lenient().when(payments.lockMission(7L, 2L)).thenReturn(mission);
        lenient().when(parties.access(1L, 7L, jwt)).thenReturn(manager);
        lenient().when(agreements.current(quote)).thenReturn(new ServiceQuoteAgreementService.Agreement(
                1L, new BigDecimal("120"), new BigDecimal("150"), "EUR", 8L));
    }

    @Test void cancellationKeepsHistoricalAgreementAndNotifiesInSameTransaction() {
        var result = service.cancel(1L, 7L, jwt, 4L, "  Prestataire remplacé  ");
        assertThat(mission.getStatus()).isEqualTo(InterventionStatus.CANCELLED);
        assertThat(quote.getStatus()).isEqualTo(ServiceQuote.Status.APPROVED);
        assertThat(quote.getAmount()).isEqualByComparingTo("120");
        assertThat(result.reason()).isEqualTo("Prestataire remplacé");
        assertThat(result.cancelledAt()).isEqualTo(Instant.EPOCH);
        verify(cancellations).saveAndFlush(argThat(c -> c.getAgreedAmount().compareTo(new BigDecimal("150")) == 0
                && c.getActorSubject().equals("manager") && c.getOrganizationId().equals(7L)));
        var order = inOrder(em, payments, cancellations, discussion);
        order.verify(em).refresh(quote, LockModeType.PESSIMISTIC_WRITE);
        order.verify(payments).lockMission(7L, 2L);
        order.verify(cancellations).saveAndFlush(any());
        order.verify(discussion).cancelled(eq(quote), any(), eq("manager"));
    }

    @Test void paymentDoesNotPreventCancellationAndOpensFinancialCase() {
        mission.setPaymentStatus(PaymentStatus.PAID);
        assertThat(service.view(1L,7L,jwt).canCancel()).isTrue();
        service.cancel(1L,7L,jwt,4L,"Motif");
        assertThat(mission.getStatus()).isEqualTo(InterventionStatus.CANCELLED);
        assertThat(mission.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        verify(finances).open(1L,7L,"Motif","manager");
    }

    @Test void changedMissionVersionCannotBeCancelledFromStaleScreen() {
        assertThatThrownBy(() -> service.cancel(1L, 7L, jwt, 3L, "Motif")).hasMessageContaining("mission a changé");
        verify(cancellations, never()).saveAndFlush(any());
        verifyNoInteractions(discussion);
    }

    @Test void rightsAreCheckedAgainAfterLocking() {
        when(parties.access(1L, 7L, jwt)).thenReturn(manager,
                new ServiceQuoteAmendmentService.Access(5L, false, false, false, true));
        assertThatThrownBy(() -> service.cancel(1L, 7L, jwt, 4L, "Motif")).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(cancellations, discussion);
    }

    @Test void providerCannotCancelEvenWithAValidQuoteId() {
        when(parties.access(1L, 7L, jwt)).thenReturn(new ServiceQuoteAmendmentService.Access(5L, true, false, false, true));
        assertThatThrownBy(() -> service.cancel(1L, 7L, jwt, 4L, "Motif")).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(em, cancellations, payments, discussion);
    }

    @Test void repeatKeepsOriginalReasonAndDoesNotNotifyAgain() {
        var previous = new ServiceQuoteCancellation(quote, "first-manager", "Original", Instant.EPOCH, BigDecimal.TEN, "EUR");
        when(cancellations.findById(1L)).thenReturn(Optional.of(previous));
        mission.setStatus(InterventionStatus.CANCELLED);
        assertThat(service.cancel(1L, 7L, jwt, 4L, "Other")).isEqualTo(service.view(1L, 7L, jwt));
        verify(cancellations, never()).saveAndFlush(any());
        verifyNoInteractions(discussion);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"completed", "wrong-organization"})
    void unsupportedStatesCannotBePartiallyCancelled(String state) {
        switch (state) {
            case "paid" -> when(payments.cancellationNeedsPaymentReview(mission)).thenReturn(true);
            case "deposit" -> quote.setDepositPaidAt(LocalDateTime.now());
            case "session" -> when(payments.cancellationNeedsPaymentReview(mission)).thenReturn(true);
            case "completed" -> mission.setStatus(InterventionStatus.COMPLETED);
            case "wrong-organization" -> mission.setOrganizationId(99L);
        }
        assertThat(service.view(1L, 7L, jwt).canCancel()).isFalse();
        assertThatThrownBy(() -> service.cancel(1L, 7L, jwt, 4L, "Motif")).isInstanceOf(IllegalStateException.class);
        verify(cancellations, never()).saveAndFlush(any());
        verifyNoInteractions(discussion);
    }

    @Test void reasonIsRequiredAndBounded() {
        for (String reason : new String[] {" ", "x".repeat(1001)}) {
            assertThatThrownBy(() -> service.cancel(1L, 7L, jwt, 4L, reason)).isInstanceOf(IllegalArgumentException.class);
        }
        verifyNoInteractions(cancellations, payments, discussion);
    }

    @Test void commercialAgreementWithoutMissionCanBeCancelledWithoutInventingAMissionVersion() {
        quote.setInterventionId(null);
        assertThat(service.view(1L, 7L, jwt).canCancel()).isTrue();
        assertThat(service.view(1L, 7L, jwt).missionVersion()).isNull();
        var result = service.cancel(1L, 7L, jwt, null, "Accord abandonné");
        assertThat(result.cancelledAt()).isEqualTo(Instant.EPOCH);
        verifyNoInteractions(payments);
        verify(cancellations).saveAndFlush(argThat(c -> c.getInterventionId() == null));
        verify(discussion).cancelled(eq(quote), any(), eq("manager"));
    }

    @Test void notificationFailureRollsBackPersistedCancellation() {
        var source = new org.springframework.jdbc.datasource.DriverManagerDataSource(
                "jdbc:h2:mem:cancel_" + java.util.UUID.randomUUID() + ";DB_CLOSE_DELAY=-1", "sa", "");
        var jdbc = new org.springframework.jdbc.core.JdbcTemplate(source);
        jdbc.execute("CREATE TABLE decision (status VARCHAR(30))");
        jdbc.execute("INSERT INTO decision VALUES ('PENDING')");
        when(cancellations.saveAndFlush(any())).thenAnswer(call -> {
            jdbc.update("UPDATE decision SET status='CANCELLED'");
            return call.getArgument(0);
        });
        doThrow(new IllegalStateException("Fil indisponible")).when(discussion).cancelled(any(), any(), any());
        var proxy = new org.springframework.aop.framework.ProxyFactory(service);
        proxy.addAdvice(new org.springframework.transaction.interceptor.TransactionInterceptor(
                new org.springframework.jdbc.datasource.DataSourceTransactionManager(source),
                new org.springframework.transaction.annotation.AnnotationTransactionAttributeSource()));
        var transactional = (ServiceQuoteCancellationService) proxy.getProxy();
        assertThatThrownBy(() -> transactional.cancel(1L, 7L, jwt, 4L, "Motif")).hasMessageContaining("Fil indisponible");
        assertThat(jdbc.queryForObject("SELECT status FROM decision", String.class)).isEqualTo("PENDING");
    }
}
