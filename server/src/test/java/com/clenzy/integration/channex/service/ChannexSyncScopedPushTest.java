package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.config.ChannexMetrics;
import com.clenzy.integration.channex.config.ChannexProperties;
import com.clenzy.integration.channex.dto.ChannexAriPushResult;
import com.clenzy.integration.channex.model.ChannexAriScope;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.model.ChannexSyncStatus;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.integration.channel.ChannelRoute;
import com.clenzy.integration.channel.ChannelRoutingStrategy;
import com.clenzy.model.PriceSourceOfTruth;
import com.clenzy.model.Property;
import com.clenzy.repository.BookingRestrictionRepository;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.repository.LengthOfStayDiscountRepository;
import com.clenzy.repository.OccupancyPricingRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RatePlanRepository;
import com.clenzy.service.PriceEngine;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * La preuve au niveau des appels API : un changement de prix ne declenche
 * AUCUN appel de disponibilite, et reciproquement.
 *
 * <p>C'est ce que la certification Channex verifie — « Expected exactly one
 * update (Property.UpdateRestrictions), found: ["Property.UpdateRestrictions",
 * "Property.UpdateAvailability"] », refus du 2026-08-14 sur sept scenarios.
 * Les tests de portee du batcher verifient le trajet ; celui-ci verifie ce qui
 * sort reellement sur le reseau.</p>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("Pushes cibles par portee")
class ChannexSyncScopedPushTest {

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

    private static final LocalDate FROM = LocalDate.parse("2026-11-22");
    private static final LocalDate TO = LocalDate.parse("2026-11-24");

    @BeforeEach
    void setUp() {
        ChannelRoutingStrategy routing = org.mockito.Mockito.mock(ChannelRoutingStrategy.class);
        when(routing.resolve(anyLong(), anyLong())).thenReturn(ChannelRoute.CHANNEX);

        ChannexProperties props = new ChannexProperties();
        // Sans OTA actif, le push court-circuite : on veut observer les appels.
        props.setAllowPushWithoutActiveOta(true);

        service = new ChannexSyncService(
            channexClient, mappingRepository, calendarDayRepository, priceEngine,
            new ChannexMetrics(new SimpleMeterRegistry()),
            syncLogService, propertyRepository,
            bookingRestrictionRepository, occupancyPricingRepository,
            lengthOfStayDiscountRepository, ratePlanRepository,
            routing, props);

        ChannexPropertyMapping mapping = new ChannexPropertyMapping();
        mapping.setId(UUID.randomUUID());
        mapping.setOrganizationId(42L);
        mapping.setClenzyPropertyId(100L);
        mapping.setChannexPropertyId("channex-prop-abc");
        mapping.setChannexRoomTypeId("channex-room-1");
        mapping.setChannexDefaultRatePlanId("channex-rate-1");
        mapping.setSyncStatus(ChannexSyncStatus.ACTIVE);
        when(mappingRepository.findByClenzyPropertyId(100L, 42L)).thenReturn(Optional.of(mapping));

        Property property = new Property();
        property.setId(100L);
        property.setOrganizationId(42L);
        property.setName("Test Property - Baitly");
        property.setNightlyPrice(new BigDecimal("120.00"));
        property.setMinimumNights(2);
        property.setMaximumNights(30);
        property.setPriceSourceOfTruth(PriceSourceOfTruth.CLENZY);
        property.setDefaultCurrency("USD");
        when(propertyRepository.findById(100L)).thenReturn(Optional.of(property));

        when(calendarDayRepository.findByPropertyAndDateRange(anyLong(), any(), any(), anyLong()))
            .thenReturn(List.of());
        when(bookingRestrictionRepository.findApplicable(anyLong(), any(), any(), anyLong()))
            .thenReturn(List.of());
        when(priceEngine.resolvePriceRange(anyLong(), any(), any(), anyLong()))
            .thenReturn(Map.of(FROM, new BigDecimal("333.00")));
        when(channexClient.pushAvailability(any()))
            .thenReturn(new ChannexAriPushResult(List.of("task-avail"), List.of()));
        when(channexClient.pushRates(any()))
            .thenReturn(new ChannexAriPushResult(List.of("task-rates"), List.of()));
    }

    @Test
    @DisplayName("changement de prix -> UN appel rates, AUCUN appel availability")
    void ratesScope_doesNotTouchAvailability() {
        var result = service.processCalendarRange(100L, 42L, FROM, TO, ChannexAriScope.RATES);

        assertThat(result.success()).isTrue();
        verify(channexClient).pushRates(any());
        verify(channexClient, never()).pushAvailability(any());
    }

    @Test
    @DisplayName("blocage de dates -> UN appel availability, AUCUN appel rates")
    void availabilityScope_doesNotTouchRates() {
        var result = service.processCalendarRange(100L, 42L, FROM, TO, ChannexAriScope.AVAILABILITY);

        assertThat(result.success()).isTrue();
        verify(channexClient).pushAvailability(any());
        verify(channexClient, never()).pushRates(any());
    }

    @Test
    @DisplayName("resynchronisation -> les deux appels, comme avant")
    void bothScope_pushesEverything() {
        service.processCalendarRange(100L, 42L, FROM, TO, ChannexAriScope.BOTH);

        verify(channexClient).pushAvailability(any());
        verify(channexClient).pushRates(any());
    }

    @Test
    @DisplayName("l'ancienne signature reste equivalente a BOTH (appelants historiques)")
    void legacySignature_keepsPushingBoth() {
        service.processCalendarRange(100L, 42L, FROM, TO);

        verify(channexClient).pushAvailability(any());
        verify(channexClient).pushRates(any());
    }

    @Test
    @DisplayName("une date SANS restriction porte quand meme toutes les restrictions declarees")
    void unrestrictedDate_stillCarriesEveryDeclaredRestriction() {
        // Le coeur du refus du 2026-08-14 : « 154/181 restriction objects are
        // missing the declared restriction "min_stay_through" ». Un champ nul est
        // omis du payload ; les dates sans restriction explicite doivent donc
        // porter les defauts de la propriete, pas des nuls.
        service.processCalendarRange(100L, 42L, FROM, TO, ChannexAriScope.RATES);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<com.clenzy.integration.channex.dto.ChannexRateUpdate>> captor =
            ArgumentCaptor.forClass(List.class);
        verify(channexClient).pushRates(captor.capture());

        assertThat(captor.getValue()).isNotEmpty().allSatisfy(update -> {
            assertThat(update.minStayThrough()).as("min_stay_through").isNotNull();
            assertThat(update.minStayArrival()).as("min_stay_arrival").isNotNull();
            assertThat(update.closedToArrival()).as("closed_to_arrival").isNotNull();
            assertThat(update.closedToDeparture()).as("closed_to_departure").isNotNull();
            assertThat(update.maxStay()).as("max_stay").isNotNull();
            assertThat(update.stopSell()).as("stop_sell").isNotNull();
        });
    }

    @Test
    @DisplayName("une nuit RESERVEE consomme l'inventaire -> availability 0, sans stop_sell")
    void bookedNight_consumesInventory() {
        when(calendarDayRepository.findByPropertyAndDateRange(anyLong(), any(), any(), anyLong()))
            .thenReturn(List.of(day(FROM, com.clenzy.model.CalendarDayStatus.BOOKED)));

        service.processCalendarRange(100L, 42L, FROM, TO, ChannexAriScope.BOTH);

        assertThat(capturedAvailability())
            .anySatisfy(u -> {
                assertThat(u.date()).isEqualTo(FROM);
                assertThat(u.availability()).isZero();
            });
        assertThat(capturedRates()).allSatisfy(u -> assertThat(u.stopSell()).isFalse());
    }

    @Test
    @DisplayName("une nuit BLOQUEE garde son unite -> availability 1 et stop_sell true")
    void blockedNight_closesSaleWithoutTouchingInventory() {
        // La distinction Channex : availability porte un INVENTAIRE, stop_sell une
        // decision commerciale. Ecrire 0 pour un blocage confondait les deux, et
        // rendait le scenario 6 (Stop Sell) injouable.
        when(calendarDayRepository.findByPropertyAndDateRange(anyLong(), any(), any(), anyLong()))
            .thenReturn(List.of(day(FROM, com.clenzy.model.CalendarDayStatus.BLOCKED)));

        service.processCalendarRange(100L, 42L, FROM, TO, ChannexAriScope.BOTH);

        assertThat(capturedAvailability())
            .allSatisfy(u -> assertThat(u.availability()).isEqualTo(1));
        assertThat(capturedRates())
            .anySatisfy(u -> {
                assertThat(u.date()).isEqualTo(FROM);
                assertThat(u.stopSell()).isTrue();
            });
    }

    @Test
    @DisplayName("la maintenance ferme la vente comme un blocage")
    void maintenanceNight_alsoStopsSale() {
        when(calendarDayRepository.findByPropertyAndDateRange(anyLong(), any(), any(), anyLong()))
            .thenReturn(List.of(day(FROM, com.clenzy.model.CalendarDayStatus.MAINTENANCE)));

        service.processCalendarRange(100L, 42L, FROM, TO, ChannexAriScope.BOTH);

        assertThat(capturedAvailability())
            .allSatisfy(u -> assertThat(u.availability()).isEqualTo(1));
        assertThat(capturedRates())
            .anySatisfy(u -> assertThat(u.stopSell()).isTrue());
    }

    private com.clenzy.model.CalendarDay day(LocalDate date,
                                             com.clenzy.model.CalendarDayStatus status) {
        com.clenzy.model.CalendarDay d = new com.clenzy.model.CalendarDay();
        d.setDate(date);
        d.setStatus(status);
        return d;
    }

    private List<com.clenzy.integration.channex.dto.ChannexAvailabilityUpdate> capturedAvailability() {
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<com.clenzy.integration.channex.dto.ChannexAvailabilityUpdate>> captor =
            ArgumentCaptor.forClass(List.class);
        verify(channexClient).pushAvailability(captor.capture());
        return captor.getValue();
    }

    private List<com.clenzy.integration.channex.dto.ChannexRateUpdate> capturedRates() {
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<com.clenzy.integration.channex.dto.ChannexRateUpdate>> captor =
            ArgumentCaptor.forClass(List.class);
        verify(channexClient).pushRates(captor.capture());
        return captor.getValue();
    }

    @Test
    @DisplayName("les defauts viennent de la propriete, et min_stay_arrival suit min_stay")
    void defaultsComeFromTheProperty() {
        service.processCalendarRange(100L, 42L, FROM, TO, ChannexAriScope.RATES);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<com.clenzy.integration.channex.dto.ChannexRateUpdate>> captor =
            ArgumentCaptor.forClass(List.class);
        verify(channexClient).pushRates(captor.capture());

        var update = captor.getValue().get(0);
        assertThat(update.minStayThrough()).isEqualTo(2);   // propriete : 2 nuits mini
        assertThat(update.minStayArrival()).isEqualTo(2);   // notre modele ne distingue pas
        assertThat(update.maxStay()).isEqualTo(30);         // propriete : 30 nuits maxi
        assertThat(update.closedToArrival()).isFalse();
        assertThat(update.closedToDeparture()).isFalse();
        assertThat(update.stopSell()).isFalse();
    }
}
