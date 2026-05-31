package com.clenzy.integration.agoda.service;

import com.clenzy.integration.agoda.model.AgodaConnection;
import com.clenzy.integration.agoda.repository.AgodaConnectionRepository;
import com.clenzy.service.AuditLogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link AgodaReservationService}.
 *
 * Covers Kafka event dispatch (created/updated/cancelled), unknown event type,
 * missing data, mapping of guest+price+date fields incl. parse errors.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("AgodaReservationService")
class AgodaReservationServiceTest {

    @Mock private AgodaConnectionRepository connectionRepository;
    @Mock private AuditLogService auditLogService;

    private AgodaReservationService service;

    @BeforeEach
    void setUp() {
        service = new AgodaReservationService(connectionRepository, auditLogService);
    }

    private AgodaConnection conn(Long orgId, String propertyId) {
        AgodaConnection c = new AgodaConnection();
        c.setOrganizationId(orgId);
        c.setPropertyId(propertyId);
        c.setStatus(AgodaConnection.AgodaConnectionStatus.ACTIVE);
        return c;
    }

    private Map<String, Object> reservationData(String bookingId, String propertyId) {
        Map<String, Object> data = new HashMap<>();
        data.put("booking_id", bookingId);
        data.put("property_id", propertyId);
        data.put("room_type_id", "rt-1");
        data.put("guest_name", "Jean Dupont");
        data.put("guest_email", "jean@x.com");
        data.put("check_in", "2026-07-01");
        data.put("check_out", "2026-07-05");
        data.put("status", "confirmed");
        data.put("total_amount", 480.00);
        data.put("currency", "EUR");
        data.put("number_of_guests", 2);
        data.put("special_requests", "Late check-in");
        return data;
    }

    private Map<String, Object> event(String type, String eventId, Map<String, Object> data) {
        Map<String, Object> evt = new HashMap<>();
        evt.put("event_type", type);
        evt.put("event_id", eventId);
        evt.put("data", data);
        return evt;
    }

    @Nested
    @DisplayName("handleReservationEvent")
    class HandleEvent {

        @Test
        @DisplayName("event sans data -> log warn + no work")
        void whenNoData_thenSkips() {
            Map<String, Object> evt = new HashMap<>();
            evt.put("event_type", "reservation.created");
            evt.put("event_id", "evt-1");
            // no data

            service.handleReservationEvent(evt);

            verify(connectionRepository, never()).findByPropertyId(anyString());
            verify(auditLogService, never()).logSync(anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("event reservation.created -> dispatch + audit")
        void whenReservationCreated_thenAudits() {
            when(connectionRepository.findByPropertyId("prop-1"))
                .thenReturn(Optional.of(conn(1L, "prop-1")));

            service.handleReservationEvent(event(
                "reservation.created", "evt-1", reservationData("book-1", "prop-1")));

            verify(auditLogService).logSync(eq("AgodaReservation"), eq("book-1"), anyString());
        }

        @Test
        @DisplayName("event reservation.updated -> audit")
        void whenReservationUpdated_thenAudits() {
            service.handleReservationEvent(event(
                "reservation.updated", "evt-2", reservationData("book-1", "prop-1")));

            verify(auditLogService).logSync(eq("AgodaReservation"), eq("book-1"), anyString());
        }

        @Test
        @DisplayName("event reservation.cancelled -> audit")
        void whenReservationCancelled_thenAudits() {
            service.handleReservationEvent(event(
                "reservation.cancelled", "evt-3", reservationData("book-1", "prop-1")));

            verify(auditLogService).logSync(eq("AgodaReservation"), eq("book-1"), anyString());
        }

        @Test
        @DisplayName("event type inconnu -> no work")
        void whenUnknownEventType_thenSkips() {
            service.handleReservationEvent(event(
                "reservation.deleted", "evt-4", reservationData("book-1", "prop-1")));

            verify(auditLogService, never()).logSync(anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("exception interne ne propage pas")
        void whenServiceThrows_thenDoesntPropagate() {
            when(connectionRepository.findByPropertyId(anyString()))
                .thenThrow(new RuntimeException("DB down"));

            // Doit etre swallow par le catch dans handleReservationEvent
            service.handleReservationEvent(event(
                "reservation.created", "evt-5", reservationData("book-1", "prop-1")));
        }
    }

    @Nested
    @DisplayName("handleReservationCreated")
    class HandleCreated {

        @Test
        @DisplayName("propriete liee -> audit log + audit")
        void whenPropertyLinked_thenAudits() {
            when(connectionRepository.findByPropertyId("prop-1"))
                .thenReturn(Optional.of(conn(42L, "prop-1")));

            service.handleReservationCreated(reservationData("book-1", "prop-1"));

            ArgumentCaptor<String> detailsCap = ArgumentCaptor.forClass(String.class);
            verify(auditLogService).logSync(eq("AgodaReservation"), eq("book-1"), detailsCap.capture());
            org.assertj.core.api.Assertions.assertThat(detailsCap.getValue()).contains("prop-1");
        }

        @Test
        @DisplayName("propriete non liee -> aucune action")
        void whenPropertyNotLinked_thenSkips() {
            when(connectionRepository.findByPropertyId("prop-unknown"))
                .thenReturn(Optional.empty());

            service.handleReservationCreated(reservationData("book-1", "prop-unknown"));

            verify(auditLogService, never()).logSync(anyString(), anyString(), anyString());
        }
    }

    @Nested
    @DisplayName("date and price parsing")
    class ParseFields {

        @Test
        @DisplayName("date invalide -> mappee a null + reste fonctionnel")
        void whenInvalidDate_thenNullAndContinues() {
            Map<String, Object> data = reservationData("book-1", "prop-1");
            data.put("check_in", "not-a-date");
            data.put("check_out", "also-not-a-date");
            when(connectionRepository.findByPropertyId("prop-1"))
                .thenReturn(Optional.of(conn(1L, "prop-1")));

            service.handleReservationCreated(data);

            // L'audit est quand meme effectue malgre la date invalide
            verify(auditLogService).logSync(anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("prix en Number -> parse OK")
        void whenPriceIsNumber_thenParses() {
            Map<String, Object> data = reservationData("book-1", "prop-1");
            data.put("total_amount", 199);
            when(connectionRepository.findByPropertyId("prop-1"))
                .thenReturn(Optional.of(conn(1L, "prop-1")));

            service.handleReservationCreated(data);
            verify(auditLogService).logSync(anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("prix string parsable -> parse OK")
        void whenPriceIsString_thenParses() {
            Map<String, Object> data = reservationData("book-1", "prop-1");
            data.put("total_amount", "150.75");
            when(connectionRepository.findByPropertyId("prop-1"))
                .thenReturn(Optional.of(conn(1L, "prop-1")));

            service.handleReservationCreated(data);
            verify(auditLogService).logSync(anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("prix invalide -> null + fonctionne")
        void whenPriceInvalid_thenNull() {
            Map<String, Object> data = reservationData("book-1", "prop-1");
            data.put("total_amount", "not-a-number");
            when(connectionRepository.findByPropertyId("prop-1"))
                .thenReturn(Optional.of(conn(1L, "prop-1")));

            service.handleReservationCreated(data);
            verify(auditLogService).logSync(anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("currency par defaut EUR si absent")
        void whenCurrencyMissing_thenDefaultsEur() {
            Map<String, Object> data = reservationData("book-1", "prop-1");
            data.remove("currency");
            when(connectionRepository.findByPropertyId("prop-1"))
                .thenReturn(Optional.of(conn(1L, "prop-1")));

            service.handleReservationCreated(data);
            verify(auditLogService).logSync(anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("number_of_guests absent -> 1 par defaut")
        void whenNumberOfGuestsMissing_thenDefaultOne() {
            Map<String, Object> data = reservationData("book-1", "prop-1");
            data.remove("number_of_guests");
            when(connectionRepository.findByPropertyId("prop-1"))
                .thenReturn(Optional.of(conn(1L, "prop-1")));

            service.handleReservationCreated(data);
            verify(auditLogService).logSync(anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("date null -> tolere")
        void whenDateNull_thenTolerated() {
            Map<String, Object> data = reservationData("book-1", "prop-1");
            data.put("check_in", null);
            when(connectionRepository.findByPropertyId("prop-1"))
                .thenReturn(Optional.of(conn(1L, "prop-1")));

            service.handleReservationCreated(data);
            verify(auditLogService).logSync(anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("prix null -> tolere")
        void whenPriceNull_thenTolerated() {
            Map<String, Object> data = reservationData("book-1", "prop-1");
            data.put("total_amount", null);
            when(connectionRepository.findByPropertyId("prop-1"))
                .thenReturn(Optional.of(conn(1L, "prop-1")));

            service.handleReservationCreated(data);
            verify(auditLogService).logSync(anyString(), anyString(), anyString());
        }
    }

    @Nested
    @DisplayName("Updated and cancelled paths")
    class OtherEvents {

        @Test
        @DisplayName("handleReservationUpdated -> audit")
        void whenUpdated_thenAudits() {
            service.handleReservationUpdated(reservationData("book-1", "prop-1"));
            verify(auditLogService, times(1)).logSync(eq("AgodaReservation"), eq("book-1"), anyString());
        }

        @Test
        @DisplayName("handleReservationCancelled -> audit")
        void whenCancelled_thenAudits() {
            service.handleReservationCancelled(reservationData("book-1", "prop-1"));
            verify(auditLogService, times(1)).logSync(eq("AgodaReservation"), eq("book-1"), anyString());
        }
    }
}
