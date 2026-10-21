package com.clenzy.service;

import com.clenzy.dto.ServiceRequestDto;
import com.clenzy.marketplace.service.MarketplacePropertyContext;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.catalog.ServiceCatalogReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class BaitlyPaidServiceExecutionTest {
    final UpsellOrderRepository orders=mock(UpsellOrderRepository.class);
    final ReservationRepository reservations=mock(ReservationRepository.class);
    final ServiceRequestRepository needs=mock(ServiceRequestRepository.class);
    final InterventionRepository interventions=mock(InterventionRepository.class);
    final PaymentTransactionRepository payments=mock(PaymentTransactionRepository.class);
    final WelcomeGuideTokenRepository tokens=mock(WelcomeGuideTokenRepository.class);
    final UserRepository users=mock(UserRepository.class);
    final MarketplacePropertyContext properties=mock(MarketplacePropertyContext.class);
    final ServiceRequestService requests=mock(ServiceRequestService.class);
    final ServiceCatalogReference catalog=mock(ServiceCatalogReference.class);
    final BaitlyCommerceOperations operations=mock(BaitlyCommerceOperations.class);
    final Clock clock=Clock.fixed(Instant.parse("2026-10-19T10:00:00Z"),ZoneOffset.UTC);
    final BaitlyPaidServiceExecution service=new BaitlyPaidServiceExecution(orders,reservations,needs,interventions,
        payments,tokens,users,properties,requests,catalog,operations,clock);
    final Jwt jwt=Jwt.withTokenValue("test").header("alg","none").subject("host").build();
    final BaitlyPaidServiceExecution.Schedule plan=new BaitlyPaidServiceExecution.Schedule(LocalDateTime.parse("2026-10-21T10:00"),2,"Changer le linge");
    UpsellOrder order; Reservation stay; ServiceRequest need; PaymentTransaction proof;

    @BeforeEach void setup() {
        var property=new Property(); property.setId(7L); property.setOrganizationId(1L); property.setName("Loft test"); property.setTimezone("Europe/Paris");
        stay=new Reservation(); stay.setId(50L); stay.setOrganizationId(1L); stay.setProperty(property);
        stay.setCheckIn(LocalDate.parse("2026-10-20")); stay.setCheckOut(LocalDate.parse("2026-10-24"));
        order=new UpsellOrder(); order.setId(8L); order.setOrganizationId(1L); order.setReservationId(50L);
        order.setTitle("Ménage du séjour"); order.setStatus(UpsellOrderStatus.PAID); order.setAmount(new BigDecimal("60"));
        order.setCurrency("EUR"); order.setStripeSessionId("cs_test"); order.setFulfillmentServiceCode("cleaning-mid-stay");
        need=new ServiceRequest(); need.setId(90L); need.setOrganizationId(1L); need.setProperty(property); need.setReservationId(50L);
        need.setServiceItemCode("cleaning-mid-stay"); need.setStatus(RequestStatus.PENDING);
        need.setDesiredDate(plan.start()); need.setEstimatedDurationHours(2); need.setSpecialInstructions(plan.instructions());
        proof=new PaymentTransaction(); proof.setOrganizationId(1L); proof.setSourceType("UPSELL"); proof.setSourceId(8L);
        proof.setStatus(TransactionStatus.COMPLETED); proof.setPaymentType(TransactionType.CHECKOUT); proof.setAmount(new BigDecimal("60")); proof.setCurrency("EUR");
        when(orders.lockForExecution(8L,1L)).thenReturn(Optional.of(order)); when(orders.findById(8L)).thenReturn(Optional.of(order));
        when(reservations.findById(50L)).thenReturn(Optional.of(stay)); when(needs.findById(90L)).thenReturn(Optional.of(need));
        when(payments.findByProviderTxId("cs_test")).thenReturn(Optional.of(proof));
        var actor=new User(); actor.setId(3L); when(users.findByKeycloakId("host")).thenReturn(Optional.of(actor));
        when(catalog.items()).thenReturn(List.of(new ServiceCatalogReference.Item("cleaning-mid-stay","Ménage pendant le séjour",
            "Mid-stay cleaning","OTHER","ONSITE",true,true,"CLEANING","cleaning","GUEST")));
        when(requests.create(any())).thenAnswer(call -> { var dto=call.getArgument(0,ServiceRequestDto.class); dto.id=90L; return dto; });
    }

    @Test void createsOneOrdinaryRequestThenReplaysWithoutDuplicates() {
        var first=service.schedule(8L,1L,jwt,plan); var replay=service.schedule(8L,1L,jwt,plan);
        assertThat(first.state()).isEqualTo("REQUESTED"); assertThat(replay.serviceRequestId()).isEqualTo(90L);
        var captured=org.mockito.ArgumentCaptor.forClass(ServiceRequestDto.class); verify(requests).create(captured.capture());
        var dto=captured.getValue(); assertThat(dto.reservationId).isEqualTo(50L); assertThat(dto.propertyId).isEqualTo(7L);
        assertThat(dto.serviceItemCode).isEqualTo("cleaning-mid-stay"); assertThat(dto.estimatedCost).isNull();
        assertThat(dto.paymentStatus).isNull(); assertThat(dto.assignedToId).isNull();
        assertThat(dto.description).contains("vente #8");
    }

    @Test void changedPlanUsesExistingRequestInsteadOfCreatingAnother() {
        order.setServiceRequestId(90L);
        assertThatThrownBy(() -> service.schedule(8L,1L,jwt,new BaitlyPaidServiceExecution.Schedule(plan.start().plusDays(1),2,"")))
            .hasMessageContaining("existe déjà"); verifyNoInteractions(requests);
    }

    @Test void rejectsUnpaidRefundedAndUnqualifiedOrders() {
        order.setStatus(UpsellOrderStatus.PENDING);
        assertThatThrownBy(() -> service.schedule(8L,1L,jwt,plan)).hasMessageContaining("payé");
        order.setStatus(UpsellOrderStatus.REFUNDED);
        assertThatThrownBy(() -> service.schedule(8L,1L,jwt,plan)).hasMessageContaining("payé");
        order.setStatus(UpsellOrderStatus.PAID); order.setFulfillmentServiceCode(null);
        assertThatThrownBy(() -> service.schedule(8L,1L,jwt,plan)).hasMessageContaining("qualifié");
        verifyNoInteractions(requests);
    }

    @Test void requiresMatchingFinancialProofAndBlocksRefundInProgress() {
        proof.setAmount(BigDecimal.ONE);
        assertThatThrownBy(() -> service.schedule(8L,1L,jwt,plan)).hasMessageContaining("incompatible");
        proof.setAmount(new BigDecimal("60"));
        var refund=new PaymentTransaction(); refund.setPaymentType(TransactionType.REFUND); refund.setStatus(TransactionStatus.PROCESSING);
        when(payments.findByOrganizationIdAndSourceTypeAndSourceId(1L,"UPSELL",8L)).thenReturn(List.of(refund));
        assertThatThrownBy(() -> service.schedule(8L,1L,jwt,plan)).hasMessageContaining("Remboursement");
        verifyNoInteractions(requests);
    }

    @Test void onlyAcceptsFutureSlotsEntirelyInsideTheStay() {
        for (var date:List.of("2026-10-19T10:00","2026-10-20T12:00","2026-10-24T10:00","2026-10-25T10:00")) {
            assertThatThrownBy(() -> service.schedule(8L,1L,jwt,new BaitlyPaidServiceExecution.Schedule(LocalDateTime.parse(date),2,"")))
                .hasMessageContaining("séjour");
        }
        verifyNoInteractions(requests);
    }

    @Test void enforcesOrganizationAndPropertyOwnership() {
        assertThatThrownBy(() -> service.inspect(8L,99L,jwt)).isInstanceOf(AccessDeniedException.class);
        doThrow(new AccessDeniedException("Logement inaccessible")).when(properties).require(7L,1L,jwt);
        assertThatThrownBy(() -> service.schedule(8L,1L,jwt,plan)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(requests);
    }

    @Test void trackingUsesTheRealInterventionAndItsUpdatedTime() {
        order.setServiceRequestId(90L);
        var work=new Intervention(); work.setId(100L); work.setStatus(InterventionStatus.PENDING); work.setScheduledDate(plan.start().plusHours(1));
        when(interventions.findLinkedForServiceRequests(1L,List.of(90L))).thenReturn(List.of(work));
        var view=service.inspect(8L,1L,jwt); assertThat(view.state()).isEqualTo("CONFIRMED");
        assertThat(view.start()).isEqualTo(work.getScheduledDate().atOffset(ZoneOffset.UTC)
            .atZoneSameInstant(ZoneId.of("Europe/Paris")).toLocalDateTime());
        work.setStatus(InterventionStatus.IN_PROGRESS); assertThat(service.inspect(8L,1L,jwt).state()).isEqualTo("IN_PROGRESS");
        work.setStatus(InterventionStatus.AWAITING_VALIDATION); assertThat(service.inspect(8L,1L,jwt).state()).isEqualTo("TO_VALIDATE");
        work.setStatus(InterventionStatus.COMPLETED); assertThat(service.inspect(8L,1L,jwt).state()).isEqualTo("COMPLETED");
    }

    @Test void guestCannotReadAnotherStayOrAnExpiredToken() {
        var token=UUID.randomUUID(); var link=new WelcomeGuideToken(); link.setOrganizationId(1L); link.setReservation(stay);
        link.setValidFrom(LocalDateTime.now().minusDays(1)); link.setExpiresAt(LocalDateTime.now().plusDays(1));
        when(tokens.findByToken(token)).thenReturn(Optional.of(link));
        var foreign=new UpsellOrder(); foreign.setOrganizationId(99L); foreign.setFulfillmentServiceCode("cleaning-mid-stay");
        when(orders.findByReservationIdOrderByCreatedAtDesc(50L)).thenReturn(List.of(order,foreign));
        assertThat(service.forGuest(token)).extracting(BaitlyPaidServiceExecution.GuestView::orderId).containsExactly(8L);
        link.setRevoked(true); assertThatThrownBy(() -> service.forGuest(token)).isInstanceOf(AccessDeniedException.class);
    }

    @Test void confirmedMissionKeepsTheRequestedPropertyLocalTime() {
        order.setServiceRequestId(90L);
        var work=new Intervention(); work.setId(100L); work.setStatus(InterventionStatus.PENDING);
        work.setScheduledDate(plan.start().atZone(ZoneId.of("Europe/Paris")).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime());
        when(interventions.findLinkedForServiceRequests(1L,List.of(90L))).thenReturn(List.of(work));
        assertThat(service.inspect(8L,1L,jwt).start()).isEqualTo(plan.start());
    }

    @Test void breakfastAndQualifiedTransfersReuseTheOrdinaryRequestAndPreventDuplicates() {
        for (var code:List.of("culinary-breakfast","driver-airport","driver-station")) {
            order.setFulfillmentServiceCode(code); order.setServiceRequestId(null); need.setServiceItemCode(code);
            when(catalog.items()).thenReturn(List.of(new ServiceCatalogReference.Item(code,"Service test","Test service",
                "OTHER","ONSITE",true,true,"OTHER","other","GUEST")));
            var result=service.schedule(8L,1L,jwt,plan);
            assertThat(result.serviceRequestId()).isEqualTo(90L);
            assertThat(service.schedule(8L,1L,jwt,plan).serviceRequestId()).isEqualTo(90L);
        }
        var captured=org.mockito.ArgumentCaptor.forClass(ServiceRequestDto.class);
        verify(requests,times(3)).create(captured.capture());
        assertThat(captured.getAllValues()).extracting(d -> d.serviceItemCode)
            .containsExactly("culinary-breakfast","driver-airport","driver-station");
        assertThat(captured.getAllValues()).allSatisfy(d -> {
            assertThat(d.reservationId).isEqualTo(50L); assertThat(d.propertyId).isEqualTo(7L);
            assertThat(d.estimatedCost).isNull(); assertThat(d.paymentStatus).isNull();
        });
    }

    @Test void transfersCanPrecedeCheckinOrFollowCheckoutButRequirePickupDetails() {
        order.setFulfillmentServiceCode("driver-airport");
        need.setServiceItemCode("driver-airport");
        when(catalog.items()).thenReturn(List.of(new ServiceCatalogReference.Item("driver-airport","Transfert aéroport",
            "Airport transfer","OTHER","ONSITE",true,true,"OTHER","other","GUEST")));
        var beforeArrival=new BaitlyPaidServiceExecution.Schedule(LocalDateTime.parse("2026-10-20T09:00"),2,"CDG vers le logement, vol TEST");
        assertThat(service.inspect(8L,1L,jwt).scheduleStart()).isEqualTo(LocalDateTime.parse("2026-10-20T00:00"));
        assertThat(service.schedule(8L,1L,jwt,beforeArrival).serviceRequestId()).isEqualTo(90L);
        order.setServiceRequestId(null);
        var afterDeparture=new BaitlyPaidServiceExecution.Schedule(LocalDateTime.parse("2026-10-24T18:00"),2,"Logement vers CDG, vol TEST");
        assertThat(service.schedule(8L,1L,jwt,afterDeparture).serviceRequestId()).isEqualTo(90L);
        order.setServiceRequestId(null);
        assertThatThrownBy(() -> service.schedule(8L,1L,jwt,new BaitlyPaidServiceExecution.Schedule(afterDeparture.start(),2," ")))
            .hasMessageContaining("prise en charge");
        assertThatThrownBy(() -> service.schedule(8L,1L,jwt,new BaitlyPaidServiceExecution.Schedule(afterDeparture.start().plusDays(1),2,"CDG")))
            .hasMessageContaining("plage autorisée");
    }

    @Test void breakfastMustRemainInsideTheStayAndGenericTransfersMustBeQualified() {
        order.setFulfillmentServiceCode("culinary-breakfast");
        assertThatThrownBy(() -> service.schedule(8L,1L,jwt,new BaitlyPaidServiceExecution.Schedule(LocalDateTime.parse("2026-10-20T09:00"),1,"")))
            .hasMessageContaining("séjour");
        order.setFulfillmentServiceCode("TRANSFER");
        assertThatThrownBy(() -> service.schedule(8L,1L,jwt,plan)).hasMessageContaining("qualifiée");
        verifyNoInteractions(requests);
    }

    @Test void existingManualFulfillmentCannotCreateASecondOperationalTrack() {
        var operation=mock(BaitlyCommerceOperation.class); when(operation.getAction()).thenReturn("SCHEDULED");
        when(operations.history(1L,"UPSELL",8L)).thenReturn(List.of(operation));
        assertThat(service.inspect(8L,1L,jwt).canSchedule()).isFalse();
        assertThat(service.inspect(8L,1L,jwt).state()).isEqualTo("CONFIRMED");
        assertThatThrownBy(() -> service.schedule(8L,1L,jwt,plan)).hasMessageContaining("déjà été traitée");
        verifyNoInteractions(requests);
    }

    @Test void guestTracksEveryServiceUsingExistingOperationsWithoutLeakingPrivateProofs() {
        var token=UUID.randomUUID(); var link=new WelcomeGuideToken(); link.setOrganizationId(1L); link.setReservation(stay);
        link.setValidFrom(LocalDateTime.now().minusDays(1)); link.setExpiresAt(LocalDateTime.now().plusDays(1));
        when(tokens.findByToken(token)).thenReturn(Optional.of(link));
        when(orders.findByReservationIdOrderByCreatedAtDesc(50L)).thenReturn(List.of(order));
        order.setFulfillmentServiceCode("mobility-parking");
        assertThat(service.forGuest(token).getFirst().state()).isEqualTo("TO_ORGANIZE");
        for (var state:Map.of("SCHEDULED","CONFIRMED","FULFILLED","COMPLETED","CANCELLED","CANCELLED").entrySet()) {
            var operation=mock(BaitlyCommerceOperation.class); when(operation.getAction()).thenReturn(state.getKey());
            when(operations.history(1L,"UPSELL",8L)).thenReturn(List.of(operation));
            assertThat(service.forGuest(token).getFirst().state()).isEqualTo(state.getValue());
        }
        order.setStatus(UpsellOrderStatus.REFUNDED);
        assertThat(service.forGuest(token).getFirst().state()).isEqualTo("REFUNDED");
        order.setFulfillmentServiceCode(null);
        assertThat(service.forGuest(token)).hasSize(1);
    }
}
