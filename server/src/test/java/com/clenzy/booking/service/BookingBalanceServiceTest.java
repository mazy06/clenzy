package com.clenzy.booking.service;

import com.clenzy.dto.PaymentOrchestrationRequest;
import com.clenzy.dto.PaymentOrchestrationResult;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.PaymentProviderType;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.payment.PaymentResult;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.PaymentOrchestrationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingBalanceServiceTest {

    @Mock private ReservationRepository reservationRepository;
    @Mock private PaymentOrchestrationService orchestrationService;
    @Mock private PlatformTransactionManager transactionManager;

    private BookingBalanceService service;

    private static final Long ORG_ID = 7L;

    @BeforeEach
    void setUp() throws Exception {
        when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        service = new BookingBalanceService(reservationRepository, orchestrationService, transactionManager);
        setField(service, "defaultCurrency", "eur");
        setField(service, "frontendUrl", "https://app.test");
    }

    private void setField(Object target, String name, Object value) throws Exception {
        Field f = target.getClass().getDeclaredField(name);
        f.setAccessible(true);
        f.set(target, value);
    }

    private Reservation partiallyPaid(String currency, String countryCode, BigDecimal amountDue) {
        Property property = new Property();
        property.setId(1L);
        property.setCountryCode(countryCode);
        Reservation r = new Reservation();
        r.setId(42L);
        r.setConfirmationCode("BK-42");
        r.setOrganizationId(ORG_ID);
        r.setProperty(property);
        r.setCurrency(currency);
        r.setPaymentStatus(PaymentStatus.PARTIALLY_PAID);
        r.setAmountDue(amountDue);
        r.setPaymentLinkEmail("guest@mail.com");
        return r;
    }

    @Test
    void whenBalanceDue_thenRoutesThroughOrchestratorWithExplicitOrgAndCountry() {
        Reservation r = partiallyPaid("MAD", "MA", new BigDecimal("500.00"));
        when(reservationRepository.findByConfirmationCodeAndOrganizationId("BK-42", ORG_ID))
                .thenReturn(Optional.of(r));
        when(orchestrationService.initiatePayment(anyLong(), any(), any(PaymentOrchestrationRequest.class)))
                .thenReturn(new PaymentOrchestrationResult(null,
                        PaymentResult.success("cs_bal", "https://pay.example.ma/cs_bal"),
                        PaymentProviderType.PAYZONE));

        String url = service.createBalanceCheckoutUrl(ORG_ID, "BK-42");

        assertThat(url).isEqualTo("https://pay.example.ma/cs_bal");

        ArgumentCaptor<PaymentOrchestrationRequest> reqCaptor =
                ArgumentCaptor.forClass(PaymentOrchestrationRequest.class);
        verify(orchestrationService).initiatePayment(eq(ORG_ID), eq("MA"), reqCaptor.capture());
        PaymentOrchestrationRequest request = reqCaptor.getValue();
        assertThat(request.amount()).isEqualByComparingTo("500.00");
        assertThat(request.currency()).isEqualTo("MAD");
        assertThat(request.sourceType()).isEqualTo(BookingBalanceService.SOURCE_TYPE);
        assertThat(request.sourceId()).isEqualTo(42L);
        assertThat(request.idempotencyKey()).isEqualTo("BOOKING-BALANCE-42");
        assertThat(request.metadata()).containsEntry("reservation_id", "42");
    }

    @Test
    void whenNotPartiallyPaid_thenThrows() {
        Reservation r = partiallyPaid("EUR", "FR", new BigDecimal("100.00"));
        r.setPaymentStatus(PaymentStatus.PAID);
        when(reservationRepository.findByConfirmationCodeAndOrganizationId("BK-42", ORG_ID))
                .thenReturn(Optional.of(r));

        assertThatThrownBy(() -> service.createBalanceCheckoutUrl(ORG_ID, "BK-42"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Aucun solde");
    }

    @Test
    void whenReservationNotFound_thenThrowsNotFound() {
        when(reservationRepository.findByConfirmationCodeAndOrganizationId("BK-42", ORG_ID))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.createBalanceCheckoutUrl(ORG_ID, "BK-42"))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void whenOrchestratorFails_thenThrows() {
        Reservation r = partiallyPaid("EUR", "FR", new BigDecimal("100.00"));
        when(reservationRepository.findByConfirmationCodeAndOrganizationId("BK-42", ORG_ID))
                .thenReturn(Optional.of(r));
        when(orchestrationService.initiatePayment(anyLong(), any(), any(PaymentOrchestrationRequest.class)))
                .thenReturn(new PaymentOrchestrationResult(null,
                        PaymentResult.failure("provider indisponible"), null));

        assertThatThrownBy(() -> service.createBalanceCheckoutUrl(ORG_ID, "BK-42"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Echec de creation");
    }
}
