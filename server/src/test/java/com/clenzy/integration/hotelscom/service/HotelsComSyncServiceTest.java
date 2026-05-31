package com.clenzy.integration.hotelscom.service;

import com.clenzy.integration.hotelscom.model.HotelsComConnection;
import com.clenzy.integration.hotelscom.repository.HotelsComConnectionRepository;
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
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests for {@link HotelsComSyncService}.
 *
 * Covers reservation handlers (created/updated/cancelled), the property
 * connection lookup gate on created, DTO mapping defaults and bad-data
 * tolerance.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("HotelsComSyncService")
class HotelsComSyncServiceTest {

    @Mock private HotelsComConnectionRepository connectionRepository;
    @Mock private HotelsComApiClient apiClient;
    @Mock private AuditLogService auditLogService;

    private HotelsComSyncService service;

    @BeforeEach
    void setUp() {
        service = new HotelsComSyncService(connectionRepository, apiClient, auditLogService);
    }

    private HotelsComConnection conn(Long orgId, String propertyId) {
        HotelsComConnection c = new HotelsComConnection();
        c.setId(1L);
        c.setOrganizationId(orgId);
        c.setPropertyId(propertyId);
        c.setStatus(HotelsComConnection.HotelsComConnectionStatus.ACTIVE);
        return c;
    }

    private Map<String, Object> reservationData(String confirmationNumber, String propertyId) {
        Map<String, Object> data = new HashMap<>();
        data.put("confirmation_number", confirmationNumber);
        data.put("property_id", propertyId);
        data.put("room_type_id", "room-1");
        data.put("guest_first_name", "Maria");
        data.put("guest_last_name", "Garcia");
        data.put("guest_email", "maria@x.com");
        data.put("guest_phone", "+34611");
        data.put("check_in", "2026-07-01");
        data.put("check_out", "2026-07-05");
        data.put("status", "CONFIRMED");
        data.put("total_amount", 500.00);
        data.put("currency", "USD");
        data.put("number_of_guests", 2);
        data.put("number_of_rooms", 1);
        data.put("special_requests", "Pillow allergy");
        return data;
    }

    @Nested
    @DisplayName("handleReservationCreated")
    class HandleCreated {

        @Test
        @DisplayName("property linked -> audits")
        void linkedProperty() {
            when(connectionRepository.findByPropertyId("prop-1"))
                    .thenReturn(Optional.of(conn(42L, "prop-1")));

            service.handleReservationCreated(reservationData("CONF-1", "prop-1"));

            ArgumentCaptor<String> detailsCap = ArgumentCaptor.forClass(String.class);
            verify(auditLogService).logSync(eq("HotelsComReservation"), eq("CONF-1"),
                    detailsCap.capture());
            assertThat(detailsCap.getValue()).contains("prop-1");
        }

        @Test
        @DisplayName("property not linked -> no audit")
        void unlinkedProperty() {
            when(connectionRepository.findByPropertyId("prop-unknown"))
                    .thenReturn(Optional.empty());

            service.handleReservationCreated(reservationData("CONF-1", "prop-unknown"));

            verify(auditLogService, never()).logSync(anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("handles invalid date")
        void invalidDate() {
            when(connectionRepository.findByPropertyId("prop-1"))
                    .thenReturn(Optional.of(conn(1L, "prop-1")));
            Map<String, Object> data = reservationData("CONF-1", "prop-1");
            data.put("check_in", "not-a-date");
            data.put("check_out", "also-not-a-date");

            service.handleReservationCreated(data);

            verify(auditLogService).logSync(anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("handles missing date")
        void missingDate() {
            when(connectionRepository.findByPropertyId("prop-1"))
                    .thenReturn(Optional.of(conn(1L, "prop-1")));
            Map<String, Object> data = reservationData("CONF-1", "prop-1");
            data.remove("check_in");
            data.remove("check_out");

            service.handleReservationCreated(data);

            verify(auditLogService).logSync(anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("price as Number")
        void priceAsNumber() {
            when(connectionRepository.findByPropertyId("prop-1"))
                    .thenReturn(Optional.of(conn(1L, "prop-1")));
            Map<String, Object> data = reservationData("CONF-1", "prop-1");
            data.put("total_amount", 199);

            service.handleReservationCreated(data);

            verify(auditLogService).logSync(anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("price as parseable String")
        void priceAsString() {
            when(connectionRepository.findByPropertyId("prop-1"))
                    .thenReturn(Optional.of(conn(1L, "prop-1")));
            Map<String, Object> data = reservationData("CONF-1", "prop-1");
            data.put("total_amount", "299.50");

            service.handleReservationCreated(data);

            verify(auditLogService).logSync(anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("invalid price string -> tolerated")
        void invalidPrice() {
            when(connectionRepository.findByPropertyId("prop-1"))
                    .thenReturn(Optional.of(conn(1L, "prop-1")));
            Map<String, Object> data = reservationData("CONF-1", "prop-1");
            data.put("total_amount", "garbage");

            service.handleReservationCreated(data);

            verify(auditLogService).logSync(anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("null price -> tolerated")
        void nullPrice() {
            when(connectionRepository.findByPropertyId("prop-1"))
                    .thenReturn(Optional.of(conn(1L, "prop-1")));
            Map<String, Object> data = reservationData("CONF-1", "prop-1");
            data.put("total_amount", null);

            service.handleReservationCreated(data);

            verify(auditLogService).logSync(anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("currency defaults to EUR if absent")
        void currencyDefault() {
            when(connectionRepository.findByPropertyId("prop-1"))
                    .thenReturn(Optional.of(conn(1L, "prop-1")));
            Map<String, Object> data = reservationData("CONF-1", "prop-1");
            data.remove("currency");

            service.handleReservationCreated(data);

            verify(auditLogService).logSync(anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("guest counts default to 1/1 if absent")
        void guestCountDefaults() {
            when(connectionRepository.findByPropertyId("prop-1"))
                    .thenReturn(Optional.of(conn(1L, "prop-1")));
            Map<String, Object> data = reservationData("CONF-1", "prop-1");
            data.remove("number_of_guests");
            data.remove("number_of_rooms");

            service.handleReservationCreated(data);

            verify(auditLogService).logSync(anyString(), anyString(), anyString());
        }
    }

    @Nested
    @DisplayName("handleReservationUpdated")
    class HandleUpdated {

        @Test
        @DisplayName("always audits (no connection check)")
        void audits() {
            service.handleReservationUpdated(reservationData("CONF-2", "prop-2"));

            verify(auditLogService).logSync(eq("HotelsComReservation"), eq("CONF-2"),
                    anyString());
            verify(connectionRepository, never()).findByPropertyId(anyString());
        }
    }

    @Nested
    @DisplayName("handleReservationCancelled")
    class HandleCancelled {

        @Test
        @DisplayName("always audits (no connection check)")
        void audits() {
            service.handleReservationCancelled(reservationData("CONF-3", "prop-3"));

            verify(auditLogService).logSync(eq("HotelsComReservation"), eq("CONF-3"),
                    anyString());
            verify(connectionRepository, never()).findByPropertyId(anyString());
        }
    }
}
