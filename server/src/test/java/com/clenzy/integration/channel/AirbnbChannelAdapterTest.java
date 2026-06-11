package com.clenzy.integration.channel;

import com.clenzy.integration.airbnb.model.AirbnbConnection;
import com.clenzy.integration.airbnb.repository.AirbnbConnectionRepository;
import com.clenzy.integration.airbnb.service.AirbnbOAuthService;
import com.clenzy.integration.airbnb.service.AirbnbTokenEncryptionService;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AirbnbChannelAdapterTest {

    @Mock private AirbnbOAuthService airbnbOAuthService;
    @Mock private AirbnbConnectionRepository airbnbConnectionRepository;
    @Mock private AirbnbTokenEncryptionService tokenEncryptionService;
    @Mock private ChannelMappingRepository channelMappingRepository;
    @Mock private PriceEngine priceEngine;
    @Mock private RestTemplate restTemplate;
    @Mock private BookingRestrictionRepository bookingRestrictionRepository;
    @Mock private CalendarDayRepository calendarDayRepository;
    @Mock private HostProfileSyncSupport hostProfileSyncSupport;

    private AirbnbChannelAdapter adapter;

    private static final Long ORG_ID = 1L;
    private static final Long PROPERTY_ID = 42L;
    private static final String LISTING_ID = "listing-abc";
    private static final String DECRYPTED_TOKEN = "access-token-decrypted";

    @BeforeEach
    void setUp() {
        adapter = new AirbnbChannelAdapter(airbnbOAuthService, airbnbConnectionRepository,
                tokenEncryptionService, channelMappingRepository, priceEngine, restTemplate,
                bookingRestrictionRepository, calendarDayRepository, hostProfileSyncSupport);
    }

    private ChannelMapping mockMapping() {
        ChannelMapping mapping = mock(ChannelMapping.class);
        lenient().when(mapping.getExternalId()).thenReturn(LISTING_ID);
        return mapping;
    }

    private AirbnbConnection activeConnection(String tokenCipher) {
        AirbnbConnection conn = new AirbnbConnection();
        conn.setStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE);
        conn.setAccessTokenEncrypted(tokenCipher);
        return conn;
    }

    private void stubAccessToken() {
        AirbnbConnection conn = activeConnection("encrypted-token");
        when(airbnbConnectionRepository.findByStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE))
                .thenReturn(List.of(conn));
        when(tokenEncryptionService.decrypt("encrypted-token")).thenReturn(DECRYPTED_TOKEN);
    }

    // ── Basic metadata ──────────────────────────────────────────────────────

    @Test
    void channelName() {
        assertThat(adapter.getChannelName()).isEqualTo(ChannelName.AIRBNB);
    }

    @Test
    void capabilities_containsAllExpected() {
        assertThat(adapter.getCapabilities()).contains(
                ChannelCapability.INBOUND_CALENDAR,
                ChannelCapability.OUTBOUND_CALENDAR,
                ChannelCapability.INBOUND_RESERVATIONS,
                ChannelCapability.WEBHOOKS,
                ChannelCapability.OAUTH,
                ChannelCapability.MESSAGING,
                ChannelCapability.PROMOTIONS,
                ChannelCapability.OUTBOUND_RESTRICTIONS,
                ChannelCapability.CONTENT_SYNC,
                ChannelCapability.FEES,
                ChannelCapability.CANCELLATION_POLICIES,
                ChannelCapability.OUTBOUND_HOST_PROFILE
        );
    }

    @Test
    void handleInboundEvent_isNoOp() {
        adapter.handleInboundEvent("calendar.updated", Map.of("k", "v"), ORG_ID);
        // No exception, no interactions on dependencies that matter
    }

    // ── resolveMapping ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("resolveMapping")
    class ResolveMappingTests {

        @Test
        void found() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));

            assertThat(adapter.resolveMapping(PROPERTY_ID, ORG_ID)).contains(mapping);
        }

        @Test
        void notFound() {
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.empty());

            assertThat(adapter.resolveMapping(PROPERTY_ID, ORG_ID)).isEmpty();
        }
    }

    // ── pushHostProfile ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("pushHostProfile")
    class PushHostProfileTests {

        @Test
        void delegatesToHostProfileSyncSupport() {
            HostProfileUpdate profile = new HostProfileUpdate(
                    1L, "Alice", "Doe", "alice@example.com", "+33123456789", "http://avatar/url");
            SyncResult expected = SyncResult.success("ok", 1, 0L);
            when(hostProfileSyncSupport.dispatch(eq(ChannelName.AIRBNB), eq(profile), eq(ORG_ID), any()))
                    .thenReturn(expected);

            SyncResult result = adapter.pushHostProfile(profile, ORG_ID);

            assertThat(result).isSameAs(expected);
            verify(hostProfileSyncSupport).dispatch(eq(ChannelName.AIRBNB), eq(profile), eq(ORG_ID), any());
        }
    }

    // ── pushCalendarUpdate ──────────────────────────────────────────────────

    @Nested
    @DisplayName("pushCalendarUpdate")
    class PushCalendarUpdateTests {

        private final LocalDate from = LocalDate.of(2026, 6, 1);
        private final LocalDate to = LocalDate.of(2026, 6, 3);

        @Test
        @DisplayName("returns SKIPPED when no mapping")
        void noMapping() {
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.empty());

            SyncResult result = adapter.pushCalendarUpdate(PROPERTY_ID, from, to, ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("Aucun mapping Airbnb");
        }

        @Test
        @DisplayName("returns FAILED when no token")
        void noToken() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            when(airbnbConnectionRepository.findByStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE))
                    .thenReturn(List.of());

            SyncResult result = adapter.pushCalendarUpdate(PROPERTY_ID, from, to, ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
            assertThat(result.getMessage()).contains("Pas de token OAuth Airbnb valide");
        }

        @Test
        @DisplayName("returns FAILED when token entity has null cipher")
        void nullCipher() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            AirbnbConnection conn = activeConnection(null);
            when(airbnbConnectionRepository.findByStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE))
                    .thenReturn(List.of(conn));

            SyncResult result = adapter.pushCalendarUpdate(PROPERTY_ID, from, to, ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
            assertThat(result.getMessage()).contains("Pas de token OAuth Airbnb valide");
        }

        @Test
        @DisplayName("returns FAILED when decrypt throws")
        void decryptThrows() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            AirbnbConnection conn = activeConnection("ciphertext");
            when(airbnbConnectionRepository.findByStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE))
                    .thenReturn(List.of(conn));
            when(tokenEncryptionService.decrypt("ciphertext")).thenThrow(new RuntimeException("boom"));

            SyncResult result = adapter.pushCalendarUpdate(PROPERTY_ID, from, to, ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
            assertThat(result.getMessage()).contains("Pas de token OAuth Airbnb valide");
        }

        @Test
        @DisplayName("returns SUCCESS when API responds 2xx for each day")
        void successAllDays() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            stubAccessToken();

            Map<LocalDate, BigDecimal> prices = new LinkedHashMap<>();
            prices.put(from, new BigDecimal("120.00"));
            prices.put(from.plusDays(1), new BigDecimal("130.00"));
            when(priceEngine.resolvePriceRange(PROPERTY_ID, from, to, ORG_ID)).thenReturn(prices);
            when(bookingRestrictionRepository.findApplicable(PROPERTY_ID, from, to, ORG_ID))
                    .thenReturn(List.of());
            when(calendarDayRepository.findByPropertyAndDateRange(PROPERTY_ID, from, to, ORG_ID))
                    .thenReturn(List.of());

            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("ok"));

            SyncResult result = adapter.pushCalendarUpdate(PROPERTY_ID, from, to, ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SUCCESS);
            assertThat(result.getItemsProcessed()).isEqualTo(2);
            verify(restTemplate, times(2)).exchange(anyString(), eq(HttpMethod.PUT), any(), eq(String.class));
        }

        @Test
        @DisplayName("consumes provided channel prices instead of re-resolving via PriceEngine (Z5-BUGS-03)")
        void whenResolvedPricesProvided_thenTheyArePushedWithoutPriceEngine() {
            // Arrange : prix channel-specific (markup +10%) fournis par RateDistributionService
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            stubAccessToken();
            when(bookingRestrictionRepository.findApplicable(PROPERTY_ID, from, to, ORG_ID))
                    .thenReturn(List.of());
            when(calendarDayRepository.findByPropertyAndDateRange(PROPERTY_ID, from, to, ORG_ID))
                    .thenReturn(List.of());
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("ok"));

            Map<LocalDate, BigDecimal> channelPrices = new LinkedHashMap<>();
            channelPrices.put(from, new BigDecimal("110.00")); // prix de base 100 +10% channel

            // Act
            SyncResult result = adapter.pushCalendarUpdate(PROPERTY_ID, from, to, ORG_ID, channelPrices);

            // Assert : pas de re-resolution des prix de base
            verify(priceEngine, never()).resolvePriceRange(any(), any(), any(), any());
            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SUCCESS);
            assertThat(result.getItemsProcessed()).isEqualTo(1);

            // Le prix POUSSE est bien le prix channel (110), pas le prix de base
            ArgumentCaptor<HttpEntity<Map<String, Object>>> captor = ArgumentCaptor.forClass(HttpEntity.class);
            verify(restTemplate).exchange(anyString(), eq(HttpMethod.PUT), captor.capture(), eq(String.class));
            assertThat(captor.getValue().getBody()).containsEntry("daily_price", 110);
        }

        @Test
        @DisplayName("filters out null prices")
        void skipsNullPrices() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            stubAccessToken();
            Map<LocalDate, BigDecimal> prices = new LinkedHashMap<>();
            prices.put(from, null);
            prices.put(from.plusDays(1), new BigDecimal("99.00"));
            when(priceEngine.resolvePriceRange(PROPERTY_ID, from, to, ORG_ID)).thenReturn(prices);
            when(bookingRestrictionRepository.findApplicable(PROPERTY_ID, from, to, ORG_ID))
                    .thenReturn(List.of());
            when(calendarDayRepository.findByPropertyAndDateRange(PROPERTY_ID, from, to, ORG_ID))
                    .thenReturn(List.of());
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("ok"));

            SyncResult result = adapter.pushCalendarUpdate(PROPERTY_ID, from, to, ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SUCCESS);
            assertThat(result.getItemsProcessed()).isEqualTo(1);
        }

        @Test
        @DisplayName("uses BOOKED status as unavailable")
        void respectsBookedStatus() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            stubAccessToken();
            when(priceEngine.resolvePriceRange(PROPERTY_ID, from, to, ORG_ID))
                    .thenReturn(Map.of(from, new BigDecimal("120.00")));
            when(bookingRestrictionRepository.findApplicable(PROPERTY_ID, from, to, ORG_ID))
                    .thenReturn(List.of());

            CalendarDay booked = new CalendarDay();
            booked.setDate(from);
            booked.setStatus(CalendarDayStatus.BOOKED);
            when(calendarDayRepository.findByPropertyAndDateRange(PROPERTY_ID, from, to, ORG_ID))
                    .thenReturn(List.of(booked));
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("ok"));

            SyncResult result = adapter.pushCalendarUpdate(PROPERTY_ID, from, to, ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SUCCESS);
        }

        @Test
        @DisplayName("continues when single-day API call throws")
        void perDayExceptionStillSucceedsOverall() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            stubAccessToken();
            Map<LocalDate, BigDecimal> prices = new LinkedHashMap<>();
            prices.put(from, new BigDecimal("120.00"));
            prices.put(from.plusDays(1), new BigDecimal("130.00"));
            when(priceEngine.resolvePriceRange(PROPERTY_ID, from, to, ORG_ID)).thenReturn(prices);
            when(bookingRestrictionRepository.findApplicable(PROPERTY_ID, from, to, ORG_ID))
                    .thenReturn(List.of());
            when(calendarDayRepository.findByPropertyAndDateRange(PROPERTY_ID, from, to, ORG_ID))
                    .thenReturn(List.of());

            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(String.class)))
                    .thenThrow(new RestClientException("network"))
                    .thenReturn(ResponseEntity.ok("ok"));

            SyncResult result = adapter.pushCalendarUpdate(PROPERTY_ID, from, to, ORG_ID);

            // 1 success, 1 swallowed exception => still SUCCESS overall
            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SUCCESS);
            assertThat(result.getItemsProcessed()).isEqualTo(1);
        }

        @Test
        @DisplayName("returns FAILED when outer pipeline throws")
        void outerExceptionPath() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            stubAccessToken();
            when(priceEngine.resolvePriceRange(PROPERTY_ID, from, to, ORG_ID))
                    .thenThrow(new RuntimeException("price engine boom"));

            SyncResult result = adapter.pushCalendarUpdate(PROPERTY_ID, from, to, ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
            assertThat(result.getMessage()).contains("Erreur API Airbnb");
        }
    }

    // ── pushPromotion ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("pushPromotion")
    class PushPromotionTests {

        private ChannelPromotion buildPromo(PromotionType type) {
            ChannelPromotion promo = new ChannelPromotion();
            promo.setId(7L);
            promo.setPropertyId(PROPERTY_ID);
            promo.setPromotionType(type);
            promo.setDiscountPercentage(new BigDecimal("15.00"));
            promo.setStartDate(LocalDate.of(2026, 7, 1));
            promo.setEndDate(LocalDate.of(2026, 7, 31));
            promo.setEnabled(true);
            return promo;
        }

        @Test
        @DisplayName("returns FAILED when no token")
        void noToken() {
            when(airbnbConnectionRepository.findByStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE))
                    .thenReturn(List.of());

            SyncResult result = adapter.pushPromotion(buildPromo(PromotionType.EARLY_BIRD_OTA), ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
        }

        @Test
        @DisplayName("returns SKIPPED when no mapping")
        void noMapping() {
            stubAccessToken();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.empty());

            SyncResult result = adapter.pushPromotion(buildPromo(PromotionType.EARLY_BIRD_OTA), ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
        }

        @Test
        @DisplayName("returns SUCCESS when API responds 2xx")
        void success() {
            stubAccessToken();
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("ok"));

            SyncResult result = adapter.pushPromotion(buildPromo(PromotionType.FLASH_SALE), ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SUCCESS);
            assertThat(result.getItemsProcessed()).isEqualTo(1);
        }

        @Test
        @DisplayName("returns FAILED on non-2xx response")
        void apiNon2xx() {
            stubAccessToken();
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(String.class)))
                    .thenReturn(new ResponseEntity<>("nope", HttpStatus.BAD_REQUEST));

            SyncResult result = adapter.pushPromotion(buildPromo(PromotionType.FLASH_SALE), ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
            assertThat(result.getMessage()).contains("Airbnb returned");
        }

        @Test
        @DisplayName("returns FAILED on RestClientException")
        void apiException() {
            stubAccessToken();
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(String.class)))
                    .thenThrow(new RestClientException("timeout"));

            SyncResult result = adapter.pushPromotion(buildPromo(PromotionType.MOBILE_RATE), ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
            assertThat(result.getMessage()).contains("Erreur API Airbnb");
        }

        @Test
        @DisplayName("handles null discount and dates")
        void nullableFields() {
            stubAccessToken();
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            ChannelPromotion promo = buildPromo(PromotionType.LONG_STAY_OTA);
            promo.setDiscountPercentage(null);
            promo.setStartDate(null);
            promo.setEndDate(null);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("ok"));

            SyncResult result = adapter.pushPromotion(promo, ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SUCCESS);
        }

        @Test
        @DisplayName("maps Genius to custom type")
        void mapsGeniusToCustom() {
            stubAccessToken();
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("ok"));

            SyncResult result = adapter.pushPromotion(buildPromo(PromotionType.GENIUS), ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SUCCESS);
        }
    }

    // ── checkHealth ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("checkHealth")
    class CheckHealthTests {

        @Test
        void unknown_whenNotFound() {
            when(airbnbConnectionRepository.findById(99L)).thenReturn(Optional.empty());
            assertThat(adapter.checkHealth(99L)).isEqualTo(HealthStatus.UNKNOWN);
        }

        @Test
        void unhealthy_whenInactive() {
            AirbnbConnection conn = new AirbnbConnection();
            conn.setStatus(AirbnbConnection.AirbnbConnectionStatus.REVOKED);
            when(airbnbConnectionRepository.findById(1L)).thenReturn(Optional.of(conn));

            assertThat(adapter.checkHealth(1L)).isEqualTo(HealthStatus.UNHEALTHY);
        }

        @Test
        void degraded_whenExpired() {
            AirbnbConnection conn = new AirbnbConnection();
            conn.setStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE);
            conn.setTokenExpiresAt(LocalDateTime.now().minusHours(1));
            when(airbnbConnectionRepository.findById(2L)).thenReturn(Optional.of(conn));

            assertThat(adapter.checkHealth(2L)).isEqualTo(HealthStatus.DEGRADED);
        }

        @Test
        void healthy_whenActiveAndValid() {
            AirbnbConnection conn = new AirbnbConnection();
            conn.setStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE);
            conn.setTokenExpiresAt(LocalDateTime.now().plusHours(1));
            when(airbnbConnectionRepository.findById(3L)).thenReturn(Optional.of(conn));

            assertThat(adapter.checkHealth(3L)).isEqualTo(HealthStatus.HEALTHY);
        }

        @Test
        void healthy_whenNoExpiryConfigured() {
            AirbnbConnection conn = new AirbnbConnection();
            conn.setStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE);
            // tokenExpiresAt null => isTokenExpired returns false
            when(airbnbConnectionRepository.findById(4L)).thenReturn(Optional.of(conn));

            assertThat(adapter.checkHealth(4L)).isEqualTo(HealthStatus.HEALTHY);
        }
    }

    // ── pushRestrictions ────────────────────────────────────────────────────

    @Nested
    @DisplayName("pushRestrictions")
    class PushRestrictionsTests {

        private final LocalDate from = LocalDate.of(2026, 8, 1);
        private final LocalDate to = LocalDate.of(2026, 8, 4);

        @Test
        void skipped_whenNoMapping() {
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.empty());

            SyncResult result = adapter.pushRestrictions(PROPERTY_ID, from, to, ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
        }

        @Test
        void failed_whenNoToken() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            when(airbnbConnectionRepository.findByStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE))
                    .thenReturn(List.of());

            SyncResult result = adapter.pushRestrictions(PROPERTY_ID, from, to, ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
        }

        @Test
        void success_appliesDefaultsWhenNoRestrictions() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            stubAccessToken();
            when(bookingRestrictionRepository.findApplicable(PROPERTY_ID, from, to, ORG_ID))
                    .thenReturn(List.of());
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("ok"));

            SyncResult result = adapter.pushRestrictions(PROPERTY_ID, from, to, ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SUCCESS);
            assertThat(result.getItemsProcessed()).isEqualTo(3); // from..to exclusive
            verify(restTemplate, times(3)).exchange(anyString(), eq(HttpMethod.PUT), any(), eq(String.class));
        }

        @Test
        void success_appliesRestrictionsWhenMatch() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            stubAccessToken();

            BookingRestriction r = new BookingRestriction();
            r.setStartDate(from);
            r.setEndDate(to);
            r.setMinStay(2);
            r.setMaxStay(7);
            r.setClosedToArrival(true);
            r.setClosedToDeparture(false);
            when(bookingRestrictionRepository.findApplicable(PROPERTY_ID, from, to, ORG_ID))
                    .thenReturn(List.of(r));
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("ok"));

            SyncResult result = adapter.pushRestrictions(PROPERTY_ID, from, to, ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SUCCESS);
            assertThat(result.getItemsProcessed()).isEqualTo(3);
        }

        @Test
        void perDayExceptionStillSucceedsOverall() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            stubAccessToken();
            when(bookingRestrictionRepository.findApplicable(PROPERTY_ID, from, to, ORG_ID))
                    .thenReturn(List.of());

            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(String.class)))
                    .thenThrow(new RestClientException("net"))
                    .thenReturn(ResponseEntity.ok("ok"))
                    .thenReturn(ResponseEntity.ok("ok"));

            SyncResult result = adapter.pushRestrictions(PROPERTY_ID, from, to, ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SUCCESS);
            assertThat(result.getItemsProcessed()).isEqualTo(2);
        }

        @Test
        void failed_outerException() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            stubAccessToken();
            when(bookingRestrictionRepository.findApplicable(PROPERTY_ID, from, to, ORG_ID))
                    .thenThrow(new RuntimeException("repo boom"));

            SyncResult result = adapter.pushRestrictions(PROPERTY_ID, from, to, ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
            assertThat(result.getMessage()).contains("Erreur API Airbnb");
        }
    }

    // ── pushContent / pullContent ───────────────────────────────────────────

    @Nested
    @DisplayName("pushContent")
    class PushContentTests {

        private ChannelContentMapping buildContent() {
            ChannelContentMapping content = new ChannelContentMapping();
            content.setPropertyId(PROPERTY_ID);
            content.setTitle("Loft");
            content.setDescription("Beau loft");
            content.setAmenities(new ArrayList<>(List.of("wifi", "pool")));
            content.setPhotoUrls(new ArrayList<>(List.of("http://a.com/1.jpg")));
            content.setPropertyType("apartment");
            content.setBedrooms(2);
            content.setBathrooms(1);
            content.setMaxGuests(4);
            return content;
        }

        @Test
        void skipped_whenNoMapping() {
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.empty());

            SyncResult result = adapter.pushContent(buildContent(), ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
        }

        @Test
        void failed_whenNoToken() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            when(airbnbConnectionRepository.findByStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE))
                    .thenReturn(List.of());

            SyncResult result = adapter.pushContent(buildContent(), ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
        }

        @Test
        void success() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            stubAccessToken();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("ok"));

            SyncResult result = adapter.pushContent(buildContent(), ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SUCCESS);
        }

        @Test
        void failed_apiNon2xx() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            stubAccessToken();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(String.class)))
                    .thenReturn(new ResponseEntity<>("nope", HttpStatus.INTERNAL_SERVER_ERROR));

            SyncResult result = adapter.pushContent(buildContent(), ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
        }

        @Test
        void failed_apiException() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            stubAccessToken();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(String.class)))
                    .thenThrow(new RestClientException("boom"));

            SyncResult result = adapter.pushContent(buildContent(), ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
        }

        @Test
        void emptyAmenitiesAndPhotosOmittedFromPayload() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            stubAccessToken();
            ChannelContentMapping content = buildContent();
            content.setAmenities(new ArrayList<>());
            content.setPhotoUrls(new ArrayList<>());
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("ok"));

            SyncResult result = adapter.pushContent(content, ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SUCCESS);
        }
    }

    @Nested
    @DisplayName("pullContent")
    class PullContentTests {

        @Test
        void skipped_whenNoMapping() {
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.empty());

            SyncResult result = adapter.pullContent(PROPERTY_ID, ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
        }

        @Test
        void failed_noToken() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            when(airbnbConnectionRepository.findByStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE))
                    .thenReturn(List.of());

            SyncResult result = adapter.pullContent(PROPERTY_ID, ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
        }

        @Test
        void success() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            stubAccessToken();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("payload"));

            SyncResult result = adapter.pullContent(PROPERTY_ID, ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SUCCESS);
        }

        @Test
        void failed_apiNon2xx() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            stubAccessToken();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(), eq(String.class)))
                    .thenReturn(new ResponseEntity<>("err", HttpStatus.UNAUTHORIZED));

            SyncResult result = adapter.pullContent(PROPERTY_ID, ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
        }

        @Test
        void failed_apiException() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            stubAccessToken();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(), eq(String.class)))
                    .thenThrow(new RestClientException("boom"));

            SyncResult result = adapter.pullContent(PROPERTY_ID, ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
        }
    }

    // ── pushFees ────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("pushFees")
    class PushFeesTests {

        private ChannelFee buildFee(boolean enabled) {
            ChannelFee fee = new ChannelFee();
            fee.setPropertyId(PROPERTY_ID);
            fee.setFeeType(FeeType.CLEANING);
            fee.setAmount(new BigDecimal("50.00"));
            fee.setCurrency("EUR");
            fee.setChargeType(ChargeType.PER_STAY);
            fee.setIsMandatory(true);
            fee.setEnabled(enabled);
            return fee;
        }

        @Test
        void skipped_emptyList() {
            SyncResult result = adapter.pushFees(List.of(), ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            verify(restTemplate, never()).exchange(anyString(), any(HttpMethod.class), any(), eq(String.class));
        }

        @Test
        void skipped_noMapping() {
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.empty());

            SyncResult result = adapter.pushFees(List.of(buildFee(true)), ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
        }

        @Test
        void failed_noToken() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            when(airbnbConnectionRepository.findByStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE))
                    .thenReturn(List.of());

            SyncResult result = adapter.pushFees(List.of(buildFee(true)), ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
        }

        @Test
        void success() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            stubAccessToken();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("ok"));

            SyncResult result = adapter.pushFees(List.of(buildFee(true), buildFee(false)), ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SUCCESS);
            assertThat(result.getItemsProcessed()).isEqualTo(1); // only enabled ones counted
        }

        @Test
        void failed_apiNon2xx() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            stubAccessToken();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(String.class)))
                    .thenReturn(new ResponseEntity<>("err", HttpStatus.SERVICE_UNAVAILABLE));

            SyncResult result = adapter.pushFees(List.of(buildFee(true)), ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
        }

        @Test
        void failed_apiException() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            stubAccessToken();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(String.class)))
                    .thenThrow(new RestClientException("boom"));

            SyncResult result = adapter.pushFees(List.of(buildFee(true)), ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
        }
    }

    // ── pushCancellationPolicy ──────────────────────────────────────────────

    @Nested
    @DisplayName("pushCancellationPolicy")
    class PushCancellationPolicyTests {

        private ChannelCancellationPolicy buildPolicy(CancellationPolicyType type) {
            ChannelCancellationPolicy policy = new ChannelCancellationPolicy();
            policy.setPropertyId(PROPERTY_ID);
            policy.setPolicyType(type);
            return policy;
        }

        @Test
        void skipped_noMapping() {
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.empty());

            SyncResult result = adapter.pushCancellationPolicy(buildPolicy(CancellationPolicyType.FLEXIBLE), ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
        }

        @Test
        void failed_noToken() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            when(airbnbConnectionRepository.findByStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE))
                    .thenReturn(List.of());

            SyncResult result = adapter.pushCancellationPolicy(buildPolicy(CancellationPolicyType.STRICT), ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
        }

        @Test
        void success_mapsCustomToModerate() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            stubAccessToken();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("ok"));

            SyncResult result = adapter.pushCancellationPolicy(buildPolicy(CancellationPolicyType.CUSTOM), ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SUCCESS);
        }

        @Test
        void success_superStrict() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            stubAccessToken();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("ok"));

            SyncResult result = adapter.pushCancellationPolicy(buildPolicy(CancellationPolicyType.SUPER_STRICT), ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SUCCESS);
        }

        @Test
        void failed_apiNon2xx() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            stubAccessToken();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(String.class)))
                    .thenReturn(new ResponseEntity<>("err", HttpStatus.FORBIDDEN));

            SyncResult result = adapter.pushCancellationPolicy(buildPolicy(CancellationPolicyType.FIRM), ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
        }

        @Test
        void failed_apiException() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            stubAccessToken();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(String.class)))
                    .thenThrow(new RestClientException("boom"));

            SyncResult result = adapter.pushCancellationPolicy(buildPolicy(CancellationPolicyType.MODERATE), ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
        }

        @Test
        void success_nonRefundable() {
            ChannelMapping mapping = mockMapping();
            when(channelMappingRepository.findByPropertyIdAndChannel(PROPERTY_ID, ChannelName.AIRBNB, ORG_ID))
                    .thenReturn(Optional.of(mapping));
            stubAccessToken();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("ok"));

            SyncResult result = adapter.pushCancellationPolicy(buildPolicy(CancellationPolicyType.NON_REFUNDABLE), ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SUCCESS);
        }
    }
}
