package com.clenzy.marketplace.service;

import com.clenzy.dto.ServiceRequestDto;
import com.clenzy.marketplace.model.*;
import com.clenzy.marketplace.repository.MarketplaceRecurrenceRepository;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.ServiceRequestService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.*;
import org.mockito.ArgumentCaptor;
import java.time.*;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MarketplaceRecurrenceServiceTest {
    final MarketplaceQuoteMissionFactory access = mock(MarketplaceQuoteMissionFactory.class);
    final MarketplaceRecurrenceRepository plans = mock(MarketplaceRecurrenceRepository.class);
    final PropertyRepository properties = mock(PropertyRepository.class);
    final InterventionRepository interventions = mock(InterventionRepository.class);
    final ServiceRequestService requests = mock(ServiceRequestService.class);
    final com.clenzy.marketplace.repository.MarketplaceServiceItemRepository items = mock(com.clenzy.marketplace.repository.MarketplaceServiceItemRepository.class);
    final TenantContext tenant = new TenantContext();
    final Clock clock = Clock.fixed(Instant.parse("2026-09-15T12:00:00Z"), ZoneOffset.UTC);
    MarketplaceRecurrenceService service;
    MarketplaceQuoteRequest quote;
    MarketplaceRecurrence plan;

    @BeforeEach void setup() {
        tenant.setOrganizationId(7L);
        service = new MarketplaceRecurrenceService(access, plans, properties, requests, tenant, clock, interventions, items);
        quote = new MarketplaceQuoteRequest(); quote.setId(9L); quote.setRequesterOrganizationId(7L);
        quote.setStatus(QuoteRequestStatus.ACCEPTED); quote.setInterventionId(5L); quote.setPropertyId(3L);
        quote.setTitle("Entretien chaudière"); quote.setQuotedAmount(new java.math.BigDecimal("250"));
        when(access.lock(9L, 7L)).thenReturn(quote);
        plan = new MarketplaceRecurrence(); plan.setQuoteRequestId(9L); plan.setOrganizationId(7L);
        plan.setConsentOwnerId(11L); plan.setEnabled(true);
        plan.configure(LocalDate.of(2026, 9, 20), "MONTHS", 12, 14);
        when(plans.findById(9L)).thenReturn(Optional.of(plan));
    }
    @AfterEach void clear() { tenant.clear(); }
    void property() {
        User owner = new User(); owner.setId(11L);
        Property property = new Property(); property.setId(3L); property.setOwner(owner);
        when(properties.findByIdWithOwner(3L, 7L)).thenReturn(Optional.of(property));
        Intervention source = new Intervention(); source.setOrganizationId(7L);
        source.setType("PREVENTIVE_MAINTENANCE"); source.setStatus(InterventionStatus.COMPLETED);
        when(interventions.findById(5L)).thenReturn(Optional.of(source));
    }
    @Test void createsANewRequestWithoutCopyingTheCommercialAgreementThenAdvances() {
        property(); when(requests.createRecurringRequest(any(), eq(9L))).thenReturn(42L);
        service.generate(9L);
        var dto = ArgumentCaptor.forClass(ServiceRequestDto.class);
        verify(requests).createRecurringRequest(dto.capture(), eq(9L));
        assertThat(dto.getValue().estimatedCost).isNull();
        assertThat(dto.getValue().assignedToId).isNull();
        assertThat(dto.getValue().reservationId).isNull();
        assertThat(dto.getValue().serviceType).isEqualTo(ServiceType.PREVENTIVE_MAINTENANCE);
        assertThat(plan.getNextDate()).isEqualTo(LocalDate.of(2027, 9, 20));
        assertThat(plan.getLastRequestId()).isEqualTo(42L);
        service.generate(9L);
        verifyNoMoreInteractions(requests);
    }
    @Test void failureDoesNotAdvanceTheSchedule() {
        property(); when(requests.createRecurringRequest(any(), any())).thenThrow(new IllegalStateException("rollback"));
        assertThatThrownBy(() -> service.generate(9L)).hasMessage("rollback");
        assertThat(plan.getNextDate()).isEqualTo(LocalDate.of(2026, 9, 20));
        assertThat(plan.getLastRequestId()).isNull();
    }
    @Test void ownershipChangeSuspendsGeneration() {
        property(); plan.setConsentOwnerId(99L);
        service.generate(9L);
        assertThat(plan.isEnabled()).isFalse(); verifyNoInteractions(requests);
    }
    @Test void cancelledSourceSuspendsGeneration() {
        property(); interventions.findById(5L).orElseThrow().setStatus(InterventionStatus.CANCELLED);
        service.generate(9L);
        assertThat(plan.isEnabled()).isFalse(); verifyNoInteractions(requests);
    }
    @Test void pausedPlanDoesNothing() {
        plan.setEnabled(false); service.generate(9L); verifyNoInteractions(requests, properties);
    }
    @Test void generationUsesThePropertyDateAcrossTheInternationalDateLine() {
        property();
        var property = properties.findByIdWithOwner(3L, 7L).orElseThrow();
        plan.configure(LocalDate.of(2026, 9, 16), "MONTHS", 1, 0);
        property.setTimezone("America/Los_Angeles");
        service.generate(9L); verifyNoInteractions(requests);
        property.setTimezone("Pacific/Kiritimati");
        when(requests.createRecurringRequest(any(), eq(9L))).thenReturn(42L);
        service.generate(9L); verify(requests).createRecurringRequest(any(), eq(9L));
    }
    @Test void staleConfigurationCannotOverwriteTheScheduler() {
        assertThatThrownBy(() -> service.configure(9L,
                new MarketplaceRecurrenceService.Command(9L, true, LocalDate.of(2026, 10, 1), "MONTHS", 12, 14), null))
                .hasMessageContaining("changé");
        verify(plans, never()).saveAndFlush(any());
    }
    @Test void calendarAnchorDoesNotDriftAfterFebruary() {
        plan.configure(LocalDate.of(2027, 1, 31), "MONTHS", 1, 7);
        plan.generated(1L); assertThat(plan.getNextDate()).isEqualTo(LocalDate.of(2027, 2, 28));
        plan.generated(2L); assertThat(plan.getNextDate()).isEqualTo(LocalDate.of(2027, 3, 31));
    }
    @Test void permissionsAreCheckedBeforeWriting() {
        doThrow(new org.springframework.security.access.AccessDeniedException("interdit"))
                .when(access).assertCanDecide(quote, 7L, null);
        assertThatThrownBy(() -> service.configure(9L,
                new MarketplaceRecurrenceService.Command(0L, false, null, null, 0, 0), null))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        assertThat(plan.isEnabled()).isTrue();
    }
    @Test void perStayServicesMustUseTheExistingReservationFlow() {
        quote.setServiceItemCode("cleaning-turnover");
        var item = new MarketplaceServiceItem(); item.setRecurrence(ServiceRecurrence.PER_STAY);
        when(items.findByCode("cleaning-turnover")).thenReturn(Optional.of(item));
        assertThatThrownBy(() -> service.configure(9L,
                new MarketplaceRecurrenceService.Command(0L, true, LocalDate.of(2026, 10, 1), "DAYS", 7, 3), null))
                .hasMessageContaining("séjours");
        verify(plans, never()).saveAndFlush(any());
    }
}
