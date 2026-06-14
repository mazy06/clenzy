package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.config.ChannexMetrics;
import com.clenzy.integration.channex.dto.ChannexRatePlanSettingsUpdate;
import com.clenzy.integration.channex.exception.ChannexException;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.model.ChannexSyncStatus;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.LengthOfStayDiscount;
import com.clenzy.model.OccupancyPricing;
import com.clenzy.model.PriceSourceOfTruth;
import com.clenzy.model.Property;
import com.clenzy.model.RatePlan;
import com.clenzy.model.RatePlanType;
import com.clenzy.repository.BookingRestrictionRepository;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.LengthOfStayDiscountRepository;
import com.clenzy.repository.OccupancyPricingRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RatePlanRepository;
import com.clenzy.service.PriceEngine;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests dedies a {@link ChannexSyncService#pushPricingSettings} — Phase 5 OTA
 * pricing (push complet bidirectionnel).
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ChannexSyncService — Phase 5 pushPricingSettings")
class ChannexSyncServicePricingPushTest {

    @Mock private ChannexClient channexClient;
    @Mock private ChannexPropertyMappingRepository mappingRepository;
    @Mock private CalendarDayRepository calendarDayRepository;
    @Mock private PriceEngine priceEngine;
    @Mock private ChannexSyncLogService syncLogService;
    @Mock private PropertyRepository propertyRepository;
    @Mock private BookingRestrictionRepository bookingRestrictionRepository;
    @Mock private OccupancyPricingRepository occupancyPricingRepository;
    @Mock private LengthOfStayDiscountRepository lengthOfStayDiscountRepository;
    @Mock private RatePlanRepository ratePlanRepository;

    private ChannexSyncService service;

    @BeforeEach
    void setUp() {
        service = new ChannexSyncService(
            channexClient, mappingRepository, calendarDayRepository, priceEngine, new ObjectMapper(),
            new ChannexMetrics(new SimpleMeterRegistry()),
            syncLogService, propertyRepository,
            bookingRestrictionRepository, occupancyPricingRepository,
            lengthOfStayDiscountRepository, ratePlanRepository
        );
    }

    private ChannexPropertyMapping mapping() {
        ChannexPropertyMapping m = new ChannexPropertyMapping();
        m.setId(UUID.randomUUID());
        m.setOrganizationId(42L);
        m.setClenzyPropertyId(100L);
        m.setChannexPropertyId("channex-prop-abc");
        m.setChannexDefaultRatePlanId("channex-rate-1");
        m.setSyncStatus(ChannexSyncStatus.ACTIVE);
        return m;
    }

    private Property propertyClenzy() {
        Property p = new Property();
        p.setId(100L);
        p.setOrganizationId(42L);
        p.setName("Studio Test");
        p.setNightlyPrice(new BigDecimal("89.00"));
        p.setMinimumNights(2);
        p.setMaximumNights(30);
        p.setPriceSourceOfTruth(PriceSourceOfTruth.CLENZY);
        p.setDefaultCurrency("EUR");
        return p;
    }

    private RatePlan weekendPlan(BigDecimal price) {
        RatePlan rp = new RatePlan();
        rp.setType(RatePlanType.WEEKEND);
        rp.setNightlyPrice(price);
        rp.setIsActive(true);
        return rp;
    }

    private OccupancyPricing op(int base, BigDecimal extra) {
        OccupancyPricing o = new OccupancyPricing();
        o.setBaseOccupancy(base);
        o.setExtraGuestFee(extra);
        return o;
    }

    private LengthOfStayDiscount losPercentage(int minNights, double pct) {
        LengthOfStayDiscount d = new LengthOfStayDiscount();
        d.setMinNights(minNights);
        d.setDiscountType(LengthOfStayDiscount.DiscountType.PERCENTAGE);
        d.setDiscountValue(BigDecimal.valueOf(pct));
        d.setActive(true);
        return d;
    }

    @Test
    @DisplayName("pushPricingSettings: payload complet (nightly + weekend + occupancy + LOS + min/max) -> PUT avec tous les champs")
    void pushSettings_fullPayload() {
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenReturn(Optional.of(mapping()));
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(propertyClenzy()));
        when(ratePlanRepository.findByPropertyIdAndType(100L, RatePlanType.WEEKEND, 42L))
            .thenReturn(List.of(weekendPlan(new BigDecimal("119.00"))));
        when(occupancyPricingRepository.findByPropertyId(100L, 42L))
            .thenReturn(Optional.of(op(2, new BigDecimal("15.00"))));
        when(lengthOfStayDiscountRepository.findApplicable(eq(100L), eq(7), eq(42L)))
            .thenReturn(List.of(losPercentage(7, 12.0)));
        when(lengthOfStayDiscountRepository.findApplicable(eq(100L), eq(28), eq(42L)))
            .thenReturn(List.of(losPercentage(28, 20.0)));

        ChannexSyncService.ChannexSyncResult result = service.pushPricingSettings(100L, 42L);

        assertThat(result.success()).isTrue();
        ArgumentCaptor<ChannexRatePlanSettingsUpdate> captor =
            ArgumentCaptor.forClass(ChannexRatePlanSettingsUpdate.class);
        verify(channexClient).updateRatePlanSettings(eq("channex-rate-1"), captor.capture());
        ChannexRatePlanSettingsUpdate update = captor.getValue();
        assertThat(update.defaultDailyPrice()).isEqualByComparingTo("89.00");
        assertThat(update.weekendPrice()).isEqualByComparingTo("119.00");
        assertThat(update.guestsIncluded()).isEqualTo(2);
        assertThat(update.pricePerExtraPerson()).isEqualByComparingTo("15.00");
        assertThat(update.weeklyPriceFactor()).isEqualTo(12.0);
        assertThat(update.monthlyPriceFactor()).isEqualTo(20.0);
        assertThat(update.defaultMinNights()).isEqualTo(2);
        assertThat(update.defaultMaxNights()).isEqualTo(30);
    }

    @Test
    @DisplayName("pushPricingSettings: mapping inexistant -> success=false, pas d'appel API")
    void pushSettings_noMapping() {
        when(mappingRepository.findByClenzyPropertyId(anyLong(), anyLong())).thenReturn(Optional.empty());

        ChannexSyncService.ChannexSyncResult result = service.pushPricingSettings(100L, 42L);

        assertThat(result.success()).isFalse();
        assertThat(result.message()).contains("Aucun mapping");
        verify(channexClient, never()).updateRatePlanSettings(any(), any());
    }

    @Test
    @DisplayName("pushPricingSettings: property en mode OTA -> skip sans push")
    void pushSettings_skipIfModeOta() {
        Property otaProp = propertyClenzy();
        otaProp.setPriceSourceOfTruth(PriceSourceOfTruth.OTA);
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenReturn(Optional.of(mapping()));
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(otaProp));

        ChannexSyncService.ChannexSyncResult result = service.pushPricingSettings(100L, 42L);

        assertThat(result.success()).isTrue();
        assertThat(result.message()).contains("price_source_of_truth=OTA");
        verify(channexClient, never()).updateRatePlanSettings(any(), any());
    }

    @Test
    @DisplayName("pushPricingSettings: aucune donnee tarifaire -> success + skip (no-op)")
    void pushSettings_emptyPayload() {
        Property prop = propertyClenzy();
        prop.setNightlyPrice(null);
        prop.setMinimumNights(null);
        prop.setMaximumNights(null);
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenReturn(Optional.of(mapping()));
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(prop));
        when(ratePlanRepository.findByPropertyIdAndType(any(), any(), any())).thenReturn(List.of());
        when(occupancyPricingRepository.findByPropertyId(any(), any())).thenReturn(Optional.empty());
        when(lengthOfStayDiscountRepository.findApplicable(any(), anyInt(), any())).thenReturn(List.of());

        ChannexSyncService.ChannexSyncResult result = service.pushPricingSettings(100L, 42L);

        assertThat(result.success()).isTrue();
        assertThat(result.message()).contains("aucune donnee");
        verify(channexClient, never()).updateRatePlanSettings(any(), any());
    }

    @Test
    @DisplayName("pushPricingSettings: erreur Channex (5xx) -> success=false avec message d'erreur")
    void pushSettings_channexError() {
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenReturn(Optional.of(mapping()));
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(propertyClenzy()));
        when(ratePlanRepository.findByPropertyIdAndType(any(), any(), any())).thenReturn(List.of());
        when(occupancyPricingRepository.findByPropertyId(any(), any())).thenReturn(Optional.empty());
        when(lengthOfStayDiscountRepository.findApplicable(any(), anyInt(), any())).thenReturn(List.of());
        doThrow(new ChannexException(ChannexException.Kind.SERVER_ERROR, "503 Service Unavailable"))
            .when(channexClient).updateRatePlanSettings(any(), any());

        ChannexSyncService.ChannexSyncResult result = service.pushPricingSettings(100L, 42L);

        assertThat(result.success()).isFalse();
        assertThat(result.message()).contains("503");
    }

    @Test
    @DisplayName("pushPricingSettings: pas de rate_plan_id mapping -> success=false")
    void pushSettings_noRatePlanId() {
        ChannexPropertyMapping m = mapping();
        m.setChannexDefaultRatePlanId(null);
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L))).thenReturn(Optional.of(m));

        ChannexSyncService.ChannexSyncResult result = service.pushPricingSettings(100L, 42L);

        assertThat(result.success()).isFalse();
        assertThat(result.message()).contains("rate_plan_id");
        verify(channexClient, never()).updateRatePlanSettings(any(), any());
    }

    // ─── T2 : pushRatesForRange avec BookingRestriction (Phase 5) ──────────

    @org.mockito.Mock private com.clenzy.repository.CalendarDayRepository calendarDayRepoMock;

    @Test
    @DisplayName("pushRatesForRange : BookingRestriction applicable -> ChannexRateUpdate enrichi avec min_stay + CTA + CTD")
    void pushRates_enrichedWithBookingRestriction() {
        // Setup mapping + property en mode CLENZY
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenReturn(Optional.of(mapping()));
        when(channexClient.hasActiveOtaChannel(eq("channex-prop-abc"))).thenReturn(true);

        // PriceEngine resoud 3 jours
        java.time.LocalDate d1 = java.time.LocalDate.of(2026, 7, 1);
        java.time.LocalDate d2 = java.time.LocalDate.of(2026, 7, 2);
        java.time.LocalDate d3 = java.time.LocalDate.of(2026, 7, 3);
        when(priceEngine.resolvePriceRange(eq(100L), any(), any(), eq(42L)))
            .thenReturn(java.util.Map.of(
                d1, new BigDecimal("100"),
                d2, new BigDecimal("110"),
                d3, new BigDecimal("120")
            ));

        // Une BookingRestriction couvre les 3 jours : min=3, CTA=false, CTD=true
        com.clenzy.model.BookingRestriction br = new com.clenzy.model.BookingRestriction();
        br.setStartDate(d1);
        br.setEndDate(d3);
        br.setMinStay(3);
        br.setMinStayArrival(2);
        br.setClosedToArrival(false);
        br.setClosedToDeparture(true);
        br.setPriority(10);
        when(bookingRestrictionRepository.findApplicable(eq(100L), any(), any(), eq(42L)))
            .thenReturn(java.util.List.of(br));

        ChannexSyncService.ChannexSyncResult result = service.pushProperty(100L, 42L, d1, d3);

        assertThat(result.success()).isTrue();
        ArgumentCaptor<java.util.List<com.clenzy.integration.channex.dto.ChannexRateUpdate>> captor =
            ArgumentCaptor.forClass(java.util.List.class);
        verify(channexClient).pushRates(captor.capture());
        java.util.List<com.clenzy.integration.channex.dto.ChannexRateUpdate> sent = captor.getValue();
        assertThat(sent).allSatisfy(u -> {
            assertThat(u.minStayThrough()).isEqualTo(3);
            assertThat(u.minStayArrival()).isEqualTo(2);
            assertThat(u.closedToArrival()).isFalse();
            assertThat(u.closedToDeparture()).isTrue();
        });
    }

    @Test
    @DisplayName("pushRatesForRange : aucune BookingRestriction -> ChannexRateUpdate avec restrictions null")
    void pushRates_noBookingRestriction_nullFields() {
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
            .thenReturn(Optional.of(mapping()));
        when(channexClient.hasActiveOtaChannel(eq("channex-prop-abc"))).thenReturn(true);
        java.time.LocalDate d = java.time.LocalDate.of(2026, 7, 1);
        when(priceEngine.resolvePriceRange(eq(100L), any(), any(), eq(42L)))
            .thenReturn(java.util.Map.of(d, new BigDecimal("100")));
        when(bookingRestrictionRepository.findApplicable(eq(100L), any(), any(), eq(42L)))
            .thenReturn(java.util.List.of());

        service.pushProperty(100L, 42L, d, d);

        ArgumentCaptor<java.util.List<com.clenzy.integration.channex.dto.ChannexRateUpdate>> captor =
            ArgumentCaptor.forClass(java.util.List.class);
        verify(channexClient).pushRates(captor.capture());
        assertThat(captor.getValue().get(0).minStayThrough()).isNull();
        assertThat(captor.getValue().get(0).closedToArrival()).isNull();
        assertThat(captor.getValue().get(0).closedToDeparture()).isNull();
    }

    @Test
    @DisplayName("multi-rate-plan : push fan-out sur le rate plan defaut + les additionnels")
    void pushRates_fansOutAcrossMultipleRatePlans() {
        ChannexPropertyMapping m = mapping();
        m.setChannexRatePlanIds("channex-rate-2"); // defaut channex-rate-1 + additionnel channex-rate-2
        when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L))).thenReturn(Optional.of(m));
        when(channexClient.hasActiveOtaChannel(eq("channex-prop-abc"))).thenReturn(true);
        java.time.LocalDate d = java.time.LocalDate.of(2026, 7, 1);
        when(priceEngine.resolvePriceRange(eq(100L), any(), any(), eq(42L)))
            .thenReturn(java.util.Map.of(d, new BigDecimal("100")));
        when(bookingRestrictionRepository.findApplicable(eq(100L), any(), any(), eq(42L)))
            .thenReturn(java.util.List.of());

        service.pushProperty(100L, 42L, d, d);

        ArgumentCaptor<java.util.List<com.clenzy.integration.channex.dto.ChannexRateUpdate>> captor =
            ArgumentCaptor.forClass(java.util.List.class);
        verify(channexClient).pushRates(captor.capture());
        assertThat(captor.getValue())
            .extracting(com.clenzy.integration.channex.dto.ChannexRateUpdate::channexRatePlanId)
            .containsExactlyInAnyOrder("channex-rate-1", "channex-rate-2");
    }
}
