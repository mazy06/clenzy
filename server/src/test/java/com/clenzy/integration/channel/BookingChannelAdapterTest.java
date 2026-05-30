package com.clenzy.integration.channel;

import com.clenzy.integration.booking.config.BookingConfig;
import com.clenzy.integration.booking.model.BookingConnection;
import com.clenzy.integration.booking.repository.BookingConnectionRepository;
import com.clenzy.integration.booking.service.BookingApiClient;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.model.BookingRestriction;
import com.clenzy.model.CalendarDay;
import com.clenzy.model.CalendarDayStatus;
import com.clenzy.model.CancellationPolicyType;
import com.clenzy.model.ChannelCancellationPolicy;
import com.clenzy.model.ChannelContentMapping;
import com.clenzy.model.ChannelFee;
import com.clenzy.model.ChannelPromotion;
import com.clenzy.model.ChargeType;
import com.clenzy.model.FeeType;
import com.clenzy.model.PromotionType;
import com.clenzy.repository.BookingRestrictionRepository;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.service.PriceEngine;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BookingChannelAdapterTest {

    @Mock private BookingConfig bookingConfig;
    @Mock private BookingApiClient bookingApiClient;
    @Mock private BookingConnectionRepository bookingConnectionRepository;
    @Mock private ChannelMappingRepository channelMappingRepository;
    @Mock private PriceEngine priceEngine;
    @Mock private BookingRestrictionRepository bookingRestrictionRepository;
    @Mock private CalendarDayRepository calendarDayRepository;
    @Mock private HostProfileSyncSupport hostProfileSyncSupport;

    private BookingChannelAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new BookingChannelAdapter(bookingConfig, bookingApiClient,
                bookingConnectionRepository, channelMappingRepository, priceEngine,
                bookingRestrictionRepository, calendarDayRepository, hostProfileSyncSupport);
    }

    @Test
    void channelName() {
        assertThat(adapter.getChannelName()).isEqualTo(ChannelName.BOOKING);
    }

    @Test
    void capabilities() {
        assertThat(adapter.getCapabilities()).containsExactlyInAnyOrder(
                ChannelCapability.INBOUND_CALENDAR,
                ChannelCapability.OUTBOUND_CALENDAR,
                ChannelCapability.INBOUND_RESERVATIONS,
                ChannelCapability.OUTBOUND_RESERVATIONS,
                ChannelCapability.WEBHOOKS,
                ChannelCapability.PROMOTIONS,
                ChannelCapability.OUTBOUND_RESTRICTIONS,
                ChannelCapability.CONTENT_SYNC,
                ChannelCapability.FEES,
                ChannelCapability.CANCELLATION_POLICIES,
                ChannelCapability.OUTBOUND_HOST_PROFILE
        );
    }

    @Nested
    @DisplayName("resolveMapping")
    class ResolveMappingTests {

        @Test
        @DisplayName("returns mapping when found")
        void resolveMapping_found() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(channelMappingRepository.findByPropertyIdAndChannel(1L, ChannelName.BOOKING, 1L))
                    .thenReturn(Optional.of(mapping));

            Optional<ChannelMapping> result = adapter.resolveMapping(1L, 1L);
            assertThat(result).isPresent();
        }

        @Test
        @DisplayName("returns empty when not found")
        void resolveMapping_notFound() {
            when(channelMappingRepository.findByPropertyIdAndChannel(1L, ChannelName.BOOKING, 1L))
                    .thenReturn(Optional.empty());

            Optional<ChannelMapping> result = adapter.resolveMapping(1L, 1L);
            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("pushCalendarUpdate")
    class PushCalendarUpdateTests {

        private final Long propertyId = 42L;
        private final Long orgId = 1L;
        private final LocalDate from = LocalDate.of(2026, 3, 1);
        private final LocalDate to = LocalDate.of(2026, 3, 15);

        @Test
        @DisplayName("returns SKIPPED when no mapping exists")
        void pushCalendarUpdate_noMapping() {
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.empty());

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("Aucun mapping Booking.com");
        }

        @Test
        @DisplayName("returns FAILED when config is incomplete")
        void pushCalendarUpdate_configIncomplete() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-123");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(false);

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
            assertThat(result.getMessage()).contains("Configuration Booking.com incomplete");
        }

        @Test
        @DisplayName("returns SUCCESS when API call succeeds")
        void pushCalendarUpdate_success() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-123");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(true);
            when(priceEngine.resolvePriceRange(propertyId, from, to, orgId))
                    .thenReturn(Map.of(from, new BigDecimal("100.00")));
            when(bookingApiClient.updateAvailability(anyList())).thenReturn(true);
            when(bookingApiClient.updateRates(anyList())).thenReturn(true);

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SUCCESS);
        }

        @Test
        @DisplayName("returns FAILED when API call returns false")
        void pushCalendarUpdate_apiFailure() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-123");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(true);
            when(priceEngine.resolvePriceRange(propertyId, from, to, orgId))
                    .thenReturn(Map.of(from, new BigDecimal("100.00")));
            when(bookingApiClient.updateAvailability(anyList())).thenReturn(false);

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
            assertThat(result.getMessage()).contains("Echec partiel");
        }

        @Test
        @DisplayName("returns FAILED when API throws exception")
        void pushCalendarUpdate_exception() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-123");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(true);
            when(priceEngine.resolvePriceRange(propertyId, from, to, orgId))
                    .thenReturn(Map.of(from, new BigDecimal("100.00")));
            when(bookingApiClient.updateAvailability(anyList()))
                    .thenThrow(new RuntimeException("Connection timeout"));

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
            assertThat(result.getMessage()).contains("Erreur API Booking.com");
            assertThat(result.getMessage()).contains("Connection timeout");
        }
    }

    @Nested
    @DisplayName("checkHealth")
    class CheckHealthTests {

        @Test
        @DisplayName("returns UNKNOWN when connection not found")
        void checkHealth_connectionNotFound() {
            when(bookingConnectionRepository.findById(99L)).thenReturn(Optional.empty());

            HealthStatus status = adapter.checkHealth(99L);
            assertThat(status).isEqualTo(HealthStatus.UNKNOWN);
        }

        @Test
        @DisplayName("returns UNHEALTHY when connection is inactive")
        void checkHealth_inactive() {
            BookingConnection connection = new BookingConnection();
            connection.setStatus(BookingConnection.BookingConnectionStatus.INACTIVE);
            when(bookingConnectionRepository.findById(1L)).thenReturn(Optional.of(connection));

            HealthStatus status = adapter.checkHealth(1L);
            assertThat(status).isEqualTo(HealthStatus.UNHEALTHY);
        }

        @Test
        @DisplayName("returns UNHEALTHY when config is not configured")
        void checkHealth_configNotConfigured() {
            BookingConnection connection = new BookingConnection();
            connection.setStatus(BookingConnection.BookingConnectionStatus.ACTIVE);
            when(bookingConnectionRepository.findById(1L)).thenReturn(Optional.of(connection));
            when(bookingConfig.isConfigured()).thenReturn(false);

            HealthStatus status = adapter.checkHealth(1L);
            assertThat(status).isEqualTo(HealthStatus.UNHEALTHY);
        }

        @Test
        @DisplayName("returns HEALTHY when active with recent sync")
        void checkHealth_healthyRecentSync() {
            BookingConnection connection = new BookingConnection();
            connection.setStatus(BookingConnection.BookingConnectionStatus.ACTIVE);
            connection.setLastSyncAt(LocalDateTime.now().minusMinutes(30));
            when(bookingConnectionRepository.findById(1L)).thenReturn(Optional.of(connection));
            when(bookingConfig.isConfigured()).thenReturn(true);

            HealthStatus status = adapter.checkHealth(1L);
            assertThat(status).isEqualTo(HealthStatus.HEALTHY);
        }

        @Test
        @DisplayName("returns DEGRADED when active but has error message and no recent sync")
        void checkHealth_degraded() {
            BookingConnection connection = new BookingConnection();
            connection.setStatus(BookingConnection.BookingConnectionStatus.ACTIVE);
            connection.setLastSyncAt(LocalDateTime.now().minusHours(2));
            connection.setErrorMessage("Temporary API error");
            when(bookingConnectionRepository.findById(1L)).thenReturn(Optional.of(connection));
            when(bookingConfig.isConfigured()).thenReturn(true);

            HealthStatus status = adapter.checkHealth(1L);
            assertThat(status).isEqualTo(HealthStatus.DEGRADED);
        }

        @Test
        @DisplayName("returns HEALTHY when active with no recent sync but no error")
        void checkHealth_healthyNoRecentSyncNoError() {
            BookingConnection connection = new BookingConnection();
            connection.setStatus(BookingConnection.BookingConnectionStatus.ACTIVE);
            connection.setLastSyncAt(LocalDateTime.now().minusHours(2));
            connection.setErrorMessage(null);
            when(bookingConnectionRepository.findById(1L)).thenReturn(Optional.of(connection));
            when(bookingConfig.isConfigured()).thenReturn(true);

            HealthStatus status = adapter.checkHealth(1L);
            assertThat(status).isEqualTo(HealthStatus.HEALTHY);
        }
    }

    @Nested
    @DisplayName("handleInboundEvent")
    class HandleInboundEventTests {

        @Test
        @DisplayName("does not throw on any event type (delegates to Kafka consumers)")
        void handleInboundEvent_noOp() {
            // handleInboundEvent is a no-op for Booking — it delegates to Kafka consumers
            adapter.handleInboundEvent("calendar.updated", Map.of(), 1L);
            // No exception should be thrown; no mock interactions expected
        }
    }

    @Nested
    @DisplayName("pushReservationUpdate")
    class PushReservationUpdateTests {

        @Test
        @DisplayName("returns SKIPPED — Booking manages reservations externally")
        void pushReservationUpdate_skipped() {
            SyncResult result = adapter.pushReservationUpdate(1L, 1L);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("Booking.com gere les reservations");
        }
    }

    // ─── pushHostProfile ────────────────────────────────────────────────────

    @Nested
    @DisplayName("pushHostProfile")
    class PushHostProfileTests {

        @Test
        void delegatesToHostProfileSyncSupport() {
            HostProfileUpdate profile = new HostProfileUpdate(
                    1L, "Alice", "Doe", "alice@example.com", "+33123456789", null);
            SyncResult expected = SyncResult.success("ok", 1, 0L);
            when(hostProfileSyncSupport.recordPendingWireUp(eq(ChannelName.BOOKING), eq(profile), eq(1L)))
                    .thenReturn(expected);

            SyncResult result = adapter.pushHostProfile(profile, 1L);

            assertThat(result).isSameAs(expected);
            verify(hostProfileSyncSupport).recordPendingWireUp(eq(ChannelName.BOOKING), eq(profile), eq(1L));
        }
    }

    // ─── pushCalendarUpdate (extended) ──────────────────────────────────────

    @Nested
    @DisplayName("pushCalendarUpdate — extended")
    class PushCalendarUpdateExtendedTests {

        private final Long propertyId = 42L;
        private final Long orgId = 1L;
        private final LocalDate from = LocalDate.of(2026, 5, 1);
        private final LocalDate to = LocalDate.of(2026, 5, 5);

        @Test
        @DisplayName("returns SKIPPED when prices map is empty (no events to push)")
        void emptyPrices_returnsSkipped() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-1");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(true);
            when(priceEngine.resolvePriceRange(propertyId, from, to, orgId)).thenReturn(Map.of());
            when(bookingRestrictionRepository.findApplicable(propertyId, from, to, orgId))
                    .thenReturn(List.of());
            when(calendarDayRepository.findByPropertyAndDateRange(propertyId, from, to, orgId))
                    .thenReturn(List.of());

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("Aucun prix");
        }

        @Test
        @DisplayName("respects BOOKED CalendarDay status (available=false)")
        void respectsCalendarStatus() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-1");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(true);
            when(priceEngine.resolvePriceRange(propertyId, from, to, orgId))
                    .thenReturn(Map.of(from, new BigDecimal("120.00")));
            when(bookingRestrictionRepository.findApplicable(propertyId, from, to, orgId))
                    .thenReturn(List.of());
            CalendarDay booked = new CalendarDay();
            booked.setDate(from);
            booked.setStatus(CalendarDayStatus.BOOKED);
            when(calendarDayRepository.findByPropertyAndDateRange(propertyId, from, to, orgId))
                    .thenReturn(List.of(booked));
            when(bookingApiClient.updateAvailability(anyList())).thenReturn(true);
            when(bookingApiClient.updateRates(anyList())).thenReturn(true);

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SUCCESS);
        }

        @Test
        @DisplayName("applies BookingRestriction min/max stay and CTA/CTD flags")
        void appliesRestrictions() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-1");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(true);
            when(priceEngine.resolvePriceRange(propertyId, from, to, orgId))
                    .thenReturn(Map.of(from, new BigDecimal("100.00")));
            BookingRestriction restriction = new BookingRestriction();
            restriction.setStartDate(from);
            restriction.setEndDate(to);
            restriction.setMinStay(3);
            restriction.setMaxStay(14);
            restriction.setClosedToArrival(true);
            restriction.setClosedToDeparture(false);
            when(bookingRestrictionRepository.findApplicable(propertyId, from, to, orgId))
                    .thenReturn(List.of(restriction));
            when(calendarDayRepository.findByPropertyAndDateRange(propertyId, from, to, orgId))
                    .thenReturn(List.of());
            when(bookingApiClient.updateAvailability(anyList())).thenReturn(true);
            when(bookingApiClient.updateRates(anyList())).thenReturn(true);

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SUCCESS);
            verify(bookingApiClient).updateAvailability(anyList());
        }

        @Test
        @DisplayName("returns FAILED on partial failure (avail success, rates fail)")
        void partialFailure_ratesFail() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-1");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(true);
            when(priceEngine.resolvePriceRange(propertyId, from, to, orgId))
                    .thenReturn(Map.of(from, new BigDecimal("99.00")));
            when(bookingRestrictionRepository.findApplicable(propertyId, from, to, orgId))
                    .thenReturn(List.of());
            when(calendarDayRepository.findByPropertyAndDateRange(propertyId, from, to, orgId))
                    .thenReturn(List.of());
            when(bookingApiClient.updateAvailability(anyList())).thenReturn(true);
            when(bookingApiClient.updateRates(anyList())).thenReturn(false);

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
        }

        @Test
        @DisplayName("succeeds when rates list is empty (no positive prices to push)")
        void emptyRatesListSkipsRateApiCall() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-1");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(true);
            // Price = 0 → won't be included in rates list
            when(priceEngine.resolvePriceRange(propertyId, from, to, orgId))
                    .thenReturn(Map.of(from, BigDecimal.ZERO));
            when(bookingRestrictionRepository.findApplicable(propertyId, from, to, orgId))
                    .thenReturn(List.of());
            when(calendarDayRepository.findByPropertyAndDateRange(propertyId, from, to, orgId))
                    .thenReturn(List.of());
            when(bookingApiClient.updateAvailability(anyList())).thenReturn(true);

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SUCCESS);
            verify(bookingApiClient, never()).updateRates(anyList());
        }
    }

    // ─── pushPromotion ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("pushPromotion")
    class PushPromotionTests {

        private final Long propertyId = 42L;
        private final Long orgId = 1L;

        private ChannelPromotion buildPromo(PromotionType type, BigDecimal discountPct,
                                            LocalDate start, LocalDate end) {
            ChannelPromotion promo = new ChannelPromotion();
            promo.setId(7L);
            promo.setPropertyId(propertyId);
            promo.setPromotionType(type);
            promo.setDiscountPercentage(discountPct);
            promo.setStartDate(start);
            promo.setEndDate(end);
            promo.setEnabled(true);
            return promo;
        }

        @Test
        @DisplayName("returns SKIPPED when no mapping")
        void noMapping() {
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.empty());

            SyncResult result = adapter.pushPromotion(
                    buildPromo(PromotionType.GENIUS, new BigDecimal("10"),
                            LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 30)),
                    orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
        }

        @Test
        @DisplayName("returns FAILED when config incomplete")
        void configIncomplete() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-1");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(false);

            SyncResult result = adapter.pushPromotion(
                    buildPromo(PromotionType.FLASH_SALE, new BigDecimal("15"),
                            LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 5)),
                    orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
        }

        @Test
        @DisplayName("returns SUCCESS when discount applied to base prices")
        void successWithDiscount() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-1");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(true);
            when(priceEngine.resolvePriceRange(eq(propertyId), any(), any(), eq(orgId)))
                    .thenReturn(Map.of(LocalDate.of(2026, 6, 1), new BigDecimal("100.00")));
            when(bookingApiClient.updateRates(anyList())).thenReturn(true);

            SyncResult result = adapter.pushPromotion(
                    buildPromo(PromotionType.EARLY_BIRD_OTA, new BigDecimal("20"),
                            LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 5)),
                    orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SUCCESS);
            assertThat(result.getItemsProcessed()).isEqualTo(1);
        }

        @Test
        @DisplayName("returns FAILED when API rejects the promotion rates")
        void apiRejected() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-1");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(true);
            when(priceEngine.resolvePriceRange(eq(propertyId), any(), any(), eq(orgId)))
                    .thenReturn(Map.of(LocalDate.of(2026, 6, 1), new BigDecimal("100.00")));
            when(bookingApiClient.updateRates(anyList())).thenReturn(false);

            SyncResult result = adapter.pushPromotion(
                    buildPromo(PromotionType.FLASH_SALE, new BigDecimal("25"),
                            LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 5)),
                    orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
        }

        @Test
        @DisplayName("returns SKIPPED when promotion type has no discount config")
        void skippedNonDiscountablePromo() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-1");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(true);

            SyncResult result = adapter.pushPromotion(
                    buildPromo(PromotionType.GENIUS, null,
                            LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 5)),
                    orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            verify(bookingApiClient, never()).updateRates(anyList());
        }

        @Test
        @DisplayName("returns FAILED when API throws exception")
        void apiThrows() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-1");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(true);
            when(priceEngine.resolvePriceRange(eq(propertyId), any(), any(), eq(orgId)))
                    .thenThrow(new RuntimeException("price boom"));

            SyncResult result = adapter.pushPromotion(
                    buildPromo(PromotionType.FLASH_SALE, new BigDecimal("15"),
                            LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 5)),
                    orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
            assertThat(result.getMessage()).contains("Erreur API Booking.com");
        }
    }

    // ─── pushRestrictions ──────────────────────────────────────────────────

    @Nested
    @DisplayName("pushRestrictions")
    class PushRestrictionsTests {

        private final Long propertyId = 42L;
        private final Long orgId = 1L;
        private final LocalDate from = LocalDate.of(2026, 7, 1);
        private final LocalDate to = LocalDate.of(2026, 7, 4);

        @Test
        @DisplayName("returns SKIPPED when no mapping")
        void noMapping() {
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.empty());

            SyncResult result = adapter.pushRestrictions(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
        }

        @Test
        @DisplayName("returns FAILED when config incomplete")
        void configIncomplete() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-1");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(false);

            SyncResult result = adapter.pushRestrictions(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
        }

        @Test
        @DisplayName("returns SUCCESS with default restrictions when none match")
        void successWithDefaults() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-1");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(true);
            when(bookingRestrictionRepository.findApplicable(propertyId, from, to, orgId))
                    .thenReturn(List.of());
            when(bookingApiClient.updateAvailability(anyList())).thenReturn(true);

            SyncResult result = adapter.pushRestrictions(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SUCCESS);
            // 3 days from July 1 (incl) to July 4 (excl)
            assertThat(result.getItemsProcessed()).isEqualTo(3);
        }

        @Test
        @DisplayName("returns SUCCESS with matching restrictions")
        void successWithMatchingRestrictions() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-1");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(true);
            BookingRestriction r = new BookingRestriction();
            r.setStartDate(from);
            r.setEndDate(to);
            r.setMinStay(2);
            r.setMaxStay(7);
            r.setClosedToArrival(true);
            r.setClosedToDeparture(true);
            when(bookingRestrictionRepository.findApplicable(propertyId, from, to, orgId))
                    .thenReturn(List.of(r));
            when(bookingApiClient.updateAvailability(anyList())).thenReturn(true);

            SyncResult result = adapter.pushRestrictions(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SUCCESS);
        }

        @Test
        @DisplayName("returns FAILED when API rejects")
        void apiRejected() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-1");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(true);
            when(bookingRestrictionRepository.findApplicable(propertyId, from, to, orgId))
                    .thenReturn(List.of());
            when(bookingApiClient.updateAvailability(anyList())).thenReturn(false);

            SyncResult result = adapter.pushRestrictions(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
            assertThat(result.getMessage()).contains("rejete");
        }

        @Test
        @DisplayName("returns FAILED when API throws")
        void apiThrows() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-1");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(true);
            when(bookingRestrictionRepository.findApplicable(propertyId, from, to, orgId))
                    .thenThrow(new RuntimeException("repo boom"));

            SyncResult result = adapter.pushRestrictions(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
            assertThat(result.getMessage()).contains("Erreur API Booking.com");
        }
    }

    // ─── pushContent / pullContent ──────────────────────────────────────────

    @Nested
    @DisplayName("pushContent")
    class PushContentTests {

        private final Long propertyId = 42L;
        private final Long orgId = 1L;

        private ChannelContentMapping buildContent() {
            ChannelContentMapping content = new ChannelContentMapping();
            content.setPropertyId(propertyId);
            content.setTitle("Loft");
            return content;
        }

        @Test
        @DisplayName("returns SKIPPED when no mapping")
        void noMapping() {
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.empty());

            SyncResult result = adapter.pushContent(buildContent(), orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
        }

        @Test
        @DisplayName("returns FAILED when config incomplete")
        void configIncomplete() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-1");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(false);

            SyncResult result = adapter.pushContent(buildContent(), orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
        }

        @Test
        @DisplayName("returns SKIPPED (content managed via extranet) when configured")
        void configuredReturnsSkipped() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-1");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(true);

            SyncResult result = adapter.pushContent(buildContent(), orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("extranet");
        }
    }

    @Nested
    @DisplayName("pullContent")
    class PullContentTests {

        private final Long propertyId = 42L;
        private final Long orgId = 1L;

        @Test
        @DisplayName("returns SKIPPED when no mapping")
        void noMapping() {
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.empty());

            SyncResult result = adapter.pullContent(propertyId, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
        }

        @Test
        @DisplayName("returns FAILED when config incomplete")
        void configIncomplete() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-1");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(false);

            SyncResult result = adapter.pullContent(propertyId, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
        }

        @Test
        @DisplayName("returns SKIPPED when configured (pull not yet implemented)")
        void configuredReturnsSkipped() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-1");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(true);

            SyncResult result = adapter.pullContent(propertyId, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
        }
    }

    // ─── pushFees ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("pushFees")
    class PushFeesTests {

        private final Long propertyId = 42L;
        private final Long orgId = 1L;

        private ChannelFee buildFee(boolean enabled) {
            ChannelFee fee = new ChannelFee();
            fee.setPropertyId(propertyId);
            fee.setFeeType(FeeType.CLEANING);
            fee.setAmount(new BigDecimal("50.00"));
            fee.setCurrency("EUR");
            fee.setChargeType(ChargeType.PER_STAY);
            fee.setIsMandatory(true);
            fee.setEnabled(enabled);
            return fee;
        }

        @Test
        @DisplayName("returns SKIPPED when empty list")
        void emptyList() {
            SyncResult result = adapter.pushFees(List.of(), orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            verify(bookingApiClient, never()).updateRates(anyList());
        }

        @Test
        @DisplayName("returns SKIPPED when no mapping")
        void noMapping() {
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.empty());

            SyncResult result = adapter.pushFees(List.of(buildFee(true)), orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
        }

        @Test
        @DisplayName("returns FAILED when config incomplete")
        void configIncomplete() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-1");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(false);

            SyncResult result = adapter.pushFees(List.of(buildFee(true)), orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
        }

        @Test
        @DisplayName("returns SUCCESS when API accepts the fees")
        void success() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-1");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(true);
            when(bookingApiClient.updateRates(anyList())).thenReturn(true);

            SyncResult result = adapter.pushFees(List.of(buildFee(true), buildFee(false)), orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SUCCESS);
            assertThat(result.getItemsProcessed()).isEqualTo(1); // only enabled fee counted
        }

        @Test
        @DisplayName("returns SKIPPED when all fees are disabled")
        void allDisabled() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-1");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(true);

            SyncResult result = adapter.pushFees(List.of(buildFee(false)), orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            verify(bookingApiClient, never()).updateRates(anyList());
        }

        @Test
        @DisplayName("returns FAILED when API rejects fees")
        void apiRejected() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-1");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(true);
            when(bookingApiClient.updateRates(anyList())).thenReturn(false);

            SyncResult result = adapter.pushFees(List.of(buildFee(true)), orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
        }

        @Test
        @DisplayName("returns FAILED when API throws")
        void apiThrows() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-1");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(true);
            when(bookingApiClient.updateRates(anyList())).thenThrow(new RuntimeException("api boom"));

            SyncResult result = adapter.pushFees(List.of(buildFee(true)), orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
            assertThat(result.getMessage()).contains("Erreur API Booking.com");
        }
    }

    // ─── pushCancellationPolicy ─────────────────────────────────────────────

    @Nested
    @DisplayName("pushCancellationPolicy")
    class PushCancellationPolicyTests {

        private final Long propertyId = 42L;
        private final Long orgId = 1L;

        private ChannelCancellationPolicy buildPolicy(CancellationPolicyType type) {
            ChannelCancellationPolicy policy = new ChannelCancellationPolicy();
            policy.setPropertyId(propertyId);
            policy.setPolicyType(type);
            return policy;
        }

        @Test
        @DisplayName("returns SKIPPED when no mapping")
        void noMapping() {
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.empty());

            SyncResult result = adapter.pushCancellationPolicy(buildPolicy(CancellationPolicyType.FLEXIBLE), orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
        }

        @Test
        @DisplayName("returns FAILED when config incomplete")
        void configIncomplete() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-1");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(false);

            SyncResult result = adapter.pushCancellationPolicy(buildPolicy(CancellationPolicyType.STRICT), orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
        }

        @Test
        @DisplayName("returns SKIPPED (managed via extranet) when configured")
        void configuredReturnsSkipped() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-1");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(true);

            SyncResult result = adapter.pushCancellationPolicy(buildPolicy(CancellationPolicyType.MODERATE), orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("extranet");
        }
    }
}
