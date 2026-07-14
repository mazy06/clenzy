package com.clenzy.service;

import com.clenzy.dto.RatePlanDto;
import com.clenzy.model.Property;
import com.clenzy.model.RatePlan;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RatePlanRepository;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Vérifie qu'un changement de plan tarifaire (RatePlan) publie un event
 * calendrier — sinon le prix de base ne se propage PAS aux canaux (Channex).
 * Gap découvert pendant la certification Channex (2026-07-09) : le formulaire
 * "New Plan" (POST /api/rate-plans) n'émettait aucun event, contrairement aux
 * RateOverride par nuit.
 */
class RatePlanServiceEventTest {

    private RatePlanRepository ratePlanRepository;
    private PropertyRepository propertyRepository;
    private ReservationService reservationService;
    private TenantContext tenantContext;
    private OutboxPublisher outboxPublisher;
    private RatePlanService service;

    @BeforeEach
    void setUp() {
        ratePlanRepository = mock(RatePlanRepository.class);
        propertyRepository = mock(PropertyRepository.class);
        reservationService = mock(ReservationService.class);
        tenantContext = mock(TenantContext.class);
        outboxPublisher = mock(OutboxPublisher.class);
        // Horloge fixe (2026-07-01) pour borner "aujourd'hui" et rendre le test déterministe.
        Clock clock = Clock.fixed(Instant.parse("2026-07-01T00:00:00Z"), ZoneOffset.UTC);

        service = new RatePlanService(ratePlanRepository, propertyRepository,
            reservationService, tenantContext, outboxPublisher, new ObjectMapper(), clock);

        Property property = new Property();
        property.setId(100L);
        property.setDefaultCurrency("EUR");
        when(tenantContext.getRequiredOrganizationId()).thenReturn(42L);
        when(propertyRepository.findById(eq(100L))).thenReturn(java.util.Optional.of(property));
        when(ratePlanRepository.save(any(RatePlan.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    @DisplayName("create(plan Base sur 3→9 juillet) -> event RATE_UPDATED inclusif [3, 9]")
    void createPlanPublishesRateEventOverPeriod() {
        RatePlanDto dto = new RatePlanDto(null, 100L, "Test channex", "BASE", 1,
            600.0, "EUR", "2026-07-03", "2026-07-09", null, null, true);

        service.create(dto, "kc-user");

        var payloadCap = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(outboxPublisher).publishCalendarEvent(eq("RATE_UPDATED"), eq(100L), eq(42L),
            payloadCap.capture());
        assertThat(payloadCap.getValue()).contains("\"from\":\"2026-07-03\"");
        assertThat(payloadCap.getValue()).contains("\"to\":\"2026-07-09\"");
    }

    @Test
    @DisplayName("create(plan sans dates) -> event borné à [aujourd'hui, +500j], jamais le passé")
    void createOpenEndedPlanPublishesDefaultWindow() {
        RatePlanDto dto = new RatePlanDto(null, 100L, "Base ouvert", "BASE", 0,
            150.0, "EUR", null, null, null, null, true);

        service.create(dto, "kc-user");

        var payloadCap = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(outboxPublisher).publishCalendarEvent(eq("RATE_UPDATED"), eq(100L), eq(42L),
            payloadCap.capture());
        // Horloge fixée au 2026-07-01 -> from = aujourd'hui.
        assertThat(payloadCap.getValue()).contains("\"from\":\"2026-07-01\"");
    }
}
