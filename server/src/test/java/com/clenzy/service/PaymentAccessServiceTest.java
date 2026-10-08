package com.clenzy.service;

import com.clenzy.controller.PaymentController;
import com.clenzy.controller.ServiceRequestController;
import com.clenzy.dto.BatchPaymentSessionRequest;
import com.clenzy.dto.PaymentSessionRequest;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class PaymentAccessServiceTest {
    final UserService users = mock(UserService.class);
    final InterventionRepository missions = mock(InterventionRepository.class);
    final ReservationRepository reservations = mock(ReservationRepository.class);
    final ServiceRequestRepository requests = mock(ServiceRequestRepository.class);
    final InvoiceRepository invoices = mock(InvoiceRepository.class);
    final TenantContext tenant = mock(TenantContext.class);
    final PaymentAccessService access = new PaymentAccessService(users, missions, reservations, requests, invoices, tenant);
    final InterventionPaymentService payments = mock(InterventionPaymentService.class);
    final PaymentQueryService queries = mock(PaymentQueryService.class);
    final PaymentTransactionService transactions = mock(PaymentTransactionService.class);
    final PaymentController controller = new PaymentController(payments, queries, transactions, access);
    final Jwt jwt = Jwt.withTokenValue("test").header("alg", "none").subject("owner-a").build();
    final User owner = new User();
    final User other = new User();

    @BeforeEach void setUp() {
        owner.setId(42L); owner.setRole(UserRole.HOST);
        other.setId(43L); other.setRole(UserRole.HOST);
        when(users.findByKeycloakId("owner-a")).thenReturn(owner);
        when(tenant.getRequiredOrganizationId()).thenReturn(7L);
    }

    Intervention mission(long id, User payer, Long organization) {
        var mission = new Intervention(); mission.setId(id); mission.setRequestor(payer);
        mission.setOrganizationId(organization);
        when(missions.findById(id)).thenReturn(Optional.of(mission));
        return mission;
    }

    PaymentTransaction transaction(String source, long id) {
        var tx = new PaymentTransaction(); tx.setSourceType(source); tx.setSourceId(id); tx.setOrganizationId(7L);
        return tx;
    }

    @ParameterizedTest @ValueSource(booleans = {false, true})
    void cannotStartAnotherOwnersCheckout(boolean embedded) {
        mission(1, other, 7L);
        var request = new PaymentSessionRequest(); request.setInterventionId(1L);
        assertThatThrownBy(() -> {
            if (embedded) controller.createEmbeddedPaymentSession(request, jwt);
            else controller.createPaymentSession(request, jwt);
        }).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(payments);
    }

    @Test void rejectsWholeBatchIfOneLineBelongsToAnotherOwner() {
        mission(1, owner, 7L); mission(2, other, 7L);
        var request = new BatchPaymentSessionRequest(List.of(1L, 2L), BigDecimal.TEN, null);
        assertThatThrownBy(() -> controller.createBatchPaymentSession(request, jwt))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(payments);
    }

    @Test void acceptsOwnMissionButRejectsForeignOrMissingOrganization() {
        mission(1, owner, 7L); mission(2, owner, 8L); mission(3, owner, null);
        assertThatCode(() -> access.requireInterventions(List.of(1L), jwt)).doesNotThrowAnyException();
        assertThatThrownBy(() -> access.requireInterventions(List.of(2L), jwt)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> access.requireInterventions(List.of(3L), jwt)).isInstanceOf(AccessDeniedException.class);
    }

    @Test void reservationStatusCannotTriggerStripeFallbackForAnotherOwner() {
        var property = new Property(); property.setOwner(other);
        var booking = new Reservation(); booking.setProperty(property); booking.setOrganizationId(7L);
        when(reservations.findByStripeSessionId("cs_other")).thenReturn(Optional.of(booking));
        assertThat(controller.getSessionStatus("cs_other", jwt).getStatusCode().value()).isEqualTo(404);
        verifyNoInteractions(queries);
        property.setOwner(owner);
        assertThat(access.canReadSession("cs_other", jwt)).isTrue();
        booking.setOrganizationId(null);
        assertThat(access.canReadSession("cs_other", jwt)).isFalse();
    }

    @Test void sharedSessionRequiresOwnershipOfEveryMission() {
        var one = mission(1, owner, 7L); var two = mission(2, other, 7L);
        when(missions.findAllByStripeSessionIdAndOrganizationId("cs_batch", 7L)).thenReturn(List.of(one, two));
        assertThat(access.canReadSession("cs_batch", jwt)).isFalse();
        two.setRequestor(owner);
        assertThat(access.canReadSession("cs_batch", jwt)).isTrue();
    }

    @ParameterizedTest @ValueSource(strings={"INTERVENTION","INTERVENTION_BATCH"})
    void batchTransactionCannotExposeAnotherOwnersPayment(String source) {
        mission(1, owner, 7L); mission(2, other, 7L);
        var tx = transaction(source, 1);
        tx.setMetadata(Map.of("interventionIds", "1,2"));
        when(transactions.findByTransactionRefInCurrentOrg("tx_batch")).thenReturn(Optional.of(tx));
        assertThat(controller.getTransactionStatus("tx_batch", jwt).getStatusCode().value()).isEqualTo(404);
        tx.setMetadata(Map.of("interventionIds", "1"));
        assertThat(access.canReadTransaction(tx, jwt)).isTrue();
        tx.setMetadata(Map.of("interventionIds", "1,"));
        assertThat(access.canReadTransaction(tx, jwt)).isFalse();
    }

    @Test void staffCanReadOtherPayersInsideCurrentOrganizationOnly() {
        owner.setRole(UserRole.SUPER_MANAGER);
        mission(1, other, 7L); mission(2, other, 8L);
        assertThatCode(() -> access.requireInterventions(List.of(1L), jwt)).doesNotThrowAnyException();
        assertThatThrownBy(() -> access.requireInterventions(List.of(2L), jwt)).isInstanceOf(AccessDeniedException.class);
    }

    @Test void serviceRequestPaymentAndFallbackRequireItsPayer() {
        var request = new ServiceRequest(); request.setId(5L); request.setUser(other); request.setOrganizationId(7L);
        when(requests.findById(5L)).thenReturn(Optional.of(request));
        var srPayments = mock(ServiceRequestPaymentService.class);
        var srController = new ServiceRequestController(mock(ServiceRequestService.class), srPayments, access);
        assertThatThrownBy(() -> srController.createPaymentSession(5L, jwt)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> srController.createEmbeddedPaymentSession(5L, jwt)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> srController.checkPaymentStatus(5L, jwt)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(srPayments);
    }

    @Test void unidentifiedCallerAndUnownedSourceFailClosed() {
        assertThat(access.canReadTransaction(transaction("UNKNOWN", 1), jwt)).isFalse();
        when(users.findByKeycloakId("owner-a")).thenReturn(null);
        assertThatThrownBy(() -> access.requireInterventions(List.of(1L), jwt)).isInstanceOf(AccessDeniedException.class);
    }

    @Test void invoiceCheckoutRequiresItsOwnerWithinCurrentOrganization() {
        var invoice = new Invoice(); invoice.setId(5L); invoice.setOrganizationId(7L); invoice.setInterventionId(1L);
        when(invoices.findById(5L)).thenReturn(Optional.of(invoice));
        var mission = mission(1, other, 7L);
        assertThatThrownBy(() -> access.requireInvoice(5L, jwt)).isInstanceOf(AccessDeniedException.class);
        mission.setRequestor(owner);
        assertThatCode(() -> access.requireInvoice(5L, jwt)).doesNotThrowAnyException();
        invoice.setOrganizationId(8L);
        assertThatThrownBy(() -> access.requireInvoice(5L, jwt)).isInstanceOf(AccessDeniedException.class);
    }
}
