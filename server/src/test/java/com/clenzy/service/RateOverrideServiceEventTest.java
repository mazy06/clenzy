package com.clenzy.service;

import com.clenzy.dto.RateOverrideDto;
import com.clenzy.model.Property;
import com.clenzy.model.RateOverride;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RateOverrideRepository;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Verifie qu'un changement de prix (RateOverride) publie bien un event calendrier
 * dans l'outbox — sinon le prix ne se propage PAS aux canaux (Channex).
 * Bug decouvert pendant la certification Channex (2026-07-09) : create/createBulk/
 * delete sauvaient le prix sans emettre d'event, contrairement aux restrictions.
 */
class RateOverrideServiceEventTest {

    private RateOverrideRepository rateOverrideRepository;
    private PropertyRepository propertyRepository;
    private ReservationService reservationService;
    private TenantContext tenantContext;
    private SearchCacheInvalidator searchCacheInvalidator;
    private OutboxPublisher outboxPublisher;
    private RateOverrideService service;

    @BeforeEach
    void setUp() {
        rateOverrideRepository = mock(RateOverrideRepository.class);
        propertyRepository = mock(PropertyRepository.class);
        reservationService = mock(ReservationService.class);
        tenantContext = mock(TenantContext.class);
        searchCacheInvalidator = mock(SearchCacheInvalidator.class);
        outboxPublisher = mock(OutboxPublisher.class);

        service = new RateOverrideService(rateOverrideRepository, propertyRepository,
            reservationService, tenantContext, searchCacheInvalidator,
            outboxPublisher, new ObjectMapper());

        Property property = new Property();
        property.setId(100L);
        property.setDefaultCurrency("EUR");
        when(tenantContext.getRequiredOrganizationId()).thenReturn(42L);
        when(propertyRepository.findById(eq(100L))).thenReturn(java.util.Optional.of(property));
        when(rateOverrideRepository.save(any(RateOverride.class)))
            .thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    @DisplayName("create(prix 1 date) -> publie un event RATE_UPDATED sur [date, date]")
    void createPublishesRateEvent() {
        RateOverrideDto dto = new RateOverrideDto(null, 100L, "2026-07-11", 129.0, "MANUAL", "EUR");

        service.create(dto, "kc-user");

        verify(outboxPublisher).publishCalendarEvent(
            eq("RATE_UPDATED"), eq(100L), eq(42L),
            org.mockito.ArgumentMatchers.contains("2026-07-11"));
    }

    @Test
    @DisplayName("createBulk([from, to)) -> event RATE_UPDATED inclusif [from, to-1]")
    void createBulkPublishesInclusiveRateEvent() {
        var body = new java.util.HashMap<String, Object>();
        body.put("propertyId", 100L);
        body.put("from", "2026-07-11");
        body.put("to", "2026-07-14"); // exclusif -> 11, 12, 13
        body.put("nightlyPrice", 150.0);

        service.createBulk(body, "kc-user");

        var payloadCap = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(outboxPublisher).publishCalendarEvent(eq("RATE_UPDATED"), eq(100L), eq(42L),
            payloadCap.capture());
        // Plage inclusive : dernier soir override = 13 (to-1), pas 14.
        assertThat(payloadCap.getValue()).contains("\"from\":\"2026-07-11\"");
        assertThat(payloadCap.getValue()).contains("\"to\":\"2026-07-13\"");
    }

    @Test
    @DisplayName("create sur une date déjà surchargée -> UPDATE en place (pas d'INSERT/duplicate)")
    void createUpsertsExistingOverride() {
        Property property = new Property();
        property.setId(100L);
        RateOverride existing = new RateOverride(property, LocalDate.of(2026, 7, 11),
            new java.math.BigDecimal("120.00"), "MANUAL", 42L);
        when(rateOverrideRepository.findByPropertyIdAndDate(
                eq(100L), eq(LocalDate.of(2026, 7, 11)), eq(42L)))
            .thenReturn(java.util.Optional.of(existing));

        RateOverrideDto dto = new RateOverrideDto(null, 100L, "2026-07-11", 199.0, "MANUAL", "EUR");
        service.create(dto, "kc-user");

        // L'existant est mis à jour (nouveau prix) et re-sauvé — pas un nouvel insert.
        assertThat(existing.getNightlyPrice()).isEqualByComparingTo("199.00");
        verify(rateOverrideRepository).save(existing);
    }

    @Test
    @DisplayName("delete(override) -> publie un event RATE_UPDATED (retour au prix de base)")
    void deletePublishesRateEvent() {
        Property property = new Property();
        property.setId(100L);
        RateOverride existing = new RateOverride(property, LocalDate.of(2026, 7, 11),
            new java.math.BigDecimal("129.00"), "MANUAL", 42L);
        when(rateOverrideRepository.findById(eq(7L))).thenReturn(java.util.Optional.of(existing));

        service.delete(7L, "kc-user");

        verify(outboxPublisher).publishCalendarEvent(
            eq("RATE_UPDATED"), eq(100L), eq(42L),
            org.mockito.ArgumentMatchers.contains("2026-07-11"));
    }
}
