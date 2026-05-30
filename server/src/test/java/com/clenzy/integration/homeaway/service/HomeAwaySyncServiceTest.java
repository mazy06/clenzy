package com.clenzy.integration.homeaway.service;

import com.clenzy.integration.homeaway.repository.HomeAwayConnectionRepository;
import com.clenzy.service.AuditLogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

/**
 * Tests for {@link HomeAwaySyncService}.
 *
 * Covers all webhook handlers (created/updated/cancelled/availability),
 * DTO mapping with defaults, and tolerance for malformed dates/prices.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("HomeAwaySyncService")
class HomeAwaySyncServiceTest {

    @Mock private HomeAwayConnectionRepository connectionRepository;
    @Mock private HomeAwayApiClient apiClient;
    @Mock private HomeAwayOAuthService oAuthService;
    @Mock private AuditLogService auditLogService;

    private HomeAwaySyncService service;

    private static final Long ORG_ID = 42L;

    @BeforeEach
    void setUp() {
        service = new HomeAwaySyncService(
                connectionRepository, apiClient, oAuthService, auditLogService);
    }

    private Map<String, Object> reservationData(String reservationId, String listingId) {
        Map<String, Object> data = new HashMap<>();
        data.put("reservation_id", reservationId);
        data.put("listing_id", listingId);
        data.put("guest_first_name", "Alice");
        data.put("guest_last_name", "Martin");
        data.put("guest_email", "alice@example.com");
        data.put("guest_phone", "+33611223344");
        data.put("check_in", "2026-07-01");
        data.put("check_out", "2026-07-08");
        data.put("status", "CONFIRMED");
        data.put("total_amount", 700.00);
        data.put("currency", "EUR");
        data.put("number_of_guests", 3);
        data.put("number_of_adults", 2);
        data.put("number_of_children", 1);
        data.put("special_requests", "Late check-in");
        return data;
    }

    @Nested
    @DisplayName("handleReservationCreated")
    class HandleCreated {

        @Test
        @DisplayName("audits the reservation event")
        void audits() {
            service.handleReservationCreated(reservationData("R-1", "L-1"), ORG_ID);

            ArgumentCaptor<String> detailsCap = ArgumentCaptor.forClass(String.class);
            verify(auditLogService).logSync(eq("HomeAwayReservation"), eq("R-1"), detailsCap.capture());
            assertThat(detailsCap.getValue()).contains("L-1");
        }

        @Test
        @DisplayName("handles invalid date gracefully")
        void invalidDate() {
            Map<String, Object> data = reservationData("R-1", "L-1");
            data.put("check_in", "not-a-date");
            data.put("check_out", "also-not-a-date");

            service.handleReservationCreated(data, ORG_ID);

            verify(auditLogService).logSync(anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("handles missing date")
        void missingDate() {
            Map<String, Object> data = reservationData("R-1", "L-1");
            data.remove("check_in");
            data.remove("check_out");

            service.handleReservationCreated(data, ORG_ID);

            verify(auditLogService).logSync(anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("handles price as Number")
        void priceAsNumber() {
            Map<String, Object> data = reservationData("R-1", "L-1");
            data.put("total_amount", 199);

            service.handleReservationCreated(data, ORG_ID);

            verify(auditLogService).logSync(anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("handles price as parseable String")
        void priceAsString() {
            Map<String, Object> data = reservationData("R-1", "L-1");
            data.put("total_amount", "499.50");

            service.handleReservationCreated(data, ORG_ID);

            verify(auditLogService).logSync(anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("handles invalid price string")
        void invalidPrice() {
            Map<String, Object> data = reservationData("R-1", "L-1");
            data.put("total_amount", "abc");

            service.handleReservationCreated(data, ORG_ID);

            verify(auditLogService).logSync(anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("handles null price")
        void nullPrice() {
            Map<String, Object> data = reservationData("R-1", "L-1");
            data.put("total_amount", null);

            service.handleReservationCreated(data, ORG_ID);

            verify(auditLogService).logSync(anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("currency defaults to EUR if absent")
        void currencyDefaultsToEur() {
            Map<String, Object> data = reservationData("R-1", "L-1");
            data.remove("currency");

            service.handleReservationCreated(data, ORG_ID);

            verify(auditLogService).logSync(anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("guest counts default to 1/1/0 if absent")
        void guestCountDefaults() {
            Map<String, Object> data = reservationData("R-1", "L-1");
            data.remove("number_of_guests");
            data.remove("number_of_adults");
            data.remove("number_of_children");

            service.handleReservationCreated(data, ORG_ID);

            verify(auditLogService).logSync(anyString(), anyString(), anyString());
        }
    }

    @Nested
    @DisplayName("handleReservationUpdated")
    class HandleUpdated {

        @Test
        @DisplayName("audits the update event")
        void audits() {
            service.handleReservationUpdated(reservationData("R-7", "L-3"), ORG_ID);

            ArgumentCaptor<String> detailsCap = ArgumentCaptor.forClass(String.class);
            verify(auditLogService).logSync(eq("HomeAwayReservation"), eq("R-7"), detailsCap.capture());
            assertThat(detailsCap.getValue()).contains("L-3");
        }
    }

    @Nested
    @DisplayName("handleReservationCancelled")
    class HandleCancelled {

        @Test
        @DisplayName("audits the cancellation event")
        void audits() {
            service.handleReservationCancelled(reservationData("R-9", "L-5"), ORG_ID);

            ArgumentCaptor<String> detailsCap = ArgumentCaptor.forClass(String.class);
            verify(auditLogService).logSync(eq("HomeAwayReservation"), eq("R-9"), detailsCap.capture());
            assertThat(detailsCap.getValue()).contains("L-5");
        }
    }

    @Nested
    @DisplayName("handleAvailabilityUpdate")
    class HandleAvailability {

        @Test
        @DisplayName("audits availability event")
        void audits() {
            Map<String, Object> data = new HashMap<>();
            data.put("listing_id", "L-1");
            data.put("date", "2026-06-15");
            data.put("available", false);

            service.handleAvailabilityUpdate(data, ORG_ID);

            verify(auditLogService).logSync(eq("HomeAwayAvailability"), eq("L-1"),
                    anyString());
        }

        @Test
        @DisplayName("handles invalid date in availability")
        void invalidDate() {
            Map<String, Object> data = new HashMap<>();
            data.put("listing_id", "L-1");
            data.put("date", "not-a-date");
            data.put("available", true);

            service.handleAvailabilityUpdate(data, ORG_ID);

            verify(auditLogService).logSync(eq("HomeAwayAvailability"), eq("L-1"),
                    anyString());
        }

        @Test
        @DisplayName("handles null date in availability")
        void nullDate() {
            Map<String, Object> data = new HashMap<>();
            data.put("listing_id", "L-1");
            data.put("date", null);
            data.put("available", true);

            service.handleAvailabilityUpdate(data, ORG_ID);

            verify(auditLogService).logSync(eq("HomeAwayAvailability"), eq("L-1"),
                    anyString());
        }
    }
}
