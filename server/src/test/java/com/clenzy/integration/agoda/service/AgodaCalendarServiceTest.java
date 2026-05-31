package com.clenzy.integration.agoda.service;

import com.clenzy.integration.agoda.dto.AgodaAvailabilityDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * Unit tests for {@link AgodaCalendarService}.
 *
 * Covers Kafka event dispatch (availability/rate updates), missing data,
 * invalid date/price formats, and currency/allotment defaults.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("AgodaCalendarService")
class AgodaCalendarServiceTest {

    @Mock private AgodaApiClient agodaApiClient;

    private AgodaCalendarService service;

    @BeforeEach
    void setUp() {
        service = new AgodaCalendarService(agodaApiClient);
    }

    private Map<String, Object> event(String type, String eventId, Map<String, Object> data) {
        Map<String, Object> evt = new HashMap<>();
        evt.put("event_type", type);
        evt.put("event_id", eventId);
        evt.put("data", data);
        return evt;
    }

    private Map<String, Object> availabilityData() {
        Map<String, Object> data = new HashMap<>();
        data.put("property_id", "prop-1");
        data.put("room_type_id", "rt-1");
        data.put("date", "2026-07-01");
        data.put("available", true);
        data.put("price", 120.50);
        data.put("currency", "EUR");
        data.put("allotment", 2);
        return data;
    }

    private Map<String, Object> rateData() {
        Map<String, Object> data = new HashMap<>();
        data.put("property_id", "prop-1");
        data.put("room_type_id", "rt-1");
        data.put("from", "2026-07-01");
        data.put("to", "2026-07-31");
        data.put("rate", 150.00);
        data.put("currency", "EUR");
        return data;
    }

    @Nested
    @DisplayName("handleCalendarSync")
    class HandleCalendarSync {

        @Test
        @DisplayName("availability.update -> pushes via api client")
        void whenAvailabilityUpdate_thenCallsApi() {
            service.handleCalendarSync(event("availability.update", "e-1", availabilityData()));

            ArgumentCaptor<List<AgodaAvailabilityDto>> cap =
                ArgumentCaptor.forClass(List.class);
            verify(agodaApiClient).updateAvailability(eq("prop-1"), cap.capture());
            assertThat(cap.getValue()).hasSize(1);
            assertThat(cap.getValue().get(0).propertyId()).isEqualTo("prop-1");
            assertThat(cap.getValue().get(0).price()).isEqualByComparingTo(new BigDecimal("120.50"));
        }

        @Test
        @DisplayName("rate.update -> pushes rates via api client")
        void whenRateUpdate_thenCallsApi() {
            service.handleCalendarSync(event("rate.update", "e-2", rateData()));

            verify(agodaApiClient).updateRates(
                eq("prop-1"), eq("rt-1"),
                eq(LocalDate.of(2026, 7, 1)),
                eq(LocalDate.of(2026, 7, 31)),
                eq(BigDecimal.valueOf(150.0)),
                eq("EUR"));
        }

        @Test
        @DisplayName("data null -> no api call")
        void whenNoData_thenSkips() {
            Map<String, Object> evt = new HashMap<>();
            evt.put("event_type", "availability.update");
            evt.put("event_id", "e-0");
            // no data field

            service.handleCalendarSync(evt);

            verify(agodaApiClient, never()).updateAvailability(anyString(), any());
            verify(agodaApiClient, never()).updateRates(any(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("event_type inconnu -> no api call")
        void whenUnknownEventType_thenSkips() {
            service.handleCalendarSync(event("rate.delete", "e-3", rateData()));

            verify(agodaApiClient, never()).updateAvailability(anyString(), any());
            verify(agodaApiClient, never()).updateRates(any(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("exception interne ne propage pas (catch)")
        void whenInternalException_thenDoesntPropagate() {
            org.mockito.Mockito.doThrow(new RuntimeException("api down"))
                .when(agodaApiClient).updateAvailability(anyString(), any());

            service.handleCalendarSync(event("availability.update", "e-x", availabilityData()));
        }
    }

    @Nested
    @DisplayName("availability missing fields")
    class AvailabilityMissingFields {

        @Test
        @DisplayName("property_id manquant -> skip + no api call")
        void whenPropertyIdMissing_thenSkips() {
            Map<String, Object> data = availabilityData();
            data.remove("property_id");

            service.handleCalendarSync(event("availability.update", "e", data));
            verify(agodaApiClient, never()).updateAvailability(anyString(), any());
        }

        @Test
        @DisplayName("date manquante -> skip")
        void whenDateMissing_thenSkips() {
            Map<String, Object> data = availabilityData();
            data.remove("date");

            service.handleCalendarSync(event("availability.update", "e", data));
            verify(agodaApiClient, never()).updateAvailability(anyString(), any());
        }

        @Test
        @DisplayName("available manquant -> skip")
        void whenAvailableMissing_thenSkips() {
            Map<String, Object> data = availabilityData();
            data.remove("available");

            service.handleCalendarSync(event("availability.update", "e", data));
            verify(agodaApiClient, never()).updateAvailability(anyString(), any());
        }

        @Test
        @DisplayName("date invalide -> skip (date null apres parsing)")
        void whenDateInvalid_thenSkips() {
            Map<String, Object> data = availabilityData();
            data.put("date", "not-a-date");

            service.handleCalendarSync(event("availability.update", "e", data));
            verify(agodaApiClient, never()).updateAvailability(anyString(), any());
        }

        @Test
        @DisplayName("currency manquante -> defaut EUR")
        void whenCurrencyMissing_thenDefaultsEur() {
            Map<String, Object> data = availabilityData();
            data.remove("currency");

            service.handleCalendarSync(event("availability.update", "e", data));

            ArgumentCaptor<List<AgodaAvailabilityDto>> cap =
                ArgumentCaptor.forClass(List.class);
            verify(agodaApiClient).updateAvailability(eq("prop-1"), cap.capture());
            assertThat(cap.getValue().get(0).currency()).isEqualTo("EUR");
        }

        @Test
        @DisplayName("allotment manquant -> defaut 1")
        void whenAllotmentMissing_thenDefaultsOne() {
            Map<String, Object> data = availabilityData();
            data.remove("allotment");

            service.handleCalendarSync(event("availability.update", "e", data));

            ArgumentCaptor<List<AgodaAvailabilityDto>> cap =
                ArgumentCaptor.forClass(List.class);
            verify(agodaApiClient).updateAvailability(eq("prop-1"), cap.capture());
            assertThat(cap.getValue().get(0).allotment()).isEqualTo(1);
        }

        @Test
        @DisplayName("price string parsable -> ok")
        void whenPriceString_thenParses() {
            Map<String, Object> data = availabilityData();
            data.put("price", "99.99");

            service.handleCalendarSync(event("availability.update", "e", data));

            ArgumentCaptor<List<AgodaAvailabilityDto>> cap =
                ArgumentCaptor.forClass(List.class);
            verify(agodaApiClient).updateAvailability(eq("prop-1"), cap.capture());
            assertThat(cap.getValue().get(0).price()).isEqualByComparingTo(new BigDecimal("99.99"));
        }

        @Test
        @DisplayName("price string invalide -> null")
        void whenPriceInvalid_thenNull() {
            Map<String, Object> data = availabilityData();
            data.put("price", "not-a-number");

            service.handleCalendarSync(event("availability.update", "e", data));

            ArgumentCaptor<List<AgodaAvailabilityDto>> cap =
                ArgumentCaptor.forClass(List.class);
            verify(agodaApiClient).updateAvailability(eq("prop-1"), cap.capture());
            assertThat(cap.getValue().get(0).price()).isNull();
        }
    }

    @Nested
    @DisplayName("rate missing fields")
    class RateMissingFields {

        @Test
        @DisplayName("property_id manquant -> skip")
        void whenPropertyIdMissing_thenSkips() {
            Map<String, Object> data = rateData();
            data.remove("property_id");

            service.handleCalendarSync(event("rate.update", "e", data));
            verify(agodaApiClient, never()).updateRates(any(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("from missing -> skip")
        void whenFromMissing_thenSkips() {
            Map<String, Object> data = rateData();
            data.remove("from");

            service.handleCalendarSync(event("rate.update", "e", data));
            verify(agodaApiClient, never()).updateRates(any(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("to missing -> skip")
        void whenToMissing_thenSkips() {
            Map<String, Object> data = rateData();
            data.remove("to");

            service.handleCalendarSync(event("rate.update", "e", data));
            verify(agodaApiClient, never()).updateRates(any(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("rate missing -> skip")
        void whenRateMissing_thenSkips() {
            Map<String, Object> data = rateData();
            data.remove("rate");

            service.handleCalendarSync(event("rate.update", "e", data));
            verify(agodaApiClient, never()).updateRates(any(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("currency missing -> defaut EUR")
        void whenCurrencyMissing_thenDefaultsEur() {
            Map<String, Object> data = rateData();
            data.remove("currency");

            service.handleCalendarSync(event("rate.update", "e", data));

            verify(agodaApiClient).updateRates(
                any(), any(), any(), any(), any(), eq("EUR"));
        }
    }
}
